"""AI and analytics request and response validation schemas."""

import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.work_item import WorkItemResponse


class DuplicateItemMatch(BaseModel):
    """Potential duplicate work item identified by similarity search.

    Attributes:
        item_id: Identifier of existing similar item.
        title: Title of existing item.
        status: Current status of existing item.
        similarity_score: Cosine similarity score between zero and one.
    """

    item_id: uuid.UUID
    title: str
    status: str
    similarity_score: float


class AssigneeRecommendation(BaseModel):
    """AI suggested team member for work item assignment.

    Attributes:
        user_id: Identifier of recommended team member.
        display_name: Display name of recommended user.
        confidence_score: Confidence estimate for this recommendation.
        reasoning: Contextual rationale explaining why this user is suitable.
    """

    user_id: uuid.UUID
    display_name: str
    confidence_score: float
    reasoning: str


class AISuggestionsResponse(BaseModel):
    """Enriched operational intelligence suggestions for a work item.

    Attributes:
        suggested_priority: Priority evaluated from description and similar items.
        suggested_category: Category inferred from item context.
        summary: Concise executive summary of the issue.
        suggested_next_steps: Concrete actionable steps for resolution.
        potential_duplicates: List of similar items detected.
        recommended_assignees: Recommended team members based on historical performance.
    """

    suggested_priority: str | None = None
    suggested_category: str | None = None
    summary: str | None = None
    suggested_next_steps: list[str] = Field(default_factory=list)
    potential_duplicates: list[DuplicateItemMatch] = Field(default_factory=list)
    recommended_assignees: list[AssigneeRecommendation] = Field(default_factory=list)


class SemanticSearchResultItem(BaseModel):
    """Work item result annotated with hybrid similarity relevance score.

    Attributes:
        item: Serialized work item entity.
        similarity_score: Hybrid semantic and lexical relevance score.
    """

    item: WorkItemResponse
    similarity_score: float


class SemanticSearchResponse(BaseModel):
    """Response payload for semantic and hybrid search queries.

    Attributes:
        query: Original search query text.
        total_results: Total count of matching items.
        results: Ranked list of work items with scores.
    """

    query: str
    total_results: int
    results: list[SemanticSearchResultItem]


class DashboardStatsResponse(BaseModel):
    """Aggregated operational statistics across user's teams.

    Attributes:
        total_active_items: Count of open or active work items.
        critical_items_count: Count of critical priority items needing intervention.
        unassigned_items_count: Count of work items without an assignee.
        in_review_items_count: Count of items currently awaiting review or approval.
        items_by_priority: Breakdown of items per priority level.
        items_by_status: Breakdown of items per workflow state.
    """

    total_active_items: int
    critical_items_count: int
    unassigned_items_count: int
    in_review_items_count: int
    items_by_priority: dict[str, int]
    items_by_status: dict[str, int]
