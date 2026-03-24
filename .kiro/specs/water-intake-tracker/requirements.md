# Requirements Document

## Introduction

The Water Intake Tracker feature enables LifeOS users to log their daily water consumption, set personalized hydration goals, and view intake history over time. Users can quickly log water entries in configurable amounts, track progress toward a daily target, and review trends on a dedicated Hydration page and a Dashboard widget. The feature follows the existing LifeOS architecture with a FastAPI backend router, SQLAlchemy models, and a React/TypeScript frontend.

## Glossary

- **Hydration_Service**: The backend service responsible for managing water intake records, daily goals, and serving hydration data to the frontend.
- **Hydration_Page**: The frontend page where users view their water intake history, log new entries, and manage their daily hydration goal.
- **Water_Entry**: A single record of water consumed, including the amount in milliliters and a timestamp.
- **Daily_Goal**: The user's target water intake amount in milliliters for a single day. Each user has one active Daily_Goal value.
- **Daily_Progress**: An aggregated view of total water consumed by a user for a specific date, compared against the Daily_Goal.
- **Intake_Summary**: A collection of Daily_Progress records over a date range, used for trend visualization.

## Requirements

### Requirement 1: Log Water Intake

**User Story:** As a user, I want to log water I have consumed, so that I can keep an accurate record of my daily hydration.

#### Acceptance Criteria

1. WHEN the user submits a water intake amount, THE Hydration_Service SHALL create a Water_Entry with the user ID, amount in milliliters, and the current timestamp.
2. THE Hydration_Service SHALL reject a Water_Entry where the amount is less than 1 milliliter or greater than 5000 milliliters and return a validation error.
3. WHEN a Water_Entry is created, THE Hydration_Page SHALL update the Daily_Progress display for the current date without requiring a full page reload.

### Requirement 2: Quick-Add Water Intake

**User Story:** As a user, I want to quickly add common water amounts with a single tap, so that logging is fast and convenient.

#### Acceptance Criteria

1. THE Hydration_Page SHALL display quick-add buttons for 250 ml, 500 ml, and 750 ml amounts.
2. WHEN the user clicks a quick-add button, THE Hydration_Service SHALL create a Water_Entry with the corresponding amount.
3. THE Hydration_Page SHALL also display a custom amount input field that accepts any valid amount between 1 ml and 5000 ml.

### Requirement 3: Delete Water Entry

**User Story:** As a user, I want to delete a water entry I logged by mistake, so that my daily total remains accurate.

#### Acceptance Criteria

1. WHEN the user requests deletion of a Water_Entry, THE Hydration_Service SHALL remove the Water_Entry from the database.
2. WHEN a Water_Entry is deleted, THE Hydration_Page SHALL update the Daily_Progress display for the affected date.
3. THE Hydration_Service SHALL verify that the Water_Entry belongs to the authenticated user before deleting and return a 403 error if the entry belongs to a different user.

### Requirement 4: Set Daily Hydration Goal

**User Story:** As a user, I want to set a personal daily water intake goal, so that I can track my progress toward a target.

#### Acceptance Criteria

1. THE Hydration_Service SHALL allow the user to set a Daily_Goal amount in milliliters.
2. THE Hydration_Service SHALL reject a Daily_Goal where the amount is less than 500 milliliters or greater than 10000 milliliters and return a validation error.
3. WHEN no Daily_Goal has been set by the user, THE Hydration_Service SHALL use a default Daily_Goal of 2000 milliliters.
4. WHEN the user updates the Daily_Goal, THE Hydration_Page SHALL reflect the new goal in the Daily_Progress display.

### Requirement 5: View Daily Progress

**User Story:** As a user, I want to see how much water I have consumed today compared to my goal, so that I know if I need to drink more.

#### Acceptance Criteria

1. THE Hydration_Page SHALL display the total water consumed for the current date in milliliters.
2. THE Hydration_Page SHALL display a progress indicator showing the percentage of the Daily_Goal achieved.
3. WHEN the total water consumed meets or exceeds the Daily_Goal, THE Hydration_Page SHALL display a visual indicator that the goal has been reached.
4. THE Hydration_Page SHALL display a list of individual Water_Entry records for the selected date, showing the amount and timestamp for each entry.

### Requirement 6: View Intake History

**User Story:** As a user, I want to view my water intake history over the past week, so that I can identify hydration trends.

#### Acceptance Criteria

1. THE Hydration_Page SHALL display a bar chart showing daily total water intake for the past 7 days.
2. THE Hydration_Page SHALL display the Daily_Goal as a reference line on the bar chart.
3. WHEN the user selects a specific date on the chart, THE Hydration_Page SHALL display the detailed Water_Entry list for that date.

### Requirement 7: Hydration API Endpoints

**User Story:** As a developer, I want backend API endpoints for managing water intake data, so that the frontend can interact with the hydration features.

#### Acceptance Criteria

1. THE Hydration_Service SHALL expose a POST endpoint at `/api/water/entries` that creates a new Water_Entry for the authenticated user.
2. THE Hydration_Service SHALL expose a GET endpoint at `/api/water/entries` that accepts a date parameter and returns Water_Entry records for the authenticated user on that date.
3. THE Hydration_Service SHALL expose a DELETE endpoint at `/api/water/entries/{entry_id}` that deletes a specific Water_Entry belonging to the authenticated user.
4. THE Hydration_Service SHALL expose a GET endpoint at `/api/water/progress` that accepts a date range and returns Daily_Progress records for the authenticated user.
5. THE Hydration_Service SHALL expose a PUT endpoint at `/api/water/goal` that sets or updates the Daily_Goal for the authenticated user.
6. THE Hydration_Service SHALL expose a GET endpoint at `/api/water/goal` that returns the current Daily_Goal for the authenticated user.
7. THE Hydration_Service SHALL require user authentication for all water intake endpoints.

### Requirement 8: Hydration Page Navigation and Layout

**User Story:** As a user, I want to access my hydration tracker from the main navigation, so that I can easily log and review my water intake.

#### Acceptance Criteria

1. THE Hydration_Page SHALL be accessible via the URL path `/hydration`.
2. THE Sidebar SHALL include a navigation link to the Hydration_Page with the label "Hydration" and a water drop icon.
3. THE Hydration_Page SHALL organize content into sections: Daily Progress (with quick-add buttons and entry list) and History (with the 7-day bar chart).

### Requirement 9: Dashboard Hydration Widget

**User Story:** As a user, I want to see a summary of my daily water intake on the Dashboard, so that I get a quick hydration status without navigating away.

#### Acceptance Criteria

1. THE Dashboard SHALL display a hydration widget showing today's total water consumed and the Daily_Goal.
2. THE Dashboard hydration widget SHALL display a progress bar indicating the percentage of the Daily_Goal achieved.
3. THE Dashboard hydration widget SHALL display a "Log Water" quick-add button for 250 ml that creates a Water_Entry directly from the Dashboard.
4. THE Dashboard hydration widget SHALL display a "View Details" link that navigates to the Hydration_Page.

### Requirement 10: Data Integrity

**User Story:** As a user, I want my water intake data to be stored reliably, so that my records are accurate and consistent.

#### Acceptance Criteria

1. THE Hydration_Service SHALL store each Water_Entry with a non-null user ID, a positive integer amount in milliliters, and a non-null timestamp.
2. THE Hydration_Service SHALL compute Daily_Progress by summing all Water_Entry amounts for a given user and date, and the sum SHALL equal the total of the individual entry amounts.
3. THE Hydration_Service SHALL return Water_Entry records only for the authenticated user and SHALL NOT expose entries belonging to other users.
