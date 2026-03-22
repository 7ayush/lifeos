# Implementation Plan: Task Tags

## Overview

Add user-scoped tags with optional colors to tasks via a many-to-many relationship. Backend adds Tag model, task_tags join table, tag CRUD endpoints, and extends task endpoints to handle tag_ids. Frontend adds Tag types, TagChip component, TagSelector component, tag filter on Kanban board, and tag display on task cards. Backend uses Python (FastAPI/SQLAlchemy/Pydantic), frontend uses TypeScript (React). Property-based tests use hypothesis (backend) and fast-check (frontend).

## Tasks

- [x] 1. Backend data model changes
  - [x] 1.1 Add Tag model and task_tags join table to `backend/models.py`
    - Add `task_tags = Table("task_tags", Base.metadata, Column("task_id", Integer, ForeignKey("tasks.id"), primary_key=True), Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True))`
    - Add `Tag` class with `id`, `user_id` (FK to users), `name` (String), `color` (String, nullable), `UniqueConstraint("user_id", "name")`
    - Add `tags = relationship("Tag", secondary=task_tags, backref="tasks")` to `Task` model
    - Add `tags = relationship("Tag", back_populates="user")` to `User` model and `user = relationship("User", back_populates="tags")` to `Tag` model
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Add tag schemas to `backend/schemas.py`
    - Define `TAG_COLORS` list with 8 hex values
    - Add `TagBase`, `TagCreate`, `TagUpdate`, `TagOut` schemas
    - Add name validator (1-30 chars, non-whitespace-only) and color validator (null or in TAG_COLORS)
    - Add `tag_ids: Optional[List[int]] = None` to `TaskCreate` and `TaskUpdate`
    - Add `tags: Optional[List[TagOut]] = []` to `Task` response schema
    - _Requirements: 1.1, 3.1, 3.3, 4.4, 9.1, 9.2_

  - [ ]* 1.3 Write property test: Tag name length validation
    - **Property 2: Tag name length validation**
    - **Validates: Requirements 2.3, 2.4**
    - Create `backend/tests/test_tag_properties.py` using `hypothesis`
    - Generate strings of various lengths, verify strings > 30 chars are rejected and strings of 1-30 non-whitespace chars are accepted by the TagCreate schema

  - [ ]* 1.4 Write property test: Tag color validation
    - **Property 3: Tag color validation**
    - **Validates: Requirements 3.3**
    - In `backend/tests/test_tag_properties.py` using `hypothesis`
    - Generate arbitrary strings not in TAG_COLORS, verify schema rejects them. Generate colors from TAG_COLORS, verify schema accepts them.

- [x] 2. Backend CRUD and router
  - [x] 2.1 Add tag CRUD functions to `backend/crud.py`
    - Implement `create_tag(db, user_id, tag)` — check uniqueness, create tag
    - Implement `get_user_tags(db, user_id)` — return all tags for user
    - Implement `update_tag(db, tag_id, user_id, tag_update)` — verify ownership, update
    - Implement `delete_tag(db, tag_id, user_id)` — verify ownership, delete (cascade)
    - Modify `create_user_task` to handle optional `tag_ids` — look up tags, create associations
    - Modify `update_task` to handle optional `tag_ids` — replace task.tags with new set when provided
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 4.1, 4.2, 4.3_

  - [x] 2.2 Create tag router in `backend/routers/tags.py`
    - POST `/users/{user_id}/tags` — create tag, return 409 on duplicate
    - GET `/users/{user_id}/tags` — list user tags
    - PUT `/users/{user_id}/tags/{tag_id}` — update tag, return 404 if not found/wrong user
    - DELETE `/users/{user_id}/tags/{tag_id}` — delete tag, return 404 if not found/wrong user
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 2.8_

  - [x] 2.3 Register tag router in `backend/main.py`
    - Import and include the tags router
    - _Requirements: 2.1_

  - [ ]* 2.4 Write property test: Tag name uniqueness per user
    - **Property 1: Tag name uniqueness per user**
    - **Validates: Requirements 2.2, 1.2**
    - In `backend/tests/test_tag_properties.py` using `hypothesis`
    - Generate valid tag names, verify that creating a duplicate for the same user raises an error via the schema or CRUD layer

- [x] 3. Database migration
  - [x] 3.1 Create migration script for tags and task_tags tables
    - Create `backend/migrate_tags.py`
    - `upgrade()`: Create `tags` table with id, user_id, name, color, unique constraint on (user_id, name). Create `task_tags` table with task_id, tag_id composite PK and foreign keys.
    - `downgrade()`: Drop `task_tags` table, then drop `tags` table.
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 4. Checkpoint — Backend complete
  - Ensure all backend changes work together, ask the user if questions arise.

