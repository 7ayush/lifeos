# Implementation Plan: Water Intake Tracker

## Overview

Implement a water intake tracking feature for LifeOS with a FastAPI backend router, SQLAlchemy models, and a React/TypeScript frontend. The implementation follows the existing LifeOS architecture patterns: router-per-domain, CRUD functions in `crud.py`, Pydantic schemas, and React pages with API client modules. Tasks are ordered to build backend data layer first, then API endpoints, then frontend components, wiring everything together incrementally.

## Tasks

- [x] 1. Create database models and migration
  - [x] 1.1 Add WaterEntry and WaterGoal models to `backend/models.py`
    - Add `WaterEntry` model with columns: id, user_id (FK to users.id), amount_ml (Integer, non-null), timestamp (DateTime, non-null, default utcnow)
    - Add `WaterGoal` model with columns: id, user_id (FK to users.id, unique), amount_ml (Integer, non-null, default 2000), updated_at (DateTime)
    - Add relationships to User model via backref
    - _Requirements: 10.1, 4.3_

  - [x] 1.2 Add Pydantic schemas to `backend/schemas.py`
    - Add `WaterEntryCreate` with amount_ml field (ge=1, le=5000)
    - Add `WaterEntryOut` with id, user_id, amount_ml, timestamp (from_attributes=True)
    - Add `WaterGoalUpdate` with amount_ml field (ge=500, le=10000)
    - Add `WaterGoalOut` with amount_ml (from_attributes=True)
    - Add `DailyProgressOut` with date, total_ml, goal_ml, percentage
    - _Requirements: 1.2, 4.2, 7.1, 7.4_

  - [x] 1.3 Create migration script `backend/migrations/migrate_water_intake.py`
    - Create `water_entries` and `water_goals` tables following existing migration patterns
    - _Requirements: 10.1_

- [x] 2. Implement backend CRUD functions
  - [x] 2.1 Add water CRUD functions to `backend/crud.py`
    - Implement `create_water_entry(db, user_id, entry)` — inserts a WaterEntry record
    - Implement `get_water_entries_by_date(db, user_id, date)` — queries entries filtered by user and date
    - Implement `delete_water_entry(db, entry_id, user_id)` — deletes entry after verifying ownership, returns False if not found or not owned
    - Implement `get_daily_progress(db, user_id, start_date, end_date)` — aggregates SUM(amount_ml) grouped by date, joins with goal
    - Implement `get_water_goal(db, user_id)` — returns WaterGoal row or None
    - Implement `upsert_water_goal(db, user_id, amount_ml)` — inserts or updates the user's goal row
    - _Requirements: 1.1, 3.1, 3.3, 4.1, 4.3, 7.2, 7.4, 10.2, 10.3_

  - [x] 2.2 Write property test: entry creation preserves required fields
    - **Property 1: Water entry creation preserves all required fields**
    - **Validates: Requirements 1.1, 7.1, 10.1**

  - [x] 2.3 Write property test: entry amount validation rejects out-of-range values
    - **Property 2: Entry amount validation rejects out-of-range values**
    - **Validates: Requirements 1.2**

  - [x] 2.4 Write property test: goal amount validation rejects out-of-range values
    - **Property 3: Goal amount validation rejects out-of-range values**
    - **Validates: Requirements 4.2**

  - [x] 2.5 Write property test: deleting an entry removes it from the database
    - **Property 4: Deleting an entry removes it from the database**
    - **Validates: Requirements 3.1, 7.3**

  - [x] 2.6 Write property test: entry access is scoped to the owning user
    - **Property 5: Entry access is scoped to the owning user**
    - **Validates: Requirements 3.3, 10.3**

  - [x] 2.7 Write property test: goal set/get round trip
    - **Property 6: Goal set/get round trip**
    - **Validates: Requirements 4.1, 7.5, 7.6**

  - [x] 2.8 Write property test: date filtering returns only records within the requested range
    - **Property 7: Date filtering returns only records within the requested range**
    - **Validates: Requirements 7.2, 7.4**

  - [x] 2.9 Write property test: daily progress total equals sum of individual entries
    - **Property 8: Daily progress total equals sum of individual entries**
    - **Validates: Requirements 10.2**

