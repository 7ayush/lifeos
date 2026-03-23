# Implementation Plan: Dark/Light Mode

## Overview

Add a dual-theme system (dark/light) to LifeOS. Backend adds a `theme_preference` column to the User model and settings endpoints. Frontend adds a ThemeProvider context, ThemeToggle on the Profile page, CSS variable restructuring for light/dark palettes, and migrates all components from hardcoded dark classes to theme-aware equivalents. Property-based tests use hypothesis (backend) and fast-check (frontend).

## Tasks

- [x] 1. Backend data model and API
  - [x] 1.1 Add `theme_preference` column to User model in `backend/models.py`
    - Add `theme_preference = Column(String, default="dark")` to the User class
    - _Requirements: 4.1_

  - [x] 1.2 Add settings schemas to `backend/schemas.py`
    - Add `UserSettingsOut` schema with `theme_preference: str`
    - Add `UserSettingsUpdate` schema with `theme_preference: Optional[str]` and validator restricting to `"dark"` or `"light"`
    - _Requirements: 4.2, 4.3_

  - [x] 1.3 Add settings endpoints to `backend/routers/users.py`
    - `GET /users/{user_id}/settings` — return `UserSettingsOut` from user record
    - `PATCH /users/{user_id}/settings` — accept `UserSettingsUpdate`, update user, return `UserSettingsOut`
    - _Requirements: 4.2, 4.3_

  - [x] 1.4 Create Alembic migration for `theme_preference` column
    - Add column to `users` table with server_default `"dark"`
    - _Requirements: 4.1_

  - [x] 1.5 Write property test: Backend settings round-trip
    - **Property 6: Backend settings round-trip**
    - **Validates: Requirements 4.2, 4.3**
    - Create `backend/tests/test_theme_properties.py` using `hypothesis`
    - Generate random valid theme values (`"dark"` or `"light"`), PATCH then GET, verify round-trip

  - [x] 1.6 Write property test: Backend theme_preference validation
    - **Property 7: Backend theme_preference validation**
    - **Validates: Requirements 4.2**
    - In `backend/tests/test_theme_properties.py` using `hypothesis`
    - Generate arbitrary strings not in `{"dark", "light"}`, PATCH with them, verify 422 error and preference unchanged

- [x] 2. CSS theme variables
  - [x] 2.1 Restructure `frontend/src/index.css` for dual-theme support
    - Move existing dark palette from `:root` to `.dark` selector
    - Define light-mode palette under `:root` with light surfaces, dark text, adjusted accents
    - Update `.glass-panel` to use `bg-card/80 border-border` instead of `bg-white/[0.015] border-white/[0.05]`
    - Update `.glass-button` to use `bg-secondary/50 hover:bg-secondary/80 border-border`
    - Update body background gradients to use theme-aware opacity
    - Add `.theme-transitioning` rule: `html.theme-transitioning { transition: background-color 200ms, color 200ms; }`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.1, 7.2_

- [x] 3. ThemeProvider context
  - [x] 3.1 Create `frontend/src/contexts/ThemeContext.tsx`
    - Export `ThemeProvider` component and `useTheme` hook
    - Expose `theme: 'dark' | 'light'` and `toggleTheme: () => void`
    - Initialize from localStorage (`lifeos_theme` key), fall back to `prefers-color-scheme`, then default `"dark"`
    - Validate localStorage value — if invalid, fall back to `"dark"` and overwrite
    - On toggle: flip theme, update `<html>` dark class, write localStorage, fire PATCH to backend (fire-and-forget)
    - Add/remove `theme-transitioning` class on `<html>` during user-initiated toggles (remove after 200ms)
    - On auth change (user logs in): fetch `GET /users/:id/settings`, apply backend preference, overwrite localStorage
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 4.4, 4.5, 4.6, 7.1, 7.2, 8.1, 8.2, 8.3, 8.4_

  - [x] 3.2 Integrate ThemeProvider into `frontend/src/App.tsx`
    - Wrap app content with `<ThemeProvider>` inside `<AuthProvider>`
    - _Requirements: 1.1_

  - [x] 3.3 Write property test: Dark class synchronization
    - **Property 1: Dark class synchronization**
    - **Validates: Requirements 1.4, 1.5**
    - Create `frontend/src/contexts/__tests__/ThemeContext.test.tsx` using `fast-check`
    - Generate random theme values, apply them, verify `<html>` class matches

  - [x] 3.4 Write property test: Toggle is self-inverse
    - **Property 2: Toggle is self-inverse**
    - **Validates: Requirements 2.2**
    - In `frontend/src/contexts/__tests__/ThemeContext.test.tsx` using `fast-check`
    - Generate random initial themes, toggle twice, verify return to original

  - [x] 3.5 Write property test: Theme preference localStorage round-trip
    - **Property 4: Theme preference localStorage round-trip**
    - **Validates: Requirements 1.2, 3.1, 3.2**
    - In `frontend/src/contexts/__tests__/ThemeContext.test.tsx` using `fast-check`
    - Generate random valid themes, toggle, verify localStorage matches

  - [x] 3.6 Write property test: Invalid localStorage fallback
    - **Property 5: Invalid localStorage fallback**
    - **Validates: Requirements 3.3**
    - In `frontend/src/contexts/__tests__/ThemeContext.test.tsx` using `fast-check`
    - Generate arbitrary non-"dark"/"light" strings, set in localStorage, mount provider, verify fallback to dark

  - [x] 3.7 Write property test: System preference detection fallback
    - **Property 8: System preference detection fallback**
    - **Validates: Requirements 8.1, 8.2, 8.3**
    - In `frontend/src/contexts/__tests__/ThemeContext.test.tsx` using `fast-check`
    - Generate random system preferences, clear localStorage, mount provider, verify theme matches system preference

