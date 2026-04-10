# LifeOS — Developer Onboarding Guide

## What is LifeOS?

LifeOS is a full-stack personal management app. Think of it as a single place where users track their goals, habits, tasks, journal entries, notes, water intake, and weekly reviews. It's organized around the P.A.R.A. methodology (Projects, Areas, Resources, Archives) for categorizing goals and notes.

---

## Architecture at a Glance

```
┌─────────────────────┐         ┌──────────────────┐
│  React SPA (Vite)   │  HTTPS  │  Cloudflare Pages │
│  TypeScript + TW4   │◄───────►│  (static hosting) │
└────────┬────────────┘         └──────────────────┘
         │ API calls
         ▼
┌──────────────────────┐
│  Cloudflare Tunnel   │  ← no open inbound ports
│  (cloudflared)       │
└────────┬─────────────┘
         │ http://backend:8001
         ▼
┌──────────────────────┐
│  FastAPI Backend     │
│  Python 3.12        │
│  SQLAlchemy ORM     │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│  SQLite (dev)        │
│  PostgreSQL (prod)   │
└──────────────────────┘
```

The frontend is a React 19 SPA built with Vite and deployed to Cloudflare Pages as static files. The backend is a FastAPI app running in Docker. There are no open ports on the backend server — all traffic flows through a Cloudflare Tunnel container that proxies requests to the backend on the internal Docker network. This is a nice zero-trust setup.

---

## Tech Stack

| Layer | What we use |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, Axios, date-fns, lucide-react |
| Backend | FastAPI, SQLAlchemy, Pydantic v2, python-jose (JWT), google-auth, slowapi |
| Database | SQLite locally, PostgreSQL (Supabase) in production |
| Testing | pytest + Hypothesis (backend), Vitest + Testing Library + fast-check (frontend) |
| Deployment | Docker Compose, Cloudflare Tunnel, Cloudflare Pages |

---

## Backend Deep Dive

### Entry Point: `backend/main.py`

This is where the FastAPI app boots up. The startup sequence:

1. Creates all database tables via `models.Base.metadata.create_all(bind=engine)`
2. Attaches rate limiting (slowapi — 30 requests/minute default, configurable)
3. Registers two custom middleware:
   - `limit_request_body` — rejects requests over 1MB
   - `audit_log` — logs every request's method, path, and client IP
4. Registers 15 routers (auth, users, dashboard, goals, habits, tasks, journal, notes, tags, sync, notifications, analytics, weekly_review, export, water)
5. Configures CORS from the `CORS_ORIGINS` env var

### Database Layer: `backend/database.py`

Simple and clean. Uses `DATABASE_URL` env var, defaults to SQLite. The `get_db()` generator is a FastAPI dependency that yields a session and auto-closes it:

```python
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./lifeos.db")
engine = create_engine(DATABASE_URL, ...)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### Models: `backend/models.py` — 19 Tables

The core domain entities and their relationships:

```
User ──┬── Goals ──┬── Habits ── HabitLogs
       │           ├── Tasks ──┬── SubTasks
       │           │           ├── Notifications
       │           │           └── Tags (many-to-many via task_tags)
       │           ├── ProgressSnapshots
       │           └── GoalMilestones
       ├── JournalEntries ── JournalTags
       ├── Notes
       ├── ReminderConfig (one-to-one)
       ├── WeeklyReflections
       ├── FocusTasks
       ├── WaterEntries
       └── WaterGoal (one-to-one)
```

Key design decisions to know:
- Goals use P.A.R.A. categories (Project/Area/Resource/Archive)
- Habits auto-create linked Tasks with `task_type="habit"` — the sync engine keeps them in sync
- Recurring tasks use a template/instance pattern: templates have `parent_task_id=None`, instances point back to the template
- Progress tracking uses daily `ProgressSnapshot` records and `GoalMilestone` entries at 25/50/75/100% thresholds

### Authentication: `backend/auth.py`

Google OAuth 2.0 flow with JWT tokens:

1. Frontend triggers Google Sign-In, gets a Google ID token
2. `POST /auth/google` — backend verifies the token with Google, finds or creates the user, returns a HS256 JWT (7-day expiry)
3. Every subsequent request includes `Authorization: Bearer <token>`
4. `get_current_user()` dependency decodes the JWT, looks up the user, returns `401` if invalid

There's a `BYPASS_GOOGLE_AUTH` flag that only works inside pytest — it auto-creates a dev user for testing without hitting Google.

Every user-scoped router has a `_verify_owner()` check that compares `current_user.id` against the `user_id` path parameter, preventing IDOR attacks.

### CRUD Layer: `backend/crud.py`

Follows consistent patterns:
- Create: `model_dump()` → ORM constructor → `db.add()` → `db.commit()` → `db.refresh()`
- Read: Always scoped to `user_id`
- Update: `model_dump(exclude_unset=True)` → `setattr()` loop → `db.commit()`
- Delete: Query → `db.delete()` → `db.commit()`

Notable functions: `recalculate_habit_streak()` walks backwards through scheduled days counting consecutive "Done" logs. `sync_recurring_tasks()` handles end conditions and creates instances per period. `_resolve_tag_ids()` validates tag ownership to prevent cross-user injection.

### Business Logic Engines

Three dedicated engines handle complex computations:

1. **`progress_engine.py`** — Computes goal progress as a weighted average of task completion and habit success rates. Manages daily snapshots, milestone detection (25/50/75/100%), and auto-completion of goals.

2. **`week_summary_engine.py`** — Orchestrates the weekly review feature. Computes task summaries grouped by day, habit adherence grids, goal progress deltas (week-over-week), journal summaries with mood averages, and time tracking efficiency.

3. **`export_engine.py`** — Handles data export in JSON (with metadata envelope) or CSV (with UTF-8 BOM for Excel). Multi-type exports produce a ZIP archive with one CSV per type.

### Rate Limiting: `backend/rate_limit.py`

Uses slowapi with a smart key function — identifies users by JWT user ID when authenticated, falls back to IP address for anonymous requests. Default: 30 requests/minute. Storage is in-memory by default, configurable to Redis for multi-worker production.

### Migrations: `backend/migrations/`

11 migration scripts for schema evolution (tags, priorities, theme preference, water intake, weekly review, etc.). These are standalone Python scripts rather than Alembic migrations — they add columns and tables incrementally.

---

## Frontend Deep Dive

### Routing: `frontend/src/App.tsx`

React Router v7 with a nested layout pattern. All routes except `/login` are wrapped in `<ProtectedRoute>` which checks auth status:

```
<AuthProvider>
  <ThemeProvider>
    <BrowserRouter>
      /login          → LoginPage (public)
      / (protected)   → Layout wrapper (sidebar + content)
        /             → Dashboard
        /goals        → GoalsPage
        /tasks        → KanbanBoard
        /habits       → HabitsPage
        /journal      → JournalPage
        /vault        → VaultPage (notes)
        /analytics    → AnalyticsPage
        /profile      → ProfilePage
        /weekly-review → WeeklyReviewPage
        /export       → ExportPage
        /hydration    → HydrationPage
