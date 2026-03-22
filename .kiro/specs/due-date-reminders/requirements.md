# Requirements Document

## Introduction

LifeOS currently has no notification or reminder system. Tasks have a `target_date` field, but users receive no alerts when deadlines approach or pass. This feature adds an in-app notification system that alerts users about upcoming and overdue task deadlines, surfaced through a persistent notification center in the UI and visual cues on the Dashboard and Kanban board. The system supports configurable reminder lead times so users can choose how far in advance they want to be notified.

## Glossary

- **Notification**: A persistent record stored in the database representing an alert about a task deadline. Each Notification has a type, message, read/unread status, and a reference to the originating Task.
- **Notification_Center**: A UI panel accessible from the app header that displays a chronological list of Notifications for the current user, with the ability to mark them as read or dismiss them.
- **Reminder_Config**: User-level settings that control when Notifications are generated relative to a Task's target_date (e.g., 1 day before, on the day, when overdue).
- **Notification_Engine**: The backend process that evaluates all Tasks with a target_date for a given user and generates Notifications based on the Reminder_Config and current date.
- **Notification_Badge**: A visual indicator on the Notification_Center icon showing the count of unread Notifications.
- **Overdue_Task**: A Task whose target_date is earlier than today and whose status is not "Done".
- **Upcoming_Task**: A Task whose target_date falls within the configured reminder lead-time window relative to today and whose status is not "Done".
- **Dashboard**: The main landing page that shows today's habits and tasks.
- **Kanban_Board**: The frontend page that displays tasks organized by status columns (Todo, InProgress, Done).

## Requirements

### Requirement 1: Notification Data Model

**User Story:** As a developer, I want a persistent notification data model, so that reminders can be stored, queried, and displayed across sessions.

#### Acceptance Criteria

1. THE Notification model SHALL include fields: id (primary key), user_id (foreign key to users), task_id (foreign key to tasks), type (string: "upcoming", "due_today", "overdue"), message (string), is_read (boolean, default false), created_at (datetime), and dismissed (boolean, default false).
2. THE Notification model SHALL enforce a foreign key relationship between task_id and the tasks table.
3. THE Notification model SHALL enforce a foreign key relationship between user_id and the users table.
4. WHEN a Task referenced by a Notification is deleted, THE system SHALL delete all Notifications linked to that Task.

### Requirement 2: Reminder Configuration

**User Story:** As a user, I want to configure when I receive deadline reminders, so that I get notified at times that are useful to me.

#### Acceptance Criteria

1. THE Reminder_Config model SHALL include fields: user_id (foreign key to users), remind_days_before (integer, default 1), remind_on_due_date (boolean, default true), remind_when_overdue (boolean, default true).
2. THE system SHALL create a default Reminder_Config for each user when the user account is created or when the Notification_Engine first runs for a user with no existing config.
3. WHEN a user updates Reminder_Config settings, THE system SHALL persist the changes and apply them on the next Notification_Engine run.
4. THE Reminder_Config SHALL support remind_days_before values of 0, 1, 2, 3, 5, and 7.

### Requirement 3: Notification Generation Engine

**User Story:** As a user, I want the system to automatically generate reminders based on my task deadlines, so that I am alerted without manual effort.

#### Acceptance Criteria

1. WHEN the Notification_Engine runs for a user, THE Notification_Engine SHALL identify all Tasks belonging to that user that have a non-null target_date and a status other than "Done".
2. WHEN a Task's target_date is exactly remind_days_before days from today and remind_days_before is greater than 0, THE Notification_Engine SHALL create a Notification of type "upcoming" if no Notification of the same type and task_id exists for today.
3. WHEN a Task's target_date equals today and remind_on_due_date is true, THE Notification_Engine SHALL create a Notification of type "due_today" if no Notification of the same type and task_id exists for today.
4. WHEN a Task's target_date is before today and remind_when_overdue is true, THE Notification_Engine SHALL create a Notification of type "overdue" if no Notification of type "overdue" and the same task_id exists for today.
5. THE Notification_Engine SHALL generate Notifications with a human-readable message that includes the Task title and the relevant date context (e.g., "Task 'Weekly Report' is due tomorrow", "Task 'Weekly Report' is due today", "Task 'Weekly Report' is 3 days overdue").
6. THE Notification_Engine SHALL skip Tasks that already have a Notification of the matching type for the current date to prevent duplicate Notifications.
7. WHEN a Task's status changes to "Done", THE Notification_Engine SHALL exclude that Task from future Notification generation.

### Requirement 4: Notification Sync API Endpoint

**User Story:** As a frontend client, I want a dedicated API endpoint to trigger notification generation, so that reminders are created when the app loads.

#### Acceptance Criteria

