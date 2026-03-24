# Implementation Plan: Google Fit Integration

## Overview

Incrementally build the Google Fit integration by starting with backend data models and schemas, then building the service layer (OAuth + data fetching), CRUD operations, API router, and finally the frontend pages and dashboard widget. Each step builds on the previous one, with property and unit tests woven in close to the code they validate.

## Tasks

- [ ] 1. Add backend data models and Pydantic schemas
  - [ ] 1.1 Add fitness SQLAlchemy models to `backend/models.py`
    - Add `FitnessConnection`, `StepRecord`, `WorkoutRecord`, and `DailySummary` models with all columns, relationships, and unique constraints as specified in the design
    - Run Alembic migration to create the new tables
    - _Requirements: 1.3, 3.2, 4.2, 5.2, 6.2, 7.2, 12.1_

  - [ ] 1.2 Add fitness Pydantic schemas to `backend/schemas.py`
    - Add `FitnessConnectionStatus`, `FitnessAuthUrl`, `FitnessCallbackRequest`, `FitnessSyncRequest`, `FitnessSyncResponse`, `StepRecordOut`, `WorkoutRecordOut`, `DailySummaryOut`, and `FitnessDashboardSummary` schemas as specified in the design
    - _Requirements: 9.1–9.8, 12.3_

- [ ] 2. Implement fitness CRUD operations
  - [ ] 2.1 Create `backend/fitness_crud.py` with all database operations
    - Implement `create_fitness_connection`, `get_fitness_connection`, `delete_fitness_connection`
    - Implement `upsert_step_record`, `upsert_workout_record`, `upsert_daily_summary`
    - Implement `get_step_records`, `get_daily_summaries`, `get_workout_records`
    - Implement `update_last_sync`
    - All upsert functions must use the unique constraint for idempotent writes
    - _Requirements: 1.3, 2.1, 2.3, 3.2, 3.3, 4.2, 5.2, 6.2, 7.2, 8.5_

  - [ ]* 2.2 Write property test: Step record upsert idempotence
    - **Property 3: Step record upsert idempotence**
    - **Validates: Requirements 3.3**

  - [ ]* 2.3 Write property test: Disconnect retains fitness data
    - **Property 2: Disconnect retains fitness data**
    - **Validates: Requirements 2.3**

- [ ] 3. Implement fitness service layer
  - [ ] 3.1 Create `backend/fitness_service.py` with OAuth and sync logic
    - Implement `build_auth_url` to generate Google OAuth 2.0 authorization URL with required scopes (`fitness.activity.read`, `fitness.body.read`, `fitness.sleep.read`)
    - Implement `exchange_code_for_tokens` to exchange authorization code for access/refresh tokens
    - Implement `refresh_access_token` to refresh expired access tokens
    - Implement `revoke_token` to revoke tokens with Google on disconnect
    - Implement `encrypt_token` and `decrypt_token` using `cryptography.fernet` with key from environment variable
    - Implement `sync_fitness_data` that fetches steps, workouts, calories, active minutes, heart rate, and sleep data from Google Fit REST API and upserts into DB via CRUD functions
    - Handle token refresh transparently during sync; mark connection as disconnected if refresh token is invalid
    - _Requirements: 1.2, 1.3, 1.5, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.5, 8.6, 8.7, 12.1, 12.2_

  - [ ]* 3.2 Write property test: Token encryption round trip
    - **Property 1: Token encryption round trip**
    - **Validates: Requirements 12.1**

  - [ ]* 3.3 Write property test: Step records contain required fields
    - **Property 4: Step records contain required fields**
    - **Validates: Requirements 3.2**

  - [ ]* 3.4 Write property test: Workout records contain required fields
    - **Property 5: Workout records contain required fields**
    - **Validates: Requirements 4.2**

  - [ ]* 3.5 Write property test: Daily summary contains all synced metric fields
    - **Property 6: Daily summary contains all synced metric fields**
    - **Validates: Requirements 5.2, 6.2, 7.2**

  - [ ]* 3.6 Write property test: Last sync timestamp updated after successful sync
    - **Property 8: Last sync timestamp updated after successful sync**
    - **Validates: Requirements 8.5**

