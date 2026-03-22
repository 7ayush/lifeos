# Implementation Plan: Task Priorities and Sorting

## Overview

Add a priority field (High, Medium, Low, None) across the full stack — database migration, backend model/schema, frontend types, sort/filter utilities, PriorityBadge component, and Kanban Board + Dashboard integration. Backend uses Python (FastAPI/SQLAlchemy/Pydantic), frontend uses TypeScript (React). Property-based tests use hypothesis (backend) and fast-check (frontend).

## Tasks

- [x] 1. Backend data model and schema changes
  - [x] 1.1 Add priority column to Task model in `backend/models.py`
    - Add `priority = Column(String, default="None")` to the `Task` class
    - _Requirements: 1.1_

  - [x] 1.2 Add PriorityLevel type and priority field to Pydantic schemas in `backend/schemas.py`
    - Define `PriorityLevel = Literal["High", "Medium", "Low", "None"]`
    - Add `priority: Optional[PriorityLevel] = "None"` to `TaskBase`
    - Add `priority: Optional[PriorityLevel] = None` to `TaskUpdate`
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ]* 1.3 Write property test: Invalid priority values are rejected
    - **Property 1: Invalid priority values are rejected**
    - **Validates: Requirements 1.4, 3.4**
    - Create `backend/tests/test_priority_properties.py` using `hypothesis`
    - Generate arbitrary strings not in {"High", "Medium", "Low", "None"} and verify `TaskCreate`/`TaskUpdate` schema validation raises `ValidationError`

  - [ ]* 1.4 Write property test: Priority round-trip persistence
    - **Property 2: Priority round-trip persistence**
    - **Validates: Requirements 2.4, 3.3**
    - In `backend/tests/test_priority_properties.py` using `hypothesis`
    - For each valid priority, create a `TaskCreate` schema and verify the `priority` field matches the input; create a `TaskUpdate` schema and verify the same

- [x] 2. Database migration
  - [x] 2.1 Create Alembic migration script to add priority column
    - Create `backend/migrate_task_priority.py`
    - `upgrade()`: Add `priority` column (String, server_default="None") to `tasks` table, update existing rows to "None"
    - `downgrade()`: Drop the `priority` column
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 3. Checkpoint — Backend complete
  - Ensure all backend tests pass, ask the user if questions arise.

- [x] 4. Frontend types and utility functions
  - [x] 4.1 Add priority field to frontend TypeScript interfaces in `frontend/src/types.ts`
    - Add `priority?: string` to `Task` interface
    - Add `priority?: string` to `TaskCreate` interface
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 4.2 Create priority sort utility in `frontend/src/utils/prioritySort.ts`
    - Implement `sortByPriority(tasks: Task[]): Task[]` using weight map `{ High: 0, Medium: 1, Low: 2, None: 3 }`
    - Must be a stable sort preserving relative order for equal priorities
    - _Requirements: 5.1, 5.2_

  - [ ]* 4.3 Write property test: Priority sort produces correct ordering with stability
    - **Property 3: Priority sort produces correct ordering with stability**
    - **Validates: Requirements 5.1, 5.2**
    - Create `frontend/src/utils/__tests__/prioritySort.test.ts` using `fast-check`
    - Generate random arrays of task objects with random priorities, sort them, verify non-decreasing weight order and stable relative ordering for equal priorities

  - [x] 4.4 Create priority filter utility in `frontend/src/utils/priorityFilter.ts`
    - Implement `filterByPriority(tasks: Task[], priority: string): Task[]`
    - Return only tasks matching the selected priority, or all tasks if priority is "All"
    - _Requirements: 6.2, 6.3_

  - [ ]* 4.5 Write property test: Priority filter returns only matching tasks
    - **Property 4: Priority filter returns only matching tasks**
    - **Validates: Requirements 6.2, 6.3**
    - Create `frontend/src/utils/__tests__/priorityFilter.test.ts` using `fast-check`
    - Generate random task arrays and a random priority filter value, verify filtered results contain only matching tasks and "All" returns the full list

  - [ ]* 4.6 Write property test: Priority and energy filters compose as intersection
    - **Property 5: Priority and energy filters compose as intersection**
    - **Validates: Requirements 6.4, 6.5**
    - In `frontend/src/utils/__tests__/priorityFilter.test.ts` using `fast-check`
    - Generate random task arrays with random priority and energy values, plus random filter selections, verify combined filter result equals intersection of individual filters

- [x] 5. Checkpoint — Utilities and properties complete
  - Ensure all frontend utility tests pass, ask the user if questions arise.

- [x] 6. PriorityBadge component
  - [x] 6.1 Create `frontend/src/components/PriorityBadge.tsx`
    - Map priority to colored badge: High → red, Medium → amber/yellow, Low → blue, None → render nothing
    - Include appropriate icons (arrow-up for High, minus for Medium, arrow-down for Low)
    - Treat `undefined`/`null` priority as "None"
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 6.2 Write unit tests for PriorityBadge component
    - Create `frontend/src/components/__tests__/PriorityBadge.test.tsx`
    - Test rendering for each priority value (High, Medium, Low, None, undefined)
    - Verify correct color classes and that None/undefined renders nothing
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7. Kanban Board integration
  - [x] 7.1 Add priority filter state and UI control to `frontend/src/pages/KanbanBoard.tsx`
    - Add `priorityFilter` state (default: "All")
    - Render priority filter control with options "All", "High", "Medium", "Low", "None" next to existing energy filter
    - _Requirements: 6.1, 6.4_

  - [x] 7.2 Add priority selector to create/edit task modal in `frontend/src/pages/KanbanBoard.tsx`
    - Add priority `<select>` to the task creation modal, defaulting to "None"
    - Add priority `<select>` to the edit modal, pre-populated with the task's current priority
    - Include selected priority in create/update API requests
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [x] 7.3 Integrate sort and filter into `getTasksByStatus` in `frontend/src/pages/KanbanBoard.tsx`
    - Apply `filterByPriority` alongside existing energy filter
    - Apply `sortByPriority` after filtering
    - Ensure drag-and-drop destination column re-sorts via the render pipeline
    - _Requirements: 5.1, 5.3, 5.4, 6.2, 6.3, 6.5_

  - [x] 7.4 Render PriorityBadge on task cards in `frontend/src/pages/KanbanBoard.tsx`
    - Add `<PriorityBadge priority={task.priority} />` to each task card
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 8. Dashboard integration
  - [x] 8.1 Render PriorityBadge on Dashboard action items in `frontend/src/pages/Dashboard.tsx`
    - Add `<PriorityBadge priority={task.priority} />` to each task entry in the action items section
    - _Requirements: 4.5, 4.6, 4.7, 4.8_

- [x] 9. Final checkpoint — All integration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- No changes needed to `backend/crud.py`, `backend/routers/tasks.py`, or `frontend/src/api/index.ts` — the new field flows through existing code automatically
- Property tests use `hypothesis` (backend) and `fast-check` (frontend)
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