- [x] 4. Frontend API layer
  - [x] 4.1 Add settings API functions to `frontend/src/api/index.ts`
    - Implement `getUserSettings(userId)` — GET `/users/{userId}/settings`
    - Implement `updateUserSettings(userId, settings)` — PATCH `/users/{userId}/settings`
    - _Requirements: 4.2, 4.3, 4.4_

- [x] 5. Theme Toggle on Profile page
  - [x] 5.1 Add Appearance section with ThemeToggle to `frontend/src/pages/ProfilePage.tsx`
    - Add new "Appearance" glass-panel section between Reminder Settings and Session
    - Display sun icon (Sun from lucide-react) when theme is `"dark"`, moon icon (Moon) when `"light"`
    - Include `aria-label` describing the action (e.g., "Switch to light mode")
    - Call `toggleTheme()` from `useTheme()` on click
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 5.2 Write property test: Toggle renders correct icon and accessible label
    - **Property 3: Toggle renders correct icon and accessible label**
    - **Validates: Requirements 2.3, 2.4**
    - Create `frontend/src/pages/__tests__/ThemeToggle.test.tsx` using `fast-check`
    - Generate random theme values, render toggle, verify icon and aria-label

- [x] 6. Component theme migration — Core layout
  - [x] 6.1 Migrate `frontend/src/components/Layout.tsx`
    - Replace `bg-[#030303]` with `bg-background`
    - Replace `text-neutral-50` with `text-foreground`
    - Replace hardcoded dark gradient in main with theme-aware classes
    - _Requirements: 6.1_

  - [x] 6.2 Migrate `frontend/src/components/Sidebar.tsx`
    - Replace `bg-black/60` with `bg-card/60`
    - Replace `border-white/10` with `border-border`
    - Replace `text-neutral-400` with `text-muted-foreground`
    - Replace active link `bg-gradient-to-r from-emerald-500/10` and text colors with theme-aware variants
    - _Requirements: 6.2_

  - [x] 6.3 Migrate `frontend/src/components/ProfileMenu.tsx`
    - Replace `bg-black/80` with `bg-popover`
    - Replace `border-white/10` with `border-border`
    - Replace `text-neutral-300`, `text-neutral-500` with `text-foreground`, `text-muted-foreground`
    - _Requirements: 6.3_

  - [x] 6.4 Migrate `frontend/src/components/NotificationCenter.tsx`
    - Replace `bg-black/80` with `bg-popover`
    - Replace `border-white/10` with `border-border`
    - Replace `text-neutral-200`, `text-neutral-400`, `text-neutral-500` with theme-aware equivalents
    - _Requirements: 6.4_

- [x] 7. Component theme migration — Shared components
  - [x] 7.1 Migrate `frontend/src/components/MarkdownEditor.tsx`
    - Replace hardcoded dark text/background classes with theme-aware equivalents
    - Ensure code blocks and markdown content are readable in both themes
    - _Requirements: 6.7_

  - [x] 7.2 Migrate remaining shared components
    - Migrate `ConfirmModal.tsx`, `CustomDropdown.tsx`, `QuickCaptureButton.tsx`, `TagChip.tsx`, `TagSelector.tsx`, `PriorityBadge.tsx`, `ProgressBar.tsx`
    - Replace hardcoded dark classes (`bg-black`, `bg-white/5`, `text-white`, `border-white/10`, etc.) with theme-aware equivalents
    - _Requirements: 6.6_

- [x] 8. Component theme migration — Pages
  - [x] 8.1 Migrate `frontend/src/pages/ProfilePage.tsx`
    - Replace `text-white` with `text-foreground`
    - Replace `text-neutral-300`, `text-neutral-400`, `text-neutral-500` with `text-muted-foreground`
    - Replace `bg-white/5` with `bg-secondary`
    - Replace `divide-white/5` with `divide-border`
    - _Requirements: 6.5_

  - [x] 8.2 Migrate remaining pages
    - Migrate Dashboard, GoalsPage, HabitsPage, JournalPage, KanbanBoard, VaultPage, AnalyticsPage, WeeklyReviewPage, ExportPage, LoginPage
    - Replace hardcoded dark classes with theme-aware equivalents following the same pattern
    - _Requirements: 6.8_

  - [x] 8.3 Migrate weekly-review sub-components
    - Migrate all components in `frontend/src/components/weekly-review/`
    - Replace hardcoded dark classes with theme-aware equivalents
    - _Requirements: 6.8_

- [x] 9. Final verification
  - [x] 9.1 Visual review of both themes
    - Verify all pages render correctly in dark mode (regression)
    - Verify all pages render correctly in light mode
    - Verify theme toggle transitions smoothly
    - _Requirements: 5.5, 7.1, 7.2_

## Notes

- Tasks marked with `*` are optional property-based test tasks
- The CSS restructuring (task 2.1) must be done before component migration (tasks 6-8) since components depend on the updated CSS variables
- ThemeProvider (task 3.1) must be done before the toggle (task 5.1) since the toggle consumes the context
- Component migrations (tasks 6-8) can be done in parallel
- Backend tasks (1.x) and frontend CSS/context tasks (2.x, 3.x) can be done in parallel
- `hypothesis` needs to be added to `backend/requirements.txt` for backend property tests
- `fast-check` is already in `frontend/package.json`
