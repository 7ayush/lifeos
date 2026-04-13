# Implementation Plan: API Security Middleware

## Overview

Harden the Life OS API against IDOR vulnerabilities by introducing a centralized ownership validation dependency, fixing three endpoint gaps (notifications, subtasks, focus tasks), adding a profile visibility setting, and filtering the leaderboard by visibility. Implementation uses Python with FastAPI dependency injection.

## Tasks

- [x] 1. Create ownership registry module and core dependency
  - [x] 1.1 Create `backend/ownership.py` with registry, `register_ownership_checker`, and `require_ownership` factory
    - Define `OwnershipChecker` type alias: `Callable[[Session, int], Optional[Tuple[Any, int]]]`
    - Implement `_registry: Dict[str, OwnershipChecker]` module-level dict
    - Implement `register_ownership_checker(resource_type, checker)` to add entries
    - Implement `require_ownership(resource_type, id_param, error_detail)` factory that returns a FastAPI `Depends`-compatible callable
    - The returned dependency should: extract resource ID from path params, call the registered checker, raise 404 if not found, raise 403 if `owner_user_id != current_user.id`, return the resource on success
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 1.2 Register checker for `notification` resource type
    - Query `Notification` by `notification_id`, return `(notification, notification.user_id)` or `None`
    - Register in `backend/ownership.py` at module level
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.2_

  - [x] 1.3 Register checker for `subtask` resource type with path consistency
    - Query `SubTask` joined with `Task`, filtering by `subtask_id` AND `task_id` from path params
    - Return `(subtask, subtask.task.user_id)` or `None` if subtask not found or `task_id` mismatch
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.2_

  - [x] 1.4 Register checker for `task` resource type
    - Query `Task` by `task_id`, return `(task, task.user_id)` or `None`
    - _Requirements: 3.1, 3.2, 3.3, 4.2_

- [x] 2. Wire ownership dependency into notification endpoints
  - [x] 2.1 Update `mark_notification_read` in `backend/routers/notifications.py`
    - Add `require_ownership("notification")` as a dependency parameter
    - Use the returned notification object directly instead of calling `crud.mark_notification_read` with an unvalidated ID
    - Remove redundant manual ownership check if present
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 2.2 Update `dismiss_notification` in `backend/routers/notifications.py`
    - Add `require_ownership("notification")` as a dependency parameter
    - Use the returned notification object directly instead of calling `crud.dismiss_notification` with an unvalidated ID
    - Remove redundant manual ownership check if present
    - _Requirements: 1.2, 1.3, 1.4_

- [x] 3. Wire ownership dependency into subtask endpoints
  - [x] 3.1 Update `toggle_subtask` in `backend/routers/tasks.py`
    - Add `require_ownership("subtask")` as a dependency parameter
    - The checker validates both `subtask.task_id == path task_id` and `task.user_id == current_user.id`
    - Remove the existing manual task lookup and subtask toggle-by-ID-only pattern
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 3.2 Update `delete_subtask` in `backend/routers/tasks.py`
    - Add `require_ownership("subtask")` as a dependency parameter
    - Same path consistency and ownership validation as toggle
    - Remove the existing manual task lookup and subtask delete-by-ID-only pattern
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [x] 4. Checkpoint - Verify ownership middleware
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Fix focus task ownership and add profile visibility
  - [x] 5.1 Fix `add_focus_task` in `backend/routers/weekly_review.py` to verify task ownership
    - After checking `task exists`, add a check: `if task.user_id != current_user.id: raise HTTPException(403)`
    - This prevents adding another user's task to your focus list
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.2 Add `profile_visibility` column to `User` model in `backend/models.py`
    - Add `profile_visibility = Column(String, default="public")` to the `User` class
    - _Requirements: 5.1_

  - [x] 5.3 Create migration script `backend/migrations/migrate_profile_visibility.py`
    - Use `sqlite3` to `ALTER TABLE users ADD COLUMN profile_visibility TEXT DEFAULT 'public'`
    - Follow existing migration pattern in the `backend/migrations/` directory
    - _Requirements: 5.1_

  - [x] 5.4 Add `ProfileVisibilityUpdate` and `ProfileVisibilityOut` schemas to `backend/schemas.py`
    - `ProfileVisibilityUpdate`: `profile_visibility: Literal["public", "private"]`
    - `ProfileVisibilityOut`: `profile_visibility: str` with `from_attributes=True`
    - Update `UserSettingsOut` to include `profile_visibility` field
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 5.5 Create profile visibility toggle endpoint in `backend/routers/users.py`
    - `PUT /users/{user_id}/settings/profile-visibility`
    - Accept `ProfileVisibilityUpdate` body, require authentication, verify `user_id == current_user.id`
    - Update and return the `profile_visibility` value
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 6. Update leaderboard to filter by visibility
  - [x] 6.1 Modify `get_leaderboard` in `backend/routers/analytics.py`
    - Change `db.query(User).all()` to `db.query(User).filter(User.profile_visibility == "public").all()`
    - After building the leaderboard list, check if `current_user.id` is already included
    - If not (user is private), compute and append the authenticated user's entry
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 7. Checkpoint - Verify all features
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Property-based tests for correctness properties
  - [x] 8.1 Write property test: Ownership validation grants access iff requester is owner
    - **Property 1: Ownership validation grants access if and only if requester is owner**
    - Generate random `(requester_id, owner_id)` pairs and resource instances using Hypothesis
    - Verify the ownership checker grants access iff IDs match, raises 403 otherwise
    - **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.4, 3.1, 3.2**

  - [x] 8.2 Write property test: Subtask path consistency rejects mismatched task IDs
    - **Property 2: Subtask path consistency rejects mismatched task IDs**
    - Generate random `(url_task_id, subtask_task_id)` pairs using Hypothesis
    - Verify the subtask checker returns the resource only when IDs match, raises 404 otherwise
    - **Validates: Requirements 2.3, 2.5**

  - [x] 8.3 Write property test: Profile visibility round-trip
    - **Property 3: Profile visibility round-trip**
    - Generate random users and random valid visibility values (`"public"`, `"private"`) using Hypothesis
    - Set visibility, read back, verify equality
    - **Validates: Requirements 5.2, 5.3, 6.2**

  - [x] 8.4 Write property test: Invalid visibility values are rejected
    - **Property 4: Invalid visibility values are rejected**
    - Generate random strings (excluding `"public"` and `"private"`) using Hypothesis
    - Verify 422 response from Pydantic validation
    - **Validates: Requirements 5.4**

  - [x] 8.5 Write property test: Leaderboard excludes private users
    - **Property 5: Leaderboard excludes private users**
    - Generate random sets of users with random visibility settings using Hypothesis
    - Call leaderboard, verify only public users appear (excluding self-inclusion rule)
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [x] 8.6 Write property test: Leaderboard always includes the authenticated user
    - **Property 6: Leaderboard always includes the authenticated user**
    - Generate random authenticated users with random visibility using Hypothesis
    - Verify the authenticated user always appears in their own leaderboard view
    - **Validates: Requirements 7.4**

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use the Hypothesis library (already present in the project)
- The design uses Python with FastAPI throughout — no language selection needed
