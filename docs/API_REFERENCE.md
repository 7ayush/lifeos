# LifeOS — API Reference

## Base URL

| Environment | URL |
|---|---|
| Local development | `http://localhost:8001` |
| Production | Your Cloudflare Tunnel domain (e.g., `https://api.yourdomain.com`) |

## Authentication

All endpoints except `POST /auth/google` and `GET /` require a Bearer JWT token:

```
Authorization: Bearer <access_token>
```

Tokens are obtained via the Google OAuth login endpoint and expire after 7 days.

## Rate Limiting

- **Default**: 30 requests/minute per user (or per IP if unauthenticated).
- **Login endpoint**: 10 requests/minute.
- **Storage**: In-memory by default; configurable to Redis via `RATE_LIMIT_STORAGE_URI`.
- **429 response**:
  ```json
  {"detail": "Rate limit exceeded. Please slow down.", "retry_after": "60"}
  ```
  Includes `Retry-After` header.

## CORS

Configured via `CORS_ORIGINS` environment variable (comma-separated). Defaults to `http://localhost:5173,5174,5175,3000,5176`. All methods and headers are allowed. Credentials are enabled.

## Common Error Responses

| Status | Meaning | Body |
|---|---|---|
| 401 | Unauthorized — missing/invalid JWT | `{"detail": "Could not validate credentials"}` |
| 403 | Forbidden — user_id mismatch | `{"detail": "Not authorized"}` |
| 404 | Resource not found | `{"detail": "<Resource> not found"}` |
| 413 | Request body too large (>1 MB) | `{"detail": "Request body too large"}` |
| 422 | Validation error | `{"detail": "<field-specific message>"}` |
| 429 | Rate limited | `{"detail": "Rate limit exceeded. Please slow down."}` |

---

## Root

### `GET /`

Health check / welcome endpoint.

- **Auth required**: No
- **Response**: `{"message": "Welcome to Life OS API"}`

```bash
curl http://localhost:8001/
```

---

## Auth

### `POST /auth/google`

Authenticate with Google OAuth. Creates a new user on first login.

- **Auth required**: No
- **Rate limit**: 10/minute
- **Request body**:
  ```json
  {"credential": "<Google ID token>"}
  ```
  | Field | Type | Required | Constraints |
  |---|---|---|---|
  | credential | string | yes | max 4096 chars |
- **Response** (`TokenResponse`):
  ```json
  {
    "access_token": "eyJ...",
    "token_type": "bearer",
    "user": {"id": 1, "username": "...", "email": "...", "avatar_url": "...", "created_at": "..."}
  }
  ```

```bash
curl -X POST http://localhost:8001/auth/google \
  -H "Content-Type: application/json" \
  -d '{"credential": "GOOGLE_ID_TOKEN"}'
```

### `GET /auth/me`

Return the authenticated user's profile.

- **Auth required**: Yes
- **Response** (`UserProfile`): `{id, username, email, avatar_url, created_at}`

```bash
curl http://localhost:8001/auth/me -H "Authorization: Bearer TOKEN"
```

### `PUT /auth/me`

Update the authenticated user's profile.

- **Auth required**: Yes
- **Request body** (`UserProfileUpdate`):
  | Field | Type | Required |
  |---|---|---|
  | username | string | no |
  | avatar_url | string | no |
- **Response** (`UserProfile`): Updated user profile.

```bash
curl -X PUT http://localhost:8001/auth/me \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "New Name"}'
```

---

## Users & Settings

### `GET /users/{user_id}`

Get user profile.

- **Auth required**: Yes (own user only)
- **Response** (`User`): `{id, username, email, avatar_url, created_at}`

### `GET /users/{user_id}/settings`

Get user settings (theme preference).

- **Auth required**: Yes (own user only)
- **Response** (`UserSettingsOut`): `{"theme_preference": "dark"}`

### `PATCH /users/{user_id}/settings`

Update user settings.

- **Auth required**: Yes (own user only)
- **Request body** (`UserSettingsUpdate`):
  | Field | Type | Constraints |
  |---|---|---|
  | theme_preference | string | `"dark"` or `"light"` |
