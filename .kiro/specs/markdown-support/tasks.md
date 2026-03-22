# Implementation Plan: Markdown Support

## Overview

Add markdown editing and preview support to VaultPage and JournalPage. Create a reusable MarkdownEditor component with formatting toolbar, edit/preview toggle, and rendered markdown output. Add a stripMarkdown utility for sidebar previews. Frontend-only — uses react-markdown + remark-gfm for rendering, fast-check for property tests.

## Tasks

- [x] 1. Add dependencies
  - [x] 1.1 Install react-markdown and remark-gfm
    - Run `npm install react-markdown remark-gfm` in the `frontend/` directory
    - _Requirements: 8.1, 8.2_

- [x] 2. Create stripMarkdown utility
  - [x] 2.1 Create `frontend/src/utils/stripMarkdown.ts`
    - Implement `stripMarkdown(text: string): string` that removes heading markers, bold/italic markers, list prefixes, code fences, inline code backticks, link syntax `[text](url)` → `text`, and image syntax `![alt](url)` → `alt`
    - Use regex-based replacements
    - Return empty string for empty input, return unchanged text for non-markdown input
    - _Requirements: 7.3_

  - [ ]* 2.2 Write property test: Strip markdown preserves readable text and removes syntax
    - **Property 6: Strip markdown preserves readable text and removes syntax**
    - **Validates: Requirements 7.3**
    - Create `frontend/src/utils/__tests__/stripMarkdown.test.ts` using `fast-check`
    - Generate markdown strings with random combinations of headings, bold, italic, lists, code, and links
    - Verify the result contains no markdown syntax markers and all readable words are preserved
    - Minimum 100 iterations

- [x] 3. Create formatting helper functions
  - [x] 3.1 Create `frontend/src/utils/markdownFormatting.ts`
    - Implement pure functions for each toolbar action that take `(text: string, selectionStart: number, selectionEnd: number)` and return `{ text: string, selectionStart: number, selectionEnd: number }`
    - `applyBold`: wrap selection with `**` or insert `****` with cursor between
    - `applyItalic`: wrap selection with `*` or insert `**` with cursor between
    - `applyHeading`: insert `## ` at the beginning of the current line
    - `applyUnorderedList`: insert `- ` at the beginning of the current line
    - `applyOrderedList`: insert `1. ` at the beginning of the current line
    - `applyCodeBlock`: wrap selection with triple backtick fences or insert empty fenced block
    - `applyLink`: insert `[text](url)` at cursor or wrap selection as `[selection](url)`
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ] 3.2 Write property test: Wrapping format actions preserve selected text between markers
    - **Property 2: Wrapping format actions preserve selected text between markers**
    - **Validates: Requirements 2.2, 2.3, 2.7, 2.9**
    - Create `frontend/src/utils/__tests__/markdownFormatting.test.ts` using `fast-check`
    - Generate arbitrary text strings, valid selection ranges, and wrapping format types (bold/italic/code)
    - Verify the selected text appears between the correct markers and surrounding text is unchanged
    - Minimum 100 iterations

  - [ ] 3.3 Write property test: Line-prefix format actions insert prefix at line start
    - **Property 3: Line-prefix format actions insert prefix at line start**
    - **Validates: Requirements 2.4, 2.5, 2.6**
    - In `frontend/src/utils/__tests__/markdownFormatting.test.ts` using `fast-check`
    - Generate arbitrary multi-line text strings, valid cursor positions, and line-prefix format types
    - Verify the correct prefix appears at the start of the cursor's line and other lines are unchanged
    - Minimum 100 iterations

  - [ ] 3.4 Write property test: Link insertion places template at cursor
    - **Property 4: Link insertion places template at cursor**
    - **Validates: Requirements 2.8**
    - In `frontend/src/utils/__tests__/markdownFormatting.test.ts` using `fast-check`
    - Generate arbitrary text strings and valid cursor positions
    - Verify `[text](url)` or `[selected](url)` appears at the correct position with surrounding text unchanged
    - Minimum 100 iterations

- [ ] 4. Checkpoint — Utilities complete
  - Ensure all utility functions and property tests pass before building the component.

