# Requirements Document

## Introduction

This feature adds markdown editing and preview support to the notes (VaultPage) and journal (JournalPage) editing experience in the LifeOS app. Currently both pages use plain `<textarea>` elements with no formatting capability. This feature introduces a reusable markdown editor component with a formatting toolbar, live preview mode, and rendered markdown display. Markdown content is stored as plain text in the existing database columns — this is a frontend-only feature requiring no backend changes.

## Glossary

- **Markdown_Editor**: A reusable React component that replaces the plain `<textarea>` and provides markdown text input with a formatting toolbar and preview toggle.
- **Formatting_Toolbar**: A row of buttons within the Markdown_Editor that insert common markdown syntax (headings, bold, italic, lists, code, links) into the content at the cursor position.
- **Preview_Mode**: A display state of the Markdown_Editor where the raw markdown text is hidden and the rendered HTML output is shown instead.
- **Edit_Mode**: A display state of the Markdown_Editor where the raw markdown text is shown in an editable textarea for authoring.
- **Rendered_Preview**: The HTML output produced by parsing markdown text, displayed when the Markdown_Editor is in Preview_Mode.
- **VaultPage**: The frontend page (`VaultPage.tsx`) for managing notes with P.A.R.A. folder organization and auto-save.
- **JournalPage**: The frontend page (`JournalPage.tsx`) for managing journal entries with mood tracking and manual save.
- **Auto_Save**: The existing VaultPage behavior that persists note content changes after a 1500ms debounce delay.

## Requirements

### Requirement 1: Reusable Markdown Editor Component

**User Story:** As a developer, I want a reusable markdown editor component, so that both VaultPage and JournalPage can share the same editing experience without code duplication.

#### Acceptance Criteria

1. THE Markdown_Editor SHALL accept `value` and `onChange` props matching the interface of a controlled textarea component.
2. THE Markdown_Editor SHALL accept an optional `placeholder` prop for display when content is empty.
3. THE Markdown_Editor SHALL accept an optional `autoFocus` prop to focus the textarea on mount.
4. THE Markdown_Editor SHALL render an editable textarea in Edit_Mode and a Rendered_Preview in Preview_Mode.
5. THE Markdown_Editor SHALL default to Edit_Mode when mounted.

### Requirement 2: Formatting Toolbar

**User Story:** As a user, I want a toolbar with formatting buttons above the editor, so that I can apply common markdown formatting without memorizing syntax.

#### Acceptance Criteria

1. THE Formatting_Toolbar SHALL include buttons for: heading, bold, italic, unordered list, ordered list, code block, and link.
2. WHEN the user clicks the bold button, THE Formatting_Toolbar SHALL insert `**` markers around the selected text or at the cursor position in the textarea.
3. WHEN the user clicks the italic button, THE Formatting_Toolbar SHALL insert `*` markers around the selected text or at the cursor position in the textarea.
4. WHEN the user clicks the heading button, THE Formatting_Toolbar SHALL insert a `## ` prefix at the beginning of the current line.
5. WHEN the user clicks the unordered list button, THE Formatting_Toolbar SHALL insert a `- ` prefix at the beginning of the current line.
6. WHEN the user clicks the ordered list button, THE Formatting_Toolbar SHALL insert a `1. ` prefix at the beginning of the current line.
7. WHEN the user clicks the code block button, THE Formatting_Toolbar SHALL insert triple backtick fences around the selected text or at the cursor position.
8. WHEN the user clicks the link button, THE Formatting_Toolbar SHALL insert a `[text](url)` template at the cursor position.
9. WHEN text is selected and a wrapping format button is clicked, THE Formatting_Toolbar SHALL wrap the selected text with the appropriate markers and preserve the selection.
10. THE Formatting_Toolbar SHALL be visible only in Edit_Mode.

### Requirement 3: Edit and Preview Mode Toggle

**User Story:** As a user, I want to toggle between editing markdown and previewing the rendered output, so that I can see how the formatted content looks.

#### Acceptance Criteria

1. THE Markdown_Editor SHALL display a toggle control allowing the user to switch between Edit_Mode and Preview_Mode.
2. WHEN the user switches to Preview_Mode, THE Markdown_Editor SHALL render the current markdown content as formatted HTML.
3. WHEN the user switches back to Edit_Mode, THE Markdown_Editor SHALL display the raw markdown text in the editable textarea with the cursor restored.
4. WHILE the Markdown_Editor is in Preview_Mode, THE Markdown_Editor SHALL hide the Formatting_Toolbar and the textarea.
5. WHILE the Markdown_Editor is in Preview_Mode, THE Rendered_Preview SHALL be displayed in a scrollable container matching the textarea dimensions.