- **Response** (`UserSettingsOut`): Updated settings.

```bash
curl -X PATCH http://localhost:8001/users/1/settings \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"theme_preference": "light"}'
```

---

## Dashboard

### `GET /users/{user_id}/dashboard/stats`

Get dashboard statistics: active streaks, goal completion %, task efficiency, upcoming deadlines, top 3 active goals.

- **Auth required**: Yes (own user only)
- **Response**:
  ```json
  {
    "active_streaks": 5,
    "goal_completion_percentage": 42.5,
    "task_efficiency": {"daily": 80.0, "monthly": 65.0, "annual": 55.0},
    "upcoming_deadlines": 3,
    "active_goals": [{"id": 1, "title": "...", "priority": "High", "progress": 60, "category": "Project", "target_date": "2025-06-01"}]
  }
  ```

```bash
curl http://localhost:8001/users/1/dashboard/stats -H "Authorization: Bearer TOKEN"
```

### `GET /users/{user_id}/dashboard/today`

Get today's habits and due/overdue tasks.

- **Auth required**: Yes (own user only)
- **Response**: `{"habits": [...], "tasks": [...]}`

```bash
curl http://localhost:8001/users/1/dashboard/today -H "Authorization: Bearer TOKEN"
```

---

## Goals

All endpoints: `/users/{user_id}/goals`

### `POST /users/{user_id}/goals/`

Create a new goal.

- **Auth required**: Yes
- **Request body** (`GoalCreate`):
  | Field | Type | Required | Constraints |
  |---|---|---|---|
  | title | string | yes | 1–200 chars |
  | description | string | no | max 2000 chars |
  | category | string | no | default "Project" |
  | priority | string | no | "High", "Medium", "Low"; default "Medium" |
  | target_date | date | no | YYYY-MM-DD |
- **Response** (`Goal`): Created goal object.

```bash
curl -X POST http://localhost:8001/users/1/goals/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn Rust", "category": "Project", "priority": "High"}'
```

### `GET /users/{user_id}/goals/`

List all goals with computed progress.

- **Auth required**: Yes
- **Query params**: `skip` (default 0), `limit` (default 100, max 200)
- **Response** (`GoalWithProgress[]`): Goals with `progress` field (0–100).

### `GET /users/{user_id}/goals/{goal_id}`

Get goal detail with linked habits, tasks, progress history, and milestones.

- **Auth required**: Yes
- **Response** (`GoalDetailWithHistory`): Goal + habits + tasks + progress + milestones + progress_history.

### `PUT /users/{user_id}/goals/{goal_id}`

Update a goal.

- **Auth required**: Yes
- **Request body** (`GoalUpdate`): Any subset of `{title, description, status, category, priority, target_date}`.
- **Response** (`Goal`): Updated goal.

### `DELETE /users/{user_id}/goals/{goal_id}`

Delete a goal. Unlinks associated habits and tasks (sets their `goal_id` to null).

- **Auth required**: Yes
- **Response**: `{"ok": true}`

### `GET /users/{user_id}/goals/{goal_id}/progress`

Get computed progress for a single goal.

- **Auth required**: Yes
- **Response**: `{"goal_id": 1, "progress": 75.5}`

---

## Tasks

All endpoints: `/users/{user_id}/tasks`

### `POST /users/{user_id}/tasks/`

Create a new task. Supports manual, habit-linked, and recurring task types.

- **Auth required**: Yes
- **Request body** (`TaskCreate`):
  | Field | Type | Required | Constraints |
  |---|---|---|---|
  | title | string | yes | 1–200 chars |
  | description | string | no | max 5000 chars |
  | target_date | date | no | |
  | goal_id | int | no | |
  | priority | string | no | "High", "Medium", "Low", "None" |
  | energy_level | string | no | "High", "Medium", "Low" |
  | estimated_minutes | int | no | |
  | task_type | string | no | "manual", "habit", "recurring" |
  | frequency_type | string | no | "daily", "weekly", "monthly", "annually", "custom" |
  | repeat_interval | int | no | default 1 |
  | repeat_days | string | no | comma-separated day numbers (0=Sun..6=Sat) |
  | ends_type | string | no | "never", "on", "after" |
  | ends_on_date | date | no | required if ends_type="on" |
  | ends_after_occurrences | int | no | required if ends_type="after" |
  | tag_ids | int[] | no | |
