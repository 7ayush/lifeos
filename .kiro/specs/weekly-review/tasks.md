# Implementation Plan: Weekly Review

## Overview

Add a Weekly Review/Planning page to LifeOS that aggregates tasks, habits, goals, and journal data into a weekly summary. Backend introduces two new database models (`WeeklyReflection`, `FocusTask`), a `week_summary_engine.py` service module, new Pydantic schemas, CRUD functions, and a dedicated FastAPI router. Frontend adds TypeScript types, an API module, a `WeeklyReviewPage` with sub-components (WeekNavigator, TaskSummarySection, HabitSummarySection, GoalProgressSection, JournalSummarySection, ReflectionSection, FocusTasksSection, StatisticsSection), and integrates into routing and sidebar. Property-based tests use Hypothesis (backend) and fast-check (frontend).

## Tasks

- [x] 1. Database models and migration
  - [x] 1.1 Add WeeklyReflection and FocusTask models to `backend/models.py`
    - Add `WeeklyReflection` class with columns: `id`, `user_id` (FK → users.id), `week_identifier` (String), `content` (Text), `created_at`, `updated_at`
    - Add unique constraint on `(user_id, week_identifier)` named `uq_reflection_user_week`
    - Add `FocusTask` class with columns: `id`, `user_id` (FK → users.id), `task_id` (FK → tasks.id), `week_identifier` (String), `created_at`
    - Add unique constraint on `(user_id, task_id, week_identifier)` named `uq_focus_user_task_week`
    - Add `weekly_reflections` and `focus_tasks` relationships to the `User` model
    - Add `task` relationship on `FocusTask` pointing to `Task`
    - _Requirements: 11.1, 11.5, 12.1, 12.6_

  - [x] 1.2 Create migration script `backend/migrate_weekly_review.py`
    - `upgrade()`: Create `weekly_reflections` and `focus_tasks` tables with all columns and constraints
    - `downgrade()`: Drop both tables
    - _Requirements: 11.1, 12.1_

