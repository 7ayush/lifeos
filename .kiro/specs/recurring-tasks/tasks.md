# Implementation Plan: Recurring Tasks

## Overview

Add native recurrence support to the Task entity using a template/instance pattern. The backend extends the Task model with recurrence fields and a self-referential `parent_task_id`, adds a sync engine for instance generation, and modifies CRUD operations for template lifecycle. The frontend adds recurrence UI to the task modal and recurring indicators on the Kanban board.

## Tasks

- [ ] 1. Database migration and model layer
  - [ ] 1.1 Add recurrence columns and parent_task_id to the Task model in `backend/models.py`
    - Add columns: `parent_task_id` (Integer, ForeignKey to tasks.id, nullable), `frequency_type` (String, nullable), `repeat_interval` (Integer, default 1), `repeat_days` (String, nullable), `ends_type` (String, nullable), `ends_on_date` (Date, nullable), `ends_after_occurrences` (Integer, nullable)
    - Add self-referential relationship: `parent_task = relationship("Task", remote_side=[id], backref="instances")`
    - Update `task_type` column comment to include "recurring" as a valid value
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 1.2 Create database migration script `backend/migrate_recurring_tasks.py`
    - Follow the pattern from `backend/migrate_habits_recurrence.py`
    - ALTER TABLE tasks to add all new columns
    - Handle idempotent execution (check if columns exist before adding)
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 1.3 Update Pydantic schemas in `backend/schemas.py`
    - Add recurrence fields to `TaskCreate`: `frequency_type`, `repeat_interval`, `repeat_days`, `ends_type`, `ends_on_date`, `ends_after_occurrences` (all optional)
    - Add same recurrence fields to `TaskUpdate`
    - Add `parent_task_id` and recurrence fields to `Task` response schema
    - Add new `RecurringSyncResponse` schema with `created: int` and `active_templates: int`
    - _Requirements: 1.2, 1.3, 8.2_

  - [ ]* 1.4 Write property tests for template vs instance classification (Property 1)
    - **Property 1: Template vs Instance Classification**
    - For any Task with task_type "recurring", it is a template iff parent_task_id is null, and an instance iff parent_task_id is not null
    - Use Hypothesis to generate random recurring tasks and verify classification
    - **Validates: Requirements 1.4, 1.5, 6.3**

  - [ ]* 1.5 Write property test for recurrence config round-trip (Property 2)
    - **Property 2: Recurrence Config Persistence Round-Trip**
    - For any valid recurrence config, creating a template and reading it back yields identical field values
    - Use Hypothesis strategies for valid frequency_type, repeat_interval, repeat_days, ends_type combinations
    - **Validates: Requirements 2.1**

- [ ] 2. Backend validation and template creation
  - [x] 2.1 Implement `validate_recurrence_config` in `backend/crud.py`
    - Raise ValueError if frequency_type is "weekly" and repeat_days is empty/null
    - Raise ValueError if ends_type is "on" and ends_on_date is missing
    - Raise ValueError if ends_type is "after" and ends_after_occurrences is missing or < 1
    - Validate frequency_type is one of: daily, weekly, monthly, annually, custom
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 2.2 Modify `create_user_task` in `backend/crud.py` to handle recurring templates
    - When task_type is "recurring", call `validate_recurrence_config` before persisting
    - After persisting the template, call `sync_recurring_tasks` to generate the first instance
    - Return the created template
    - _Requirements: 2.1, 2.5_

  - [x] 2.3 Update `create_task_for_user` endpoint in `backend/routers/tasks.py`
    - Catch ValueError from validation and return 422 with appropriate error detail
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ]* 2.4 Write property test for recurrence validation (Property 3)
    - **Property 3: Recurrence Validation Rejects Invalid Configs**
    - Generate invalid configs (weekly without repeat_days, "on" without ends_on_date, "after" without valid ends_after_occurrences) and verify rejection
    - Use Hypothesis `InvalidRecurrenceConfig` strategy
    - **Validates: Requirements 2.2, 2.3, 2.4**

  - [ ]* 2.5 Write property test for template creation generating first instance (Property 4)
    - **Property 4: Template Creation Generates First Instance**
    - After creating a valid recurring template, exactly one instance exists with status "Todo" and target_date in current period
    - **Validates: Requirements 2.5**