1. THE Notification_Engine SHALL expose a POST endpoint at /sync/notifications/{user_id} that triggers Notification generation for the specified user.
2. WHEN the sync endpoint is called, THE Notification_Engine SHALL return a summary containing the count of newly created Notifications.
3. THE Dashboard SHALL call the notification sync endpoint when the page loads.
4. THE Kanban_Board SHALL call the notification sync endpoint when the page loads.

### Requirement 5: Notification Retrieval API

**User Story:** As a frontend client, I want API endpoints to fetch and manage notifications, so that the Notification_Center can display and update them.

#### Acceptance Criteria

1. THE system SHALL expose a GET endpoint at /users/{user_id}/notifications that returns all non-dismissed Notifications for the user, ordered by created_at descending.
2. THE system SHALL expose a PUT endpoint at /users/{user_id}/notifications/{notification_id}/read that marks a single Notification as read.
3. THE system SHALL expose a PUT endpoint at /users/{user_id}/notifications/read-all that marks all unread Notifications for the user as read.
4. THE system SHALL expose a DELETE endpoint at /users/{user_id}/notifications/{notification_id} that marks a Notification as dismissed.
5. THE system SHALL expose a GET endpoint at /users/{user_id}/notifications/unread-count that returns the count of unread, non-dismissed Notifications.

### Requirement 6: Notification Center UI

**User Story:** As a user, I want a notification center in the app header, so that I can see and manage my deadline reminders from any page.

#### Acceptance Criteria

1. THE Notification_Center SHALL be accessible via a bell icon in the app header/layout component, visible on all authenticated pages.
2. THE Notification_Badge SHALL display the count of unread Notifications on the bell icon when the count is greater than zero.
3. WHEN a user clicks the bell icon, THE Notification_Center SHALL open a dropdown panel displaying the list of non-dismissed Notifications.
4. THE Notification_Center SHALL visually distinguish unread Notifications from read Notifications using different background styling.
5. THE Notification_Center SHALL visually distinguish Notification types using color coding: cyan for "upcoming", amber for "due_today", and rose for "overdue".
6. WHEN a user clicks a Notification in the Notification_Center, THE system SHALL mark that Notification as read and navigate to the Kanban_Board.
7. THE Notification_Center SHALL include a "Mark all as read" action button.
8. THE Notification_Center SHALL include a dismiss button on each Notification to remove it from the list.
9. WHEN the Notification list is empty, THE Notification_Center SHALL display a message indicating no pending reminders.

### Requirement 7: Dashboard Notification Integration

**User Story:** As a user, I want to see overdue and due-today task indicators on my Dashboard, so that urgent deadlines are immediately visible.

#### Acceptance Criteria

1. THE Dashboard SHALL display an overdue task count badge in the KPI cards section when the user has Overdue_Tasks.
2. THE Dashboard "Action Items" section SHALL display a visual overdue indicator (rose-colored styling) on tasks whose target_date is before today.
3. THE Dashboard "Action Items" section SHALL display a visual due-today indicator (amber-colored styling) on tasks whose target_date equals today.

### Requirement 8: Kanban Board Deadline Indicators

**User Story:** As a user, I want to see deadline status indicators on task cards in the Kanban board, so that I can quickly identify which tasks need urgent attention.

#### Acceptance Criteria

1. THE Kanban_Board SHALL display a rose-colored "Overdue" badge on task cards whose target_date is before today and status is not "Done".
2. THE Kanban_Board SHALL display an amber-colored "Due Today" badge on task cards whose target_date equals today and status is not "Done".
3. THE Kanban_Board SHALL display a cyan-colored "Due Soon" badge on task cards whose target_date is within the remind_days_before window and status is not "Done".
4. WHEN a task card has no target_date, THE Kanban_Board SHALL display no deadline badge on that card.

### Requirement 9: Reminder Settings UI

**User Story:** As a user, I want to configure my reminder preferences through a settings interface, so that I can control when and how I receive deadline alerts.

#### Acceptance Criteria

1. THE system SHALL provide a reminder settings section accessible from the user Profile page.
2. THE reminder settings section SHALL display controls for: remind_days_before (dropdown with values 0, 1, 2, 3, 5, 7), remind_on_due_date (toggle), and remind_when_overdue (toggle).
3. WHEN a user changes a reminder setting, THE system SHALL persist the change via the API and display a confirmation message.
4. THE reminder settings section SHALL display the current saved values when the page loads.

### Requirement 10: Notification Cleanup

**User Story:** As a user, I want old notifications to be automatically cleaned up, so that the notification list stays relevant and performant.

#### Acceptance Criteria

1. WHEN the Notification_Engine runs, THE Notification_Engine SHALL delete all dismissed Notifications older than 30 days.
2. WHEN the Notification_Engine runs, THE Notification_Engine SHALL delete all read Notifications of type "overdue" for Tasks that have been marked as "Done".
