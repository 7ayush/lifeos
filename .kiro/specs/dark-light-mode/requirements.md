# Requirements Document

## Introduction

LifeOS currently uses a hardcoded dark theme across all pages and components. This feature adds a theme toggle allowing users to switch between dark mode and light mode. The selected theme preference persists per user so it survives page reloads and re-logins. The implementation leverages Tailwind CSS's `dark:` variant strategy and CSS custom properties already partially defined in `index.css`.

## Glossary

- **Theme_Provider**: A React context provider that manages the current theme state (`dark` or `light`) and exposes a toggle function to child components.
- **Theme_Toggle**: A UI control (icon button) that allows the user to switch between dark and light modes.
- **Theme_Preference**: The stored value (`dark` or `light`) representing the user's chosen theme, persisted in the backend database and mirrored in `localStorage` for instant hydration.
- **User_Settings_API**: The backend REST endpoint responsible for reading and writing user-level settings such as theme preference.
- **CSS_Theme_Variables**: The set of CSS custom properties defined in `index.css` under `:root` (light) and `.dark` (dark) selectors that control surface, text, border, and accent colors.

## Requirements

### Requirement 1: Theme Context and State Management

**User Story:** As a user, I want the app to know my current theme preference, so that all components render with the correct color scheme.

#### Acceptance Criteria

1. THE Theme_Provider SHALL expose the current theme value (`dark` or `light`) and a toggle function to all descendant components via React context.
2. WHEN the application mounts, THE Theme_Provider SHALL initialize the theme from `localStorage` if a stored Theme_Preference exists.
3. WHEN no stored Theme_Preference exists in `localStorage`, THE Theme_Provider SHALL default to `dark` mode.
4. WHEN the theme is `dark`, THE Theme_Provider SHALL add the `dark` class to the `<html>` element.
5. WHEN the theme is `light`, THE Theme_Provider SHALL remove the `dark` class from the `<html>` element.

### Requirement 2: Theme Toggle Control

**User Story:** As a user, I want a visible toggle button, so that I can switch between dark and light modes at any time.

#### Acceptance Criteria

1. THE Theme_Toggle SHALL be rendered in the Profile page under a new "Appearance" settings section.
2. WHEN the user activates the Theme_Toggle, THE Theme_Provider SHALL switch the current theme from `dark` to `light` or from `light` to `dark`.
3. THE Theme_Toggle SHALL display a sun icon when the current theme is `dark` and a moon icon when the current theme is `light`, indicating the mode the user will switch to.
4. THE Theme_Toggle SHALL include an accessible label describing its current action (e.g., "Switch to light mode").

### Requirement 3: Theme Preference Persistence — Local

**User Story:** As a user, I want my theme choice to survive page reloads, so that I do not have to re-select my theme every time.

#### Acceptance Criteria

1. WHEN the user changes the theme via the Theme_Toggle, THE Theme_Provider SHALL write the new Theme_Preference value to `localStorage` under the key `lifeos_theme`.
2. WHEN the application mounts, THE Theme_Provider SHALL read the `lifeos_theme` key from `localStorage` and apply the stored theme before the first paint.
3. IF `localStorage` contains an invalid value for `lifeos_theme`, THEN THE Theme_Provider SHALL fall back to `dark` mode and overwrite the invalid value.

### Requirement 4: Theme Preference Persistence — Backend

**User Story:** As a user, I want my theme preference saved to my account, so that it follows me across devices and browsers.

#### Acceptance Criteria

1. THE User model in the backend SHALL include a `theme_preference` column of type String with a default value of `dark`.
2. THE User_Settings_API SHALL expose a `PATCH /users/{user_id}/settings` endpoint that accepts a JSON body with an optional `theme_preference` field.
3. THE User_Settings_API SHALL expose a `GET /users/{user_id}/settings` endpoint that returns the current `theme_preference` value.
4. WHEN the user changes the theme via the Theme_Toggle, THE frontend SHALL send a PATCH request to the User_Settings_API to persist the new Theme_Preference.
5. WHEN the user logs in, THE Theme_Provider SHALL fetch the Theme_Preference from the User_Settings_API and apply it, overwriting any stale `localStorage` value.
6. IF the PATCH request to the User_Settings_API fails, THEN THE Theme_Provider SHALL retain the locally applied theme and log the error to the console without disrupting the user experience.

### Requirement 5: CSS Theme Variables for Light Mode

**User Story:** As a user, I want the light mode to have a cohesive, readable color scheme, so that the app is comfortable to use in bright environments.

#### Acceptance Criteria

1. THE CSS_Theme_Variables SHALL define a light-mode palette under the `:root` selector with light surface colors, dark text colors, and appropriately adjusted accent colors.
2. THE CSS_Theme_Variables SHALL define the existing dark-mode palette under the `.dark` selector.
3. THE `.glass-panel` component class SHALL adapt its background, border, and shadow values based on the active theme using CSS custom properties.
4. THE `.glass-button` component class SHALL adapt its background and border values based on the active theme using CSS custom properties.
5. THE `.text-gradient` component class SHALL remain visually legible in both dark and light modes.

### Requirement 6: Component Theme Adaptation

**User Story:** As a user, I want all pages and components to look correct in both themes, so that no element is unreadable or visually broken.

#### Acceptance Criteria

1. THE Layout component SHALL use theme-aware CSS classes (via Tailwind `dark:` variants or CSS custom properties) for its background, text, and border colors instead of hardcoded dark-only values.
2. THE Sidebar component SHALL use theme-aware CSS classes for its background, border, active-link highlight, and text colors.
3. THE ProfileMenu component SHALL use theme-aware CSS classes for its dropdown background, border, and text colors.
4. THE NotificationCenter component SHALL use theme-aware CSS classes for its dropdown panel background, border, notification item backgrounds, and text colors.
5. THE ProfilePage component SHALL use theme-aware CSS classes for its glass panels, text, and form control colors.
6. WHEN a component uses inline color values (e.g., `bg-black/60`, `text-white`, `bg-white/5`), THE component SHALL replace those values with theme-aware equivalents that resolve correctly in both dark and light modes.
7. THE MarkdownEditor component SHALL render markdown content with readable text and code block colors in both themes.
8. THE pages (Dashboard, GoalsPage, HabitsPage, JournalPage, KanbanBoard, VaultPage, AnalyticsPage, WeeklyReviewPage, ExportPage) SHALL use theme-aware background, text, and border colors.

### Requirement 7: Transition and Animation

**User Story:** As a user, I want theme changes to feel smooth, so that the switch is not jarring.

#### Acceptance Criteria

1. WHEN the theme changes, THE application SHALL apply a CSS transition of 200ms duration to background-color and color properties on the `<html>` element to create a smooth visual shift.
2. THE transition SHALL apply only when the theme is toggled by the user, not on initial page load.

### Requirement 8: System Preference Detection

**User Story:** As a first-time user, I want the app to respect my operating system's color scheme preference, so that the app matches my environment by default.

#### Acceptance Criteria

1. WHEN no stored Theme_Preference exists in `localStorage` and no backend preference is available, THE Theme_Provider SHALL check the `prefers-color-scheme` media query.
2. WHEN the `prefers-color-scheme` media query returns `light`, THE Theme_Provider SHALL initialize the theme to `light`.
3. WHEN the `prefers-color-scheme` media query returns `dark` or is unsupported, THE Theme_Provider SHALL initialize the theme to `dark`.
4. WHEN the user explicitly sets a theme via the Theme_Toggle, THE Theme_Provider SHALL use the explicit preference and ignore the system preference for subsequent loads.
