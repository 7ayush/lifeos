# LifeOS Multi-Feature Implementation Plan

## Overview

Five features covering PARA tooltips on Goals, Dashboard task efficiency carousel, X/Y target support in custom schedules + last date, label renames, and Habit↔Task sync. This plan is based on the previous agent's draft but enhanced with **correct file paths**, **detailed implementation specifics**, and a **comprehensive verification plan** grounded in the actual codebase.

---

## Feature 1: PARA Tooltips on Goals Section [COMPLETED]

Add informational tooltips to the PARA category filter buttons and the category selector in the create/edit modal so users understand what each PARA category means.

### Proposed Changes

#### [MODIFY] [GoalsPage.tsx](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/frontend/src/pages/GoalsPage.tsx)

- Add a `PARA_DESCRIPTIONS` constant map after `CATEGORY_COLORS` (~line 18):
  ```ts
  const PARA_DESCRIPTIONS: Record<string, string> = {
    Project: 'A goal with a clear deadline and deliverable outcome',
    Area: 'An ongoing area of responsibility to maintain over time',
    Resource: 'A topic or interest for future reference and learning',
    Archive: 'Completed or paused items no longer active',
  };
  ```
- **Filter bar** (~line 194): Add `title={PARA_DESCRIPTIONS[cat] || ''}` to each category `<button>`
- **Create/edit modal category selector** (~line 492): Add `title` to each `<option>`, and add a small info icon/helper text near the "Category (P.A.R.A.)" label showing descriptions on hover using a CSS-only tooltip

---

## Feature 2: Task Efficiency Carousel on Dashboard [COMPLETED]

Replace the single "Task Efficiency" KPI card with a rotating circular carousel showing **Daily** (today), **Monthly** (current month), and **Annual** (current year) task completion percentages.

### Proposed Changes

#### [MODIFY] [dashboard.py](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/backend/routers/dashboard.py)

- Modify `get_dashboard_stats` (line 14) to compute and return `task_efficiency` as an object:
  ```python
  "task_efficiency": {
      "daily": <% of tasks due today that are done>,
      "monthly": <% of tasks due this month that are done>,
      "annual": <% of tasks due this year that are done>,
  }
  ```
- The existing `task_efficiency_percentage` key will be **replaced** by the new `task_efficiency` object
- Import `datetime` is already present

#### [MODIFY] [types.ts](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/frontend/src/types.ts)

- Change `DashboardStats` interface (line 151):
  ```ts
  export interface TaskEfficiencyBreakdown {
    daily: number;
    monthly: number;
    annual: number;
  }
  
  export interface DashboardStats {
    active_streaks: number;
    goal_completion_percentage: number;
    task_efficiency: TaskEfficiencyBreakdown;
    upcoming_deadlines: number;
  }
  ```

#### [MODIFY] [Dashboard.tsx](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/frontend/src/pages/Dashboard.tsx)

- Replace the static "Task Efficiency" KPI card (the third item in the KPI array, ~line 226) with a **carousel widget**:
  - Three slides: "Today", "This Month", "This Year"
  - Each slide shows a **circular SVG progress ring** with the percentage centered
  - Auto-rotates every 4 seconds via `setInterval`
  - Left/Right chevron arrows for manual navigation
  - Dot indicators below showing current slide
- State: `const [efficiencySlide, setEfficiencySlide] = useState(0);`

---

## Feature 3: X/Y Target Support in Custom Schedules + Last Date Calculation [COMPLETED]

Currently the HabitsPage modal has no schedule/frequency type UI, only showing X/Y target fields for the default "flexible" mode. This feature:
1. Adds X/Y target support inside **custom schedules** 
2. Calculates and displays a **"Last Date"** for habits based on `start_date + target_y_days`

### Proposed Changes

#### [MODIFY] [HabitsPage.tsx](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/frontend/src/pages/HabitsPage.tsx)

- Add a computed **"Last Date" display** below the X/Y fields in the modal:
  - `lastDate = addDays(new Date(startDate), targetY)`
  - Show as read-only field: `"Ends on: Mar 28, 2026"`
- When `frequencyType === 'custom'` and a schedule is set, still show Target Days (X) and Total Days (Y) inputs
- Update `handleSubmit` to send `frequency_type`, `repeat_days`, `target_x`, and `target_y_days` for custom scheduled habits

> [!IMPORTANT]
> The current HabitsPage has **no frequency type selector UI** at all — only the X/Y fields. The `frequency_type`, `repeat_days`, etc. fields exist on the model/schema but are not exposed in the frontend's create/edit modal. Implementing full schedule mode UI is a larger effort. For this iteration, I will add the **last date computation display** based on the existing X/Y fields, and add frequency type selection to the modal for the first time.

---

## Feature 4: Label Renames [COMPLETED]

Simple string replacements in the habit creation modal labels.

### Proposed Changes

#### [MODIFY] [HabitsPage.tsx](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/frontend/src/pages/HabitsPage.tsx)

| Current Label | New Label |
|---|---|
| `Target (X days)` (line 455) | `Target Days` |
| `Period (Y days)` (line 469) | `Total Days` |
| `"Target (X) cannot be greater than Period (Y)."` (line 89) | `"Target Days cannot be greater than Total Days."` |

---

## Feature 5: Habit↔Task Sync [IN PROGRESS]

