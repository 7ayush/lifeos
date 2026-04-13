# Requirements Document

## Introduction

This feature hardens the Life OS API against Insecure Direct Object Reference (IDOR) vulnerabilities and adds leaderboard privacy controls. Today, several endpoints rely on per-route `_verify_owner` checks that only compare `user_id` in the URL path to the authenticated user — but do not verify that the specific resource (notification, subtask, focus task) actually belongs to that user. A centralized ownership-validation layer will close these gaps. Additionally, users currently have no way to opt out of the public leaderboard; a profile visibility setting will let them control whether their data appears there.

## Glossary

- **Ownership_Middleware**: A FastAPI dependency or middleware that intercepts requests and validates that the target resource belongs to the authenticated user before the route handler executes.
- **Resource**: Any database entity (Notification, SubTask, Task, FocusTask) that is scoped to a specific user.
- **IDOR**: Insecure Direct Object Reference — a vulnerability where an attacker manipulates resource identifiers to access another user's data.
- **Profile_Visibility**: A per-user setting stored on the User model that controls whether the user appears on the public leaderboard. Valid values are "public" and "private".
- **Leaderboard_Endpoint**: The `GET /analytics/leaderboard` route that returns ranked user statistics.
- **Authenticated_User**: The user extracted from the JWT token by the `get_current_user` dependency.

## Requirements

### Requirement 1: Notification Ownership Validation

**User Story:** As an authenticated user, I want the API to verify that a notification belongs to me before allowing me to mark it as read or dismiss it, so that I cannot accidentally or maliciously modify another user's notifications.

#### Acceptance Criteria

1. WHEN a request is received to mark a notification as read, THE Ownership_Middleware SHALL verify that the notification's `user_id` matches the Authenticated_User's id before executing the operation.
2. WHEN a request is received to dismiss a notification, THE Ownership_Middleware SHALL verify that the notification's `user_id` matches the Authenticated_User's id before executing the operation.
3. IF the notification does not belong to the Authenticated_User, THEN THE Ownership_Middleware SHALL return an HTTP 403 response with the message "Not authorized".
4. IF the notification does not exist, THEN THE Ownership_Middleware SHALL return an HTTP 404 response with the message "Notification not found".

### Requirement 2: Subtask Ownership Validation

**User Story:** As an authenticated user, I want the API to verify that a subtask belongs to one of my tasks before allowing me to toggle or delete it, so that I cannot modify subtasks on another user's tasks.

#### Acceptance Criteria

1. WHEN a request is received to toggle a subtask, THE Ownership_Middleware SHALL verify that the subtask's parent task `user_id` matches the Authenticated_User's id before executing the operation.
2. WHEN a request is received to delete a subtask, THE Ownership_Middleware SHALL verify that the subtask's parent task `user_id` matches the Authenticated_User's id before executing the operation.
3. WHEN a request is received to toggle or delete a subtask, THE Ownership_Middleware SHALL verify that the subtask's `task_id` matches the `task_id` in the URL path.
4. IF the subtask's parent task does not belong to the Authenticated_User, THEN THE Ownership_Middleware SHALL return an HTTP 403 response with the message "Not authorized".
5. IF the subtask does not exist or the subtask's `task_id` does not match the URL path `task_id`, THEN THE Ownership_Middleware SHALL return an HTTP 404 response with the message "SubTask not found".

### Requirement 3: Focus Task Ownership Validation

**User Story:** As an authenticated user, I want the API to verify that a task belongs to me before it can be added to my focus list, so that I cannot add another user's tasks to my weekly review.

#### Acceptance Criteria

1. WHEN a request is received to add a focus task, THE Ownership_Middleware SHALL verify that the referenced task's `user_id` matches the Authenticated_User's id before adding the task to the focus list.
2. IF the referenced task does not belong to the Authenticated_User, THEN THE Ownership_Middleware SHALL return an HTTP 403 response with the message "Not authorized".
3. IF the referenced task does not exist, THEN THE Ownership_Middleware SHALL return an HTTP 404 response with the message "Task not found".

### Requirement 4: Centralized Ownership Validation Pattern

**User Story:** As a developer, I want a reusable, centralized ownership validation mechanism, so that new endpoints automatically benefit from resource ownership checks and individual routes cannot accidentally omit validation.

#### Acceptance Criteria

1. THE Ownership_Middleware SHALL provide a reusable FastAPI dependency that accepts a resource type and extracts the resource identifier from the request path.
2. THE Ownership_Middleware SHALL support validation for Notification, SubTask, Task, and FocusTask resource types.
3. WHEN a new resource type is added, THE Ownership_Middleware SHALL allow registration of a new ownership-check function without modifying existing validation logic.
4. THE Ownership_Middleware SHALL execute ownership validation before the route handler function runs.
5. THE Ownership_Middleware SHALL query the database at most once per resource to determine ownership.

### Requirement 5: Profile Visibility Setting

**User Story:** As a user, I want to control whether my profile appears on the public leaderboard, so that I can keep my productivity data private if I choose.

#### Acceptance Criteria

1. THE User model SHALL include a `profile_visibility` field with valid values "public" and "private", defaulting to "public".
2. WHEN a user updates their profile visibility to "private", THE User model SHALL persist the value "private" for that user.
3. WHEN a user updates their profile visibility to "public", THE User model SHALL persist the value "public" for that user.
4. IF a profile visibility update request contains a value other than "public" or "private", THEN THE API SHALL return an HTTP 422 response with a descriptive validation error.

### Requirement 6: Profile Visibility Toggle Endpoint

**User Story:** As a user, I want an API endpoint to change my profile visibility setting, so that I can opt in or out of the leaderboard at any time.

#### Acceptance Criteria

1. THE API SHALL expose a PUT endpoint at `/users/{user_id}/settings/profile-visibility` that accepts a JSON body with a `profile_visibility` field.
2. WHEN the endpoint receives a valid request, THE API SHALL update the Authenticated_User's `profile_visibility` field and return the updated setting.
3. THE API SHALL require authentication for the profile visibility endpoint.
4. WHEN an unauthenticated request is received, THE API SHALL return an HTTP 401 response.
5. WHEN a request targets a `user_id` that does not match the Authenticated_User, THE API SHALL return an HTTP 403 response with the message "Not authorized".

### Requirement 7: Leaderboard Privacy Filtering

**User Story:** As a user with a private profile, I want to be excluded from the public leaderboard, so that other users cannot see my productivity statistics.

#### Acceptance Criteria

1. WHEN the Leaderboard_Endpoint is called, THE Leaderboard_Endpoint SHALL return only users whose `profile_visibility` is set to "public".
2. WHEN a user changes their `profile_visibility` from "public" to "private", THE Leaderboard_Endpoint SHALL exclude that user from subsequent leaderboard responses.
3. WHEN a user changes their `profile_visibility` from "private" to "public", THE Leaderboard_Endpoint SHALL include that user in subsequent leaderboard responses.
4. THE Leaderboard_Endpoint SHALL always include the Authenticated_User's own entry in the response, regardless of the Authenticated_User's `profile_visibility` setting.