- **Response** (`Task`): Created task.

```bash
curl -X POST http://localhost:8001/users/1/tasks/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Write docs", "priority": "High", "target_date": "2025-07-01"}'
```

### `GET /users/{user_id}/tasks/`

List tasks (excludes recurring templates).

- **Auth required**: Yes
- **Query params**: `start_date`, `end_date` (YYYY-MM-DD strings), `skip`, `limit` (max 200)
- **Response** (`Task[]`): Tasks with subtasks and tags.

### `PUT /users/{user_id}/tasks/reorder`

Reorder tasks within a status column.

- **Auth required**: Yes
- **Request body** (`ReorderRequest`):
  ```json
  {"status": "Todo", "ordered_task_ids": [3, 1, 2]}
  ```
- **Response** (`Task[]`): Reordered tasks.

### `PUT /users/{user_id}/tasks/{task_id}`

Update a task. Triggers goal progress recalculation if status changes on a goal-linked task.

- **Auth required**: Yes
- **Request body** (`TaskUpdate`): Any subset of task fields + `tag_ids`.
- **Response** (`Task`): Updated task.
- **Note**: Cannot modify recurrence config fields on task instances (returns 400).

### `DELETE /users/{user_id}/tasks/{task_id}`

Delete a task. If it's a recurring template, deletes all Todo instances and orphans InProgress/Done instances.

- **Auth required**: Yes
- **Response**: `{"status": "success"}`

### `POST /users/{user_id}/tasks/{task_id}/subtasks`

Create a subtask.

- **Auth required**: Yes
- **Request body** (`SubTaskCreate`): `{"title": "...", "is_complete": 0}`
- **Response** (`SubTask`): Created subtask.

### `PATCH /users/{user_id}/tasks/{task_id}/subtasks/{subtask_id}/toggle`

Toggle subtask completion.

- **Auth required**: Yes
- **Response** (`SubTask`): Updated subtask.

### `DELETE /users/{user_id}/tasks/{task_id}/subtasks/{subtask_id}`

Delete a subtask.

- **Auth required**: Yes
- **Response**: `{"status": "success"}`

---

## Habits

All endpoints: `/users/{user_id}/habits`

### `POST /users/{user_id}/habits/`

Create a habit. Auto-creates a linked task with `🔁` prefix.

- **Auth required**: Yes
- **Request body** (`HabitCreate`):
  | Field | Type | Required | Constraints |
  |---|---|---|---|
  | title | string | yes | 1–200 chars |
  | start_date | date | yes | |
  | goal_id | int | no | |
  | target_x | int | no | |
  | target_y_days | int | no | |
  | frequency_type | string | no | "flexible", "daily", "weekly", "monthly", "annually", "custom" |
  | repeat_interval | int | no | default 1 |
  | repeat_days | string | no | comma-separated (0=Sun..6=Sat) |
  | ends_type | string | no | "never", "on", "after" |
  | min_threshold_pct | int | no | default 80 |
- **Response** (`Habit`): Created habit with logs.

```bash
curl -X POST http://localhost:8001/users/1/habits/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Morning run", "start_date": "2025-01-01", "frequency_type": "daily"}'
```

### `GET /users/{user_id}/habits/`

List all habits with their logs.

- **Auth required**: Yes
- **Query params**: `skip`, `limit` (max 200)
- **Response** (`Habit[]`)

### `POST /users/{user_id}/habits/{habit_id}/log`

Log a habit status for a date.

- **Auth required**: Yes
- **Query params**:
  | Param | Type | Required | Constraints |
  |---|---|---|---|
  | status | string | yes | "Done" or "Missed" |
  | log_date | date | no | defaults to today; cannot be future |
