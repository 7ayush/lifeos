# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Habit-Task Sync Bugs
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the four bugs exist
  - **Scoped PBT Approach**: Scope properties to concrete failing cases for each bug
  - Write property-based tests in `backend/test_habit_sync_bugs.py` using pytest and the existing TestClient/DB pattern from `backend/test_main.py`
  - **Bug 1 — Import Error**: Test that `from backend.routers.sync import router` succeeds without `ImportError` (will FAIL on unfixed code because `sync.py` uses `from database import get_db` and `import crud` instead of relative imports)
  - **Bug 2 — Stale Tasks**: Create a user, create a habit (which auto-generates a linked task), update the habit title, then assert all pending tasks have `title == "🔁 {new_title}"` (will FAIL on unfixed code because `update_user_habit` doesn't propagate changes)
  - **Bug 4 — Period-Unaware Sync (daily)**: Create a user with a daily habit, manually insert a habit task with `target_date = yesterday`, run `sync_habit_tasks`, assert a new task exists with `target_date = today` (will FAIL because sync only checks if ANY task exists for the habit)
  - **Bug 4 — Period-Unaware Sync (weekly)**: Create a weekly habit with a task from last week, run sync, assert a new task for this week (will FAIL)
  - **Bug 4 — Period-Unaware Sync (monthly)**: Create a monthly habit with a task from last month, run sync, assert a new task for this month (will FAIL)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found (e.g., `ImportError`, stale task titles, missing period tasks)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Habit-Task Lifecycle Unchanged
  - **IMPORTANT**: Follow observation-first methodology - observe behavior on UNFIXED code first
  - Write property-based tests in `backend/test_habit_sync_preservation.py` using pytest
  - **Habit Creation Preservation**: Create a habit via API and verify a linked task with `task_type="habit"` and `title="🔁 {habit_title}"` is auto-generated (observe on unfixed code, should PASS)
  - **Cascade Delete Preservation**: Create a habit (which creates a linked task), delete the habit, verify all linked tasks are also deleted via cascade (observe on unfixed code, should PASS)
  - **Orphan Cleanup Preservation**: Create orphaned habit-tasks (tasks with `habit_id` pointing to a deleted habit), run `sync_habit_tasks`, verify orphaned tasks are removed (observe on unfixed code, should PASS)
  - **Manual Task Independence**: Create, update, and delete manual tasks (non-habit), then run sync operations and verify manual tasks are unaffected (observe on unfixed code, should PASS)
  - **Done Task Immutability**: Create a habit, mark its linked task as "Done", update the parent habit title, verify the Done task title is unchanged (observe on unfixed code, should PASS since `update_user_habit` doesn't touch tasks at all currently)
  - **Other Router Stability**: Verify that goals, habits, tasks, and other endpoints continue to function normally (observe on unfixed code, should PASS)
  - Use property-based approach: generate random habit titles, goal associations, and verify preservation invariants hold across the input domain
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix Habit-Task Sync Bugs

  - [x] 3.1 Fix sync router imports (Bug 1)
    - In `backend/routers/sync.py`, replace `from database import get_db` with `from ..database import get_db`
    - Replace `import crud` with `from .. import crud`
    - This matches the import pattern used by all other routers (e.g., `dashboard.py`, `habits.py`)
    - _Bug_Condition: isBugCondition(input) where input.action == "start_app" AND sync_router_uses_absolute_imports()_
    - _Expected_Behavior: App starts without ImportError, sync router loads correctly_
    - _Preservation: All other routers continue to function with their existing relative import patterns unchanged_
    - _Requirements: 1.1, 2.1, 3.6_

  - [x] 3.2 Add task propagation to `update_user_habit` (Bug 2)
    - In `backend/crud.py`, in the `update_user_habit` function, after updating habit fields and before `recalculate_habit_streak`
    - Query all linked tasks: `db.query(models.Task).filter(models.Task.habit_id == habit_id, models.Task.task_type == "habit", models.Task.status != "Done")`
    - For each pending task, update `title` to `f"🔁 {db_habit.title}"` and `goal_id` to `db_habit.goal_id`
    - _Bug_Condition: isBugCondition(input) where input.action == "update_habit" AND habit_has_pending_tasks(input.habit_id)_
    - _Expected_Behavior: All pending habit tasks reflect updated title and goal_id_
    - _Preservation: Done tasks are NOT modified; manual tasks are unaffected_
    - _Requirements: 1.2, 2.2, 3.4, 3.5_

  - [x] 3.3 Create migration script (Bug 3)
    - Create `backend/migrate_habit_task_sync.py`
    - Connect to SQLite database using the same `DATABASE_URL` from `backend/database.py`
    - Use `PRAGMA table_info(tasks)` to check if `habit_id` and `task_type` columns exist
    - If `habit_id` missing: `ALTER TABLE tasks ADD COLUMN habit_id INTEGER REFERENCES habits(id)`
    - If `task_type` missing: `ALTER TABLE tasks ADD COLUMN task_type VARCHAR DEFAULT 'manual'`
    - Print status messages for each operation
    - Make script runnable standalone with `if __name__ == "__main__"`
    - Script must be idempotent (safe to run multiple times)
    - _Bug_Condition: isBugCondition(input) where input.action == "migrate_db" AND NOT columns_exist("tasks", ["habit_id", "task_type"])_
    - _Expected_Behavior: Both columns exist in tasks table after running migration_
    - _Preservation: Existing data in tasks table is not modified_
    - _Requirements: 1.3, 2.3_

  - [x] 3.4 Add time-period awareness to `sync_habit_tasks` (Bug 4)
    - In `backend/crud.py`, in the `sync_habit_tasks` function
    - Import `datetime` and compute `today = datetime.date.today()`
    - For each habit, determine the current period based on `frequency_type`:
      - `daily` or `flexible`: check if a task exists with `target_date == today`
      - `weekly`: check if a task exists with `target_date` between Monday and Sunday of the current week
      - `monthly`: check if a task exists with `target_date` between 1st and last day of the current month
    - Replace the naive `habit.id not in linked_habit_ids` check with the period-aware check
    - Set `target_date = today` on newly created tasks (instead of `habit.start_date`)
    - _Bug_Condition: isBugCondition(input) where input.action == "sync_habits" AND habit_has_task_for_previous_period AND NOT habit_has_task_for_current_period_
    - _Expected_Behavior: New task created for current period; no duplicate within same period_
    - _Preservation: Orphan cleanup logic unchanged; habit creation auto-task unchanged_
    - _Requirements: 1.4, 1.5, 1.6, 2.4, 2.5, 2.6, 3.1, 3.3_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Habit-Task Sync Bugs Fixed
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior for all four bugs
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1 (`backend/test_habit_sync_bugs.py`)
    - **EXPECTED OUTCOME**: Test PASSES (confirms all bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Habit-Task Lifecycle Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2 (`backend/test_habit_sync_preservation.py`)
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `pytest backend/test_main.py backend/test_habit_sync_bugs.py backend/test_habit_sync_preservation.py -v`
  - Ensure all tests pass, ask the user if questions arise
