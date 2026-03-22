# Implementation Plan: Goal Progress Tracking

## Overview

Add progress computation, visual progress bars, auto-completion, progress history snapshots, and milestone tracking to the LifeOS goal system. Backend uses Python (FastAPI/SQLAlchemy/Pydantic) with a new `progress_engine.py` module and two new database tables. Frontend uses TypeScript (React) with a new ProgressBar component and updates to GoalsPage and Dashboard. Property-based tests use Hypothesis (backend) and Vitest (frontend).

## Tasks

- [x] 1. Database models and migration
  - [x] 1.1 Add ProgressSnapshot and GoalMilestone models to `backend/models.py`
    - Add `ProgressSnapshot` class with columns: `id`, `goal_id` (FK → goals.id), `date` (Date), `progress` (Integer)
    - Add unique constraint on `(goal_id, date)` named `uq_snapshot_goal_date`
    - Add `GoalMilestone` class with columns: `id`, `goal_id` (FK → goals.id), `threshold` (Integer), `achieved_at` (DateTime, default utcnow)
    - Add unique constraint on `(goal_id, threshold)` named `uq_milestone_goal_threshold`
    - Add `snapshots` and `milestones` relationships to the `Goal` model with cascade delete
    - _Requirements: 5.1, 5.2, 6.1, 6.4_

  - [x] 1.2 Create migration script `backend/migrate_goal_progress.py`
    - `upgrade()`: Create `progress_snapshots` and `goal_milestones` tables with all columns and constraints
    - `downgrade()`: Drop both tables
    - _Requirements: 5.1, 6.1_

- [x] 2. Progress Engine — core computation
  - [x] 2.1 Create `backend/progress_engine.py` with `compute_goal_progress` function
    - Compute progress as weighted average of task completion ratio and habit success rate
    - Return 0 when goal has no linked tasks and no linked habits
    - Clamp result to 0–100 range
    - Guard against division by zero for habits with `target_y_days = 0`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 Add `batch_compute_progress` function to `backend/progress_engine.py`
    - Accept list of goal IDs, return `dict[int, int]` mapping goal_id → progress
    - Use eager-loaded relationships to avoid N+1 queries
    - Return empty dict for empty input
    - _Requirements: 7.4_

  - [ ]* 2.3 Write property test: Progress computation is a weighted average
    - **Property 1: Progress computation is a weighted average**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - Create `backend/tests/test_progress_properties.py` using `hypothesis`
    - Generate random task sets with statuses from {Todo, InProgress, Done} and random habit sets with done/expected counts
    - Verify computed progress equals expected weighted average, and equals 0 when both collections are empty

  - [ ]* 2.4 Write property test: Progress field is a bounded integer
    - **Property 9: Progress field is a bounded integer**
    - **Validates: Requirements 7.1**
    - In `backend/tests/test_progress_properties.py`
    - For any generated goal configuration, verify `compute_goal_progress` returns an integer in [0, 100]