- [x] 3. Implement water router API endpoints
  - [x] 3.1 Create `backend/routers/water.py` with all endpoints
    - POST `/api/water/entries` — validate via WaterEntryCreate schema, call create_water_entry, return WaterEntryOut
    - GET `/api/water/entries?date=YYYY-MM-DD` — call get_water_entries_by_date, return List[WaterEntryOut]
    - DELETE `/api/water/entries/{entry_id}` — call delete_water_entry, return 404 if not found, 403 if not owned
    - GET `/api/water/progress?start_date=...&end_date=...` — call get_daily_progress, return List[DailyProgressOut]
    - PUT `/api/water/goal` — validate via WaterGoalUpdate, call upsert_water_goal, return WaterGoalOut
    - GET `/api/water/goal` — call get_water_goal, return default 2000 ml if no row exists
    - All endpoints use `get_current_user` dependency for JWT auth
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 1.1, 1.2, 3.1, 3.3, 4.1, 4.2, 4.3_

  - [x] 3.2 Register water router in `backend/main.py`
    - Import and include the water router with appropriate prefix
    - _Requirements: 7.1_

  - [x] 3.3 Write property test: all water endpoints require authentication
    - **Property 9: All water endpoints require authentication**
    - **Validates: Requirements 7.7**

  - [x] 3.4 Write unit tests for water API endpoints in `backend/tests/test_water_api.py`
    - Test create entry, get entries by date, delete entry, delete nonexistent entry
    - Test set goal, get goal, get default goal (no row), update goal
    - Test daily progress with entries, no entries, and across date range
    - _Requirements: 1.1, 1.2, 3.1, 3.3, 4.1, 4.2, 4.3, 7.1–7.7, 10.2_

- [x] 4. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create frontend API client and types
  - [x] 5.1 Add TypeScript types to `frontend/src/types.ts`
    - Add `WaterEntry`, `WaterGoal`, and `DailyProgress` interfaces
    - _Requirements: 7.1, 7.4, 7.6_

  - [x] 5.2 Create `frontend/src/api/water.ts` API client
    - Implement `createWaterEntry(amount_ml)` — POST to `/api/water/entries`
    - Implement `getWaterEntries(date)` — GET `/api/water/entries?date=...`
    - Implement `deleteWaterEntry(entryId)` — DELETE `/api/water/entries/{entryId}`
    - Implement `getDailyProgress(startDate, endDate)` — GET `/api/water/progress?start_date=...&end_date=...`
    - Implement `getWaterGoal()` — GET `/api/water/goal`
    - Implement `updateWaterGoal(amount_ml)` — PUT `/api/water/goal`
    - Follow existing API client patterns from `frontend/src/api/`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 6. Implement HydrationPage
  - [x] 6.1 Create `frontend/src/pages/HydrationPage.tsx`
    - Daily Progress section: display today's total in ml, progress bar showing percentage of goal, visual indicator when goal is reached
    - Quick-add buttons for 250 ml, 500 ml, and 750 ml
    - Custom amount input field accepting 1–5000 ml with validation
    - List of individual Water_Entry records for the selected date with amount, timestamp, and delete button
    - History section: 7-day bar chart of daily totals with goal reference line
    - Clicking a bar in the chart selects that date and shows its entries
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 3.2, 4.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 8.3_

  - [x] 6.2 Add route for HydrationPage in `frontend/src/App.tsx`
    - Register `/hydration` route pointing to HydrationPage
    - _Requirements: 8.1_

  - [x] 6.3 Add Hydration link to Sidebar in `frontend/src/components/Sidebar.tsx`
    - Add navigation link with label "Hydration" and a water drop icon
    - _Requirements: 8.2_

  - [x] 6.4 Write unit tests for HydrationPage in `frontend/src/pages/__tests__/HydrationPage.test.tsx`
    - Test quick-add buttons (250/500/750 ml) are rendered and create entries on click
    - Test custom amount input accepts valid values and rejects invalid ones
    - Test entry list renders with amount and timestamp
    - Test delete button removes entry from list
    - _Requirements: 2.1, 2.2, 2.3, 5.4_

- [x] 7. Implement Dashboard HydrationWidget
  - [x] 7.1 Create `frontend/src/components/HydrationWidget.tsx`
    - Display today's total water consumed and Daily_Goal
    - Progress bar showing percentage of goal achieved
    - Quick-add 250 ml button that creates a Water_Entry
    - "View Details" link navigating to `/hydration`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 7.2 Integrate HydrationWidget into Dashboard page `frontend/src/pages/Dashboard.tsx`
    - Add HydrationWidget to the Dashboard layout
    - _Requirements: 9.1_

  - [x] 7.3 Write unit tests for HydrationWidget in `frontend/src/components/__tests__/HydrationWidget.test.tsx`
    - Test widget shows total and goal, progress bar, quick-add button, and "View Details" link
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use Hypothesis (Python) in `backend/tests/test_water_properties.py`
- Frontend unit tests use Vitest in their respective `__tests__/` directories
- Checkpoints ensure incremental validation after backend and full integration
