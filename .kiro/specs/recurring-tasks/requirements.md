# Requirements Document

## Introduction

LifeOS currently supports one-off manual tasks and habit-generated tasks. Users who want a repeating task (e.g., "weekly review every Friday") must create a habit first, which is semantically wrong — a recurring task is not a habit. This feature adds native recurrence to the Task entity so users can define recurring tasks directly, with an automatic instance-generation mechanism and full Kanban board integration.

## Glossary

- **Task_Template**: A Task record that carries recurrence configuration and serves as the blueprint for generating Task_Instances. It is not displayed on the Kanban board itself.
- **Task_Instance**: A concrete, actionable Task record generated from a Task_Template for a specific target_date. Task_Instances appear on the Kanban board and can be completed independently.
- **Recurrence_Config**: The set of fields on a Task_Template that define how often and when Task_Instances are generated (frequency_type, repeat_interval, repeat_days, ends_type, ends_on_date, ends_after_occurrences).
- **Sync_Engine**: The backend process (API endpoint + CRUD logic) responsible for generating Task_Instances from Task_Templates for the current period.
- **Kanban_Board**: The frontend page that displays tasks organized by status columns (Todo, InProgress, Done), filtered by timeframe.
- **One_Off_Task**: A manually created task with no recurrence configuration (task_type = "manual").
- **Frequency_Type**: One of: daily, weekly, monthly, annually, custom — defining the recurrence cadence.
- **Repeat_Interval**: An integer specifying how many frequency periods to skip between occurrences (e.g., every 2 weeks).
- **Repeat_Days**: A comma-separated string of day numbers (0=Sun through 6=Sat) specifying which days of the week a weekly recurrence applies to.

## Requirements

### Requirement 1: Task Recurrence Data Model

**User Story:** As a user, I want to attach recurrence settings to a task, so that the system can automatically generate repeating task instances on my behalf.

#### Acceptance Criteria

1. THE Task model SHALL support a task_type value of "recurring" in addition to the existing "manual" and "habit" values.
2. THE Task model SHALL include recurrence fields: frequency_type (daily, weekly, monthly, annually, custom), repeat_interval (integer, default 1), repeat_days (comma-separated day numbers for weekly), ends_type (never, on, after), ends_on_date (date), and ends_after_occurrences (integer).
3. THE Task model SHALL include a parent_task_id field that links a Task_Instance to its originating Task_Template.
4. WHEN a Task record has task_type "recurring" and parent_task_id is null, THE system SHALL treat that record as a Task_Template.
5. WHEN a Task record has task_type "recurring" and parent_task_id is not null, THE system SHALL treat that record as a Task_Instance.

### Requirement 2: Recurring Task Template Creation

**User Story:** As a user, I want to create a recurring task with a schedule, so that I do not have to manually recreate the same task every period.

#### Acceptance Criteria

1. WHEN a user submits a task creation request with task_type "recurring" and a valid Recurrence_Config, THE Task API SHALL persist a Task_Template record with the provided recurrence fields.
2. WHEN a user submits a task creation request with task_type "recurring" and frequency_type is "weekly" but repeat_days is empty, THE Task API SHALL reject the request with a validation error.
3. WHEN a user submits a task creation request with task_type "recurring" and ends_type is "on" but ends_on_date is missing, THE Task API SHALL reject the request with a validation error.
4. WHEN a user submits a task creation request with task_type "recurring" and ends_type is "after" but ends_after_occurrences is missing or less than 1, THE Task API SHALL reject the request with a validation error.
5. WHEN a Task_Template is created, THE Sync_Engine SHALL generate the first Task_Instance for the current period.

### Requirement 3: Recurring Task Instance Generation (Sync)

**User Story:** As a user, I want the system to automatically create task instances for the current period, so that recurring tasks appear on my Kanban board without manual intervention.

#### Acceptance Criteria

1. WHEN the Sync_Engine runs for a user, THE Sync_Engine SHALL identify all active Task_Templates belonging to that user.
2. WHEN a Task_Template has frequency_type "daily", THE Sync_Engine SHALL create a Task_Instance with target_date set to today if no Task_Instance exists for today.
3. WHEN a Task_Template has frequency_type "weekly", THE Sync_Engine SHALL create a Task_Instance with target_date set to the next matching day from repeat_days within the current week if no Task_Instance exists for the current week.
4. WHEN a Task_Template has frequency_type "monthly", THE Sync_Engine SHALL create a Task_Instance with target_date set within the current month if no Task_Instance exists for the current month.
5. WHEN a Task_Template has frequency_type "annually", THE Sync_Engine SHALL create a Task_Instance with target_date set within the current year if no Task_Instance exists for the current year.
6. WHEN a Task_Template has ends_type "on" and the current date exceeds ends_on_date, THE Sync_Engine SHALL skip that Task_Template and generate no new Task_Instances.
7. WHEN a Task_Template has ends_type "after" and the count of existing Task_Instances equals or exceeds ends_after_occurrences, THE Sync_Engine SHALL skip that Task_Template and generate no new Task_Instances.
8. THE Sync_Engine SHALL copy title, description, goal_id, energy_level, and estimated_minutes from the Task_Template to each generated Task_Instance.
9. THE Sync_Engine SHALL set each generated Task_Instance status to "Todo".
10. WHEN a Task_Template has repeat_interval greater than 1, THE Sync_Engine SHALL skip the appropriate number of periods between generated Task_Instances.