- [x] 3. Progress Engine — side effects
  - [x] 3.1 Add `_upsert_snapshot` function to `backend/progress_engine.py`
    - Create or update today's ProgressSnapshot for the goal using INSERT ON CONFLICT UPDATE
    - Skip upsert if progress hasn't changed from existing snapshot
    - _Requirements: 5.1, 5.2_

  - [x] 3.2 Add `_check_milestones` function to `backend/progress_engine.py`
    - Check progress against thresholds {25, 50, 75, 100}
    - Record milestone using INSERT ON CONFLICT DO NOTHING for newly crossed thresholds
    - _Requirements: 6.1, 6.2, 6.4_

  - [x] 3.3 Add `_check_auto_complete` function to `backend/progress_engine.py`
    - Set goal status to "Completed" if all linked tasks are Done and goal has at least one task
    - Revert to "Active" if not all tasks are Done
    - Never override "Archived" status
    - Record status change timestamp
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 3.4 Add `recalculate_goal_progress` function to `backend/progress_engine.py`
    - Call `compute_goal_progress`, then trigger `_upsert_snapshot`, `_check_milestones`, `_check_auto_complete`
    - Return the computed progress value
    - _Requirements: 1.4, 4.4, 5.1, 6.2_

  - [ ]* 3.5 Write property test: Auto-completion iff all tasks Done
    - **Property 3: Auto-completion iff all tasks Done**
    - **Validates: Requirements 4.1, 4.2**
    - In `backend/tests/test_progress_properties.py`
    - Generate non-Archived goals with random task statuses, verify goal is "Completed" iff all tasks are Done

  - [ ]* 3.6 Write property test: Archived status is never overridden
    - **Property 4: Archived status is never overridden by automation**
    - **Validates: Requirements 4.3**
    - In `backend/tests/test_progress_properties.py`
    - Generate Archived goals with all-Done tasks, verify status remains "Archived"

  - [ ]* 3.7 Write property test: At most one snapshot per goal per day
    - **Property 5: At most one snapshot per goal per day with latest value**
    - **Validates: Requirements 5.1, 5.2**
    - In `backend/tests/test_progress_properties.py`
    - Simulate multiple progress changes on the same day, verify exactly one snapshot exists with the latest value

  - [ ]* 3.8 Write property test: Milestone invariant — valid thresholds with no duplicates
    - **Property 7: Milestone invariant — valid thresholds with no duplicates**
    - **Validates: Requirements 6.1, 6.4**
    - In `backend/tests/test_progress_properties.py`
    - Generate sequences of progress recalculations, verify milestones are a subset of {25, 50, 75, 100} with no duplicates

  - [ ]* 3.9 Write property test: Milestones are recorded when thresholds are crossed
    - **Property 8: Milestones are recorded when thresholds are crossed**
    - **Validates: Requirements 6.2**
    - In `backend/tests/test_progress_properties.py`
    - Generate progress transitions crossing thresholds, verify milestone records exist after recalculation

- [x] 4. Checkpoint — Progress Engine complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Backend schemas and API updates
  - [x] 5.1 Add new Pydantic schemas to `backend/schemas.py`
    - Add `ProgressSnapshotOut` with fields: `date` (date), `progress` (int)
    - Add `GoalMilestoneOut` with fields: `threshold` (int), `achieved_at` (datetime)
    - Add `GoalWithProgress` extending existing Goal schema with `progress: int = 0`
    - Add `GoalDetailWithHistory` extending GoalDetail with `progress: int = 0`, `milestones: list[GoalMilestoneOut] = []`, `progress_history: list[ProgressSnapshotOut] = []`
    - _Requirements: 7.1, 7.2_

  - [x] 5.2 Update `backend/routers/goals.py` list endpoint
    - Modify GET `/users/{user_id}/goals/` to call `batch_compute_progress` and include `progress` field in each goal response
    - Use `GoalWithProgress` response schema
    - _Requirements: 2.5, 7.1, 7.4_

  - [x] 5.3 Update `backend/routers/goals.py` detail endpoint
    - Modify GET `/users/{user_id}/goals/{goal_id}` to call `recalculate_goal_progress`
    - Include `progress`, `milestones` (ordered by threshold), and `progress_history` (ordered by date descending) in response
    - Use `GoalDetailWithHistory` response schema
    - _Requirements: 5.3, 6.3, 7.2_

  - [ ]* 5.4 Write property test: Progress history is ordered by date descending
    - **Property 6: Progress history is ordered by date descending**
    - **Validates: Requirements 5.3**
    - In `backend/tests/test_progress_properties.py`
    - Generate goals with multiple snapshots, verify the detail response returns them sorted by date descending

  - [x] 5.5 Update `backend/routers/tasks.py` to trigger progress recalculation
    - In the PUT `/users/{user_id}/tasks/{task_id}` handler, after updating the task, if the task has a `goal_id` and the status field changed, call `recalculate_goal_progress(db, goal_id)`
    - _Requirements: 1.4_

  - [ ]* 5.6 Write property test: Progress recalculation reflects task status changes
    - **Property 2: Progress recalculation reflects task status changes**
    - **Validates: Requirements 1.4**
    - In `backend/tests/test_progress_properties.py`
    - Generate goals with tasks, change a task status, verify progress reflects the updated statuses

  - [x] 5.7 Update dashboard stats endpoint in `backend/routers/dashboard.py`
    - Modify GET `/users/{user_id}/dashboard/stats` to include per-goal progress for active goals using `batch_compute_progress`
    - Change `goal_completion_percentage` to average progress across active goals
    - Return active goals sorted by priority (High first), limited to 3
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 7.3_

  - [ ]* 5.8 Write property test: Dashboard active goals sorted by priority and limited to 3
    - **Property 10: Dashboard active goals are sorted by priority and limited to 3**
    - **Validates: Requirements 3.3**
    - In `backend/tests/test_progress_properties.py`
    - Generate sets of active goals with random priorities, verify dashboard returns at most 3 sorted by priority

  - [ ]* 5.9 Write property test: Dashboard KPI is average progress of active goals
    - **Property 11: Dashboard KPI is average progress of active goals**
    - **Validates: Requirements 3.4**
    - In `backend/tests/test_progress_properties.py`
    - Generate active goals with known progress values, verify KPI equals rounded arithmetic mean (or 0 if no active goals)

