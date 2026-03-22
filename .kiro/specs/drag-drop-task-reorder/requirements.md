# Requirements Document

## Introduction

This feature adds persistent drag-and-drop task reordering within Kanban board columns in the LifeOS productivity app. Currently, tasks can be dragged between columns to change status, but there is no way to control or persist the order of tasks within a column. This feature introduces a `sort_order` field on tasks, a backend reorder endpoint, and frontend logic so that users can manually reorder tasks within a column by dragging, with that order persisting across page reloads. Manual reorder overrides the default priority-based sort.

## Glossary

- **Task_Model**: The SQLAlchemy database model representing a task, stored in the `tasks` table.
- **Task_Schema**: The Pydantic schemas (`TaskBase`, `TaskCreate`, `TaskUpdate`, `Task`) used for API request/response validation.
- **Task_API**: The backend REST API endpoints under `/users/{user_id}/tasks` that handle task CRUD operations.
- **Kanban_Board**: The frontend page (`KanbanBoard.tsx`) that displays tasks in draggable columns grouped by status (Todo, InProgress, Done, Archived).
- **Sort_Order**: An integer field on a task that determines its display position within a Kanban column. Lower values appear first.
- **Reorder_Endpoint**: A dedicated API endpoint that accepts an ordered list of task IDs and updates their sort_order values accordingly.
- **Same_Column_Reorder**: A drag-and-drop operation where a task is moved to a different position within the same Kanban column without changing status.
- **Cross_Column_Move**: A drag-and-drop operation where a task is moved from one Kanban column to another, changing its status and inserting it at a specific position.
- **Priority_Sort**: The existing default sort that orders tasks by priority (High → Medium → Low → None) within a column.

## Requirements

### Requirement 1: Sort Order Data Model

**User Story:** As a developer, I want the task data model to include a sort_order field, so that task ordering within columns can be persisted in the database.

#### Acceptance Criteria

1. THE Task_Model SHALL include a `sort_order` column of type Integer with a default value of 0.
2. THE Task_Schema SHALL include a `sort_order` field in the `Task` response schema.
3. WHEN a task is created without specifying a sort_order, THE Task_API SHALL store the sort_order as 0.
4. THE migration SHALL add a `sort_order` column of type Integer to the `tasks` table with a default value of 0 for all existing rows.

### Requirement 2: Reorder Tasks Endpoint

**User Story:** As a developer, I want a backend endpoint that accepts an ordered list of task IDs and persists their new sort order, so that the frontend can save reorder operations.

#### Acceptance Criteria

1. THE Task_API SHALL expose a PUT endpoint at `/users/{user_id}/tasks/reorder` that accepts a JSON body containing a `status` string field and an `ordered_task_ids` list of integer task IDs.
2. WHEN the Reorder_Endpoint receives a valid request, THE Task_API SHALL update the sort_order of each task in `ordered_task_ids` to match its index position in the list (0-based).
3. WHEN the Reorder_Endpoint receives a task ID that does not belong to the specified user, THE Task_API SHALL return a 404 error.
4. WHEN the Reorder_Endpoint receives an empty `ordered_task_ids` list, THE Task_API SHALL return a 200 response with no changes.
5. WHEN the Reorder_Endpoint receives a task ID that does not exist, THE Task_API SHALL return a 404 error.

### Requirement 3: Sort Order in Frontend Types

**User Story:** As a developer, I want the frontend TypeScript types to include the sort_order field, so that ordering data flows correctly through the frontend codebase.

#### Acceptance Criteria

1. THE `Task` interface in `types.ts` SHALL include an optional `sort_order` field of type number.
2. WHEN the frontend receives a task object from the Task_API, THE frontend SHALL parse and store the sort_order field.

### Requirement 4: Same-Column Drag-and-Drop Reordering

**User Story:** As a user, I want to drag a task to a different position within the same Kanban column, so that I can manually prioritize my tasks in the order I prefer.

#### Acceptance Criteria

1. WHEN the user drags a task to a new position within the same column, THE Kanban_Board SHALL visually reorder the tasks to reflect the new position immediately (optimistic update).
2. WHEN a Same_Column_Reorder occurs, THE Kanban_Board SHALL send the full ordered list of task IDs for that column to the Reorder_Endpoint.
3. IF the Reorder_Endpoint returns an error after a Same_Column_Reorder, THEN THE Kanban_Board SHALL revert the task list to its previous order and reload tasks from the server.
4. WHEN a Same_Column_Reorder is completed successfully, THE Kanban_Board SHALL display tasks in the user-defined order on subsequent page loads.

### Requirement 5: Cross-Column Drag with Position Preservation

**User Story:** As a user, I want to drag a task to a specific position in another column, so that when I change a task's status it lands exactly where I want it.

#### Acceptance Criteria

1. WHEN the user drags a task to a different column, THE Kanban_Board SHALL update the task status to match the destination column.
2. WHEN the user drags a task to a specific position in a different column, THE Kanban_Board SHALL insert the task at the drop index within the destination column.
3. WHEN a Cross_Column_Move occurs, THE Kanban_Board SHALL send the updated status to the Task_API and the full ordered list of task IDs for the destination column to the Reorder_Endpoint.
4. IF the status update or reorder request fails after a Cross_Column_Move, THEN THE Kanban_Board SHALL revert the task to its original column and position and reload tasks from the server.

### Requirement 6: Sort Order Overrides Priority Sort

**User Story:** As a user, I want my manual ordering to take precedence over the default priority sort, so that my custom arrangement is respected.

#### Acceptance Criteria

1. WHEN any task in a column has a non-zero sort_order value, THE Kanban_Board SHALL sort tasks in that column by sort_order ascending instead of by Priority_Sort.
2. WHEN all tasks in a column have a sort_order of 0, THE Kanban_Board SHALL fall back to the existing Priority_Sort ordering.
3. WHEN a new task is created, THE Kanban_Board SHALL assign the new task a sort_order of 0, placing it according to Priority_Sort until the user explicitly reorders.

### Requirement 7: Reordering with Active Filters

**User Story:** As a user, I want drag-and-drop reordering to work correctly even when energy or priority filters are active, so that filtering does not corrupt my task order.

#### Acceptance Criteria

1. WHILE an energy or priority filter is active, THE Kanban_Board SHALL allow the user to drag and reorder the visible (filtered) tasks.
2. WHEN a reorder occurs while filters are active, THE Kanban_Board SHALL send only the visible (filtered) task IDs in their new order to the Reorder_Endpoint, preserving the relative order of hidden (filtered-out) tasks.
3. WHEN filters are cleared after a reorder, THE Kanban_Board SHALL display all tasks with the updated sort_order values, interleaving previously hidden tasks at their original relative positions.

### Requirement 8: Sort Order Consistency Invariant

**User Story:** As a developer, I want the sort_order values to remain consistent after reorder operations, so that ordering is deterministic and predictable.

#### Acceptance Criteria

1. WHEN the Reorder_Endpoint processes a request, THE Task_API SHALL assign consecutive sort_order values starting from 0 to the tasks in the provided order.
2. FOR ALL reorder operations, THE Task_API SHALL ensure no two tasks within the same user and status have the same sort_order value after the operation completes.
3. WHEN a task's status changes via a Cross_Column_Move, THE Task_API SHALL update the sort_order values in the destination column to maintain consecutive ordering.
