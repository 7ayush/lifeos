# Multi-Feature Implementation Plan

## Overview

Five features covering Goals tooltips, Dashboard task efficiency carousel, schedule X/Y support, label renames, and Habit→Task sync.

---

## Feature 1: PARA Tooltips on Goals Section

Add informational tooltips to the PARA category badges/filters so users understand what each category means.

### Proposed Changes

#### [MODIFY] [GoalsPage.tsx](file:///Users/administrator/Desktop/Projects/life-os/frontend/src/pages/GoalsPage.tsx)

- Add a `PARA_DESCRIPTIONS` constant with explanations for each category:
  - **Project**: A goal with a clear deadline and deliverable outcome
  - **Area**: An ongoing area of responsibility to maintain over time
  - **Resource**: A topic or interest for future reference and learning
  - **Archive**: Completed or paused items no longer active
- Add hover tooltip (CSS `title` attribute or custom tooltip component) to each PARA category button in the filter bar and to the category badge in the create/edit modal

---

## Feature 2: Task Efficiency Carousel on Dashboard

Replace the single "Task Efficiency" KPI card with a rotating circular carousel showing **Daily** (today), **Monthly** (current month), and **Annual** (current year) task completion percentages.

### Proposed Changes

#### [MODIFY] [dashboard.py](file:///Users/administrator/Desktop/Projects/life-os/backend/routers/dashboard.py)

- Modify `get_dashboard_stats` to return `task_efficiency` as an object with three breakdowns:
  ```python
  "task_efficiency": {
      "daily": <% of tasks due today that are done>,
      "monthly": <% of tasks due this month that are done>,
      "annual": <% of tasks due this year that are done>,
  }
  ```

#### [MODIFY] [types.ts](file:///Users/administrator/Desktop/Projects/life-os/frontend/src/types.ts)

- Update `DashboardStats` interface to reflect the new `task_efficiency` object shape

#### [MODIFY] [Dashboard.tsx](file:///Users/administrator/Desktop/Projects/life-os/frontend/src/pages/Dashboard.tsx)

- Replace the static "Task Efficiency" KPI card with a carousel widget:
  - Three slides: "Today", "This Month", "This Year"
  - Each slide shows a **circular progress ring** with the percentage
  - Auto-rotates every 4 seconds
  - Left/Right chevron arrows for manual navigation
  - Dot indicators below showing current slide

---

## Feature 3: X/Y Target Support in Custom Schedules + Last Date Calculation

Currently, switching to "Scheduled" mode hides the X/Y target fields. This feature:
1. Brings back X/Y target support inside **custom schedules** (meaning "do X days within Y days, but only on scheduled days")
2. Calculates and displays a **last date** for both flexible and scheduled habits based on X, Y, and the start date

### Proposed Changes

#### [MODIFY] [HabitsPage.tsx](file:///Users/administrator/Desktop/Projects/life-os/frontend/src/pages/HabitsPage.tsx)

- When `frequencyMode === 'scheduled'` **and** `frequencyType === 'custom'`, show Target Days (X) and Total Days (Y) inputs below the day selector
- Add a **computed "Last Date" display** for both modes:
  - **Daily (flexible)**: `lastDate = startDate + Y days`
  - **Custom scheduled**: `lastDate = startDate + Y days` (Y is the rolling window period)  
  - Show it as a read-only field: "Ends on: Mar 28, 2026"
- Update `handleSubmit` to send `target_x` and `target_y_days` for custom scheduled habits

> [!IMPORTANT]
> Clarification needed: Does "last date" mean the habit simply displays when the current Y-day window ends, or does the habit auto-deactivate after that date? I'll implement it as a **display-only computed field** initially.

---

## Feature 4: Label Renames

Simple string replacements across the habit creation modal.

### Proposed Changes

#### [MODIFY] [HabitsPage.tsx](file:///Users/administrator/Desktop/Projects/life-os/frontend/src/pages/HabitsPage.tsx)

| Current Label | New Label |
|---|---|
| `Flexible (X/Y)` | `Daily` |
| `Target (X days)` | `Target Days` |
| `Period (Y days)` | `Total Days` |

---

## Feature 5: Habit↔Task Sync