- [x] 2. Backend Week Summary Engine
  - [x] 2.1 Create `backend/week_summary_engine.py` with week utility functions
    - Implement `get_week_boundaries(week_identifier: str) -> tuple[date, date]` — parse ISO 8601 week string, return (monday, sunday), raise `ValueError` for invalid format
    - Implement `get_current_week_identifier() -> str` — return current week as "YYYY-Www"
    - Validate week identifier format with regex `^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$`
    - _Requirements: 1.2, 2.1, 10.2, 10.3_

  - [x] 2.2 Add `compute_task_summary` to `backend/week_summary_engine.py`
    - Query tasks completed within the week boundary
    - Group completed tasks by day of the week
    - Compute completion rate (done / total)
    - Return zero values when no tasks exist
    - _Requirements: 1.1, 1.2, 1.4, 3.1, 3.2, 3.3_

  - [x] 2.3 Add `compute_habit_summary` to `backend/week_summary_engine.py`
    - Query habit logs within the week boundary
    - Compute adherence rate per habit: done_logs / expected_completions
    - For daily habits, expected = 7; for weekly/repeat_days habits, expected = count of configured days in the week
    - Build day-by-day status grid (Mon–Sun) per habit
    - Include current streak count
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.4 Add `compute_goal_progress` to `backend/week_summary_engine.py`
    - Query ProgressSnapshot records to compute per-goal delta for the week
    - Delta = latest snapshot on/before Sunday minus latest snapshot on/before previous Sunday (0 if no prior snapshot)
    - Sort goals by priority (High, Medium, Low)
    - _Requirements: 1.3, 5.1, 5.2, 5.3, 5.4_

  - [x] 2.5 Add `compute_journal_summary` to `backend/week_summary_engine.py`
    - Query journal entries within the week boundary
    - Compute average mood from non-null mood values (null if none)
    - Truncate content preview to first 200 characters
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 2.6 Add `compute_statistics` to `backend/week_summary_engine.py`
    - Compute daily task completion counts (Mon–Sun)
    - Compute completion rate and habit adherence rate for current and previous week
    - Calculate week-over-week change percentages
    - Compute total estimated/actual minutes and efficiency ratio for completed tasks
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 2.7 Add `build_weekly_review` orchestrator to `backend/week_summary_engine.py`
    - Call all compute functions and assemble the full `WeeklyReviewData` response
    - Include reflection and focus tasks from CRUD layer
    - _Requirements: 10.4_

  - [ ]* 2.8 Write property test: Week boundary filtering (Property 1)
    - **Property 1: Week boundary filtering**
    - **Validates: Requirements 1.1, 1.2, 3.1**
    - Create `backend/tests/test_week_summary_engine.py` using Hypothesis
    - Verify only records within the week boundary appear in summary output

  - [ ]* 2.9 Write property test: Goal progress delta computation (Property 2)
    - **Property 2: Goal progress delta computation**
    - **Validates: Requirements 1.3**
    - In `backend/tests/test_week_summary_engine.py`
    - Verify delta equals latest snapshot on/before Sunday minus latest snapshot on/before previous Sunday

  - [ ]* 2.10 Write property test: Week identifier to date range mapping (Property 4)
    - **Property 4: Week identifier to date range mapping**
    - **Validates: Requirements 2.4**
    - Verify `get_week_boundaries` returns a Monday and Sunday exactly 6 days apart in the correct ISO week

  - [ ]* 2.11 Write property test: Habit adherence rate computation (Property 6)
    - **Property 6: Habit adherence rate computation**
    - **Validates: Requirements 4.2, 4.3, 4.4**
    - Verify adherence rate equals done_logs / expected_completions with correct expected values per frequency type

  - [ ]* 2.12 Write property test: Goals sorted by priority (Property 7)
    - **Property 7: Goals sorted by priority**
    - **Validates: Requirements 5.4**
    - Verify goals are returned in High, Medium, Low order

  - [ ]* 2.13 Write property test: Journal content preview truncation (Property 8)
    - **Property 8: Journal content preview truncation**
    - **Validates: Requirements 6.1**
    - Verify preview is at most 200 chars and is a prefix of the original content

  - [ ]* 2.14 Write property test: Average mood computation (Property 9)
    - **Property 9: Average mood computation**
    - **Validates: Requirements 6.3**
    - Verify average mood equals arithmetic mean of non-null mood values, or null if none

  - [ ]* 2.15 Write property test: Daily task counts sum to total completed (Property 14)
    - **Property 14: Daily task counts sum to total completed**
    - **Validates: Requirements 9.1**
    - Verify sum of daily counts equals total completed task count

  - [ ]* 2.16 Write property test: Week-over-week comparison change calculation (Property 15)
    - **Property 15: Week-over-week comparison change calculation**
    - **Validates: Requirements 9.2, 9.3, 9.4**
    - Verify completion_rate_change = completion_rate - previous_completion_rate

  - [ ]* 2.17 Write property test: Time tracking efficiency computation (Property 16)
    - **Property 16: Time tracking efficiency computation**
    - **Validates: Requirements 9.5**
    - Verify efficiency_ratio = total_actual / total_estimated (or 0 if estimated is 0)

- [x] 3. Checkpoint — Week Summary Engine complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Backend schemas
  - [x] 4.1 Add weekly review Pydantic schemas to `backend/schemas.py`
    - Add `WeeklyReflectionIn`, `WeeklyReflectionOut`, `FocusTaskIn`, `FocusTaskOut`
    - Add `CompletedTaskOut`, `HabitWeekSummary`, `GoalWeekProgress`, `JournalEntrySummary`
    - Add `DailyTaskCount`, `WeekComparisonStats`, `WeeklyReviewResponse`
    - _Requirements: 10.4, 11.2, 12.2_

