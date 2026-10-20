"""Database models package initialization.

Exports all SQLAlchemy entity models and schema initialization utilities.
Automatically provisions extensions, tables, workflows, evaluator accounts,
and sample work items on application startup.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import math
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.database import Base
from app.models.activity_log import ActivityLog
from app.models.comment import Comment
from app.models.idempotency_key import IdempotencyKey
from app.models.task_queue import TaskQueue, TaskStatus
from app.models.team import Team
from app.models.team_member import TeamMember, TeamRole
from app.models.user import User
from app.models.work_item import ItemPriority, WorkItem
from app.models.workflow import Workflow
from app.services.auth_service import hash_password

__all__ = [
    "ActivityLog",
    "Base",
    "Comment",
    "IdempotencyKey",
    "ItemPriority",
    "TaskQueue",
    "TaskStatus",
    "Team",
    "TeamMember",
    "TeamRole",
    "User",
    "WorkItem",
    "Workflow",
    "initialize_database_schema",
]

DEFAULT_WORKFLOW_STATES = [
    {"id": "open", "label": "Open", "type": "initial"},
    {"id": "in_progress", "label": "In Progress", "type": "active"},
    {"id": "in_review", "label": "In Review", "type": "active"},
    {"id": "blocked", "label": "Blocked", "type": "active"},
    {"id": "resolved", "label": "Resolved", "type": "terminal"},
    {"id": "cancelled", "label": "Cancelled", "type": "terminal"},
    {"id": "closed", "label": "Closed", "type": "terminal"},
]

DEFAULT_WORKFLOW_TRANSITIONS = [
    {
        "from": "open",
        "to": "in_progress",
        "required_roles": ["member", "lead", "admin"],
    },
    {
        "from": "in_progress",
        "to": "in_review",
        "required_roles": ["member", "lead", "admin"],
    },
    {
        "from": "in_review",
        "to": "in_progress",
        "required_roles": ["lead", "admin"],
    },
    {"from": "in_review", "to": "resolved", "required_roles": ["lead", "admin"]},
    {"from": "resolved", "to": "closed", "required_roles": ["lead", "admin"]},
    {
        "from": "in_progress",
        "to": "blocked",
        "required_roles": ["member", "lead", "admin"],
    },
    {
        "from": "blocked",
        "to": "in_progress",
        "required_roles": ["member", "lead", "admin"],
    },
    {"from": "open", "to": "cancelled", "required_roles": ["lead", "admin"]},
    {
        "from": "in_progress",
        "to": "cancelled",
        "required_roles": ["lead", "admin"],
    },
]


def _generate_seed_embedding(text: str, dimension: int = 3072) -> list[float]:
    """Generate a deterministic normalized pseudo-embedding vector for seeded items.

    Args:
        text: Input string content to vectorize.
        dimension: Number of dimensions required for vector representation.

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