> [!CAUTION]
> This is the most complex feature. It creates a **bidirectional relationship** between Habits and Tasks, where:
> - Creating a habit auto-generates a Task for the current period (day/week/month)  
> - Editing a habit updates associated pending tasks; deleting removes them
> - On app load, a **sync endpoint** ensures tasks exist for the current period
> - `habit_logs` is **kept for now** as a parallel system during transition

### Proposed Changes

#### [MODIFY] [models.py](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/backend/models.py)

- Add to `Task` model (~line 70):
  ```python
  habit_id = Column(Integer, ForeignKey("habits.id"), nullable=True)
  task_type = Column(String, default="manual")  # "manual" or "habit"
  ```
- Add relationships:
  ```python
  # On Task:
  habit = relationship("Habit", back_populates="tasks")
  # On Habit:
  tasks = relationship("Task", back_populates="habit")
  ```

#### [NEW] [migrate_habit_task_sync.py](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/backend/migrate_habit_task_sync.py)

- Migration script to add `habit_id` and `task_type` columns to the `tasks` table using `ALTER TABLE` (SQLite compatible)

#### [MODIFY] [schemas.py](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/backend/schemas.py)

- Add `habit_id: Optional[int] = None` and `task_type: Optional[str] = "manual"` to `TaskCreate`, `TaskUpdate`, and `Task` response schemas

#### [MODIFY] [crud.py](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/backend/crud.py)

- New function `sync_habit_tasks(db, user_id)`:
  - For each active habit belonging to the user, determine if a task exists for the current period
  - **Daily/flexible habits**: Check for task with `target_date = today` and `habit_id = habit.id`
  - **Weekly habits**: Check for task with `target_date` within current week
  - **Monthly habits**: Check for task with `target_date` within current month
  - Create missing tasks with `task_type="habit"`, auto-title format: `"{habit.title} — {date_display}"`
- Modify `create_user_habit`: After creating habit, call task creation for the current period
- Modify `update_user_habit`: Update associated pending (non-Done) habit tasks
- Modify `delete_user_habit`: Delete all associated habit tasks before deleting the habit

#### [NEW] [sync.py](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/backend/routers/sync.py)

- New `POST /users/{user_id}/sync` endpoint that calls `sync_habit_tasks` and returns `{ "tasks_created": N }`

#### [MODIFY] [main.py](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/backend/main.py)

- Import and register the new `sync` router

#### [MODIFY] [types.ts](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/frontend/src/types.ts)

- Add `habit_id?: number` and `task_type?: string` to the `Task` interface
- Add to `TaskCreate`: `habit_id?: number`

#### [MODIFY] [api/index.ts](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/frontend/src/api/index.ts)

- Add `syncUserData(userId)` API call: `POST /users/{userId}/sync`

#### [MODIFY] [Dashboard.tsx](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/frontend/src/pages/Dashboard.tsx)

- Call `syncUserData(user.id)` on initial load (before fetching dashboard data) in `loadDashboardData`

#### [MODIFY] [KanbanBoard.tsx](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/frontend/src/pages/KanbanBoard.tsx)

- Show habit-generated tasks with a distinct 🔄 badge next to the title when `task.task_type === 'habit'`
- Prevent deletion of habit-generated tasks (show a tooltip saying "Managed by habit")

> [!WARNING]
> **Re: `habit_logs` table**: Keeping `habit_logs` as a parallel system during this transition. Tasks become the primary tracking mechanism, but habit_logs continues working as fallback. We can deprecate it later.

---

## Execution Order

1. **Feature 4** — Label renames (trivial, ~2 min)
2. **Feature 1** — PARA tooltips (~5 min)
3. **Feature 2** — Task efficiency carousel (medium: backend + frontend)
4. **Feature 3** — X/Y last date display + frequency type selector (medium: frontend + logic)
5. **Feature 5** — Habit↔Task sync (large: DB migration + CRUD + endpoint + frontend sync)

---

## Verification Plan

### Automated Tests

The existing test file is [test_main.py](file:///Users/aykaushi2401/Documents/Projects/Github/lifeos/backend/test_main.py). It uses `TestClient` with an SQLite test database.

**Command to run existing tests:**
```bash
cd /Users/aykaushi2401/Documents/Projects/Github/lifeos && python -m pytest backend/test_main.py -v
```

**New test additions** (added to `test_main.py`):
1. **Task efficiency endpoint**: Test that `GET /users/{user_id}/dashboard/stats` returns the new `task_efficiency` object with `daily`, `monthly`, `annual` keys
2. **Habit-task sync**: 
   - `POST /users/{user_id}/habits/` → verify a task is auto-created with `task_type="habit"`
   - `POST /users/{user_id}/sync` → verify sync creates missing tasks
   - `DELETE /users/{user_id}/habits/{habit_id}` → verify associated tasks are deleted

### Browser Verification

After implementing, I will verify in the browser:
1. **PARA tooltips**: Hover over category filter buttons on Goals page → tooltip appears
2. **Task efficiency carousel**: Dashboard shows rotating carousel with circular progress rings, arrows work
3. **Label renames**: Open habit creation modal → verify "Target Days" and "Total Days" labels
4. **Last date display**: Create a habit → see "Ends on: ..." computed field
5. **Habit-task sync**: Create a habit → navigate to Kanban → see auto-created task with 🔄 badge