> [!CAUTION]
> This is the most complex feature. It creates a **bidirectional relationship** between Habits and Tasks, where:
> - Creating a habit auto-generates a Task for the current period (day/week/month)
> - Editing a habit updates associated tasks; deleting removes them
> - On app load, a **sync endpoint** ensures tasks exist for the current period
> - This essentially replaces `habit_logs` with Tasks as the tracking mechanism

### Proposed Changes

#### [MODIFY] [models.py](file:///Users/administrator/Desktop/Projects/life-os/backend/models.py)

- Add `habit_id` column to the `Task` model (nullable FK to `habits.id`)
- Add `task_type` column: `"manual"` (user-created) or `"habit"` (auto-generated)
- Add relationship: `Task.habit` ↔ `Habit.tasks`

#### [NEW] [migrate_habit_task_sync.py](file:///Users/administrator/Desktop/Projects/life-os/backend/migrate_habit_task_sync.py)

- Migration script to add `habit_id` and `task_type` columns to the `tasks` table

#### [MODIFY] [schemas.py](file:///Users/administrator/Desktop/Projects/life-os/backend/schemas.py)

- Add `habit_id` and `task_type` to `Task` response schema
- Add `habit_id` and `task_type` to `TaskCreate` (optional)

#### [MODIFY] [crud.py](file:///Users/administrator/Desktop/Projects/life-os/backend/crud.py)

- New function `sync_habit_tasks(db, user_id)`:
  - For each active habit, determine if a task exists for the current period
  - **Daily habits**: Check for task with `target_date = today`
  - **Weekly habits**: Check for task with `target_date` within current week
  - **Monthly habits**: Check for task with `target_date` within current month  
  - Create missing tasks, auto-title them (e.g. "Read 10 Pages — Mar 21")
- Update `create_user_habit` to call task creation for the current period
- Update `update_user_habit` to update associated pending tasks
- Update `delete_user_habit` to cascade-delete associated habit tasks
- **Modify habit logging**: When a habit task is marked "Done", update the habit streak; when toggling a habit, update the corresponding task status

#### [NEW] [sync.py](file:///Users/administrator/Desktop/Projects/life-os/backend/routers/sync.py)

- New `POST /users/{user_id}/sync` endpoint that calls `sync_habit_tasks`
- Returns count of tasks created/updated

#### [MODIFY] [types.ts](file:///Users/administrator/Desktop/Projects/life-os/frontend/src/types.ts)

- Add `habit_id?: number` and `task_type?: string` to `Task` interface

#### [MODIFY] [api/index.ts](file:///Users/administrator/Desktop/Projects/life-os/frontend/src/api/index.ts)

- Add `syncUserData(userId)` API call

#### [MODIFY] [Dashboard.tsx](file:///Users/administrator/Desktop/Projects/life-os/frontend/src/pages/Dashboard.tsx)

- Call `syncUserData` on initial load before fetching dashboard data

#### [MODIFY] [KanbanBoard.tsx](file:///Users/administrator/Desktop/Projects/life-os/frontend/src/pages/KanbanBoard.tsx)

- Show habit-generated tasks with a distinct badge (e.g. 🔄 icon)
- When completing a habit task, also update the habit streak via the existing log endpoint

> [!WARNING]
> **Re: Removing `habit_logs` table**: I recommend **keeping `habit_logs` for now** as a parallel system during this transition, rather than immediately deleting it. The Tasks-based tracking can be the primary system, while habit_logs continues working as a fallback. We can deprecate it later once the task sync is battle-tested.

---

## Verification Plan

### Automated Tests
- Verify backend API returns correct task efficiency breakdowns via `curl`
- Test habit creation generates corresponding tasks via API
- Test sync endpoint creates missing tasks for current period
- Test habit deletion cascades to associated tasks

### Browser Verification
- Verify PARA tooltips appear on hover in Goals page
- Verify task efficiency carousel rotates and displays correct percentages
- Verify custom schedule shows X/Y inputs and last date
- Verify label renames display correctly
- Verify habit creation creates a task visible in Kanban board

---

## Execution Order

1. **Feature 4** (label renames) — trivial, 2 minutes
2. **Feature 1** (PARA tooltips) — small, 5 minutes
3. **Feature 2** (task efficiency carousel) — medium, backend + frontend
4. **Feature 3** (X/Y in custom schedules + last date) — medium, frontend + logic
5. **Feature 5** (habit↔task sync) — large, DB migration + new CRUD + new endpoint + frontend sync
