# Habit-Task Sync Fixes Bugfix Design

## Overview

The Habit↔Task Sync feature has four bugs that collectively render it non-functional: (1) broken imports in the sync router crash the app on startup, (2) updating a habit doesn't propagate changes to linked pending tasks, (3) no migration script exists for existing databases, and (4) the sync function doesn't account for time periods when checking for existing tasks. The fix strategy is to address each bug independently with minimal, targeted changes while preserving all existing behavior.

## Glossary

- **Bug_Condition (C)**: The set of conditions across four bugs that cause the habit-task sync feature to malfunction — broken imports, missing task propagation, missing migration, and missing time-period awareness
- **Property (P)**: The desired behavior — app starts cleanly, habit updates propagate to pending tasks, migration script exists and works, and sync creates period-appropriate tasks
- **Preservation**: Existing behavior that must remain unchanged — habit creation auto-generates tasks, cascade deletes, orphan cleanup, manual task independence, and Done task immutability
- **`sync_habit_tasks`**: The function in `backend/crud.py` that ensures every active habit has a linked task for the current period
- **`update_user_habit`**: The function in `backend/crud.py` that updates a habit record and should propagate changes to pending linked tasks
- **`backend/routers/sync.py`**: The sync router that exposes the sync endpoint, currently using broken absolute imports
- **frequency_type**: The `Habit.frequency_type` field that determines the recurrence period — `flexible`, `daily`, `weekly`, `monthly`, etc.

## Bug Details

### Fault Condition

The bugs manifest across four distinct conditions:

**Bug 1 — Import Error**: When the FastAPI app starts and loads `backend/routers/sync.py`, the file uses `from database import get_db` and `import crud` (absolute imports) instead of relative imports, causing an `ImportError`.

**Bug 2 — Stale Tasks**: When `update_user_habit` is called, it updates only the `Habit` row and never queries or updates associated `Task` rows where `task_type="habit"` and `status != "Done"`.

**Bug 3 — Missing Migration**: When an existing database (created before the habit-task sync feature) is used, the `habit_id` and `task_type` columns are missing from the `tasks` table because `create_all` doesn't alter existing tables and no migration script exists.

**Bug 4 — Missing Period Check**: When `sync_habit_tasks` runs, it checks `habit.id not in linked_habit_ids` (whether ANY task exists for the habit) instead of checking whether a task exists for the CURRENT time period.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type {action, context}
  OUTPUT: boolean

  // Bug 1: Import error on app startup
  IF input.action == "start_app" AND sync_router_uses_absolute_imports()
    RETURN TRUE

  // Bug 2: Habit update doesn't propagate to pending tasks
  IF input.action == "update_habit" AND habit_has_pending_tasks(input.habit_id)
    RETURN TRUE

  // Bug 3: Existing DB missing columns
  IF input.action == "migrate_db" AND NOT columns_exist("tasks", ["habit_id", "task_type"])
    RETURN TRUE

  // Bug 4: Sync doesn't check current period
  IF input.action == "sync_habits" AND habit_has_task_for_previous_period(input.habit_id)
     AND NOT habit_has_task_for_current_period(input.habit_id, input.habit.frequency_type)
    RETURN TRUE

  RETURN FALSE
