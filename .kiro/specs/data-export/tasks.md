# Implementation Plan: Data Export

## Overview

Add a Data Export feature to LifeOS that lets users download their data (tasks, goals, habits, journal entries, notes) as JSON or CSV files. Backend introduces a new `export_engine.py` module for data querying and serialization, and a new FastAPI router at `/users/{user_id}/export`. Frontend adds an Export Page with data type checkboxes, format selector, optional date range filter, and a download button that triggers a blob download. No database migrations are needed — the feature reads from existing models.

## Tasks

- [x] 1. Backend export engine
  - [x] 1.1 Create `backend/export_engine.py` with serialization functions
    - Define `EXPORTABLE_TYPES` set and `CSV_COLUMNS` dict
    - Implement `serialize_tasks(tasks)` — convert Task ORM objects to export dicts, include subtasks (as nested list of `{id, title, is_complete}`) and tags (as list of tag names)
    - Implement `serialize_goals(goals)` — convert Goal ORM objects to export dicts including `progress`
    - Implement `serialize_habits(habits)` — convert Habit ORM objects to export dicts, include logs (as nested list of `{log_date, status}`)
    - Implement `serialize_journal(entries)` — convert JournalEntry ORM objects to export dicts
    - Implement `serialize_notes(notes)` — convert Note ORM objects to export dicts
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 1.2 Add `query_export_data` to `backend/export_engine.py`
    - Query each requested data type from the database for the given user
    - Apply optional date range filtering on `created_at` (inclusive start, inclusive end)
    - Include all statuses for tasks (Todo, InProgress, Done) and goals (Active, Completed, Archived)
    - Include all task types (manual, habit, recurring)
    - Include all habit log entries for exported habits
    - Include all subtasks nested within parent tasks
    - Return dict mapping data type names to serialized record lists
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 4.3, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 1.3 Add `build_json_export` to `backend/export_engine.py`
    - Build JSON bytes with top-level `metadata` object containing `exported_at` (ISO 8601), `user_id`, and `format` fields
    - Include each selected data type as a top-level key mapping to its array of records
    - _Requirements: 2.3, 5.1, 5.2_

  - [x] 1.4 Add `build_csv_single` and `build_csv_zip` to `backend/export_engine.py`
    - `build_csv_single(data_type, records)` — build a single CSV file with UTF-8 BOM prefix, header row matching `CSV_COLUMNS[data_type]`, and data rows; tags joined with semicolons for tasks
    - `build_csv_zip(data)` — build a ZIP archive containing one `{type}.csv` per data type, each with BOM and correct headers
    - _Requirements: 2.4, 2.5, 6.1, 6.7_

  - [ ]* 1.5 Write property test: JSON export contains exactly the selected data types (Property 1)
    - **Property 1: JSON export contains exactly the selected data types**
    - **Validates: Requirements 2.3, 5.1, 5.2**
    - Create `backend/tests/test_export_engine.py` using Hypothesis
    - Generate random non-empty subsets of data types and mock data, call `build_json_export`, verify JSON keys match `{"metadata"} ∪ selected_types`

  - [ ]* 1.6 Write property test: CSV ZIP contains one file per selected data type (Property 2)
    - **Property 2: CSV ZIP contains one file per selected data type**
    - **Validates: Requirements 2.4**
    - In `backend/tests/test_export_engine.py`
    - Generate random subsets of size ≥ 2, call `build_csv_zip`, verify ZIP contains exactly `{type}.csv` for each selected type

  - [ ]* 1.7 Write property test: Serialized records contain all required fields (Property 5)
    - **Property 5: Serialized records contain all required fields**
    - **Validates: Requirements 5.3, 5.4, 5.5, 5.6, 5.7, 6.2, 6.3, 6.4, 6.5, 6.6**
    - In `backend/tests/test_export_engine.py`
    - Generate random records for each data type, call the appropriate `serialize_*` function, verify all required fields are present

  - [ ]* 1.8 Write property test: CSV structure — BOM and correct headers (Property 6)
    - **Property 6: CSV structure — BOM and correct headers**
    - **Validates: Requirements 6.1, 6.7**
    - In `backend/tests/test_export_engine.py`
    - Generate random data for each data type, call `build_csv_single`, verify BOM prefix and header row columns match the spec

  - [ ]* 1.9 Write property test: Nested data completeness (Property 9)
    - **Property 9: Nested data completeness**
    - **Validates: Requirements 9.4, 9.5**
    - In `backend/tests/test_export_engine.py`
    - Generate tasks with random subtask counts and habits with random log counts, serialize them, verify nested array lengths match

