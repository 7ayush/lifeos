# Implementation Plan: Drag-and-Drop Task Reorder

## Overview

Implement persistent drag-and-drop task reordering for the LifeOS Kanban board. The backend adds a `sort_order` column, a reorder endpoint, and a migration script. The frontend updates types, API calls, sorting logic, and the drag-and-drop handler with optimistic updates and error rollback. Tasks are implemented incrementally: backend data model first, then backend endpoint, then frontend types/API, then UI logic.

## Tasks

- [x] 1. Backend data model and migration
  - [x] 1.1 Add `sort_order` column to Task model in `backend/models.py`
    - Add `sort_order = Column(Integer, default=0)` to the Task class
    - _Requirements: 1.1, 1.3_

  - [x] 1.2 Add `sort_order` to Task response schema and add `ReorderRequest` schema in `backend/schemas.py`
    - Add `sort_order: Optional[int] = 0` field to the `Task` schema class
    - Add `ReorderRequest` schema with `status: str` and `ordered_task_ids: List[int]`
    - _Requirements: 1.2, 2.1_

  - [x] 1.3 Create migration script `backend/migrate_sort_order.py`
    - Add `sort_order INTEGER DEFAULT 0` column to the `tasks` table for existing databases
    - Use `ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0` with a check for column existence
    - _Requirements: 1.4_

- [x] 2. Backend reorder endpoint
  - [x] 2.1 Implement `reorder_tasks` CRUD function in `backend/crud.py`
    - Accept `db`, `user_id`, `status`, `ordered_task_ids` parameters
    - Validate all task IDs belong to the specified user (return 404-worthy error if not)
    - Return early with empty list if `ordered_task_ids` is empty
    - Assign consecutive `sort_order` values (0-based) to tasks in the provided order
    - Use all-or-nothing validation: check all IDs before making any changes
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 8.1, 8.2_

  - [x] 2.2 Add reorder endpoint in `backend/routers/tasks.py`
    - Add `PUT /reorder` endpoint that accepts `ReorderRequest` body
    - Call `reorder_tasks` CRUD function
    - Return 404 if any task ID is invalid or doesn't belong to user
    - Return 200 with updated tasks list on success
    - Place this route BEFORE `/{task_id}` routes to avoid path conflicts
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 2.3 Write property test: default sort_order for new tasks
    - **Property 1: Default sort_order for new tasks**
    - Create tasks without explicit sort_order, verify stored sort_order is 0
    - Test file: `backend/tests/test_reorder_properties.py`
    - Run with: `.venv/bin/python -m pytest backend/tests/test_reorder_properties.py -v`
    - **Validates: Requirements 1.1, 1.3, 6.3**

  - [ ]* 2.4 Write property test: reorder assigns consecutive 0-based indices
    - **Property 2: Reorder assigns consecutive 0-based indices**
    - Generate random permutations of task ID lists, call reorder, verify each task's sort_order equals its list index
    - Test file: `backend/tests/test_reorder_properties.py`
    - Run with: `.venv/bin/python -m pytest backend/tests/test_reorder_properties.py -v`
    - **Validates: Requirements 2.2, 8.1, 8.2**

  - [ ]* 2.5 Write property test: invalid task IDs produce 404
    - **Property 3: Invalid task IDs produce 404**
    - Generate task ID lists containing IDs from other users or non-existent IDs, verify 404 response
    - Test file: `backend/tests/test_reorder_properties.py`
    - Run with: `.venv/bin/python -m pytest backend/tests/test_reorder_properties.py -v`
    - **Validates: Requirements 2.3, 2.5**

  - [ ]* 2.6 Write property test: reorder round trip persistence
    - **Property 4: Reorder round trip (persistence)**
    - Create tasks, reorder them with a random permutation, fetch again, verify sort_order values match submitted order
    - Test file: `backend/tests/test_reorder_properties.py`
    - Run with: `.venv/bin/python -m pytest backend/tests/test_reorder_properties.py -v`
    - **Validates: Requirements 3.2, 4.4**

- [x] 3. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.
  - Run: `.venv/bin/python -m pytest backend/tests/test_reorder_properties.py -v`

- [x] 4. Frontend types and API layer
  - [x] 4.1 Add `sort_order` to Task interface in `frontend/src/types.ts`
    - Add `sort_order?: number` field to the existing `Task` interface
    - _Requirements: 3.1, 3.2_

  - [x] 4.2 Add `reorderTasks` API function in `frontend/src/api/index.ts`
    - Implement `reorderTasks(userId, status, orderedTaskIds)` calling `PUT /users/{userId}/tasks/reorder`
    - Send `{ status, ordered_task_ids: orderedTaskIds }` as request body
    - Return `Task[]` response
    - _Requirements: 4.2, 5.3_