async def _seed_initial_database_records(session: AsyncSession) -> None:
    """Populate default workflows, evaluator user accounts, teams, and sample items.

    Args:
        session: Active asynchronous database session.
    """
    workflow_statement = select(Workflow).where(
        Workflow.name == "Standard Operational Workflow"
    )
    workflow = (await session.execute(workflow_statement)).scalar_one_or_none()
    if workflow is None:
        workflow = Workflow(
            name="Standard Operational Workflow",
            description="Default seven-state operational state machine with review gates and role authorizations.",
            states=DEFAULT_WORKFLOW_STATES,
            transitions=DEFAULT_WORKFLOW_TRANSITIONS,
            is_default=True,
        )
        session.add(workflow)
        await session.flush()

    incident_workflow = Workflow(
        name="Critical Incident Response",
        description="Fast-track emergency response workflow with triage, mitigation, and post-mortem review gates.",
        states=[
            {"id": "open", "label": "Triage", "type": "initial"},
            {"id": "in_progress", "label": "Mitigating", "type": "active"},
            {"id": "in_review", "label": "Post-Mortem Review", "type": "active"},
            {"id": "resolved", "label": "Resolved", "type": "terminal"},
            {"id": "closed", "label": "Closed", "type": "terminal"},
        ],
        transitions=[
            {"from": "open", "to": "in_progress", "required_roles": ["member", "lead", "admin"]},
            {"from": "in_progress", "to": "in_review", "required_roles": ["lead", "admin"]},
            {"from": "in_review", "to": "resolved", "required_roles": ["lead", "admin"]},
            {"from": "resolved", "to": "closed", "required_roles": ["admin"]},
        ],
        is_default=False,
    )
    session.add(incident_workflow)

    compliance_workflow = Workflow(
        name="Regulatory Compliance Flow",
        description="Rigorous compliance review pipeline with multi-stage audit approvals and legal signs-off.",
        states=[
            {"id": "open", "label": "Submitted", "type": "initial"},
            {"id": "in_progress", "label": "Auditing", "type": "active"},
            {"id": "in_review", "label": "Legal Review", "type": "active"},
            {"id": "blocked", "label": "Deficiency Blocked", "type": "active"},
            {"id": "resolved", "label": "Compliant Approved", "type": "terminal"},
            {"id": "closed", "label": "Archived", "type": "terminal"},
        ],
        transitions=[
            {"from": "open", "to": "in_progress", "required_roles": ["member", "lead", "admin"]},
            {"from": "in_progress", "to": "in_review", "required_roles": ["lead", "admin"]},
            {"from": "in_progress", "to": "blocked", "required_roles": ["member", "lead", "admin"]},
            {"from": "blocked", "to": "in_progress", "required_roles": ["lead", "admin"]},
            {"from": "in_review", "to": "resolved", "required_roles": ["admin"]},
            {"from": "resolved", "to": "closed", "required_roles": ["admin"]},
        ],
        is_default=False,
    )
    session.add(compliance_workflow)
    await session.flush()

    user_definitions = [
        ("admin@opflow.internal", "Alex Admin", TeamRole.ADMIN),
        ("lead@opflow.internal", "Devin Lead", TeamRole.LEAD),
        ("engineer@opflow.internal", "Eli Engineer", TeamRole.MEMBER),
        ("support@opflow.internal", "Sam Support", TeamRole.MEMBER),
        ("auditor@opflow.internal", "Val Viewer", TeamRole.VIEWER),
    ]

    users: dict[str, User] = {}
    default_password_hash = hash_password("password123")
    for email, display_name, _ in user_definitions:
        user_stmt = select(User).where(User.email == email)
        existing_user = (await session.execute(user_stmt)).scalar_one_or_none()
        if existing_user is None:
            new_user = User(
                email=email,
                password_hash=default_password_hash,
                display_name=display_name,
            )
            session.add(new_user)
            await session.flush()
            users[email] = new_user
        else:
            users[email] = existing_user

    team_definitions = [
        ("Platform Engineering", "Core cloud infrastructure, kubernetes clusters, and incident remediation.", workflow.id),
        ("Customer Operations", "Customer inquiries, escalations, account verifications, and refunds.", workflow.id),
        ("Compliance & Security", "Audit logs, regulatory disclosures, and security reviews.", compliance_workflow.id),
    ]

    teams: dict[str, Team] = {}
    for name, description, assigned_workflow_id in team_definitions:
        team_stmt = select(Team).where(Team.name == name)
        existing_team = (await session.execute(team_stmt)).scalar_one_or_none()
        if existing_team is None:
            new_team = Team(
                name=name,
                description=description,
                workflow_id=assigned_workflow_id,
            )
            session.add(new_team)
            await session.flush()
            teams[name] = new_team
        else:
            teams[name] = existing_team

    membership_definitions = [
        (users["admin@opflow.internal"], teams["Platform Engineering"], TeamRole.ADMIN),
        (users["admin@opflow.internal"], teams["Customer Operations"], TeamRole.ADMIN),
        (users["admin@opflow.internal"], teams["Compliance & Security"], TeamRole.ADMIN),
        (users["lead@opflow.internal"], teams["Platform Engineering"], TeamRole.LEAD),
        (users["engineer@opflow.internal"], teams["Platform Engineering"], TeamRole.MEMBER),
        (users["support@opflow.internal"], teams["Customer Operations"], TeamRole.MEMBER),
        (users["auditor@opflow.internal"], teams["Compliance & Security"], TeamRole.VIEWER),
    ]

    for member_user, member_team, role in membership_definitions:
        member_stmt = select(TeamMember).where(
            TeamMember.user_id == member_user.id,
            TeamMember.team_id == member_team.id,
        )
        existing_member = (await session.execute(member_stmt)).scalar_one_or_none()
        if existing_member is None:
            session.add(
                TeamMember(
                    user_id=member_user.id,
                    team_id=member_team.id,
                    role=role.value,
                )
            )

    sample_items = [
        {
            "title": "Payment webhook timeouts on stripe-v3 integration",
            "description": "Multiple customer transactions encountered 504 Gateway Timeout during checkout webhooks over the last 4 hours. Error logs indicate rate limiting on third party endpoint.",
            "team": teams["Platform Engineering"],
            "creator": users["lead@opflow.internal"],
            "assignee": users["engineer@opflow.internal"],
            "status": "in_progress",
            "priority": ItemPriority.CRITICAL.value,
            "category": "incident",
            "workflow_id": incident_workflow.id,
        },
        {
            "title": "GDPR data deletion request for user account #84920",
            "description": "Compliance inquiry requesting permanent removal of PII across core datastores and analytics pipelines within 30 days statutory window.",
            "team": teams["Compliance & Security"],
            "creator": users["admin@opflow.internal"],
            "assignee": None,
            "status": "open",
            "priority": ItemPriority.MEDIUM.value,
            "category": "compliance",
            "workflow_id": compliance_workflow.id,
        },
        {
            "title": "Enterprise customer billing discrepancy on invoice INV-2026-088",
            "description": "Customer claims seat overcharge of $4,200 following bulk member migration. Audit logs require verification with finance team.",
            "team": teams["Customer Operations"],
            "creator": users["support@opflow.internal"],
            "assignee": users["lead@opflow.internal"],
            "status": "in_review",
            "priority": ItemPriority.HIGH.value,
            "category": "customer_issue",
            "workflow_id": workflow.id,
        },
        {
            "title": "Postgres connection pool exhaustion during daily backup cron",
            "description": "Nightly backup scripts acquired connections without timeouts, causing worker pool saturation and elevated API latencies for 12 minutes.",
            "team": teams["Platform Engineering"],
            "creator": users["engineer@opflow.internal"],
            "assignee": users["engineer@opflow.internal"],
            "status": "resolved",
            "priority": ItemPriority.MEDIUM.value,
            "category": "engineering",
            "workflow_id": workflow.id,
        },
        {
            "title": "Investigate recurring Redis replica desynchronization in region us-east",
            "description": "Replication offset lag exceeds 128MB every morning during high traffic bursts. Needs buffer tuning and network latency investigation.",
            "team": teams["Platform Engineering"],
            "creator": users["engineer@opflow.internal"],
            "assignee": None,
            "status": "open",
            "priority": ItemPriority.HIGH.value,
            "category": "incident",
            "workflow_id": incident_workflow.id,
        },
        {
            "title": "SOC2 Type II compliance evidence collection for Q4 audit",
            "description": "Gather identity provider access logs, pull request approvals, and change management records for external auditors.",
            "team": teams["Compliance & Security"],
            "creator": users["admin@opflow.internal"],
            "assignee": users["auditor@opflow.internal"],
            "status": "in_progress",
            "priority": ItemPriority.HIGH.value,
            "category": "compliance",
            "workflow_id": compliance_workflow.id,
        },
        {
            "title": "Customer refund request for suspended subscription #1920",
            "description": "User requested prorated refund following automated account suspension due to suspicious login patterns.",
            "team": teams["Customer Operations"],
            "creator": users["support@opflow.internal"],
            "assignee": users["support@opflow.internal"],
            "status": "closed",
            "priority": ItemPriority.LOW.value,
            "category": "customer_issue",
            "workflow_id": workflow.id,
        },
        {
            "title": "Implement distributed rate limiter for public GraphQL gateway",
            "description": "Prevent volumetric abuse by enforcing per-tenant sliding window token bucket rate limiting on GraphQL endpoints.",
            "team": teams["Platform Engineering"],
            "creator": users["lead@opflow.internal"],
            "assignee": users["engineer@opflow.internal"],
            "status": "in_progress",
            "priority": ItemPriority.HIGH.value,
            "category": "engineering",
            "workflow_id": workflow.id,
        },
        {
            "title": "Data retention policy audit for archived analytics clusters",
            "description": "Verify that raw user interaction events older than 365 days are scheduled for permanent purge in cloud storage buckets.",
            "team": teams["Compliance & Security"],
            "creator": users["admin@opflow.internal"],
            "assignee": None,
            "status": "in_review",
            "priority": ItemPriority.MEDIUM.value,
            "category": "compliance",
            "workflow_id": compliance_workflow.id,
        },
        {
            "title": "Customer complaint: SSO SAML certificate expiration lock-out",
            "description": "Acme Corp enterprise tenant users cannot log in due to signing certificate rotation misconfiguration.",
            "team": teams["Customer Operations"],
            "creator": users["support@opflow.internal"],
            "assignee": users["engineer@opflow.internal"],
            "status": "in_progress",
            "priority": ItemPriority.CRITICAL.value,
            "category": "customer_issue",
            "workflow_id": incident_workflow.id,
        },
        {
            "title": "Upgrade Kubernetes worker nodes to containerd 2.0",
            "description": "Rolling upgrade across production cluster nodes to resolve known runtime memory leak under heavy container churn.",
            "team": teams["Platform Engineering"],
            "creator": users["lead@opflow.internal"],
            "assignee": None,
            "status": "open",
            "priority": ItemPriority.MEDIUM.value,
            "category": "engineering",
            "workflow_id": workflow.id,
        },
        {
            "title": "Vendor risk assessment for third-party messaging provider",
            "description": "Evaluate security postures, encryption standards, and breach notification SLAs before onboarding transactional email service.",
            "team": teams["Compliance & Security"],
            "creator": users["auditor@opflow.internal"],
            "assignee": users["admin@opflow.internal"],
            "status": "resolved",
            "priority": ItemPriority.LOW.value,
            "category": "compliance",
            "workflow_id": compliance_workflow.id,
        },
        {
            "title": "High memory utilization alert on authentication microservice",
            "description": "Resident set size memory grew steadily past 85% threshold over 48 hours without releasing garbage-collected sessions.",
            "team": teams["Platform Engineering"],
            "creator": users["engineer@opflow.internal"],
            "assignee": users["engineer@opflow.internal"],
            "status": "blocked",
            "priority": ItemPriority.HIGH.value,
            "category": "incident",
            "workflow_id": incident_workflow.id,
        },
        {
            "title": "Customer request: Export historical audit logs in CSV format",
            "description": "Enterprise customer security team requested complete 12-month sign-in history for compliance verification.",
            "team": teams["Customer Operations"],
            "creator": users["support@opflow.internal"],
            "assignee": None,
            "status": "open",
            "priority": ItemPriority.MEDIUM.value,
            "category": "customer_issue",
            "workflow_id": workflow.id,
        },
        {
            "title": "Review quarterly access privileges across production databases",
            "description": "Identify stale contractor credentials and revoke unneeded elevated roles on production replica instances.",
            "team": teams["Compliance & Security"],
            "creator": users["admin@opflow.internal"],
            "assignee": users["auditor@opflow.internal"],
            "status": "open",
            "priority": ItemPriority.HIGH.value,
            "category": "compliance",
            "workflow_id": compliance_workflow.id,
        },
        {
            "title": "Zero-downtime database migration for work item schema v2",
            "description": "Add workflow execution history tracking and partitioning strategy for high-volume activity audit records.",
            "team": teams["Platform Engineering"],
            "creator": users["lead@opflow.internal"],
            "assignee": users["engineer@opflow.internal"],
            "status": "in_progress",
            "priority": ItemPriority.CRITICAL.value,
            "category": "engineering",
            "workflow_id": workflow.id,
        },
        {
            "title": "Customer portal UI responsiveness degradation on Safari iOS",
            "description": "Touch interactions on kanban column dragging freeze when item count exceeds 50 cards on mobile Safari.",
            "team": teams["Customer Operations"],
            "creator": users["support@opflow.internal"],
            "assignee": users["engineer@opflow.internal"],
            "status": "in_review",
            "priority": ItemPriority.MEDIUM.value,
            "category": "customer_issue",
            "workflow_id": workflow.id,
        },
        {
            "title": "Security advisory: Patch OpenSSL vulnerability CVE-2026-1104",
            "description": "Apply security patches across base alpine container images to mitigate remote buffer overflow vulnerability.",
            "team": teams["Compliance & Security"],
            "creator": users["admin@opflow.internal"],
            "assignee": users["lead@opflow.internal"],
            "status": "in_progress",
            "priority": ItemPriority.CRITICAL.value,
            "category": "incident",
            "workflow_id": incident_workflow.id,
        },
        {
            "title": "Configure multi-region read replicas for PostgreSQL datastore",
            "description": "Provision cross-region asynchronous read replicas to lower read latency for European and Asian tenant queries.",
            "team": teams["Platform Engineering"],
            "creator": users["lead@opflow.internal"],
            "assignee": None,
            "status": "open",
            "priority": ItemPriority.HIGH.value,
            "category": "engineering",
            "workflow_id": workflow.id,
        },
        {
            "title": "VIP enterprise onboarding: Provision dedicated tenant isolation",
            "description": "Complete VPC peering, custom domain routing, and customer encryption key configuration for incoming enterprise account.",
            "team": teams["Customer Operations"],
            "creator": users["support@opflow.internal"],
            "assignee": users["lead@opflow.internal"],
            "status": "in_progress",
            "priority": ItemPriority.HIGH.value,
            "category": "operational",
            "workflow_id": workflow.id,
        },
        {
            "title": "Automated PII anonymization pipeline for staging environments",
            "description": "Scrub customer names, email addresses, and payment references when syncing production sanitization dumps into staging.",
            "team": teams["Compliance & Security"],
            "creator": users["auditor@opflow.internal"],
            "assignee": users["engineer@opflow.internal"],
            "status": "resolved",
            "priority": ItemPriority.MEDIUM.value,
            "category": "compliance",
            "workflow_id": compliance_workflow.id,
        },
    ]

    now = datetime.now(timezone.utc)
    for item_data in sample_items:
        check_item = select(WorkItem).where(
            WorkItem.title == item_data["title"],
            WorkItem.team_id == item_data["team"].id,
        )
        existing_item = (await session.execute(check_item)).scalar_one_or_none()
        if existing_item is None:
            embedding_vector = _generate_seed_embedding(
                f"{item_data['title']}\n{item_data['description']}"
            )
            item_obj = WorkItem(
                title=item_data["title"],
                description=item_data["description"],
                team_id=item_data["team"].id,
                created_by_id=item_data["creator"].id,
                assignee_id=item_data["assignee"].id if item_data["assignee"] else None,
                status=item_data["status"],
                priority=item_data["priority"],
                category=item_data["category"],
                workflow_id=item_data["workflow_id"],
                embedding=embedding_vector,
                version=1,
                ai_metadata={
                    "suggested_priority": item_data["priority"],
                    "suggested_category": item_data["category"],
                    "summary": f"Operational tracking for {item_data['title'].lower()}.",
                    "suggested_next_steps": [
                        "Investigate related error metrics and diagnostic logs.",
                        "Coordinate remediation plan with assigned operational responders.",
                        "Verify resolution criteria and update tracking ticket.",
                    ],
                    "recommended_assignees": [
                        {
                            "user_id": str(item_data["creator"].id),
                            "display_name": item_data["creator"].display_name,
                            "confidence_score": 0.90,
                            "reasoning": "Creator and operational domain responder.",
                        }
                    ],
                    "potential_duplicates": [],
                },
                created_at=now - timedelta(hours=4),
                updated_at=now,
            )
            session.add(item_obj)
            await session.flush()

            init_log = ActivityLog(
                item_id=item_obj.id,
                user_id=item_data["creator"].id,
                action_type="created",
                old_value=None,
                new_value={"title": item_obj.title, "status": item_obj.status},
                created_at=now - timedelta(hours=4),
            )
            session.add(init_log)

            comment_obj = Comment(
                item_id=item_obj.id,
                user_id=item_data["creator"].id,
                content="Initial triage started. Assigned team members notified.",
                created_at=now - timedelta(hours=3),
            )
            session.add(comment_obj)

    await session.commit()


async def initialize_database_schema(engine: AsyncEngine) -> None:
    """Create pgvector extension and all database tables defined in the metadata.

    Ensures the vector extension is available, creates all missing entity tables,
    and automatically populates foundational workflows, evaluator accounts, and
    sample work items if the database has not yet been seeded.

    Args:
        engine: Asynchronous SQLAlchemy engine connected to target PostgreSQL database.
    """
    async with engine.begin() as connection:
        await connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await connection.run_sync(Base.metadata.create_all)
        await connection.execute(
            text(
                "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL;"
            )
        )

    async with AsyncSession(engine, expire_on_commit=False) as session:
        check_statement = select(User).where(
            User.email == "admin@opflow.internal"
        )
        existing_admin = (
            await session.execute(check_statement)
        ).scalar_one_or_none()
        if existing_admin is None:
            await _seed_initial_database_records(session)