END FUNCTION
```

### Examples

- **Bug 1**: Starting the app raises `ImportError: No module named 'database'` because `sync.py` uses `from database import get_db` instead of `from ..database import get_db`
- **Bug 2**: User renames habit "Read 30min" to "Read 1hr"; the linked pending task still shows "🔁 Read 30min"
- **Bug 3**: Existing user upgrades; `SELECT habit_id FROM tasks` fails with `OperationalError: no such column: tasks.habit_id`
- **Bug 4**: User has a daily habit "Exercise" with a task for yesterday; `sync_habit_tasks` sees a task already exists for that habit and skips creating today's task
- **Bug 4 (weekly)**: User has a weekly habit "Review goals" with a task from last week; sync doesn't create a new task for this week
- **Bug 4 (monthly)**: User has a monthly habit "Budget review" with a task from last month; sync doesn't create a new task for this month

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Creating a new habit auto-generates a linked task with `task_type="habit"` and `target_date=habit.start_date`
- Deleting a habit cascades to delete all associated habit tasks via the SQLAlchemy relationship
- `sync_habit_tasks` removes orphaned habit-tasks (tasks whose linked habit no longer exists)
- Manual tasks (`task_type="manual"`) are never affected by habit-task sync logic
- Habit tasks already marked as "Done" are not modified when the parent habit is updated
- All other routers (goals, habits, tasks, journal, notes, users, auth, analytics, dashboard) continue to function with their existing relative import patterns

**Scope:**
All inputs that do NOT involve the four bug conditions should be completely unaffected by this fix. This includes:
- All non-sync router endpoints
- Manual task CRUD operations
- Habit creation and deletion (already working correctly)
- Habit logging and streak calculation
- Goal CRUD and progress computation

## Hypothesized Root Cause

Based on the bug analysis, the root causes are:

1. **Bug 1 — Copy-paste error in imports**: `backend/routers/sync.py` was likely written as a standalone script or copied without adapting imports to the package structure. All other routers in `backend/routers/` use `from .. import crud` and `from ..database import get_db`, but `sync.py` uses `from database import get_db` and `import crud`.

2. **Bug 2 — Missing propagation logic in `update_user_habit`**: The function only updates the `Habit` model fields and recalculates the streak. It never queries `Task` rows linked via `habit_id` to propagate changes like title or goal_id. The `create_user_habit` function correctly creates a linked task, but the update path was never implemented.

3. **Bug 3 — No migration script created**: SQLAlchemy's `Base.metadata.create_all()` only creates new tables; it does not add columns to existing tables. The `habit_id` and `task_type` columns were added to the `Task` model but no `ALTER TABLE` migration was provided for existing databases.

4. **Bug 4 — Naive existence check in `sync_habit_tasks`**: The function builds `linked_habit_ids` as the set of all habit IDs that have ANY existing task, regardless of date. It should instead check whether a task exists for the current period (today for daily/flexible, this week for weekly, this month for monthly) before deciding to create a new one.

## Correctness Properties

Property 1: Fault Condition — Sync Router Imports

_For any_ application startup that loads the sync router, the router module SHALL use relative imports (`from .. import crud`, `from ..database import get_db`) and the application SHALL start without `ImportError`.

**Validates: Requirements 2.1**

Property 2: Fault Condition — Habit Update Propagates to Pending Tasks

_For any_ habit update where the habit has associated pending (non-Done) tasks, the `update_user_habit` function SHALL update the title (as `🔁 {new_title}`) and `goal_id` on all linked tasks where `task_type="habit"` and `status != "Done"`.

**Validates: Requirements 2.2**

Property 3: Fault Condition — Migration Script Adds Missing Columns

_For any_ existing SQLite database where the `tasks` table lacks `habit_id` and `task_type` columns, the migration script SHALL add both columns using `ALTER TABLE` statements with appropriate defaults (`NULL` for `habit_id`, `"manual"` for `task_type`).

**Validates: Requirements 2.3**

Property 4: Fault Condition — Sync Creates Period-Appropriate Tasks

_For any_ user with active habits, `sync_habit_tasks` SHALL check for existing tasks within the current time period (today for daily/flexible, current week Mon–Sun for weekly, current month for monthly) and SHALL create a new task only if none exists for that period.

**Validates: Requirements 2.4, 2.5, 2.6**

Property 5: Preservation — Existing Habit-Task Lifecycle Unchanged

_For any_ input where the bug condition does NOT hold (habit creation, habit deletion with cascade, orphan cleanup, manual task operations, Done task immutability), the fixed code SHALL produce the same result as the original code, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `backend/routers/sync.py`

**Change 1 — Fix imports**:
- Replace `from database import get_db` with `from ..database import get_db`
- Replace `import crud` with `from .. import crud`
- This matches the pattern used by all other routers (e.g., `dashboard.py`)

**File**: `backend/crud.py`

**Function**: `update_user_habit`

**Change 2 — Propagate habit updates to pending tasks**:
- After updating the habit fields and before recalculating the streak, query all linked tasks: `db.query(models.Task).filter(Task.habit_id == habit_id, Task.task_type == "habit", Task.status != "Done")`
- For each pending task, update `title` to `f"🔁 {db_habit.title}"` and `goal_id` to `db_habit.goal_id`
- Commit these changes along with the habit update

**Function**: `sync_habit_tasks`

**Change 3 — Add time-period awareness**:
- Import `datetime` at function scope (or module level)
- Compute `today = datetime.date.today()`
- For each habit, determine the current period based on `frequency_type`:
  - `daily` or `flexible`: check if a task exists with `target_date == today`
  - `weekly`: check if a task exists with `target_date` between Monday and Sunday of the current week
  - `monthly`: check if a task exists with `target_date` in the current month (1st to last day)
- Replace the naive `habit.id not in linked_habit_ids` check with the period-aware check
- Set `target_date = today` on newly created tasks (instead of `habit.start_date`)

**New File**: `backend/migrate_habit_task_sync.py`

**Change 4 — Create migration script**:
- Connect to the SQLite database using the same `DATABASE_URL` from `backend/database.py`
- Check if `habit_id` column exists in `tasks` table using `PRAGMA table_info(tasks)`
- If missing, execute `ALTER TABLE tasks ADD COLUMN habit_id INTEGER REFERENCES habits(id)`
- Check if `task_type` column exists
- If missing, execute `ALTER TABLE tasks ADD COLUMN task_type VARCHAR DEFAULT 'manual'`
- Print status messages for each operation
- Make the script runnable standalone (`if __name__ == "__main__"`)

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that exercise each bug condition on the unfixed code to observe failures and confirm root causes.

**Test Cases**:
1. **Import Error Test**: Attempt to import `backend.routers.sync` and assert it raises `ImportError` (will fail on unfixed code — confirms Bug 1)
2. **Stale Task Test**: Create a habit, update its title, query linked pending tasks and assert title matches new title (will fail on unfixed code — confirms Bug 2)
3. **Period-Unaware Sync Test**: Create a daily habit with a task for yesterday, run `sync_habit_tasks`, assert a new task exists for today (will fail on unfixed code — confirms Bug 4)
4. **Weekly Period Test**: Create a weekly habit with a task from last week, run sync, assert new task for this week (will fail on unfixed code)
5. **Monthly Period Test**: Create a monthly habit with a task from last month, run sync, assert new task for this month (will fail on unfixed code)

**Expected Counterexamples**:
- Bug 1: `ImportError: No module named 'database'`
- Bug 2: Pending task title remains `🔁 Old Title` after habit renamed to `New Title`
- Bug 4: No new task created for today/this week/this month because sync sees an existing task for a previous period

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

Specifically:
- For Bug 1: `from backend.routers.sync import router` succeeds without error
- For Bug 2: After `update_user_habit(db, habit_id, HabitUpdate(title="New"))`, all pending tasks have `title == "🔁 New"`
- For Bug 3: After running migration, `PRAGMA table_info(tasks)` includes `habit_id` and `task_type`
- For Bug 4: After `sync_habit_tasks(db, user_id)`, a task exists with `target_date` in the current period for each habit

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-bug inputs (habit creation, deletion, manual tasks, Done tasks), then write property-based tests capturing that behavior.

**Test Cases**:
1. **Habit Creation Preservation**: Create a habit and verify a linked task with `task_type="habit"` is auto-generated (should pass on both unfixed and fixed code)
2. **Cascade Delete Preservation**: Delete a habit and verify all linked tasks are removed (should pass on both)
3. **Orphan Cleanup Preservation**: Create orphaned habit-tasks, run sync, verify they're removed (should pass on both)
4. **Manual Task Independence**: Create/update/delete manual tasks and verify they're unaffected by sync operations (should pass on both)
5. **Done Task Immutability**: Mark a habit task as Done, update the parent habit, verify the Done task is unchanged (should pass on unfixed, must pass on fixed)

### Unit Tests

- Test sync router imports resolve correctly
- Test `update_user_habit` propagates title and goal_id to pending tasks
- Test `update_user_habit` does NOT modify Done tasks
- Test `sync_habit_tasks` creates tasks for today (daily/flexible habits)
- Test `sync_habit_tasks` creates tasks for current week (weekly habits)
- Test `sync_habit_tasks` creates tasks for current month (monthly habits)
- Test `sync_habit_tasks` does NOT create duplicate tasks within the same period
- Test migration script adds columns to a table missing them
- Test migration script is idempotent (safe to run twice)

### Property-Based Tests

- Generate random habit configurations (varying frequency_type, start_date) and verify sync creates exactly one task per current period
- Generate random sequences of habit updates and verify all pending tasks reflect the latest habit state
- Generate random mixes of manual and habit tasks and verify manual tasks are never modified by sync or habit update operations
- Generate random habit lifecycles (create, update, delete) and verify cascade behavior is preserved

### Integration Tests

- Test full flow: create user → create habit → verify task created → update habit → verify task updated → sync → verify period-appropriate tasks
- Test sync endpoint via HTTP: POST `/sync/habits/{user_id}` returns correct created/removed counts
- Test that all existing API endpoints (goals, tasks, journal, etc.) continue to work after the sync router import fix