### Requirement 4: Markdown Rendering

**User Story:** As a user, I want my markdown content rendered with proper formatting, so that I can use headings, bold, italic, lists, code blocks, and links in my notes and journal entries.

#### Acceptance Criteria

1. THE Rendered_Preview SHALL render markdown headings (levels 1 through 6) as corresponding HTML heading elements with distinct visual sizing.
2. THE Rendered_Preview SHALL render bold text (`**text**`) as visually bold.
3. THE Rendered_Preview SHALL render italic text (`*text*`) as visually italic.
4. THE Rendered_Preview SHALL render unordered lists (`- item`) as bulleted lists with proper indentation.
5. THE Rendered_Preview SHALL render ordered lists (`1. item`) as numbered lists with proper indentation.
6. THE Rendered_Preview SHALL render inline code (`` `code` ``) with a distinct monospace background style.
7. THE Rendered_Preview SHALL render fenced code blocks (triple backticks) as preformatted blocks with a distinct background style.
8. THE Rendered_Preview SHALL render links (`[text](url)`) as clickable anchor elements that open in a new browser tab.
9. THE Rendered_Preview SHALL render paragraphs separated by blank lines as distinct paragraph elements with spacing.
10. THE Rendered_Preview SHALL apply styles consistent with the existing dark theme of the application.

### Requirement 5: Integration with VaultPage

**User Story:** As a user, I want the Vault note editor to use the markdown editor, so that I can write and preview formatted notes.

#### Acceptance Criteria

1. THE VaultPage SHALL replace the existing plain textarea with the Markdown_Editor component for note content editing.
2. WHEN the user types in the Markdown_Editor on VaultPage, THE VaultPage SHALL trigger the existing Auto_Save behavior with the 1500ms debounce.
3. WHEN a note is opened for editing, THE VaultPage SHALL pass the note content to the Markdown_Editor and display it in Edit_Mode.
4. THE VaultPage SHALL preserve all existing functionality including title editing, folder selection, manual save button, and close button.

### Requirement 6: Integration with JournalPage

**User Story:** As a user, I want the journal entry editor to use the markdown editor, so that I can write and preview formatted journal entries.

#### Acceptance Criteria

1. THE JournalPage SHALL replace the existing plain textarea with the Markdown_Editor component for journal entry content editing.
2. WHEN the user types in the Markdown_Editor on JournalPage, THE JournalPage SHALL update the current content state for manual save via the Save Entry button.
3. WHEN a journal entry is opened for editing, THE JournalPage SHALL pass the entry content to the Markdown_Editor and display it in Edit_Mode.
4. THE JournalPage SHALL preserve all existing functionality including mood selector, date picker, smart prompts, and delete button.

### Requirement 7: Preview in Content Lists

**User Story:** As a user, I want the note list and journal timeline to show plain text previews without markdown syntax, so that the previews are readable.

#### Acceptance Criteria

1. WHEN displaying a note preview in the VaultPage sidebar, THE VaultPage SHALL strip markdown syntax from the content and display plain text in the line-clamp preview.
2. WHEN displaying a journal entry preview in the JournalPage timeline, THE JournalPage SHALL strip markdown syntax from the content and display plain text in the line-clamp preview.
3. THE markdown stripping logic SHALL remove heading markers, bold/italic markers, list prefixes, code fences, and link syntax while preserving the readable text content.

### Requirement 8: Markdown Library Dependencies

**User Story:** As a developer, I want to use established markdown parsing and rendering libraries, so that the markdown support is reliable and maintainable.

#### Acceptance Criteria

1. THE frontend project SHALL add `react-markdown` as a dependency for rendering markdown content as React components.
2. THE frontend project SHALL add `remark-gfm` as a dependency to support GitHub Flavored Markdown extensions including tables and strikethrough.
3. WHEN rendering markdown, THE Rendered_Preview SHALL use `react-markdown` with the `remark-gfm` plugin.
4. THE Markdown_Editor SHALL use a plain textarea for editing and rely on `react-markdown` only for the Preview_Mode rendering.