- [x] 5. Frontend Kanban board sorting and drag logic
  - [x] 5.1 Update `getTasksByStatus` sorting logic in `frontend/src/pages/KanbanBoard.tsx`
    - Check if any task in the column has a non-zero `sort_order`
    - If yes, sort by `sort_order` ascending
    - If all tasks have `sort_order === 0` (or undefined), fall back to existing `sortByPriority`
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 5.2 Update `onDragEnd` handler for same-column reorder in `frontend/src/pages/KanbanBoard.tsx`
    - Detect same-column drag (source.droppableId === destination.droppableId)
    - Snapshot current task list before changes
    - Optimistically reorder tasks in local state
    - Call `reorderTasks` API with the full ordered list of task IDs for that column
    - On error: revert to snapshot and reload tasks from server
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 5.3 Update `onDragEnd` handler for cross-column drag in `frontend/src/pages/KanbanBoard.tsx`
    - Detect cross-column drag (source.droppableId !== destination.droppableId)
    - Snapshot current task list before changes
    - Optimistically update task status and insert at drop index in destination column
    - Call `updateTask` for status change, then `reorderTasks` for destination column ordering
    - On error: revert to snapshot and reload tasks from server
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 8.3_

  - [x] 5.4 Implement filter-aware reorder logic in `frontend/src/pages/KanbanBoard.tsx`
    - When filters are active, send only visible (filtered) task IDs in reorder payload
    - Preserve sort_order of hidden (filtered-out) tasks
    - When filters are cleared, interleave hidden tasks at their original relative positions
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 5.5 Write property test: sorting strategy (sort_order vs priority fallback)
    - **Property 6: Sorting strategy — sort_order vs priority fallback**
    - Generate random task arrays with varying sort_order values, verify correct sorting strategy is applied
    - Test file: `frontend/src/pages/__tests__/kanbanSorting.test.ts`
    - Run with: `npx vitest --run frontend/src/pages/__tests__/kanbanSorting.test.ts`
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 5.6 Write property test: filtered reorder preserves hidden task order
    - **Property 7: Filtered reorder preserves hidden task order**
    - Generate random task arrays with filters, simulate reorder, verify only visible IDs in payload and hidden tasks unchanged
    - Test file: `frontend/src/pages/__tests__/kanbanSorting.test.ts`
    - Run with: `npx vitest --run frontend/src/pages/__tests__/kanbanSorting.test.ts`
    - **Validates: Requirements 7.2**

  - [ ]* 5.7 Write property test: filter merge interleaving
    - **Property 8: Filter merge interleaving**
    - Generate random task arrays, apply filter, reorder visible, clear filter, verify correct interleaving
    - Test file: `frontend/src/pages/__tests__/kanbanSorting.test.ts`
    - Run with: `npx vitest --run frontend/src/pages/__tests__/kanbanSorting.test.ts`
    - **Validates: Requirements 7.3**

- [x] 6. Checkpoint - Frontend complete
  - Ensure all tests pass, ask the user if questions arise.
  - Run: `npx vitest --run`

- [x] 7. Integration wiring and final validation
  - [x] 7.1 Wire cross-column move to call both status update and reorder in sequence
    - Ensure `onDragEnd` cross-column path calls `updateTask` then `reorderTasks` in order
    - Handle partial failure: if status update succeeds but reorder fails, revert both
    - _Requirements: 5.3, 5.4, 8.3_

  - [ ]* 7.2 Write property test: cross-column drag updates status and position
    - **Property 5: Cross-column drag updates status and position**
    - Simulate cross-column moves, verify task status matches destination and task appears at correct index
    - Test file: `backend/tests/test_reorder_properties.py`
    - Run with: `.venv/bin/python -m pytest backend/tests/test_reorder_properties.py -v`
    - **Validates: Requirements 5.1, 5.2, 8.3**

- [x] 8. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run backend: `.venv/bin/python -m pytest backend/tests/test_reorder_properties.py -v`
  - Run frontend: `npx vitest --run`

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- Backend uses Python (FastAPI + SQLAlchemy), frontend uses TypeScript (React + Vitest)
- Run backend tests with `.venv/bin/python -m pytest`, frontend tests with `npx vitest --run`
- The `test_main.py` failures are pre-existing and unrelated to this feature