- [x] 3. Sync engine implementation
  - [x] 3.1 Implement `sync_recurring_tasks` in `backend/crud.py`
    - Follow the pattern from `sync_habit_tasks`
    - Fetch all templates for user (task_type "recurring", parent_task_id is null)
    - For each template, check end conditions (ends_type "on" with expired date, ends_type "after" with count met)
    - Determine current period based on frequency_type (today for daily, current week for weekly, current month for monthly, current year for annually)
    - Check repeat_interval: calculate elapsed periods from template created_at, skip if not a matching period
    - If no instance exists for current period, create one copying title, description, goal_id, energy_level, estimated_minutes from template, set status "Todo" and parent_task_id
    - For weekly frequency, set target_date to next matching day from repeat_days
    - Return dict with `created` count and `active_templates` count
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [x] 3.2 Add sync endpoint in `backend/routers/sync.py`
    - Add `POST /sync/recurring-tasks/{user_id}` endpoint
    - Call `crud.sync_recurring_tasks` and return `RecurringSyncResponse`
    - Follow the existing `sync_habits_to_tasks` pattern
    - _Requirements: 8.1, 8.2_

  - [ ]* 3.3 Write property test for sync generating instances (Property 5)
    - **Property 5: Sync Generates Instance for Current Period**
    - For any active template, after sync, an instance exists for the current period (unless repeat_interval skips it)
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

  - [ ]* 3.4 Write property test for sync respecting end conditions (Property 6)
    - **Property 6: Sync Respects End Conditions**
    - Templates past ends_on_date or at/above ends_after_occurrences produce zero new instances
    - **Validates: Requirements 3.6, 3.7**

  - [ ]* 3.5 Write property test for instance fields matching template (Property 7)
    - **Property 7: Generated Instance Fields Match Template**
    - Every generated instance has title, description, goal_id, energy_level, estimated_minutes matching its template, and status "Todo"
    - **Validates: Requirements 3.8, 3.9**

  - [ ]* 3.6 Write property test for repeat interval (Property 8)
    - **Property 8: Sync Respects Repeat Interval**
    - Templates with repeat_interval > 1 only generate instances for matching periods
    - **Validates: Requirements 3.10**

  - [ ]* 3.7 Write property test for sync response counts (Property 14)
    - **Property 14: Sync Response Contains Accurate Counts**
    - The returned created count equals actual new instances inserted, active_templates equals non-ended templates
    - **Validates: Requirements 8.2**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Template update and deletion logic
  - [x] 5.1 Modify `update_task` in `backend/crud.py` for template updates
    - Detect if the task being updated is a template (task_type "recurring", parent_task_id is null)
    - If only detail fields changed (title, description, energy_level, estimated_minutes): propagate changes to all linked instances with status "Todo"
    - If recurrence config changed: delete all linked instances with status "Todo", then call `sync_recurring_tasks` to regenerate
    - Preserve instances with status "InProgress" or "Done" in both cases
    - If updating an instance, block changes to recurrence fields and return 400 error
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 5.2 Modify `delete_task` in `backend/crud.py` for template deletion
    - Detect if the task being deleted is a template
    - Delete all linked instances with status "Todo"
    - Orphan instances with status "InProgress" or "Done": set parent_task_id to null, task_type to "manual"
    - Delete the template record
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.3 Update task endpoints in `backend/routers/tasks.py`
    - Update `update_task` endpoint to handle ValueError from recurrence validation on template updates
    - Update `delete_task` endpoint to use the modified delete logic
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.3_

  - [ ]* 5.4 Write property test for template detail update propagation (Property 9)
    - **Property 9: Template Detail Update Propagates to Todo Instances**
    - Updating template detail fields propagates to all linked Todo instances
    - **Validates: Requirements 4.1**

  - [ ]* 5.5 Write property test for recurrence config update regeneration (Property 10)
    - **Property 10: Template Recurrence Config Update Regenerates Instances**
    - Changing recurrence config deletes Todo instances and regenerates new ones
    - **Validates: Requirements 4.2**

  - [ ]* 5.6 Write property test for update preserving non-Todo instances (Property 11)
    - **Property 11: Template Update Preserves Non-Todo Instances**
    - InProgress and Done instances remain unchanged after any template update
    - **Validates: Requirements 4.3**

  - [ ]* 5.7 Write property test for template deletion cleanup (Property 12)
    - **Property 12: Template Deletion Removes Template and Todo Instances**
    - After deletion, template and all Todo instances no longer exist
    - **Validates: Requirements 5.1, 5.3**

  - [ ]* 5.8 Write property test for deletion orphaning completed instances (Property 13)
    - **Property 13: Template Deletion Orphans Completed Instances**
    - InProgress/Done instances get parent_task_id set to null and task_type set to "manual"
    - **Validates: Requirements 5.2**

