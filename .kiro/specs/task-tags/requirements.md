# Requirements Document

## Introduction

This feature adds user-scoped tags (short text labels such as "work", "personal", "urgent") to tasks in the LifeOS productivity app. Users can create tags with a name and an optional color from a predefined palette, assign multiple tags to a task, remove tags from a task, and filter the Kanban board by one or more tags. Tags are displayed as colored chips on task cards. A many-to-many relationship between tasks and tags is managed through a join table. Tags are fully CRUD-managed via dedicated REST endpoints, and tag assignment is handled through task-level endpoints.

## Glossary

- **Tag**: A user-scoped label entity with a unique name (per user) and an optional color. Tags are stored in the `tags` table.
- **Tag_Color**: A hex color string selected from a predefined palette of 8 colors. When no color is specified, a default neutral color is used.
- **Task_Tag**: A join table entry representing the many-to-many relationship between a Task and a Tag.
- **Tag_Chip**: A small colored UI element displayed on a task card showing the tag name and its associated color.
- **Tag_Filter**: A UI control on the Kanban_Board that allows the user to show only tasks that have one or more selected tags.
- **Tag_API**: The backend REST API endpoints under `/users/{user_id}/tags` that handle tag CRUD operations.
- **Task_API**: The backend REST API endpoints under `/users/{user_id}/tasks` that handle task CRUD operations, extended to support tag assignment.
- **Kanban_Board**: The frontend page (`KanbanBoard.tsx`) that displays tasks in draggable columns grouped by status.
- **Task_Model**: The SQLAlchemy database model representing a task, stored in the `tasks` table.
- **Tag_Model**: The SQLAlchemy database model representing a tag, stored in the `tags` table.
- **Color_Palette**: A fixed set of 8 predefined hex color values that users can choose from when creating or editing a tag.

## Requirements

### Requirement 1: Tag Data Model

**User Story:** As a developer, I want a tag data model with a many-to-many relationship to tasks, so that tags can be persisted and queried across the full stack.

#### Acceptance Criteria

1. THE Tag_Model SHALL include an `id` (integer, primary key), `user_id` (integer, foreign key to users), `name` (string, max 30 characters), and `color` (string, nullable) fields.
2. THE Tag_Model SHALL enforce a unique constraint on the combination of `user_id` and `name` so that each user has uniquely named tags.
3. THE Task_Tag join table SHALL include `task_id` (foreign key to tasks) and `tag_id` (foreign key to tags) columns with a composite primary key.
4. THE Tag_Model SHALL define a relationship to Task_Model through the Task_Tag join table, enabling many-to-many access.
5. WHEN a tag is deleted, THE database SHALL remove all associated Task_Tag entries (cascade delete on the join table).

### Requirement 2: Tag CRUD API

**User Story:** As a user, I want to create, list, update, and delete my tags, so that I can manage my personal set of labels.

#### Acceptance Criteria

1. WHEN a user sends a POST request to `/users/{user_id}/tags` with a valid name, THE Tag_API SHALL create a new tag for that user and return the tag object with id, name, and color.
2. WHEN a user sends a POST request with a name that already exists for that user, THE Tag_API SHALL return a 409 conflict error.
3. WHEN a user sends a POST request with a name exceeding 30 characters, THE Tag_API SHALL return a 422 validation error.
4. WHEN a user sends a POST request with an empty or whitespace-only name, THE Tag_API SHALL return a 422 validation error.
5. WHEN a user sends a GET request to `/users/{user_id}/tags`, THE Tag_API SHALL return a list of all tags belonging to that user.
6. WHEN a user sends a PUT request to `/users/{user_id}/tags/{tag_id}` with a new name or color, THE Tag_API SHALL update the tag and return the updated tag object.
7. WHEN a user sends a DELETE request to `/users/{user_id}/tags/{tag_id}`, THE Tag_API SHALL delete the tag and all associated Task_Tag entries.
8. WHEN a user sends a request for a tag that does not exist or belongs to another user, THE Tag_API SHALL return a 404 error.

### Requirement 3: Tag Color Selection

**User Story:** As a user, I want to pick a color for each tag from a predefined palette, so that my tags are visually distinct and consistent.

#### Acceptance Criteria

1. THE Color_Palette SHALL contain exactly 8 predefined hex color values.
2. WHEN a tag is created without specifying a color, THE Tag_API SHALL store the color as null, and the frontend SHALL render the Tag_Chip with a default neutral color.
3. WHEN a tag is created or updated with a color value not in the Color_Palette, THE Tag_API SHALL return a 422 validation error.
4. WHEN a user edits a tag, THE frontend SHALL display the Color_Palette and highlight the currently selected color.

### Requirement 4: Assign and Remove Tags on Tasks

