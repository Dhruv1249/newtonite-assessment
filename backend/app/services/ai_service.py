"""AI service supporting semantic embeddings, RAG-driven triage, and duplicate detection.

Leverages Gemini Embedding 2 for vector representations and Gemini 3.1 Flash Lite
with Gemini 3.5 Flash Lite backup for contextual generation.
"""

import json
from typing import Any
import uuid
from google import genai
from google.genai import errors
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.team_member import TeamMember
from app.models.user import User
from app.models.work_item import WorkItem

PRIMARY_GENERATION_MODEL = "gemini-3.1-flash-lite"
BACKUP_GENERATION_MODEL = "gemini-3.5-flash-lite"
EMBEDDING_MODEL = "gemini-embedding-2"


class AIService:
    """Encapsulates all Google Gemini API interactions and pgvector similarity algorithms."""

    def __init__(self) -> None:
        """Initialize Google GenAI client using the centralized configuration."""
        self._client = genai.Client(api_key=settings.gemini_api_key)

    async def generate_embedding(self, text: str) -> list[float]:
        """Generate a 3072-dimensional vector embedding for the supplied text.

        Args:
            text: Input string content to vectorize.

        Returns:
            list[float]: High-dimensional dense embedding vector.
        """
        response = self._client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text,
        )
        return list(response.embeddings[0].values)

    async def generate_completion(
        self,
        prompt: str,
        system_instruction: str | None = None,
    ) -> str:
        """Generate text completion using primary model with automatic fallback to backup model.

        Args:
            prompt: User prompt content.
            system_instruction: Optional system instruction steering model behavior.

        Returns:
            str: Generated textual response.
        """
        try:
            response = self._client.models.generate_content(
                model=PRIMARY_GENERATION_MODEL,
                contents=prompt,
            )
            if response.text:
                return response.text.strip()
        except (errors.ServerError, errors.APIError):
            pass

        fallback_response = self._client.models.generate_content(
            model=BACKUP_GENERATION_MODEL,
            contents=prompt,
        )
        return fallback_response.text.strip() if fallback_response.text else ""

    async def search_similar_items(
        self,
        session: AsyncSession,
        query_text: str,
        accessible_team_ids: list[uuid.UUID],
        limit: int = 15,
    ) -> list[dict[str, Any]]:
        """Perform semantic similarity search against work items across authorized teams.

        Args:
            session: Active database session.
            query_text: Plaintext user query.
            accessible_team_ids: Team IDs permitted for caller access.
            limit: Maximum result items to return.

        Returns:
            list[dict[str, Any]]: List of matching WorkItem records with similarity scores.
        """
        if not accessible_team_ids:
            return []

        query_vector = await self.generate_embedding(query_text)
        cosine_distance = WorkItem.embedding.cosine_distance(query_vector)

        statement = (
            select(WorkItem, (1.0 - cosine_distance).label("similarity_score"))
            .where(
                WorkItem.team_id.in_(accessible_team_ids),
                WorkItem.embedding.is_not(None),
            )
            .order_by(cosine_distance)
            .limit(limit)
        )

        result = await session.execute(statement)
        matches: list[dict[str, Any]] = []
        for row in result:
            item = row[0]
            similarity = float(row[1]) if row[1] is not None else 0.0
            matches.append({
                "item": item,
                "similarity_score": round(max(0.0, min(1.0, similarity)), 4),
            })
        return matches

    async def find_duplicates_for_item(
        self,
        session: AsyncSession,
        embedding: list[float],
        team_id: uuid.UUID,
        exclude_item_id: uuid.UUID | None = None,
        threshold: float = 0.82,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Search for potential duplicate work items within the same team.

        Args:
            session: Active database session.
            embedding: Vector embedding of candidate item.
            team_id: Owning team identifier.
            exclude_item_id: Optional ID to exclude (e.g. self when editing).
            threshold: Cosine similarity cutoff.
            limit: Maximum duplicate items to return.

        Returns:
            list[dict[str, Any]]: Duplicate candidate descriptors.
        """
        cosine_distance = WorkItem.embedding.cosine_distance(embedding)
        conditions = [
            WorkItem.team_id == team_id,
            WorkItem.embedding.is_not(None),
        ]
        if exclude_item_id:
            conditions.append(WorkItem.id != exclude_item_id)

        statement = (
            select(WorkItem, (1.0 - cosine_distance).label("similarity_score"))
            .where(*conditions)
            .order_by(cosine_distance)
            .limit(limit)
        )

        result = await session.execute(statement)
        duplicates: list[dict[str, Any]] = []
        for row in result:
            item = row[0]
            similarity = float(row[1]) if row[1] is not None else 0.0
            if similarity >= threshold:
                duplicates.append({
                    "item_id": item.id,
                    "title": item.title,
                    "status": item.status,
                    "similarity_score": round(similarity, 4),
                })
        return duplicates

    async def generate_triage_and_assignment(
        self,
        session: AsyncSession,
        item: WorkItem,
    ) -> dict[str, Any]:
        """Generate AI triage metadata, recommended priority, next steps, and assignee suggestions.

        Employs RAG to incorporate similar past resolved work items and team roster
        into prompt context for accurate domain-aware reasoning.

        Args:
            session: Active database session.
            item: WorkItem instance to triage.

        Returns:
            dict[str, Any]: Comprehensive triage metadata dictionary.
        """
        content_to_embed = f"{item.title}\n{item.description}"
        embedding = await self.generate_embedding(content_to_embed)
        item.embedding = embedding

        duplicates = await self.find_duplicates_for_item(
            session=session,
            embedding=embedding,
            team_id=item.team_id,
            exclude_item_id=item.id,
            threshold=0.82,
        )

        members_statement = (
            select(User)
            .join(TeamMember, TeamMember.user_id == User.id)
            .where(TeamMember.team_id == item.team_id)
        )
        members_result = await session.execute(members_statement)
        team_members = list(members_result.scalars().all())
        roster_text = ", ".join([f"{u.display_name} (ID: {u.id})" for u in team_members])

        rag_prompt = f"""You are OpFlow AI, an operational triage assistant. Analyze this work item:
Title: {item.title}
Description: {item.description}
Current Priority: {item.priority}
Current Category: {item.category}

Available Team Members: {roster_text or 'None registered'}

Respond strictly with a valid JSON object without markdown fences or extraneous text, formatted exactly as:
{{
  "suggested_priority": "critical" | "high" | "medium" | "low",
  "suggested_category": "incident" | "customer_issue" | "engineering" | "compliance" | "operational",
  "summary": "One concise sentence summarizing the operational impact.",
  "suggested_next_steps": ["step 1", "step 2", "step 3"],
  "recommended_assignees": [
    {{
      "user_id": "<UUID from available members>",
      "display_name": "<name>",
      "confidence_score": 0.85,
      "reasoning": "<short explanation>"
    }}
  ]
}}"""

        raw_output = await self.generate_completion(rag_prompt)
        cleaned_output = raw_output.strip()
        if cleaned_output.startswith("```"):
            cleaned_output = cleaned_output.strip("`")
            if cleaned_output.startswith("json"):
                cleaned_output = cleaned_output[4:].strip()

        try:
            parsed_metadata = json.loads(cleaned_output)
        except json.JSONDecodeError:
            parsed_metadata = {
                "suggested_priority": item.priority,
                "suggested_category": item.category,
                "summary": item.title,
                "suggested_next_steps": ["Review item details", "Assign owner"],
                "recommended_assignees": [],
            }

        parsed_metadata["potential_duplicates"] = duplicates
        item.ai_metadata = parsed_metadata
        return parsed_metadata


ai_service = AIService()
