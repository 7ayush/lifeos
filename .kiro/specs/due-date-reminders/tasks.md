# Tasks: Due Date Reminders / Notifications

## Task 1: Backend Data Models and Schemas

- [x] 1.1 Add Notification and ReminderConfig SQLAlchemy models to `backend/models.py`
  - Add `Notification` model with fields: id, user_id, task_id, type, message, is_read, dismissed, created_at
  - Add `ReminderConfig` model with fields: id, user_id, remind_days_before, remind_on_due_date, remind_when_overdue
  - Add `notifications` relationship to User model
  - Add `reminder_config` relationship to User model (uselist=False)
  - Add `notifications` relationship to Task model with cascade="all, delete-orphan"
- [x] 1.2 Add Pydantic schemas to `backend/schemas.py`
  - Add `NotificationOut`, `NotificationSyncResponse`, `UnreadCountResponse`
  - Add `ReminderConfigOut`, `ReminderConfigUpdate`

## Task 2: Backend CRUD Functions

- [x] 2.1 Add notification engine function `sync_notifications` to `backend/crud.py`
  - Query eligible tasks (non-null target_date, status != "Done")
  - Get or create ReminderConfig with defaults
  - Generate "upcoming", "due_today", "overdue" notifications based on config
  - Deduplicate by (task_id, type, current date)
  - Generate human-readable messages including task title
  - Return count of newly created notifications
- [x] 2.2 Add notification CRUD functions to `backend/crud.py`
  - `get_user_notifications(db, user_id)` — non-dismissed, ordered by created_at desc
  - `get_unread_count(db, user_id)` — count of unread + non-dismissed
  - `mark_notification_read(db, notification_id)` — set is_read = True
  - `mark_all_notifications_read(db, user_id)` — bulk mark read
  - `dismiss_notification(db, notification_id)` — set dismissed = True
- [x] 2.3 Add reminder config CRUD functions to `backend/crud.py`
  - `get_reminder_config(db, user_id)` — get or create with defaults
  - `update_reminder_config(db, user_id, config)` — validate remind_days_before in {0,1,2,3,5,7} and persist
- [x] 2.4 Add notification cleanup function to `backend/crud.py`
  - Delete dismissed notifications older than 30 days
  - Delete read "overdue" notifications for tasks with status "Done"

## Task 3: Backend API Routers

- [x] 3.1 Create `backend/routers/notifications.py` with notification endpoints
  - GET `/users/{user_id}/notifications` — list non-dismissed notifications
  - GET `/users/{user_id}/notifications/unread-count` — unread count
  - PUT `/users/{user_id}/notifications/{notification_id}/read` — mark as read
  - PUT `/users/{user_id}/notifications/read-all` — mark all as read
  - DELETE `/users/{user_id}/notifications/{notification_id}` — dismiss
  - GET `/users/{user_id}/reminder-config` — get reminder config
  - PUT `/users/{user_id}/reminder-config` — update reminder config
- [x] 3.2 Add notification sync endpoint to `backend/routers/sync.py`
  - POST `/sync/notifications/{user_id}` — trigger notification generation
- [x] 3.3 Register notifications router in `backend/main.py`

## Task 4: Frontend Types and API Functions

- [x] 4.1 Add TypeScript interfaces to `frontend/src/types.ts`
  - `Notification`, `ReminderConfig`, `NotificationSyncResponse`
- [x] 4.2 Add API functions to `frontend/src/api/index.ts`
  - `syncNotifications`, `getNotifications`, `getUnreadCount`
  - `markNotificationRead`, `markAllNotificationsRead`, `dismissNotification`
  - `getReminderConfig`, `updateReminderConfig`

## Task 5: Notification Center UI Component

- [x] 5.1 Create `frontend/src/components/NotificationCenter.tsx`
  - Bell icon with unread count badge (badge visible only when count > 0)
  - Dropdown panel toggled by clicking bell icon
  - List notifications color-coded by type: cyan (upcoming), amber (due_today), rose (overdue)
  - Visually distinguish unread vs read notifications
  - Click notification → mark as read + navigate to Kanban board
  - "Mark all as read" button
  - Per-notification dismiss button
  - Empty state message when no notifications
- [x] 5.2 Integrate NotificationCenter into `frontend/src/components/Layout.tsx`
  - Add header area with NotificationCenter component
  - Fetch unread count on mount and after sync

## Task 6: Dashboard Notification Integration

- [x] 6.1 Add notification sync call to `frontend/src/pages/Dashboard.tsx`
  - Call `syncNotifications(userId)` on page load alongside existing syncs
- [x] 6.2 Add deadline indicators to Dashboard
  - Overdue task count badge in KPI cards section
  - Rose-colored overdue indicator on action items with target_date before today
  - Amber-colored due-today indicator on action items with target_date equal to today

## Task 7: Kanban Board Deadline Indicators

- [x] 7.1 Add notification sync call to `frontend/src/pages/KanbanBoard.tsx`
  - Call `syncNotifications(userId)` on page load
- [x] 7.2 Add deadline badges to Kanban task cards
  - Rose "Overdue" badge when target_date < today and status != "Done"
  - Amber "Due Today" badge when target_date == today and status != "Done"
  - Cyan "Due Soon" badge when target_date within remind_days_before window and status != "Done"
  - No badge when target_date is null or status is "Done"

## Task 8: Reminder Settings UI

- [x] 8.1 Add reminder settings section to `frontend/src/pages/ProfilePage.tsx`
  - Dropdown for remind_days_before with options: 0, 1, 2, 3, 5, 7
  - Toggle for remind_on_due_date
  - Toggle for remind_when_overdue
  - Load current config on mount
  - Persist changes via API with confirmation message

## Task 9: Backend Tests

- [x] 9.1 Write property-based tests for notification engine in `backend/tests/test_notification_engine.py`
  - Property 6: Engine filters only eligible tasks
  - Property 7: Engine generates correct notification type
  - Property 8: Notification message includes task title
  - Property 9: Engine idempotence
  - Property 15: Cleanup removes old dismissed notifications
  - Property 16: Cleanup removes read overdue for done tasks
- [x] 9.2 Write unit/integration tests for notification API in `backend/tests/test_notification_api.py`
  - Test all CRUD endpoints (list, mark read, mark all read, dismiss, unread count)
  - Test reminder config endpoints (get, update, validation)
  - Test cascade delete behavior
  - Test sync endpoint returns correct count

## Task 10: Frontend Tests

- [x] 10.1 Write property tests for deadline badge logic in `frontend/src/utils/__tests__/deadlineBadge.test.ts`
  - Property 14: Badge assignment correctness based on target_date vs today
- [x] 10.2 Write component tests for NotificationCenter in `frontend/src/components/__tests__/NotificationCenter.test.tsx`
  - Bell icon renders
  - Badge shows unread count when > 0
  - Dropdown opens on click
  - Empty state message when no notifications