- [ ] 4. Checkpoint - Backend service layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement fitness API router
  - [ ] 5.1 Create `backend/routers/fitness.py` with all endpoints
    - `GET /api/fitness/auth-url` — returns Google OAuth authorization URL
    - `POST /api/fitness/callback` — exchanges auth code for tokens, creates connection
    - `GET /api/fitness/connection` — returns connection status
    - `DELETE /api/fitness/connection` — revokes tokens and deletes connection
    - `POST /api/fitness/sync` — triggers sync for given day range (default 7)
    - `GET /api/fitness/summary` — returns daily summaries for date range
    - `GET /api/fitness/workouts` — returns workout records for date range
    - `GET /api/fitness/steps` — returns step records for date range
    - All endpoints require JWT auth via `get_current_user` dependency
    - _Requirements: 9.1–9.9_

  - [ ] 5.2 Register the fitness router in `backend/main.py`
    - Import and include the fitness router with the appropriate prefix
    - _Requirements: 9.1–9.9_

  - [ ]* 5.3 Write property test: All fitness endpoints require authentication
    - **Property 10: All fitness endpoints require authentication**
    - **Validates: Requirements 9.9**

  - [ ]* 5.4 Write property test: API responses never expose raw tokens
    - **Property 11: API responses never expose raw tokens**
    - **Validates: Requirements 12.3**

  - [ ]* 5.5 Write property test: Date range filtering returns correct records
    - **Property 9: Date range filtering returns correct records**
    - **Validates: Requirements 9.6, 9.7, 9.8**

  - [ ]* 5.6 Write unit tests for fitness API endpoints
    - Test OAuth flow (auth URL generation, callback success, callback with invalid code)
    - Test connection management (connect, disconnect, status check)
    - Test sync operations (sync with mocked Google API, sync with expired token, sync with revoked refresh token)
    - Test data retrieval (steps/workouts/summary with date range, empty results)
    - Place tests in `backend/tests/test_fitness_api.py`
    - _Requirements: 1.2, 1.3, 1.5, 2.1, 2.2, 8.6, 8.7, 9.1–9.9_

- [ ] 6. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Add frontend TypeScript types and API client
  - [ ] 7.1 Add fitness TypeScript types to `frontend/src/types.ts`
    - Add `FitnessConnectionStatus`, `StepRecord`, `WorkoutRecord`, `DailySummary`, and `FitnessDashboardSummary` interfaces as specified in the design
    - _Requirements: 9.1–9.8_

  - [ ] 7.2 Create `frontend/src/api/fitness.ts` API client
    - Implement `getAuthUrl`, `submitCallback`, `getConnectionStatus`, `disconnect`, `syncData`, `getSummary`, `getWorkouts`, `getSteps` functions using axios
    - _Requirements: 9.1–9.8_

- [ ] 8. Implement the Fitness page
  - [ ] 8.1 Create `frontend/src/pages/FitnessPage.tsx`
    - Connection status banner with "Connect Google Fit" / "Disconnect" button based on connection state
    - Date selector for choosing date or date range
    - Steps section with daily count and 7-day trend chart
    - Workouts list with activity type, duration, and calories; empty state when no workouts
    - Calories & Active Minutes section
    - Heart Rate section with "No data" indicator when unavailable
    - Sleep section with duration formatted as "Xh Ym"; "No data" indicator when unavailable
    - "Sync Now" button with loading indicator during sync
    - Auto-trigger sync for past 7 days on page load when connected
    - Display error messages for OAuth failures
    - _Requirements: 1.1, 1.4, 1.5, 2.2, 3.4, 3.5, 4.3, 4.4, 5.3, 6.3, 6.4, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 10.1, 10.3, 10.4_

  - [ ] 8.2 Create sleep duration formatting utility in `frontend/src/utils/formatSleepDuration.ts`
    - Format minutes as "Xh Ym" string
    - _Requirements: 7.3_

  - [ ]* 8.3 Write property test: Sleep duration formatting
    - **Property 7: Sleep duration formatting**
    - **Validates: Requirements 7.3**

  - [ ]* 8.4 Write unit tests for FitnessPage
    - Test connected state, disconnected state, loading state, empty data states
    - Place tests in `frontend/src/pages/__tests__/FitnessPage.test.tsx`
    - _Requirements: 1.1, 1.4, 2.2, 4.4, 6.4, 7.4, 8.3_

- [ ] 9. Add Fitness page to navigation
  - [ ] 9.1 Add route for `/fitness` in `frontend/src/App.tsx`
    - Add the FitnessPage route inside the protected routes
    - _Requirements: 10.1_

  - [ ] 9.2 Add "Fitness" link with icon to `frontend/src/components/Sidebar.tsx`
    - _Requirements: 10.2_

- [ ] 10. Implement Dashboard fitness widget
  - [ ] 10.1 Create `frontend/src/components/FitnessWidget.tsx`
    - When connected: show today's step count, calories burned, and active minutes
    - When not connected: show prompt to connect Google Fit with link to Fitness page
    - Include "View Details" link navigating to `/fitness`
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ] 10.2 Integrate FitnessWidget into `frontend/src/pages/Dashboard.tsx`
    - Add the widget to the Dashboard layout
    - _Requirements: 11.1, 11.2_

  - [ ]* 10.3 Write unit tests for FitnessWidget
    - Test connected with data, disconnected prompt, navigation link
    - Place tests in `frontend/src/components/__tests__/FitnessWidget.test.tsx`
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All backend property tests go in `backend/tests/test_fitness_properties.py`
- The backend uses Python/FastAPI; the frontend uses React/TypeScript