**User Story:** As a user, I want to assign multiple tags to a task and remove tags from a task, so that I can categorize tasks flexibly.

#### Acceptance Criteria

1. WHEN a user sends a PUT request to `/users/{user_id}/tasks/{task_id}` with a `tag_ids` field containing a list of tag IDs, THE Task_API SHALL replace the task's current tag associations with the provided set.
2. WHEN the `tag_ids` list contains a tag ID that does not belong to the user, THE Task_API SHALL return a 422 validation error.
3. WHEN the `tag_ids` list is empty, THE Task_API SHALL remove all tag associations from the task.
4. THE Task_API SHALL include the list of associated tags (id, name, color) in every task response object.

### Requirement 5: Display Tags on Task Cards

**User Story:** As a user, I want to see tags displayed as colored chips on task cards, so that I can visually identify task categories at a glance.

#### Acceptance Criteria

1. WHEN a task has one or more tags, THE Kanban_Board SHALL display a Tag_Chip for each tag on the task card showing the tag name and its color.
2. WHEN a task has no tags, THE Kanban_Board SHALL display no Tag_Chip elements on the task card.
3. WHEN a task has more than 3 tags, THE Kanban_Board SHALL display the first 3 Tag_Chips and a "+N" indicator showing the count of remaining tags.
4. THE Tag_Chip SHALL render the tag name in a readable font size with the tag color as the background or border color.

### Requirement 6: Tag Selection in Task Create/Edit Modal

**User Story:** As a user, I want to select tags when creating or editing a task, so that I can categorize tasks during task management.

#### Acceptance Criteria

1. WHEN the user opens the task creation modal, THE Kanban_Board SHALL display a tag selector showing all of the user's available tags.
2. WHEN the user opens the edit modal for an existing task, THE Kanban_Board SHALL display the tag selector with the task's currently assigned tags pre-selected.
3. WHEN the user selects or deselects tags and saves the task, THE Kanban_Board SHALL include the selected tag IDs in the create or update API request.
4. THE tag selector SHALL allow the user to select zero or more tags for a single task.

### Requirement 7: Filter Tasks by Tags on Kanban Board

**User Story:** As a user, I want to filter the Kanban board by tags, so that I can focus on tasks belonging to specific categories.

#### Acceptance Criteria

1. THE Kanban_Board SHALL display a tag filter control showing all of the user's tags.
2. WHEN the user selects one or more tags in the tag filter, THE Kanban_Board SHALL display only tasks that have at least one of the selected tags.
3. WHEN no tags are selected in the tag filter, THE Kanban_Board SHALL display all tasks regardless of tags.
4. THE tag filter SHALL operate independently of the existing energy level filter and priority filter, allowing all filters to be active simultaneously.
5. WHEN the tag filter, priority filter, and energy filter are all active, THE Kanban_Board SHALL display only tasks that match all three filter criteria.

### Requirement 8: Tag Management in Task Create/Edit Modal

**User Story:** As a user, I want to create new tags inline from the task modal, so that I do not have to leave the task workflow to manage tags.

#### Acceptance Criteria

1. WHEN the user types a tag name that does not exist in the tag selector, THE Kanban_Board SHALL offer an option to create a new tag with that name.
2. WHEN the user confirms creating a new tag inline, THE Kanban_Board SHALL call the Tag_API to create the tag and immediately add the new tag to the selector and assign it to the task.
3. IF the inline tag creation fails due to a duplicate name, THEN THE Kanban_Board SHALL display an error message indicating the tag already exists.

### Requirement 9: Frontend Type Updates

**User Story:** As a developer, I want the frontend TypeScript types to include tag-related fields, so that tag data flows correctly through the frontend codebase.

#### Acceptance Criteria

1. THE `Task` interface in `types.ts` SHALL include an optional `tags` field of type `Tag[]`.
2. THE `TaskCreate` interface in `types.ts` SHALL include an optional `tag_ids` field of type `number[]`.
3. A new `Tag` interface SHALL be defined in `types.ts` with fields `id` (number), `name` (string), and `color` (string or null).
4. A new `TagCreate` interface SHALL be defined in `types.ts` with fields `name` (string) and `color` (string, optional).

### Requirement 10: Database Migration

**User Story:** As a developer, I want a database migration that creates the tags and task_tags tables, so that the feature can be deployed without data loss.

#### Acceptance Criteria

1. THE migration SHALL create a `tags` table with columns `id`, `user_id`, `name`, `color`, and a unique constraint on (`user_id`, `name`).
2. THE migration SHALL create a `task_tags` table with columns `task_id` and `tag_id` as a composite primary key, with foreign keys referencing `tasks` and `tags` respectively.
3. THE migration SHALL be reversible, allowing both tables to be dropped.
