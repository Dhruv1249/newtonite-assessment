"""Database seeding script for demo and evaluation environments.

Populates the default workflow, organizational teams, test user accounts across all roles,
and realistic operational work items with activity histories.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_database_engine, async_session_factory
from app.models import (
    ActivityLog,
    Comment,
    ItemPriority,
    Team,
    TeamMember,
    TeamRole,
    User,
    WorkItem,
    Workflow,
    initialize_database_schema,
)
from app.services.auth_service import hash_password

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
    {"from": "open", "to": "in_progress", "required_roles": ["member", "lead", "admin"]},
    {"from": "in_progress", "to": "in_review", "required_roles": ["member", "lead", "admin"]},
    {"from": "in_review", "to": "in_progress", "required_roles": ["lead", "admin"]},
    {"from": "in_review", "to": "resolved", "required_roles": ["lead", "admin"]},
    {"from": "resolved", "to": "closed", "required_roles": ["lead", "admin"]},
    {"from": "in_progress", "to": "blocked", "required_roles": ["member", "lead", "admin"]},
    {"from": "blocked", "to": "in_progress", "required_roles": ["member", "lead", "admin"]},
    {"from": "open", "to": "cancelled", "required_roles": ["lead", "admin"]},
    {"from": "in_progress", "to": "cancelled", "required_roles": ["lead", "admin"]},
]


async def seed_database() -> None:
    """Seed database with standard workflow, users, teams, and sample operational work items."""
    await initialize_database_schema(async_database_engine)

    async with async_session_factory() as session:
        workflow_statement = select(Workflow).where(Workflow.name == "Standard Operational Workflow")
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

        user_definitions = [
            ("admin@opflow.internal", "Alex Admin", TeamRole.ADMIN),
            ("lead@opflow.internal", "Devin Lead", TeamRole.LEAD),
            ("engineer@opflow.internal", "Eli Engineer", TeamRole.MEMBER),
            ("support@opflow.internal", "Sam Support", TeamRole.MEMBER),
            ("auditor@opflow.internal", "Val Viewer", TeamRole.VIEWER),
        ]

        users: dict[str, User] = {}
        for email, display_name, _ in user_definitions:
            user_stmt = select(User).where(User.email == email)
            existing_user = (await session.execute(user_stmt)).scalar_one_or_none()
            if existing_user is None:
                new_user = User(
                    email=email,
                    password_hash=hash_password("password123"),
                    display_name=display_name,
                )
                session.add(new_user)
                await session.flush()
                users[email] = new_user
            else:
                users[email] = existing_user

        team_names = [
            ("Platform Engineering", "Core cloud infrastructure, kubernetes clusters, and incident remediation."),
            ("Customer Operations", "Customer inquiries, escalations, account verifications, and refunds."),
            ("Compliance & Security", "Audit logs, regulatory disclosures, and security reviews."),
        ]

        teams: dict[str, Team] = {}
        for name, description in team_names:
            team_stmt = select(Team).where(Team.name == name)
            existing_team = (await session.execute(team_stmt)).scalar_one_or_none()
            if existing_team is None:
                new_team = Team(
                    name=name,
                    description=description,
                    workflow_id=workflow.id,
                )
                session.add(new_team)
                await session.flush()
                teams[name] = new_team
            else:
                teams[name] = existing_team

        memberships_map = [
            (users["admin@opflow.internal"], teams["Platform Engineering"], TeamRole.ADMIN),
            (users["admin@opflow.internal"], teams["Customer Operations"], TeamRole.ADMIN),
            (users["admin@opflow.internal"], teams["Compliance & Security"], TeamRole.ADMIN),
            (users["lead@opflow.internal"], teams["Platform Engineering"], TeamRole.LEAD),
            (users["lead@opflow.internal"], teams["Customer Operations"], TeamRole.LEAD),
            (users["engineer@opflow.internal"], teams["Platform Engineering"], TeamRole.MEMBER),
            (users["support@opflow.internal"], teams["Customer Operations"], TeamRole.MEMBER),
            (users["auditor@opflow.internal"], teams["Platform Engineering"], TeamRole.VIEWER),
            (users["auditor@opflow.internal"], teams["Customer Operations"], TeamRole.VIEWER),
            (users["auditor@opflow.internal"], teams["Compliance & Security"], TeamRole.VIEWER),
        ]

        for user_obj, team_obj, role_enum in memberships_map:
            member_stmt = select(TeamMember).where(
                TeamMember.user_id == user_obj.id,
                TeamMember.team_id == team_obj.id,
            )
            existing_member = (await session.execute(member_stmt)).scalar_one_or_none()
            if existing_member is None:
                new_member = TeamMember(
                    user_id=user_obj.id,
                    team_id=team_obj.id,
                    role=role_enum.value,
                )
                session.add(new_member)

        sample_items = [
            {
                "title": "Payment gateway webhook timeouts on stripe-v3 integration",
                "description": "Multiple customer transactions encountered 504 Gateway Timeout during checkout webhooks over the last 4 hours. Error logs indicate rate limiting on third party endpoint.",
                "team": teams["Platform Engineering"],
                "creator": users["lead@opflow.internal"],
                "assignee": users["engineer@opflow.internal"],
                "status": "in_progress",
                "priority": ItemPriority.CRITICAL.value,
                "category": "incident",
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
                item_obj = WorkItem(
                    title=item_data["title"],
                    description=item_data["description"],
                    team_id=item_data["team"].id,
                    created_by_id=item_data["creator"].id,
                    assignee_id=item_data["assignee"].id if item_data["assignee"] else None,
                    status=item_data["status"],
                    priority=item_data["priority"],
                    category=item_data["category"],
                    version=1,
                    created_at=now - timedelta(hours=3),
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
                    created_at=now - timedelta(hours=3),
                )
                session.add(init_log)

                comment_obj = Comment(
                    item_id=item_obj.id,
                    user_id=item_data["creator"].id,
                    content="Initial triage started. Assigned team members notified.",
                    created_at=now - timedelta(hours=2),
                )
                session.add(comment_obj)

        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed_database())