- [x] 5. Frontend types and API layer
  - [x] 5.1 Add Tag types to `frontend/src/types.ts`
    - Add `Tag` interface with `id`, `name`, `color` fields
    - Add `TagCreate` interface with `name` and optional `color` fields
    - Add `tags?: Tag[]` to `Task` interface
    - Add `tag_ids?: number[]` to `TaskCreate` interface
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 5.2 Add tag API functions to `frontend/src/api/index.ts`
    - Implement `getTags(userId)`, `createTag(userId, tag)`, `updateTag(userId, tagId, tag)`, `deleteTag(userId, tagId)`
    - _Requirements: 2.1, 2.5, 2.6, 2.7_

- [x] 6. Frontend utility functions
  - [x] 6.1 Create tag filter utility in `frontend/src/utils/tagFilter.ts`
    - Implement `filterByTags(tasks: Task[], selectedTagIds: number[]): Task[]`
    - Return all tasks if selectedTagIds is empty, otherwise return tasks with at least one matching tag
    - _Requirements: 7.2, 7.3_

  - [ ]* 6.2 Write property test: Tag filter returns only matching tasks
    - **Property 6: Tag filter returns only matching tasks**
    - **Validates: Requirements 7.2, 7.3**
    - Create `frontend/src/utils/__tests__/tagFilter.test.ts` using `fast-check`
    - Generate random task arrays with random tag assignments and random filter selections, verify filtered results contain only tasks with at least one matching tag

  - [ ]* 6.3 Write property test: Tag filter composes with priority and energy filters
    - **Property 7: Tag filter composes with priority and energy filters as intersection**
    - **Validates: Requirements 7.4, 7.5**
    - In `frontend/src/utils/__tests__/tagFilter.test.ts` using `fast-check`
    - Generate random task arrays with random tags, priorities, and energy levels, plus random filter selections, verify combined filter equals intersection of individual filters

- [x] 7. Checkpoint — Utilities complete
  - Ensure all frontend utility tests pass, ask the user if questions arise.

- [x] 8. TagChip component
  - [x] 8.1 Create `frontend/src/components/TagChip.tsx`
    - Render a small colored chip with the tag name
    - Use tag color as background (with opacity) or default neutral if color is null
    - Accept `tag: Tag` and optional `size: 'sm' | 'md'` props
    - _Requirements: 5.1, 5.4_

  - [ ]* 8.2 Write unit tests for TagChip component
    - Create `frontend/src/components/__tests__/TagChip.test.tsx`
    - Test rendering with color, without color, verify correct styles
    - _Requirements: 5.1, 5.4_

- [x] 9. TagSelector component
  - [x] 9.1 Create `frontend/src/components/TagSelector.tsx`
    - Multi-select dropdown showing all user tags as colored chips
    - Text input for filtering existing tags
    - "Create [name]" option when typed name doesn't match existing tags
    - Calls `createTag` API on inline creation, adds to list and selects
    - Shows error on duplicate name creation attempt
    - _Requirements: 6.1, 6.4, 8.1, 8.2, 8.3_

- [x] 10. Kanban Board integration
  - [x] 10.1 Add tag state and fetch tags on mount in `frontend/src/pages/KanbanBoard.tsx`
    - Add `tags` state for all user tags
    - Add `selectedTagFilter` state (array of tag IDs, default empty)
    - Fetch tags via `getTags` on component mount
    - _Requirements: 7.1_

  - [x] 10.2 Add tag filter UI control to `frontend/src/pages/KanbanBoard.tsx`
    - Render tag filter as multi-select chips next to existing energy and priority filters
    - Clicking a tag chip toggles it in the selectedTagFilter array
    - _Requirements: 7.1, 7.4_

  - [x] 10.3 Integrate tag filter into `getTasksByStatus` in `frontend/src/pages/KanbanBoard.tsx`
    - Apply `filterByTags` alongside existing energy and priority filters
    - _Requirements: 7.2, 7.3, 7.5_

  - [x] 10.4 Add TagSelector to create/edit task modal in `frontend/src/pages/KanbanBoard.tsx`
    - Add `<TagSelector>` to the task creation and edit modals
    - Pre-select current tags when editing
    - Include selected tag IDs in create/update API requests
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 10.5 Render TagChips on task cards in `frontend/src/pages/KanbanBoard.tsx`
    - Display TagChip for each tag on task cards (max 3 + "+N" overflow)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 11. Final checkpoint — All integration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- No changes needed to existing task router endpoints — tag_ids flows through existing create/update via updated schemas and CRUD
- The Tag model uses cascade delete on the join table FK so deleting a tag cleans up associations automatically
- Property tests use `hypothesis` (backend) and `fast-check` (frontend)
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