- **Response** (`Habit`): Updated habit with recalculated streak.

```bash
curl -X POST "http://localhost:8001/users/1/habits/1/log?status=Done" \
  -H "Authorization: Bearer TOKEN"
```

### `PUT /users/{user_id}/habits/{habit_id}`

Update a habit. Propagates title/goal changes to pending linked tasks.

- **Auth required**: Yes
- **Request body** (`HabitUpdate`): Any subset of habit fields.
- **Response** (`Habit`): Updated habit.

### `DELETE /users/{user_id}/habits/{habit_id}`

Delete a habit and its logs (cascade).

- **Auth required**: Yes
- **Response**: `{"message": "Habit deleted successfully"}`

---

## Journal

All endpoints: `/users/{user_id}/journal`

### `POST /users/{user_id}/journal/`

Create a journal entry.

- **Auth required**: Yes
- **Request body** (`JournalEntryCreate`):
  | Field | Type | Required | Constraints |
  |---|---|---|---|
  | entry_date | date | yes | |
  | content | string | yes | 1–50000 chars |
  | mood | int | no | 1–5 scale |
- **Response** (`JournalEntry`)

```bash
curl -X POST http://localhost:8001/users/1/journal/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entry_date": "2025-07-01", "content": "Great day!", "mood": 5}'
```

### `GET /users/{user_id}/journal/`

List journal entries (newest first).

- **Auth required**: Yes
- **Query params**: `skip`, `limit` (max 200)
- **Response** (`JournalEntry[]`)

### `PUT /users/{user_id}/journal/{entry_id}`

Update a journal entry.

- **Auth required**: Yes
- **Request body** (`JournalEntryCreate`): Full replacement.
- **Response** (`JournalEntry`)

### `DELETE /users/{user_id}/journal/{entry_id}`

Delete a journal entry.

- **Auth required**: Yes
- **Response**: `{"status": "success"}`

---

## Notes (Vault)

All endpoints: `/users/{user_id}/notes`

### `POST /users/{user_id}/notes/`

Create a note.

- **Auth required**: Yes
- **Request body** (`NoteCreate`):
  | Field | Type | Required | Constraints |
  |---|---|---|---|
  | title | string | yes | 1–200 chars |
  | content | string | no | max 100000 chars |
  | folder | string | no | "Project", "Area", "Resource", "Archive"; default "Resource" |
- **Response** (`Note`)

```bash
curl -X POST http://localhost:8001/users/1/notes/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Meeting notes", "content": "# Agenda\n...", "folder": "Project"}'
```

### `GET /users/{user_id}/notes/`

List notes (newest updated first). Optionally filter by folder.

- **Auth required**: Yes
- **Query params**: `folder` (optional), `skip`, `limit` (max 200)
- **Response** (`Note[]`)

### `PUT /users/{user_id}/notes/{note_id}`

Update a note.

- **Auth required**: Yes
- **Request body** (`NoteUpdate`): Any subset of `{title, content, folder}`.
- **Response** (`Note`)

### `DELETE /users/{user_id}/notes/{note_id}`

Delete a note.

- **Auth required**: Yes
- **Response**: `{"status": "success"}`

---

## Tags

All endpoints: `/users/{user_id}/tags`

### `POST /users/{user_id}/tags/`

Create a tag. Tag names must be unique per user.

- **Auth required**: Yes
- **Request body** (`TagCreate`):
  | Field | Type | Required | Constraints |
  |---|---|---|---|
  | name | string | yes | 1–30 chars, non-empty |
  | color | string | no | Must be one of 8 predefined hex colors |
- **Response** (`TagOut`): `{id, user_id, name, color}`
- **Error**: 409 if tag name already exists.

```bash
curl -X POST http://localhost:8001/users/1/tags/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "urgent", "color": "#ef4444"}'
```

### `GET /users/{user_id}/tags/`

List all tags for the user.

- **Auth required**: Yes
- **Response** (`TagOut[]`)

### `PUT /users/{user_id}/tags/{tag_id}`

Update a tag.