- [x] 5. Create MarkdownEditor component
  - [x] 5.1 Create `frontend/src/components/MarkdownEditor.tsx`
    - Implement the MarkdownEditor component with props: `value`, `onChange`, `placeholder?`, `autoFocus?`, `className?`
    - Internal state: `mode` ('edit' | 'preview'), defaults to 'edit'
    - Internal ref: `textareaRef` for cursor/selection manipulation
    - Render edit/preview toggle control (segmented buttons)
    - In edit mode: render FormattingToolbar and textarea
    - In preview mode: render ReactMarkdown with remarkGfm plugin in a scrollable container
    - FormattingToolbar uses lucide-react icons (Heading, Bold, Italic, List, ListOrdered, Code, Link)
    - Toolbar calls the pure formatting functions from `markdownFormatting.ts` and updates textarea selection
    - Toolbar is visible only in edit mode
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.10, 3.1, 3.4, 3.5, 8.3, 8.4_

  - [x] 5.2 Style the rendered markdown preview for dark theme
    - Use the `components` prop of ReactMarkdown to apply dark-theme Tailwind classes
    - Headings: white text, distinct sizes h1-h6
    - Bold: `font-bold text-white`; Italic: `italic text-neutral-300`
    - Lists: proper indentation, neutral-300 text
    - Inline code: `bg-white/10 rounded px-1.5 py-0.5 font-mono text-sm text-amber-300`
    - Code blocks: `bg-white/5 rounded-xl p-4 font-mono text-sm overflow-x-auto`
    - Links: `text-fuchsia-400 hover:underline`, `target="_blank"`, `rel="noopener noreferrer"`
    - Paragraphs: `text-neutral-200 leading-relaxed mb-4`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [ ] 5.3 Write unit tests for MarkdownEditor component
    - Create `frontend/src/components/__tests__/MarkdownEditor.test.tsx`
    - Test: defaults to edit mode with textarea visible
    - Test: toolbar buttons (heading, bold, italic, unordered list, ordered list, code, link) are rendered in edit mode
    - Test: toolbar is hidden in preview mode
    - Test: placeholder text appears when value is empty
    - Test: switching to preview mode renders markdown as HTML (bold → `<strong>`, heading → `<h2>`, etc.)
    - Test: links render with `target="_blank"` and `rel="noopener noreferrer"`
    - _Requirements: 1.4, 1.5, 2.1, 2.10, 3.2, 3.4, 4.1, 4.2, 4.3, 4.8_

  - [ ] 5.4 Write property test: Controlled value rendering
    - **Property 1: Controlled value rendering**
    - **Validates: Requirements 1.1**
    - In `frontend/src/components/__tests__/MarkdownEditor.test.tsx` using `fast-check`
    - Generate arbitrary strings, render MarkdownEditor with each as `value`, verify textarea value matches exactly
    - Minimum 100 iterations

  - [ ] 5.5 Write property test: Mode switch round-trip preserves content
    - **Property 5: Mode switch round-trip preserves content**
    - **Validates: Requirements 3.3**
    - In `frontend/src/components/__tests__/MarkdownEditor.test.tsx` using `fast-check`
    - Generate arbitrary markdown strings, set as editor value, toggle to preview, toggle back to edit, verify textarea value is identical
    - Minimum 100 iterations

- [ ] 6. Checkpoint — Component complete
  - Ensure MarkdownEditor renders correctly and all component tests pass.

- [x] 7. Integrate with VaultPage
  - [x] 7.1 Replace textarea with MarkdownEditor in `frontend/src/pages/VaultPage.tsx`
    - Import `MarkdownEditor` from `../components/MarkdownEditor`
    - Replace the `<textarea>` in the editor section with `<MarkdownEditor value={editContent} onChange={handleContentChange} placeholder="Start writing..." autoFocus />`
    - Verify auto-save debounce (1500ms) still triggers on content change
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 7.2 Add markdown stripping to VaultPage sidebar previews
    - Import `stripMarkdown` from `../utils/stripMarkdown`
    - Change `{note.content || 'Empty note'}` to `{stripMarkdown(note.content) || 'Empty note'}` in the note list
    - _Requirements: 7.1_

- [x] 8. Integrate with JournalPage
  - [x] 8.1 Replace textarea with MarkdownEditor in `frontend/src/pages/JournalPage.tsx`
    - Import `MarkdownEditor` from `../components/MarkdownEditor`
    - Replace the `<textarea>` in the editor section with `<MarkdownEditor value={currentContent} onChange={setCurrentContent} placeholder="What's on your mind today?" autoFocus />`
    - Verify manual save via Save Entry button still works
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 8.2 Add markdown stripping to JournalPage timeline previews
    - Import `stripMarkdown` from `../utils/stripMarkdown`
    - Change `{entry.content}` to `{stripMarkdown(entry.content)}` in the timeline entry list
    - _Requirements: 7.2_

- [ ] 9. Final checkpoint — All integration complete
  - Ensure all tests pass and both pages work correctly with the MarkdownEditor.

## Notes

- Tasks marked with `*` are optional property/unit tests that can be skipped for faster MVP
- This is a frontend-only feature — no backend or database changes needed
- The formatting functions are extracted as pure utilities to enable property-based testing without DOM dependencies
- Property tests use `fast-check` (already in devDependencies) with `vitest`
- Each task references specific requirements for traceability
