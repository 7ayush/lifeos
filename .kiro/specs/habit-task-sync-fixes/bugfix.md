# Bugfix Requirements Document

## Introduction

The Habit↔Task Sync feature (Feature 5) in LifeOS has four bugs that prevent it from functioning correctly. These range from a startup-crashing import error in the sync router, to missing logic for updating linked tasks when habits change, a missing database migration script for existing users, and incomplete time-period awareness in the sync function. Together, these bugs render the habit-task synchronization feature non-functional.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the FastAPI application starts and loads the sync router (`backend/routers/sync.py`) THEN the system raises an `ImportError` because the file uses absolute imports (`from database import get_db` and `import crud`) while the `backend` package requires relative imports

1.2 WHEN a user updates a habit (e.g., changes its title) via `update_user_habit` THEN the system only updates the habit record itself and does NOT update associated pending (non-Done) habit tasks, leaving them with stale data (e.g., old title)

1.3 WHEN a user with an existing database runs the application after the Habit↔Task Sync feature is deployed THEN the system fails to add the `habit_id` and `task_type` columns to the existing `tasks` table because no migration script (`migrate_habit_task_sync.py`) was created, and SQLAlchemy's `create_all` does not alter existing tables

1.4 WHEN `sync_habit_tasks` runs for a user with daily habits THEN the system only checks whether ANY task exists for a given habit (regardless of date) rather than checking whether a task exists for the CURRENT period (today for daily/flexible, this week for weekly, this month for monthly), resulting in missing tasks for new periods

1.5 WHEN `sync_habit_tasks` runs for a user with weekly habits THEN the system does not check whether a task exists within the current week, so no new task is created at the start of a new week

1.6 WHEN `sync_habit_tasks` runs for a user with monthly habits THEN the system does not check whether a task exists within the current month, so no new task is created at the start of a new month

1.7 User comment -  There should be only one task for a given habit for a given day. It is just that in the case that an event lies on current day/week/month it should be visible when that filter is selected.

### Expected Behavior (Correct)

2.1 WHEN the FastAPI application starts and loads the sync router THEN the system SHALL use relative imports (`from .. import crud` and `from ..database import get_db`) consistent with all other routers in the package, and the application SHALL start without import errors

2.2 WHEN a user updates a habit via `update_user_habit` THEN the system SHALL also update all associated pending (non-Done) habit tasks to reflect the changes (e.g., updated title, updated goal_id)

2.3 WHEN a user with an existing database runs the application after the Habit↔Task Sync feature is deployed THEN the system SHALL have a migration script (`backend/migrate_habit_task_sync.py`) available that adds the `habit_id` and `task_type` columns to the existing `tasks` table using SQLite-compatible `ALTER TABLE` statements

2.4 WHEN `sync_habit_tasks` runs for a user with daily or flexible habits THEN the system SHALL check whether a task exists with `target_date = today` for each habit, and SHALL create a new task only if no task exists for today

2.5 WHEN `sync_habit_tasks` runs for a user with weekly habits THEN the system SHALL check whether a task exists with `target_date` within the current week (Monday through Sunday) for each habit, and SHALL create a new task only if no task exists for the current week

2.6 WHEN `sync_habit_tasks` runs for a user with monthly habits THEN the system SHALL check whether a task exists with `target_date` within the current month for each habit, and SHALL create a new task only if no task exists for the current month

2.7 Make sure that there are no redundancies in fields and that we have proper DBMS table structure.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user creates a new habit THEN the system SHALL CONTINUE TO auto-generate a linked task with `task_type="habit"` as it does currently

3.2 WHEN a user deletes a habit THEN the system SHALL CONTINUE TO delete all associated habit tasks via the cascade relationship

3.3 WHEN `sync_habit_tasks` runs and finds orphaned habit-tasks (tasks whose linked habit has been deleted) THEN the system SHALL CONTINUE TO remove those orphaned tasks

3.4 WHEN a user creates, updates, or deletes manual tasks (non-habit tasks) THEN the system SHALL CONTINUE TO handle them normally without any interference from the habit-task sync logic

3.5 WHEN a user updates a habit and all associated habit tasks are already marked as Done THEN the system SHALL CONTINUE TO leave those completed tasks unchanged

3.6 WHEN all other routers (goals, habits, tasks, journal, notes, users, auth, analytics, dashboard) are loaded THEN the system SHALL CONTINUE TO function with their existing relative import patterns unchanged