### Requirement 4: Recurring Task Template Editing

**User Story:** As a user, I want to edit a recurring task template, so that future instances reflect my updated schedule or details.

#### Acceptance Criteria

1. WHEN a user updates a Task_Template's title, description, energy_level, or estimated_minutes, THE Task API SHALL apply those changes to all future Task_Instances that have status "Todo".
2. WHEN a user updates a Task_Template's Recurrence_Config, THE Task API SHALL delete all future Task_Instances that have status "Todo" and trigger the Sync_Engine to regenerate instances based on the new configuration.
3. THE Task API SHALL preserve Task_Instances that have status "InProgress" or "Done" when a Task_Template is updated.

### Requirement 5: Recurring Task Template Deletion

**User Story:** As a user, I want to delete a recurring task template, so that no further instances are generated and uncompleted future instances are cleaned up.

#### Acceptance Criteria

1. WHEN a user deletes a Task_Template, THE Task API SHALL delete all Task_Instances linked to that Task_Template that have status "Todo".
2. WHEN a user deletes a Task_Template, THE Task API SHALL retain Task_Instances that have status "InProgress" or "Done" by setting their parent_task_id to null and task_type to "manual".
3. WHEN a user deletes a Task_Template, THE Task API SHALL delete the Task_Template record itself.

### Requirement 6: Kanban Board Display of Recurring Tasks

**User Story:** As a user, I want to see recurring task instances on my Kanban board and distinguish them from one-off tasks, so that I know which tasks are part of a recurring series.

#### Acceptance Criteria

1. THE Kanban_Board SHALL display Task_Instances alongside One_Off_Tasks, filtered by the selected timeframe.
2. THE Kanban_Board SHALL display a visual recurring indicator (icon or badge) on each Task_Instance that has a non-null parent_task_id.
3. THE Kanban_Board SHALL exclude Task_Templates (task_type "recurring" with null parent_task_id) from the task list display.
4. WHEN a user clicks the recurring indicator on a Task_Instance, THE Kanban_Board SHALL navigate to or open the parent Task_Template for editing.

### Requirement 7: Recurring Task Creation and Edit UI

**User Story:** As a user, I want to configure recurrence settings when creating or editing a task in the Kanban board modal, so that I can set up recurring tasks through the existing interface.

#### Acceptance Criteria

1. THE Task creation modal SHALL include a "Recurring" toggle that reveals recurrence configuration fields when enabled.
2. WHEN the "Recurring" toggle is enabled, THE Task creation modal SHALL display fields for frequency_type, repeat_interval, repeat_days (when frequency_type is "weekly"), ends_type, ends_on_date (when ends_type is "on"), and ends_after_occurrences (when ends_type is "after").
3. WHEN a user edits a Task_Instance from the Kanban_Board, THE Task edit modal SHALL allow editing only instance-level fields (status, actual_minutes) and provide a link to edit the parent Task_Template.
4. WHEN a user edits a Task_Template, THE Task edit modal SHALL allow editing all fields including Recurrence_Config.

### Requirement 8: Recurring Task Sync API Endpoint

**User Story:** As a frontend client, I want a dedicated API endpoint to trigger recurring task sync, so that task instances are generated when the Kanban board loads.

#### Acceptance Criteria

1. THE Sync_Engine SHALL expose a POST endpoint at /sync/recurring-tasks/{user_id} that triggers Task_Instance generation for the specified user.
2. WHEN the sync endpoint is called, THE Sync_Engine SHALL return a summary containing the count of created Task_Instances and the total number of active Task_Templates.
3. THE Kanban_Board SHALL call the recurring task sync endpoint when the page loads, before fetching the task list.

### Requirement 9: Recurring Task Instance Completion

**User Story:** As a user, I want to complete a recurring task instance independently without affecting other instances or the template, so that each occurrence is tracked separately.

#### Acceptance Criteria

1. WHEN a user changes a Task_Instance status to "Done", THE Task API SHALL update only that Task_Instance and leave the Task_Template and other Task_Instances unchanged.
2. WHEN a user changes a Task_Instance status to "InProgress", THE Task API SHALL update only that Task_Instance status.
3. THE Task API SHALL allow a user to delete a single Task_Instance without affecting the Task_Template or other Task_Instances.