- [x] 5. Backend CRUD functions
  - [x] 5.1 Add weekly review CRUD functions to `backend/crud.py`
    - `get_weekly_reflection(db, user_id, week_identifier) -> WeeklyReflection | None`
    - `upsert_weekly_reflection(db, user_id, week_identifier, content) -> WeeklyReflection`
    - `get_focus_tasks(db, user_id, week_identifier) -> list[FocusTask]`
    - `add_focus_task(db, user_id, task_id, week_identifier) -> FocusTask`
    - `remove_focus_task(db, user_id, task_id, week_identifier) -> None`
    - `count_focus_tasks(db, user_id, week_identifier) -> int`
    - _Requirements: 11.2, 11.3, 11.4, 12.2, 12.3_

  - [ ]* 5.2 Write property test: Reflection persistence round-trip (Property 10)
    - **Property 10: Reflection persistence round-trip**
    - **Validates: Requirements 7.3, 7.4, 7.5, 11.3, 11.4, 11.5**
    - Verify save then retrieve returns same content; upsert overwrites; at most one record per user-week

  - [ ]* 5.3 Write property test: Focus task add/remove round-trip (Property 11)
    - **Property 11: Focus task add/remove round-trip**
    - **Validates: Requirements 8.2, 8.4, 12.6**
    - Verify add then query includes task; remove then query excludes task; no duplicates

  - [ ]* 5.4 Write property test: Focus task maximum limit invariant (Property 12)
    - **Property 12: Focus task maximum limit invariant**
    - **Validates: Requirements 8.3, 12.4**
    - Verify system rejects additions beyond 7 focus tasks per week

- [x] 6. Backend router
  - [x] 6.1 Create `backend/routers/weekly_review.py`
    - `GET /users/{user_id}/weekly-review?week=YYYY-Www` — return full weekly review data, default to current week
    - `PUT /users/{user_id}/weekly-review/{week}/reflection` — create or update reflection
    - `POST /users/{user_id}/weekly-review/{week}/focus-tasks` — add focus task (body: `{task_id}`)
    - `DELETE /users/{user_id}/weekly-review/{week}/focus-tasks/{task_id}` — remove focus task
    - `POST /users/{user_id}/weekly-review/{week}/focus-tasks/create` — create new task and auto-designate as focus task
    - Validate week identifier format, return 422 for invalid format
    - Enforce focus task limit of 7, return 400 when exceeded
    - Return 404 for non-existent tasks
    - Return 409 for duplicate focus task designations
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 11.2, 11.3, 11.4, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 6.2 Write property test: Invalid week identifier validation (Property 17)
    - **Property 17: Invalid week identifier validation**
    - **Validates: Requirements 10.3**
    - In `backend/tests/test_weekly_review_api.py`
    - Verify non-ISO-8601 week strings return HTTP 422

  - [ ]* 6.3 Write property test: Non-existent task rejection for focus tasks (Property 18)
    - **Property 18: Non-existent task rejection for focus tasks**
    - **Validates: Requirements 12.5**
    - In `backend/tests/test_weekly_review_api.py`
    - Verify adding a focus task with non-existent task_id returns HTTP 404

  - [ ]* 6.4 Write property test: Focus task reflects current task status (Property 13)
    - **Property 13: Focus task reflects current task status**
    - **Validates: Requirements 8.5**
    - In `backend/tests/test_weekly_review_api.py`
    - Verify focus task `task_status` matches the linked task's current status

- [x] 7. Backend router registration
  - [x] 7.1 Register weekly review router in `backend/main.py`
    - Import `weekly_review` from `backend.routers`
    - Add `app.include_router(weekly_review.router)`
    - _Requirements: 10.1_

- [x] 8. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Frontend types
  - [x] 9.1 Add weekly review TypeScript types to `frontend/src/types.ts`
    - Add interfaces: `WeeklyReflection`, `FocusTaskItem`, `CompletedTaskItem`, `HabitWeekSummary`, `GoalWeekProgress`, `JournalEntrySummary`, `DailyTaskCount`, `WeekComparisonStats`, `WeeklyReviewData`
    - _Requirements: 10.4_

- [x] 10. Frontend API module
  - [x] 10.1 Create `frontend/src/api/weeklyReview.ts`
    - `getWeeklyReview(userId, week?)` — GET weekly review data
    - `saveReflection(userId, week, content)` — PUT reflection
    - `addFocusTask(userId, week, taskId)` — POST focus task
    - `removeFocusTask(userId, week, taskId)` — DELETE focus task
    - `createFocusTask(userId, week, task)` — POST create task + auto-designate
    - _Requirements: 10.1, 10.4, 11.2, 12.2, 12.3_