- [x] 6. Checkpoint — Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Frontend types and ProgressBar component
  - [x] 7.1 Update `frontend/src/types.ts` with progress-related interfaces
    - Add `ProgressSnapshot` interface with `date: string`, `progress: number`
    - Add `GoalMilestone` interface with `threshold: number`, `achieved_at: string`
    - Extend `Goal` interface (or add `GoalWithProgress`) with `progress: number`
    - Update `GoalDetail` interface to include `progress: number`, `milestones: GoalMilestone[]`, `progress_history: ProgressSnapshot[]`
    - _Requirements: 7.1, 7.2_

  - [x] 7.2 Create `frontend/src/components/ProgressBar.tsx`
    - Accept props: `progress` (0–100), `showLabel` (boolean, optional), `size` ('sm' | 'md', optional)
    - Render horizontal bar with percentage fill width
    - Use green color at 100%, default gradient otherwise
    - Show empty track with visible background at 0%
    - Display numeric percentage label when `showLabel` is true
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 7.3 Write unit tests for ProgressBar component
    - Create `frontend/src/components/__tests__/ProgressBar.test.tsx` using Vitest + React Testing Library
    - Test correct width percentage rendering
    - Test green style at 100%
    - Test empty track at 0%
    - Test numeric label display when `showLabel` is true
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 8. Frontend GoalsPage integration
  - [x] 8.1 Update GoalsPage goal cards to show ProgressBar
    - Import and render `<ProgressBar>` on each goal card using the `progress` field from the list API response
    - Display numeric percentage next to the bar
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 8.2 Update GoalsPage detail view with milestones and progress history
    - Show achieved milestones with their completion dates on the goal detail panel
    - Show progress history as a list of snapshots ordered by date descending
    - _Requirements: 5.3, 6.3_

- [x] 9. Frontend Dashboard integration
  - [x] 9.1 Update Dashboard active goals section with ProgressBar
    - Render `<ProgressBar>` on each active goal card using per-goal progress from stats API
    - Display numeric percentage for each active goal
    - _Requirements: 3.1, 3.2_

  - [x] 9.2 Update Dashboard KPI to show average progress
    - Change "Goal Progress" KPI card to display average progress across active goals instead of completed-goals ratio
    - _Requirements: 3.4_

- [x] 10. Final checkpoint — All integration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use `hypothesis` (backend) and validate the 11 correctness properties from the design
- Unit tests use `vitest` + React Testing Library (frontend)
- Progress is computed on-demand, not stored on the Goal row — snapshots capture historical values separately
- Batch computation avoids N+1 queries on list endpoints