- **Auth required**: Yes
- **Request body** (`TagUpdate`): `{name?, color?}`
- **Response** (`TagOut`)

### `DELETE /users/{user_id}/tags/{tag_id}`

Delete a tag. Removes from all task associations (cascade).

- **Auth required**: Yes
- **Response**: `{"ok": true}`

---

## Notifications

### `GET /users/{user_id}/notifications`

List all notifications for the user.

- **Auth required**: Yes
- **Response** (`NotificationOut[]`): `{id, user_id, task_id, type, message, is_read, dismissed, created_at}`

### `GET /users/{user_id}/notifications/unread-count`

Get count of unread notifications.

- **Auth required**: Yes
- **Response**: `{"count": 5}`

### `PUT /users/{user_id}/notifications/read-all`

Mark all notifications as read.

- **Auth required**: Yes
- **Response**: `{"status": "ok"}`

### `PUT /users/{user_id}/notifications/{notification_id}/read`

Mark a single notification as read.

- **Auth required**: Yes
- **Response** (`NotificationOut`)

### `DELETE /users/{user_id}/notifications/{notification_id}`

Dismiss a notification.

- **Auth required**: Yes
- **Response** (`NotificationOut`)

### `GET /users/{user_id}/reminder-config`

Get reminder configuration.

- **Auth required**: Yes
- **Response** (`ReminderConfigOut`): `{user_id, remind_days_before, remind_on_due_date, remind_when_overdue}`

### `PUT /users/{user_id}/reminder-config`

Update reminder configuration.

- **Auth required**: Yes
- **Request body** (`ReminderConfigUpdate`): `{remind_days_before?, remind_on_due_date?, remind_when_overdue?}`
- **Response** (`ReminderConfigOut`)

---

## Sync

### `POST /sync/habits/{user_id}`

Sync habits to tasks. Creates missing habit-tasks for the current period and removes orphaned ones.

- **Auth required**: Yes
- **Response**: `{"created": 2, "removed": 0, "total_habits": 5}`

```bash
curl -X POST http://localhost:8001/sync/habits/1 -H "Authorization: Bearer TOKEN"
```

### `POST /sync/recurring-tasks/{user_id}`

Sync recurring task templates to instances for the current period.

- **Auth required**: Yes
- **Response** (`RecurringSyncResponse`): `{"created": 1, "active_templates": 3}`

### `POST /sync/notifications/{user_id}`

Generate notifications for upcoming, due-today, and overdue tasks.

- **Auth required**: Yes
- **Response** (`NotificationSyncResponse`): `{"created": 4}`

---

## Analytics

### `GET /analytics/leaderboard`

Get the growth score leaderboard across all users.

- **Auth required**: Yes
- **Response**: Array of `{user_id, username, goal_rate, habit_index, snap_streaks, task_efficiency, growth_score}` sorted by growth_score descending.

```bash
curl http://localhost:8001/analytics/leaderboard -H "Authorization: Bearer TOKEN"
```

### `GET /analytics/users/{user_id}/personal`

Get personal analytics with breakdown scores for radar chart.

- **Auth required**: Yes (own user only)
- **Response**:
  ```json
  {
    "growth_score": 65.0, "goal_score": 50.0, "habit_score": 80.0,
    "task_score": 70.0, "journal_score": 40.0, "streak_score": 25.0,
    "total_goals": 5, "completed_goals": 2, "total_tasks": 20,
    "done_tasks": 14, "total_habits": 3, "active_streaks": 5, "journal_entries": 10
  }
  ```

### `GET /analytics/users/{user_id}/year-in-pixels`

Get 365-day mood and habit completion data for a pixel visualization.

- **Auth required**: Yes (own user only)
- **Response**: `{"pixels": [{date, mood, habit_ratio, intensity}, ...], "start_date": "...", "end_date": "..."}`

---

## Weekly Review

### `GET /users/{user_id}/weekly-review`

Get the full weekly review for a given week.

