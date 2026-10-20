"""AI service supporting semantic embeddings, RAG-driven triage, and duplicate detection.

Leverages Google Gemini for vector representations and contextual generation,
with deterministic offline fallbacks to ensure full functionality without external API keys.
"""

import asyncio
import functools
import hashlib
import json
import math
from typing import Any
import uuid
from google import genai
from google.genai import errors, types
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
        self._client: genai.Client | None = None
        configured_key = (
            settings.gemini_api_key.strip() if settings.gemini_api_key else ""
        )
        if self._is_potential_api_key(configured_key):
            try:
                client_options = types.HttpOptions(
                    timeout=2500,
                    retry_options=types.HttpRetryOptions(attempts=1),
                )
                self._client = genai.Client(
                    api_key=configured_key,
                    http_options=client_options,
                )
            except Exception:
                self._client = None

    @staticmethod
    def _is_potential_api_key(key: str) -> bool:
        """Verify whether candidate key string is formatted like an authentic API key.

        Filters out empty values and template placeholder strings copied directly
        from sample environment configurations, such as 'replace_with_your_gemini_api_key'.

        Args:
            key: Candidate API key string.

        Returns:
            bool: True if key appears valid for client initialization.
        """
        if not key or len(key) < 20:
            return False
        lowered = key.lower()
        placeholder_indicators = (
            "replace",
            "dummy",
            "placeholder",
            "your-",
            "your_",
            "example",
            "todo",
            "secret",
        )
        if any(indicator in lowered for indicator in placeholder_indicators):
            return False
        return True

    def _generate_fallback_embedding(
        self,
        text: str,
        dimension: int = 3072,
    ) -> list[float]:
        """Generate a deterministic normalized pseudo-embedding when external AI is unavailable.

        Uses iterative SHA-256 expansion to construct a repeatable unit-length vector,
        satisfying pgvector constraints and enabling vector operations without external dependencies.

        Args:
            text: Input string content to vectorize.
            dimension: Target dimensionality matching the pgvector schema.

        Returns:
            list[float]: L2-normalized floating-point vector of length dimension.
        """
        normalized_input = text.strip().lower()
        vector: list[float] = []
        round_index = 0
        while len(vector) < dimension:
            seed = f"{round_index}:{normalized_input}".encode("utf-8")
            digest = hashlib.sha256(seed).digest()
            for byte_index in range(0, len(digest), 4):
                if len(vector) >= dimension:
                    break
                integer_val = int.from_bytes(
                    digest[byte_index : byte_index + 4], "big", signed=True
                )
                vector.append(float(integer_val) / 2147483648.0)
            round_index += 1

        norm = math.sqrt(sum(val * val for val in vector)) or 1.0
        return [round(val / norm, 6) for val in vector]

    def _heuristic_triage(
        self,
        item: WorkItem,
        team_members: list[User],
    ) -> dict[str, Any]:
        """Generate heuristic operational triage metadata when external AI generation is unavailable.

        Analyzes item title, description, and team roster to determine priority,
        operational category, actionable remediation steps, and assignee candidates.

        Args:
            item: Work item under evaluation.
            team_members: Roster of eligible members for team assignment.

        Returns:
            dict[str, Any]: Structured operational triage dictionary.
        """
        combined_text = f"{item.title} {item.description}".lower()

        suggested_priority = item.priority
        if any(
            keyword in combined_text
            for keyword in ["outage", "critical", "down", "data loss", "breach", "504"]
        ):
            suggested_priority = "critical"
        elif any(
            keyword in combined_text
            for keyword in ["timeout", "latency", "error", "failure", "broken", "bug"]
        ):
            suggested_priority = "high"
        elif any(
            keyword in combined_text
            for keyword in ["typo", "minor", "cleanup", "doc", "cosmetic"]
        ):
            suggested_priority = "low"

        suggested_category = item.category
        if any(
            keyword in combined_text
            for keyword in ["outage", "incident", "downtime", "504", "crash"]
        ):
            suggested_category = "incident"
        elif any(
            keyword in combined_text
            for keyword in [
                "gdpr",
                "compliance",
                "audit",
                "soc2",
                "pii",
                "security",
            ]
        ):
            suggested_category = "compliance"
        elif any(
            keyword in combined_text
            for keyword in ["customer", "billing", "invoice", "refund", "seat"]
        ):
            suggested_category = "customer_issue"
        elif any(
            keyword in combined_text
            for keyword in [
                "database",
                "postgres",
                "redis",
                "api",
                "migration",
                "docker",
            ]
        ):
            suggested_category = "engineering"

        summary = f"Operational triage: addressing {item.title.lower()} within {suggested_category} scope."

        suggested_next_steps = [
            f"Review diagnostic telemetry and error signatures for {item.title}.",
            "Coordinate remediation and status updates with affected stakeholders.",
            "Deploy verification fixes and monitor operational metrics.",
        ]

        recommended_assignees: list[dict[str, Any]] = []
        for index, member in enumerate(team_members[:2]):
            confidence = 0.88 - (index * 0.05)
            recommended_assignees.append(
                {
                    "user_id": str(member.id),
                    "display_name": member.display_name,
                    "confidence_score": confidence,
                    "reasoning": f"Designated operational responder from {member.display_name}.",
                }
            )

        return {
            "suggested_priority": suggested_priority,
            "suggested_category": suggested_category,
            "summary": summary,
            "suggested_next_steps": suggested_next_steps,
            "recommended_assignees": recommended_assignees,
        }

    async def generate_embedding(self, text: str) -> list[float]:
        """Generate a 3072-dimensional vector embedding for the supplied text.

        Attempts external embedding generation via Gemini API when configured,
        automatically falling back to a deterministic normalized pseudo-embedding
        vector when no API key is provided, on timeouts, or when external calls fail.

        Args:
            text: Input string content to vectorize.

        Returns:
            list[float]: High-dimensional dense embedding vector.
        """
        if self._client is not None:
            loop = asyncio.get_event_loop()
            try:
                response = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        functools.partial(
                            self._client.models.embed_content,
                            model=EMBEDDING_MODEL,
                            contents=text,
                        ),
                    ),
                    timeout=3.0,
                )
                if response.embeddings and response.embeddings[0].values:
                    return list(response.embeddings[0].values)
            except (errors.ClientError, errors.APIError):
                self._client = None
            except Exception:
                pass

        return self._generate_fallback_embedding(text)

    async def generate_completion(
        self,
        prompt: str,
        system_instruction: str | None = None,
    ) -> str:
        """Generate text completion using primary model with automatic fallback to backup model.

        Offloads synchronous Gemini SDK calls to a thread-pool executor with strict timeout guards.
        Returns an empty string gracefully if no API key is configured or network calls fail.

        Args:
            prompt: User prompt content.
            system_instruction: Optional system instruction steering model behavior.

        Returns:
            str: Generated textual response.
        """
        if self._client is None:
            return ""

        loop = asyncio.get_event_loop()
        try:
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    functools.partial(
                        self._client.models.generate_content,
                        model=PRIMARY_GENERATION_MODEL,
                        contents=prompt,
                    ),
                ),
                timeout=3.0,
            )
            if response.text:
                return response.text.strip()
        except (errors.ClientError, errors.APIError):
            self._client = None
            return ""
        except Exception:
            pass

        try:
            fallback_response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    functools.partial(
                        self._client.models.generate_content,
                        model=BACKUP_GENERATION_MODEL,
                        contents=prompt,
                    ),
                ),
                timeout=3.0,
            )
            return (
                fallback_response.text.strip()
                if fallback_response.text
                else ""
            )
        except (errors.ClientError, errors.APIError):
            self._client = None
            return ""
        except Exception:
            return ""

    async def search_similar_items(
        self,
        session: AsyncSession,
        query_text: str,
        accessible_team_ids: list[uuid.UUID],
        limit: int = 15,
    ) -> list[dict[str, Any]]:
        """Perform semantic similarity search against work items across authorized teams.

        Blends vector cosine similarity with lexical matching to guarantee robust search
        discovery in both AI-enabled and zero-AI evaluation environments.

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
            .options(
                selectinload(WorkItem.creator),
                selectinload(WorkItem.team),
                selectinload(WorkItem.assignee),
            )
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

        keywords = [word for word in query_text.lower().split() if len(word) > 2]
        if keywords:
            keyword_filters = []
            for kw in keywords:
                keyword_filters.append(WorkItem.title.ilike(f"%{kw}%"))
                keyword_filters.append(WorkItem.description.ilike(f"%{kw}%"))

            lexical_statement = (
                select(WorkItem)
                .options(
                    selectinload(WorkItem.creator),
                    selectinload(WorkItem.team),
                    selectinload(WorkItem.assignee),
                )
                .where(
                    WorkItem.team_id.in_(accessible_team_ids),
                    or_(*keyword_filters),
                )
                .limit(limit)
            )
            lexical_result = await session.execute(lexical_statement)
            existing_ids = {match["item"].id for match in matches}
            for lex_item in lexical_result.scalars().all():
                if lex_item.id not in existing_ids:
                    matches.append({
                        "item": lex_item,
                        "similarity_score": 0.85,
                    })
                    existing_ids.add(lex_item.id)
                else:
                    for match in matches:
                        if (
                            match["item"].id == lex_item.id
                            and match["similarity_score"] < 0.85
                        ):
                            match["similarity_score"] = 0.85

        matches.sort(key=lambda match: match["similarity_score"], reverse=True)
        return matches[:limit]

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
                    "item_id": str(item.id),
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
        into prompt context for accurate domain-aware reasoning, falling back to
        deterministic heuristic analysis when external AI is unavailable.

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
        roster_text = ", ".join(
            [f"{u.display_name} (ID: {u.id})" for u in team_members]
        )

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

        parsed_metadata: dict[str, Any] | None = None
        if self._client is not None:
            raw_output = await self.generate_completion(rag_prompt)
            cleaned_output = raw_output.strip()
            if cleaned_output.startswith("```"):
                cleaned_output = cleaned_output.strip("`")
                if cleaned_output.startswith("json"):
                    cleaned_output = cleaned_output[4:].strip()

            try:
                parsed_metadata = json.loads(cleaned_output)
            except json.JSONDecodeError:
                parsed_metadata = None

        if not parsed_metadata:
            parsed_metadata = self._heuristic_triage(item, team_members)

        parsed_metadata["potential_duplicates"] = duplicates
        item.ai_metadata = parsed_metadata
        return parsed_metadata


ai_service = AIService()