```

### Context Providers

Two React contexts wrap the entire app:

- **AuthContext** — Manages user state, login/logout, and an Axios interceptor that attaches the JWT to every request. On mount, it checks localStorage for an existing token and validates it with `GET /auth/me`.

- **ThemeContext** — Dark/light mode with localStorage persistence and backend sync. On login, fetches the user's theme preference from the backend. Toggle fires a fire-and-forget PATCH to persist the choice.

### API Layer: `frontend/src/api/`

A configured Axios instance in `config.ts` with `baseURL` from `VITE_API_URL` env var (defaults to `http://localhost:8001`). Domain-specific modules (`index.ts`, `water.ts`, `weeklyReview.ts`) export typed functions for every endpoint.

### Component Organization

```
frontend/src/
├── api/            # Axios instance + domain API modules
├── components/     # 14 reusable UI components
│   ├── Layout.tsx          # App shell (sidebar + outlet)
│   ├── Sidebar.tsx         # Navigation
│   ├── ProtectedRoute.tsx  # Auth guard
│   ├── NotificationCenter.tsx
│   ├── HydrationWidget.tsx
│   ├── MarkdownEditor.tsx
│   ├── TagSelector.tsx / TagChip.tsx
│   ├── PriorityBadge.tsx
│   ├── ProgressBar.tsx
│   ├── ConfirmModal.tsx
│   └── ...
├── contexts/       # Auth + Theme contexts
├── pages/          # 12 route-level page components
└── types.ts        # Shared TypeScript interfaces
```

### Styling

Tailwind CSS 4 with dark/light mode support. The design uses glass-morphism panels, gradient accents (amber, emerald, indigo, cyan), and smooth transitions. The `theme-transitioning` CSS class is added during theme switches for smooth animation.

---

## Request Lifecycle Example

When a user drags a task to "Done" on the Kanban board:

```
Browser → React (KanbanBoard) → Axios interceptor (attach JWT)
  → Cloudflare Tunnel → FastAPI middleware stack
    → audit_log → limit_request_body → rate limit check
    → get_current_user (decode JWT, load user)
    → _verify_owner (check user_id matches)
    → crud.update_task (UPDATE tasks SET status='Done')
    → progress_engine.recalculate_goal_progress
      → upsert daily snapshot
      → check milestones (25/50/75/100%)
      → auto-complete goal if all tasks done
  → 200 OK + Task JSON → React re-renders
```

---

## How to Run Locally

Backend (from project root):
```bash
.venv/bin/uvicorn backend.main:app --reload --port 8001
```

Frontend (from `frontend/` directory):
```bash
npx vite --port 5176
```

Seed sample data:
```bash
.venv/bin/python -m backend.seed_data
```

Environment setup: copy `.env.example` files in both root and `backend/` directories, fill in `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`, and `DATABASE_URL`.

---

## Testing

Backend tests live in `backend/tests/` and use pytest with an in-memory SQLite database. The test setup overrides `get_db` with a test session. Hypothesis is used for property-based testing (you'll see `.hypothesis/` in the root). Key test files:
- `test_main.py` — Core CRUD integration tests
- `test_security.py` — Auth enforcement, IDOR protection, pagination caps
- `test_progress_engine.py` — Goal progress computation
- `test_water_properties.py` / `test_theme_properties.py` — Property-based tests

Frontend tests use Vitest with Testing Library and fast-check for property-based testing.

---

## Where to Start Contributing

If you want to add a new feature, the pattern is:
1. Add the model in `models.py`
2. Add Pydantic schemas in `schemas.py`
3. Add CRUD functions in `crud.py`
4. Create a new router in `routers/`
5. Register it in `main.py`
6. Add the frontend API functions in `api/`
7. Build the page component in `pages/`
8. Add the route in `App.tsx`
9. Write a migration script if modifying existing tables

The codebase is consistent — once you've seen one feature end-to-end (say, water intake), you'll know the pattern for everything else.
