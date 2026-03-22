# Requirements Document

## Introduction

This feature adds priority levels to tasks in the LifeOS productivity app. Users will be able to assign a priority (High, Medium, Low, or None) when creating or editing tasks. Priority is surfaced through visual indicators on task cards across the Kanban board and Dashboard, and tasks can be sorted and filtered by priority within Kanban columns.

## Glossary

- **Task_Priority**: A categorical attribute on a task representing its urgency or importance. Valid values are "High", "Medium", "Low", and "None". The default value is "None".
- **Priority_Indicator**: A visual element (colored icon or badge) displayed on a task card that communicates the task's priority level at a glance.
- **Task_API**: The backend REST API endpoints under `/users/{user_id}/tasks` that handle task CRUD operations.
- **Task_Model**: The SQLAlchemy database model representing a task, stored in the `tasks` table.
- **Task_Schema**: The Pydantic schemas (`TaskBase`, `TaskCreate`, `TaskUpdate`, `Task`) used for API request/response validation.
- **Kanban_Board**: The frontend page (`KanbanBoard.tsx`) that displays tasks in draggable columns grouped by status (Todo, InProgress, Done, Archived).
- **Dashboard**: The frontend page (`Dashboard.tsx`) that shows a summary view of today's tasks and stats.
- **Sort_Order**: The display ordering of tasks within a Kanban column. Priority sort orders tasks from High to Low (High → Medium → Low → None).
- **Priority_Filter**: A UI control that allows the user to show only tasks matching a selected priority level, or all tasks.

## Requirements

### Requirement 1: Task Priority Data Model

**User Story:** As a developer, I want the task data model to include a priority field, so that priority information is persisted and available across the full stack.

#### Acceptance Criteria

1. THE Task_Model SHALL include a `priority` column of type String with a default value of "None" and valid values of "High", "Medium", "Low", and "None".
2. THE Task_Schema SHALL include an optional `priority` field in `TaskBase`, `TaskCreate`, and `TaskUpdate` with a default value of "None".
3. WHEN a task is created without specifying a priority, THE Task_API SHALL store the priority as "None".
4. WHEN a task is created with a priority value not in the set {"High", "Medium", "Low", "None"}, THE Task_API SHALL return a 422 validation error.

### Requirement 2: Set Priority on Task Creation

**User Story:** As a user, I want to set a priority level when creating a new task, so that I can indicate how urgent or important the task is from the start.

#### Acceptance Criteria

1. WHEN the user opens the task creation modal on the Kanban_Board, THE Kanban_Board SHALL display a priority selector with options "High", "Medium", "Low", and "None".
2. THE priority selector SHALL default to "None" when creating a new task.
3. WHEN the user selects a priority and submits the form, THE Kanban_Board SHALL include the selected priority in the create task API request.
4. WHEN the task is successfully created with a priority, THE Task_API SHALL return the task object with the priority field populated.

### Requirement 3: Update Priority on Existing Tasks

**User Story:** As a user, I want to change the priority of an existing task, so that I can adjust importance as circumstances change.

#### Acceptance Criteria

1. WHEN the user opens the edit modal for an existing task, THE Kanban_Board SHALL display the priority selector pre-populated with the task's current priority value.
2. WHEN the user changes the priority and saves, THE Kanban_Board SHALL send the updated priority to the Task_API.
3. WHEN a valid priority update is received, THE Task_API SHALL persist the new priority value and return the updated task.
4. WHEN a priority update contains an invalid value, THE Task_API SHALL return a 422 validation error and leave the task unchanged.

### Requirement 4: Priority Visual Indicators on Task Cards

**User Story:** As a user, I want to see a visual indicator of each task's priority on its card, so that I can quickly assess task importance without opening the task.

#### Acceptance Criteria

1. WHEN a task has a priority of "High", THE Kanban_Board SHALL display a red Priority_Indicator on the task card.
2. WHEN a task has a priority of "Medium", THE Kanban_Board SHALL display an amber/yellow Priority_Indicator on the task card.
3. WHEN a task has a priority of "Low", THE Kanban_Board SHALL display a blue Priority_Indicator on the task card.
4. WHEN a task has a priority of "None", THE Kanban_Board SHALL display no Priority_Indicator on the task card.
5. WHEN a task has a priority of "High", THE Dashboard SHALL display a red Priority_Indicator on the task entry.
6. WHEN a task has a priority of "Medium", THE Dashboard SHALL display an amber/yellow Priority_Indicator on the task entry.
7. WHEN a task has a priority of "Low", THE Dashboard SHALL display a blue Priority_Indicator on the task entry.
8. WHEN a task has a priority of "None", THE Dashboard SHALL display no Priority_Indicator on the task entry.

### Requirement 5: Sort Tasks by Priority Within Kanban Columns

**User Story:** As a user, I want tasks within each Kanban column to be sorted by priority, so that the most important tasks appear at the top.

#### Acceptance Criteria

1. THE Kanban_Board SHALL sort tasks within each column in descending priority order: High first, then Medium, then Low, then None.
2. WHEN two tasks have the same priority, THE Kanban_Board SHALL preserve their existing relative order (stable sort by creation date).
3. WHEN a task's priority is updated, THE Kanban_Board SHALL re-sort the affected column to reflect the new priority ordering.
4. WHEN the user drags a task to a different column, THE Kanban_Board SHALL place the task in the correct priority-sorted position within the destination column.

### Requirement 6: Filter Tasks by Priority

**User Story:** As a user, I want to filter tasks by priority level on the Kanban board, so that I can focus on tasks of a specific importance.

#### Acceptance Criteria

1. THE Kanban_Board SHALL display a priority filter control with options "All", "High", "Medium", "Low", and "None".
2. WHEN the user selects a priority filter value, THE Kanban_Board SHALL display only tasks matching the selected priority across all visible columns.
3. WHEN the priority filter is set to "All", THE Kanban_Board SHALL display tasks of every priority level.
4. THE priority filter SHALL operate independently of the existing energy level filter, allowing both filters to be active simultaneously.
5. WHEN both the priority filter and energy filter are active, THE Kanban_Board SHALL display only tasks that match both filter criteria.

### Requirement 7: Priority Field on Frontend Types

**User Story:** As a developer, I want the frontend TypeScript types to include the priority field, so that priority data flows correctly through the frontend codebase.

#### Acceptance Criteria

1. THE `Task` interface in `types.ts` SHALL include an optional `priority` field of type string.
2. THE `TaskCreate` interface in `types.ts` SHALL include an optional `priority` field of type string.
3. WHEN the frontend receives a task object from the Task_API, THE frontend SHALL parse and store the priority field.

### Requirement 8: Database Migration for Priority Column

**User Story:** As a developer, I want a database migration that adds the priority column to existing tasks, so that the feature can be deployed without data loss.

#### Acceptance Criteria

1. THE migration SHALL add a `priority` column of type String to the `tasks` table.
2. THE migration SHALL set the default value of the `priority` column to "None" for all existing rows.
3. THE migration SHALL be reversible, allowing the `priority` column to be removed.
