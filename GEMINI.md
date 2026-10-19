# GEMINI.md - Agent Coding Standards for OpFlow

## Identity

This project is **OpFlow**, an operational work management platform built for the
Newtonite Software Engineering Challenge.

---

## Hard Rules (Non-Negotiable)

### No Inline Comments

Never write inline comments. Code must be self-documenting through clear variable
names, function names, and type annotations. If something needs explanation, it
belongs in a docstring at the function or class level.

```python
# WRONG
x = get_items(team_id)  # fetch all items for the team

# RIGHT
team_work_items = get_items_by_team(team_id)
```

### Docstrings Are Mandatory

Every function, method, and class must have a docstring. Use Google-style docstrings
for Python. Use JSDoc-style for TypeScript.

```python
# Python
async def transition_work_item(
    item_id: UUID,
    target_status: str,
    expected_version: int,
    actor: User,
    db: AsyncSession,
) -> WorkItem:
    """Validate and execute a workflow state transition on a work item.

    Checks that the transition is permitted by the workflow definition,
    that the actor's team role authorizes the transition, and that
    the expected version matches the current version for optimistic
    concurrency control.

    Args:
        item_id: The work item to transition.
        target_status: The desired new status.
        expected_version: Client's last-known version for conflict detection.
        actor: The authenticated user performing the transition.
        db: The active database session.

    Returns:
        The updated WorkItem with incremented version.

    Raises:
        ConflictError: If expected_version does not match current version.
        ForbiddenError: If the actor's role cannot perform this transition.
        ValidationError: If the transition is not defined in the workflow.
    """
```

```typescript
// TypeScript
/**
 * Fetches paginated work items filtered by the current user's team memberships.
 *
 * @param filters - Active filter state from the UI
 * @param page - Zero-indexed page number
 * @param pageSize - Number of items per page
 * @returns Paginated response with items and total count
 * @throws {ApiError} When the server returns a non-2xx status
 */
```

### Self-Documenting Code

Variable names, function names, and type names must convey intent without
requiring comments. Prefer verbose clarity over terse brevity.

```python
# WRONG
def proc(d, u):
    ...

# RIGHT
async def process_embedding_generation_task(task_payload: dict, requesting_user: User):
    ...
```

### No Emojis

Never use emojis anywhere in the codebase. Not in code, not in strings, not in
log messages, not in UI text, not in error messages, not in docstrings.

```python
# WRONG
logger.info("Task completed successfully! ✅")

# RIGHT
logger.info("Embedding generation task completed for item %s", item_id)
```

### No Placeholder Defaults for Environment Variables

If an environment variable is required, the application must crash immediately
on startup with a clear error message if it is missing. Never fall back to
localhost, default passwords, or any other placeholder value.

```python
# WRONG
DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://localhost/opflow")

# RIGHT
DATABASE_URL: str = os.environ["DATABASE_URL"]
```

Use Pydantic Settings with no defaults for required fields:

```python
class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    gemini_api_key: str

    model_config = SettingsConfigDict(env_file=".env")
```

### Never Touch .env Files

Do not create, modify, or delete `.env` files unless absolutely necessary.
Environment variables are configured by the operator, not by the application code.
Document required environment variables in `README.md` and `docker-compose.yml`
only. Provide a `.env.example` as a reference template.

### No Env Vars Hardcoded in Source

Environment variable names and values must never appear as string literals
scattered throughout the codebase. All environment variable access must happen
in exactly one place: the `config.py` (backend) or `lib/config.ts` (frontend)
module. Every other module imports from the config module.

```python
# WRONG (scattered across codebase)
api_key = os.environ["GEMINI_API_KEY"]

# RIGHT (centralized in config.py)
from app.config import settings
api_key = settings.gemini_api_key
```

---

## Architecture Rules

### Functionality First

Never skip functionality to save time. If a feature is in the plan, implement it
fully. If time pressure forces a cut, remove the entire feature rather than
shipping a broken stub.

### No Shortcuts

Never use placeholder implementations, mock data presented as real, or dummy
functions that return hardcoded values. Every function must do real work.

### Crash Early, Crash Loud

Configuration errors, missing dependencies, and invalid state should cause
immediate, obvious failures. Silent degradation is worse than a crash.

```python
# WRONG
try:
    db = await connect_to_database()
except Exception:
    db = None  # continue without database

# RIGHT
db = await connect_to_database()  # let it crash if DB is unreachable
```

### Think Like a Senior Engineer

- Design for the next engineer who reads this code, not just for today
- Every public function has a clear contract expressed through types and docstrings
- Error handling is explicit and intentional, never blanket try/except
- Database queries are efficient with proper indexes documented
- Security boundaries are enforced at the lowest possible layer

---

## Code Style

### Python (Backend)

- Python 3.12+
- Type annotations on every function signature (args and return)
- async/await for all I/O operations
- Pydantic v2 for all request/response validation
- SQLAlchemy 2.0 style (mapped_column, DeclarativeBase)
- Google-style docstrings
- No `# type: ignore` without explicit justification in the docstring
- No bare `except Exception`
- No mutable default arguments

### TypeScript (Frontend)

- Strict mode enabled
- Explicit return types on exported functions
- Interface over type alias for object shapes
- JSDoc on all exported functions and components
- No `any` type without explicit justification
- No `as` type assertions without explicit justification
- Prefer `const` over `let`, never use `var`

### Tailwind CSS (Frontend)

- Use the project color tokens defined in `tailwind.config.ts`
- Inter font family everywhere
- No inline `style` attributes
- Responsive design with mobile-first breakpoints
- No neumorphic shadow effects (no inset/raised box-shadows)
- Use shadcn/ui components as the base, themed with project colors

---

## File and Naming Conventions

### Python

- `snake_case` for files, functions, variables, module names
- `PascalCase` for classes
- `SCREAMING_SNAKE_CASE` for constants
- One model per file in `models/`
- One router per resource in `routers/`
- Business logic lives in `services/`, never in routers

### TypeScript

- `kebab-case` for files
- `PascalCase` for components, interfaces, types
- `camelCase` for functions, variables, hook names
- Hooks prefixed with `use-` in filenames, `use` in function names
- One page component per route file

---

## Memory Map

Always maintain `/home/dhruv/newtonite-assessment/memory-map.md` as a living
document. Update it whenever you:

- Create a new file
- Add a new API endpoint
- Add a new database table or column
- Add a new frontend page or component
- Change the relationship between modules
- Add or modify environment variables

The memory map must reflect the actual current state of the codebase at all times.

---

## Models

- Embedding model: `gemini-embedding-002`
- Generation model: `gemini-3.1-flash-lite`

---

## Color Palette

| Token | Value | Usage |
|---|---|---|
| surface | #e0e5ec | Page background, card backgrounds |
| surface-deep | #d1d9e6 | Recessed areas, input backgrounds |
| surface-raised | #e8edf4 | Hover states, highlight areas |
| accent | #74a57f (Sage) | Primary CTAs, active states |
| accent-light | rgba(116,165,127,0.20) | Accent backgrounds, badges |
| text-primary | #4a5568 | Headings, primary text |
| text-secondary | #718096 | Body text, descriptions |
| text-muted | #a0aec0 | Placeholders, labels |