- [x] 11. Frontend WeeklyReviewPage and sub-components
  - [x] 11.1 Create `WeekNavigator` component at `frontend/src/components/weekly-review/WeekNavigator.tsx`
    - Display week identifier and date range (e.g. "2025-W03 · Jan 13 – Jan 19")
    - Previous/Next navigation buttons
    - Disable Next button when on current week
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 11.2 Create `TaskSummarySection` component at `frontend/src/components/weekly-review/TaskSummarySection.tsx`
    - Display completed tasks grouped by day of the week
    - Show task title, priority badge, linked goal title, completion date
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 11.3 Create `HabitSummarySection` component at `frontend/src/components/weekly-review/HabitSummarySection.tsx`
    - Show each habit with adherence rate, streak count, and 7-day status grid (Mon–Sun)
    - _Requirements: 4.1, 4.2_

  - [x] 11.4 Create `GoalProgressSection` component at `frontend/src/components/weekly-review/GoalProgressSection.tsx`
    - List goals sorted by priority with current progress, weekly delta indicator, and target date
    - Show positive/zero/stagnation indicators for delta
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 11.5 Create `JournalSummarySection` component at `frontend/src/components/weekly-review/JournalSummarySection.tsx`
    - List journal entries with date, mood indicator (1–5), content preview (200 chars)
    - Show average mood for the week
    - Display prompt if no entries exist
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 11.6 Create `ReflectionSection` component at `frontend/src/components/weekly-review/ReflectionSection.tsx`
    - Reuse existing `MarkdownEditor` component for writing/editing reflection
    - Display guided reflection prompts above the editor
    - Auto-save on blur with 500ms debounce
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 11.7 Create `FocusTasksSection` component at `frontend/src/components/weekly-review/FocusTasksSection.tsx`
    - Allow selecting existing tasks as focus items (max 7)
    - Show current status of each focus task
    - Support creating a new task inline and auto-designating as focus task
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 11.8 Create `StatisticsSection` component at `frontend/src/components/weekly-review/StatisticsSection.tsx`
    - Bar chart of daily task completions (Mon–Sun)
    - Summary cards for completion rate and habit adherence with week-over-week comparison
    - Time tracking efficiency card (estimated vs actual minutes, efficiency ratio)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 11.9 Create `WeeklyReviewPage` at `frontend/src/pages/WeeklyReviewPage.tsx`
    - Manage selected week state, fetch weekly review data via API
    - Render WeekNavigator and all sub-sections
    - Handle loading and error states
    - _Requirements: 1.1, 2.1, 10.4_

  - [ ]* 11.10 Write property test: Week navigation round-trip (Property 3)
    - **Property 3: Week navigation round-trip**
    - **Validates: Requirements 2.2, 2.3**
    - In `frontend/src/utils/__tests__/weekUtils.test.ts` using fast-check
    - Verify navigating previous then next returns the original week identifier

  - [ ]* 11.11 Write property test: Completed tasks grouped by correct day (Property 5)
    - **Property 5: Completed tasks grouped by correct day**
    - **Validates: Requirements 3.3**
    - In `frontend/src/utils/__tests__/weekUtils.test.ts`
    - Verify each task appears in the correct day group with no duplicates or omissions

- [x] 12. Frontend routing and sidebar integration
  - [x] 12.1 Add `/weekly-review` route to `frontend/src/App.tsx`
    - Import `WeeklyReviewPage` and add route inside the protected layout
    - _Requirements: 1.1, 2.1_

  - [x] 12.2 Add Weekly Review link to `frontend/src/components/Sidebar.tsx`
    - Add navigation item for Weekly Review page
    - _Requirements: 1.1_

- [x] 13. Final checkpoint — All integration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use Hypothesis (backend) and fast-check (frontend) to validate the 18 correctness properties from the design
- Unit tests use Vitest + React Testing Library (frontend)
- The `WeekSummaryEngine` is a stateless service module — it queries existing models and computes aggregated statistics
- Sub-components live under `frontend/src/components/weekly-review/` to keep the feature organized