- [x] 2. Checkpoint — Export engine complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Backend export router
  - [x] 3.1 Create `backend/routers/export.py`
    - Define `router = APIRouter(prefix="/users/{user_id}/export", tags=["export"])`
    - Implement `GET /` endpoint accepting query params: `format` (default `"json"`), `types` (comma-separated), optional `start_date` and `end_date` (ISO date strings)
    - Parse and validate `types` against `EXPORTABLE_TYPES`, return HTTP 422 if no valid types
    - Parse and validate date strings, return HTTP 422 for invalid format
    - Validate `format` is `"json"` or `"csv"`, return HTTP 422 otherwise
    - Call `query_export_data` and appropriate build function from `export_engine`
    - Return `StreamingResponse` with correct `Content-Type` and `Content-Disposition` headers per format/type-count scenario
    - Filename pattern: `lifeos-export-{YYYY-MM-DD}.{ext}` where ext is `json`, `csv`, or `zip`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.3_

  - [ ]* 3.2 Write property test: Date range filtering correctness (Property 3)
    - **Property 3: Date range filtering correctness**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
    - In `backend/tests/test_export_engine.py`
    - Generate random records with random `created_at` timestamps and random start/end date combinations, call `query_export_data`, verify all returned records fall within the specified range

  - [ ]* 3.3 Write property test: User data isolation (Property 4)
    - **Property 4: User data isolation**
    - **Validates: Requirements 4.3**
    - In `backend/tests/test_export_engine.py`
    - Generate data for two users, call `query_export_data` for one user, verify no records from the other user appear

  - [ ]* 3.4 Write property test: Filename pattern matches format and type count (Property 7)
    - **Property 7: Filename pattern matches format and type count**
    - **Validates: Requirements 7.3**
    - In `backend/tests/test_export_engine.py`
    - Generate random format and type count combinations, verify the generated filename matches the expected pattern

  - [ ]* 3.5 Write property test: Export includes all records regardless of status (Property 8)
    - **Property 8: Export includes all records regardless of status**
    - **Validates: Requirements 9.1, 9.2, 9.3**
    - In `backend/tests/test_export_engine.py`
    - Generate tasks with random statuses/types and goals with random statuses, call `query_export_data`, verify the count matches the total records for that user

- [x] 4. Backend router registration
  - [x] 4.1 Register export router in `backend/main.py`
    - Import `export` from `backend.routers`
    - Add `app.include_router(export.router)`
    - _Requirements: 4.1_

- [x] 5. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Frontend API function
  - [x] 6.1 Add `exportData` function to `frontend/src/api/index.ts`
    - Implement `exportData(userId, format, types, startDate?, endDate?)` that calls `GET /users/{userId}/export` with query params
    - Use `responseType: 'blob'` for the axios request
    - Return the response blob
    - _Requirements: 4.1, 7.2_

- [x] 7. Frontend Export Page
  - [x] 7.1 Create `frontend/src/pages/ExportPage.tsx`
    - Manage component state: `selectedTypes` (Set), `format` ('json' | 'csv', default 'json'), `startDate`, `endDate`, `loading`, `error`
    - Render page title "Export Data"
    - Render data type checkboxes for Tasks, Goals, Habits, Journal, Notes with a "Select All" toggle
    - Render format selector as radio buttons for JSON / CSV
    - Render optional start date and end date inputs
    - Show validation error when start date is after end date
    - Disable export button when no types selected or date validation fails
    - Show loading indicator during export
    - On export: call `exportData`, determine file extension (`json`, `csv`, or `zip`), create object URL, trigger browser download with filename `lifeos-export-{YYYY-MM-DD}.{ext}`
    - Show error message on failure, hide loading indicator
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 3.1, 3.6, 7.1, 7.2, 7.3, 7.4, 8.3_

- [x] 8. Frontend routing and sidebar integration
  - [x] 8.1 Add `/export` route to `frontend/src/App.tsx`
    - Import `ExportPage` and add `<Route path="/export" element={<ExportPage />} />` inside the protected layout
    - _Requirements: 8.1_

  - [x] 8.2 Add Export Data link to `frontend/src/components/Sidebar.tsx`
    - Add navigation item with label "Export Data" and `Download` icon from lucide-react
    - Link to `/export`
    - _Requirements: 8.2_

- [x] 9. Final checkpoint — All integration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use Hypothesis (Python backend) to validate the 9 correctness properties from the design
- No database migrations needed — the feature reads from existing models only
- The export engine is a stateless module that queries existing data and serializes it
