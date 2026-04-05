# LifeOS — Project Summary

LifeOS is a full-stack personal management app — React/TypeScript frontend with a FastAPI/SQLAlchemy backend on SQLite.

## Authentication

Google OAuth 2.0 with JWT tokens. A bypass mode (`BYPASS_GOOGLE_AUTH=true`) auto-logs in a dev user for local development.

## Database — 19 Tables

| Table | Purpose |
|-------|---------|
| users | Accounts with Google ID, avatar, theme preference |
| goals | Life goals using P.A.R.A. categories (Project/Area/Resource/Archive) with priority and target dates |
| habits | Recurring habits with flexible/scheduled frequency, streak tracking, and goal linking |
| habit_logs | Daily Done/Missed logs per habit |
| tasks | Kanban tasks (Todo/InProgress/Done) with priority, energy level, estimated time, recurrence support, and goal/habit linking |
| subtasks | Checklist items within tasks |
| task_tags | Many-to-many join between tasks and tags |
| tags | User-defined colored labels for tasks |
| journal_entries | Daily journal with markdown content and mood (1-5) |
| journal_tags | Links journal entries to goals/habits/tasks |
| notes | Knowledge vault notes organized by P.A.R.A. folders |
| notifications | Task-based alerts (upcoming, due today, overdue) with read/dismissed state |
| reminder_configs | Per-user notification preferences |
| progress_snapshots | Daily goal progress history for trend charts |
| goal_milestones | Threshold achievements (25%, 50%, 75%, 100%) per goal |
| weekly_reflections | Markdown reflections keyed by ISO week |
| focus_tasks | Tasks pinned for a specific week |
| water_entries | Individual water intake logs (amount + timestamp) |
| water_goals | Per-user daily hydration target |

## Backend — 15 Routers

auth, users, dashboard, goals, habits, tasks, journal, notes, tags, sync, notifications, analytics, weekly_review, export, water.

Most endpoints are scoped to `/users/{user_id}/...` except water (JWT-based `/api/water/...`) and analytics.

## Frontend — 12 Pages

| Route | Page | What it does |
|-------|------|-------------|
| `/` | Dashboard | KPI cards (streaks, goal progress, deadlines, task efficiency), daily focus hero, habits checklist, action items, hydration widget |
| `/goals` | Goals | CRUD goals with P.A.R.A. categories, progress bars, milestone tracking, linked habits/tasks |
| `/tasks` | Kanban Board | Drag-drop columns, timeframe views (daily/weekly/monthly/all), recurring tasks, subtasks, tag filtering, priority/energy badges |
| `/habits` | Habits | Create/edit habits with frequency config, 30-day heatmap, streak display, goal linking, daily logging |
| `/journal` | Journal | Markdown editor, mood emoji picker, entry timeline, date navigation |
| `/vault` | Vault | P.A.R.A. folder tabs, markdown notes with auto-save, search |
| `/weekly-review` | Weekly Review | Week navigator, stats summary, reflection editor, focus task selection |
| `/analytics` | Leaderboard | Growth score ranking, personal radar chart, year-in-pixels heatmap |
| `/profile` | Profile | Account info, reminder config, theme toggle |
| `/export` | Export | JSON/CSV export with data type and date range selection |
| `/hydration` | Hydration | Quick-add buttons (250/500/750ml), custom input, daily progress bar, 7-day bar chart, entry list with delete |
| `/login` | Login | Google OAuth (or auto-bypass in dev mode) |

## Key Shared Components

- **Sidebar** — 10 nav links + theme toggle + profile menu
- **NotificationCenter** — Bell icon with unread count, notification list, mark read/dismiss
- **ConfirmModal** — Reusable confirmation dialog with danger/default variants
- **MarkdownEditor** — Rich text editor with live preview
- **ProgressBar** — Visual progress indicator with label and size variants
- **PriorityBadge** — Color-coded priority level indicator (High/Medium/Low)
- **TagChip** — Colored tag display pill
- **TagSelector** — Multi-select tag picker dropdown
- **HydrationWidget** — Dashboard water intake summary with quick-add
- **QuickCaptureButton** — Floating button for quick task/note creation
- **ProfileMenu** — User avatar dropdown with logout
- **CustomDropdown** — Reusable dropdown component

## Styling

Tailwind CSS with dark/light mode, glass-morphism panels, gradient accents (amber, emerald, indigo, cyan), responsive layout, smooth animations and transitions.

## Running the Project

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

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, Axios, date-fns, lucide-react |
| Backend | FastAPI, SQLAlchemy, Pydantic, python-jose (JWT), google-auth |
| Database | SQLite |
| Testing | pytest + Hypothesis (backend), Vitest + Testing Library (frontend) |