- [ ] 6. Task query filtering and instance isolation
  - [x] 6.1 Modify `get_user_tasks` in `backend/crud.py` to exclude templates
    - Filter out records where task_type is "recurring" AND parent_task_id is null
    - Ensure instances (task_type "recurring" with parent_task_id set) are still returned
    - _Requirements: 6.1, 6.3_

  - [ ]* 6.2 Write property test for instance status change isolation (Property 15)
    - **Property 15: Instance Status Change Is Isolated**
    - Changing an instance status does not affect the template or sibling instances
    - **Validates: Requirements 9.1, 9.2**

  - [ ]* 6.3 Write property test for instance deletion isolation (Property 16)
    - **Property 16: Instance Deletion Is Isolated**
    - Deleting a single instance does not affect the template or sibling instances
    - **Validates: Requirements 9.3**

- [x] 7. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Frontend types and API layer
  - [x] 8.1 Extend TypeScript types in `frontend/src/types.ts`
    - Add to `Task` interface: `parent_task_id`, `frequency_type`, `repeat_interval`, `repeat_days`, `ends_type`, `ends_on_date`, `ends_after_occurrences`
    - Add same recurrence fields to `TaskCreate` interface
    - _Requirements: 1.2, 1.3_

  - [x] 8.2 Add `syncRecurringTasks` API function in `frontend/src/api/index.ts`
    - Add `syncRecurringTasks(userId: number)` that calls `POST /sync/recurring-tasks/${userId}`
    - Return `{ created: number; active_templates: number }`
    - _Requirements: 8.1, 8.2_

- [x] 9. Kanban board integration
  - [x] 9.1 Update `KanbanBoard.tsx` to call sync on mount
    - Call `syncRecurringTasks(userId)` on page load, before fetching the task list
    - Handle sync failure gracefully: show toast notification, still load existing tasks
    - _Requirements: 8.3, 6.1_

  - [x] 9.2 Add recurring indicator to task cards in `KanbanBoard.tsx`
    - Display a 🔁 icon/badge on task cards where `parent_task_id` is not null
    - On clicking the recurring indicator, open the TaskModal in template-edit mode by fetching the parent template via `parent_task_id`
    - Templates are already excluded server-side, no client-side filtering needed
    - _Requirements: 6.2, 6.4_

- [x] 10. Task modal recurrence UI
  - [x] 10.1 Add "Recurring" toggle and recurrence config fields to the task creation/edit modal
    - Add a "Recurring" toggle that reveals recurrence fields when enabled
    - Show fields: frequency_type dropdown, repeat_interval input, repeat_days checkboxes (conditional on weekly), ends_type radio group, ends_on_date picker (conditional on "on"), ends_after_occurrences input (conditional on "after")
    - Wire form submission to include recurrence fields when task_type is "recurring"
    - _Requirements: 7.1, 7.2_

  - [x] 10.2 Implement instance vs template editing behavior in the task modal
    - When editing an instance: disable recurrence fields, show "Edit Template" link that opens the parent template
    - When editing a template: enable all fields including recurrence config
    - _Requirements: 7.3, 7.4_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use Hypothesis with `@settings(max_examples=100)`
- The sync engine follows the existing `sync_habit_tasks` pattern in `backend/crud.py`
- Migration script follows the pattern from `backend/migrate_habits_recurrence.py`
- Instances do not carry recurrence config — it lives only on the template