- **Auth required**: Yes
- **Query params**: `week` (optional, ISO 8601 format `YYYY-Www`, defaults to current week)
- **Response** (`WeeklyReviewResponse`): Comprehensive weekly data including completed tasks grouped by day, habit adherence grid, goal progress deltas, journal summaries, focus tasks, and week-over-week comparison stats.

```bash
curl "http://localhost:8001/users/1/weekly-review?week=2025-W27" \
  -H "Authorization: Bearer TOKEN"
```

### `PUT /users/{user_id}/weekly-review/{week}/reflection`

Create or update the weekly reflection.

- **Auth required**: Yes
- **Request body**: `{"content": "This week I..."}`  (1–10000 chars)
- **Response** (`WeeklyReflectionOut`)

### `POST /users/{user_id}/weekly-review/{week}/focus-tasks`

Add an existing task as a focus task for the week (max 7 per week).

- **Auth required**: Yes
- **Request body**: `{"task_id": 42}`
- **Response** (`FocusTaskOut`): `{id, user_id, task_id, week_identifier, task_title, task_status, task_priority, created_at}`
- **Errors**: 400 (limit reached), 404 (task not found), 409 (duplicate)

### `POST /users/{user_id}/weekly-review/{week}/focus-tasks/create`

Create a new task and immediately add it as a focus task.

- **Auth required**: Yes
- **Request body** (`TaskCreate`): Full task creation payload.
- **Response** (`FocusTaskOut`)

### `DELETE /users/{user_id}/weekly-review/{week}/focus-tasks/{task_id}`

Remove a focus task from the week.

- **Auth required**: Yes
- **Response**: `{"ok": true}`

---

## Export

### `GET /users/{user_id}/export/`

Export user data in JSON or CSV format.

- **Auth required**: Yes
- **Query params**:
  | Param | Type | Required | Description |
  |---|---|---|---|
  | format | string | no | `"json"` (default) or `"csv"` |
  | types | string | yes | Comma-separated: `tasks`, `goals`, `habits`, `journal`, `notes` |
  | start_date | string | no | YYYY-MM-DD |
  | end_date | string | no | YYYY-MM-DD |
- **Response**: File download.
  - JSON: Single `.json` file with metadata envelope.
  - CSV (single type): Single `.csv` file with UTF-8 BOM.
  - CSV (multiple types): `.zip` archive with one CSV per type.

```bash
curl "http://localhost:8001/users/1/export/?format=json&types=tasks,goals" \
  -H "Authorization: Bearer TOKEN" -o export.json
```

---

## Water Intake

All endpoints: `/api/water`

### `POST /api/water/entries`

Log a water intake entry.

- **Auth required**: Yes
- **Request body** (`WaterEntryCreate`):
  | Field | Type | Required | Constraints |
  |---|---|---|---|
  | amount_ml | int | yes | 1–5000 |
- **Response** (`WaterEntryOut`): `{id, user_id, amount_ml, timestamp}`

```bash
curl -X POST http://localhost:8001/api/water/entries \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount_ml": 250}'
```

### `GET /api/water/entries`

Get water entries for a specific date.

- **Auth required**: Yes
- **Query params**: `date` (required, YYYY-MM-DD)
- **Response** (`WaterEntryOut[]`)

### `DELETE /api/water/entries/{entry_id}`

Delete a water entry.

- **Auth required**: Yes
- **Response**: `{"message": "Entry deleted"}`

### `GET /api/water/progress`

Get daily water progress over a date range.

- **Auth required**: Yes
- **Query params**: `start_date`, `end_date` (both required, YYYY-MM-DD)
- **Response** (`DailyProgressOut[]`): `[{date, total_ml, goal_ml, percentage}, ...]`

### `PUT /api/water/goal`

Set or update daily water goal.

- **Auth required**: Yes
- **Request body** (`WaterGoalUpdate`): `{"amount_ml": 2500}` (500–10000)
- **Response** (`WaterGoalOut`): `{"amount_ml": 2500}`

### `GET /api/water/goal`

Get current water goal (defaults to 2000ml if not set).

- **Auth required**: Yes
- **Response** (`WaterGoalOut`): `{"amount_ml": 2000}`
