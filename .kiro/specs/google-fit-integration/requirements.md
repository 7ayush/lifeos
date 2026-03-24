# Requirements Document

## Introduction

The Google Fit Integration feature enables LifeOS users to connect their Google Fit account and fetch health and fitness data including daily step counts, workout sessions, calories burned, heart rate, and sleep data. This data is stored locally and displayed on a dedicated Fitness page and the Dashboard, providing users with a holistic view of their physical activity alongside their productivity data. The integration uses Google Fit REST API with OAuth 2.0 for authorization.

## Glossary

- **Fitness_Service**: The backend service responsible for authenticating with Google Fit, fetching fitness data, storing it locally, and serving it to the frontend.
- **Fitness_Page**: The frontend page where users view their fitness data including steps, workouts, calories, heart rate, and sleep summaries.
- **Google_Fit_API**: The Google Fit REST API (fitness.googleapis.com) used to retrieve user fitness data.
- **Fitness_Connection**: The OAuth 2.0 link between a LifeOS user account and their Google Fit account, including stored access and refresh tokens.
- **Step_Record**: A daily aggregate record of the number of steps taken by the user.
- **Workout_Record**: A record of a single workout session including activity type, duration, and calories burned.
- **Daily_Summary**: An aggregated view of a user's fitness data for a single day, including total steps, total calories burned, active minutes, and average heart rate.
- **Sync_Operation**: The process of fetching the latest fitness data from the Google_Fit_API and storing it in the local database.
- **Fitness_Token**: The OAuth 2.0 access token and refresh token pair used to authenticate requests to the Google_Fit_API on behalf of the user.

## Requirements

### Requirement 1: Google Fit Account Connection

**User Story:** As a user, I want to connect my Google Fit account to LifeOS, so that my fitness data can be imported into the application.

#### Acceptance Criteria

1. THE Fitness_Page SHALL display a "Connect Google Fit" button when no Fitness_Connection exists for the authenticated user.
2. WHEN the user clicks the "Connect Google Fit" button, THE Fitness_Service SHALL initiate an OAuth 2.0 authorization flow requesting read access to the Google Fit activity, body, and sleep data scopes.
3. WHEN the user completes the OAuth 2.0 consent flow, THE Fitness_Service SHALL store the Fitness_Token (access token and refresh token) associated with the authenticated user.
4. WHEN the Fitness_Connection is established, THE Fitness_Page SHALL display the connected status and a "Disconnect" button instead of the "Connect Google Fit" button.
5. IF the OAuth 2.0 authorization flow fails or the user denies consent, THEN THE Fitness_Service SHALL return an error message and THE Fitness_Page SHALL display the error to the user.

### Requirement 2: Google Fit Account Disconnection

**User Story:** As a user, I want to disconnect my Google Fit account from LifeOS, so that I can revoke access to my fitness data.

#### Acceptance Criteria

1. WHEN the user clicks the "Disconnect" button, THE Fitness_Service SHALL revoke the stored Fitness_Token with Google and delete the Fitness_Connection record.
2. WHEN the Fitness_Connection is removed, THE Fitness_Page SHALL display the "Connect Google Fit" button.
3. WHEN the user disconnects, THE Fitness_Service SHALL retain previously synced fitness data in the local database.

### Requirement 3: Fetch Daily Steps

**User Story:** As a user, I want to see my daily step counts from Google Fit, so that I can track my walking activity alongside my productivity.

#### Acceptance Criteria

1. WHEN a Sync_Operation is triggered, THE Fitness_Service SHALL fetch daily step count data from the Google_Fit_API for the requested date range.
2. THE Fitness_Service SHALL store each Step_Record with the user ID, date, and step count.
3. WHEN a Step_Record already exists for a given user and date, THE Fitness_Service SHALL update the existing record with the latest step count.
4. THE Fitness_Page SHALL display the daily step count for the selected date.
5. THE Fitness_Page SHALL display a step count trend chart for the past 7 days.

### Requirement 4: Fetch Workouts

**User Story:** As a user, I want to see my workout sessions from Google Fit, so that I can review my exercise history.

#### Acceptance Criteria

1. WHEN a Sync_Operation is triggered, THE Fitness_Service SHALL fetch workout session data from the Google_Fit_API for the requested date range.
2. THE Fitness_Service SHALL store each Workout_Record with the user ID, activity type, start time, end time, duration in minutes, and calories burned.
3. THE Fitness_Page SHALL display a list of Workout_Record entries for the selected date range, showing activity type, duration, and calories burned.
4. WHEN no Workout_Record entries exist for the selected date range, THE Fitness_Page SHALL display an empty state message indicating no workouts were recorded.

### Requirement 5: Fetch Calories and Active Minutes

**User Story:** As a user, I want to see my daily calories burned and active minutes, so that I can monitor my overall activity level.

#### Acceptance Criteria

1. WHEN a Sync_Operation is triggered, THE Fitness_Service SHALL fetch daily calories burned and active minutes data from the Google_Fit_API for the requested date range.
2. THE Fitness_Service SHALL store calories burned and active minutes as part of the Daily_Summary record for each date.
3. THE Fitness_Page SHALL display the total calories burned and active minutes for the selected date.

### Requirement 6: Fetch Heart Rate Data

**User Story:** As a user, I want to see my heart rate data from Google Fit, so that I can monitor my cardiovascular health.

#### Acceptance Criteria

1. WHEN a Sync_Operation is triggered, THE Fitness_Service SHALL fetch heart rate summary data from the Google_Fit_API for the requested date range.
2. THE Fitness_Service SHALL store the average, minimum, and maximum heart rate as part of the Daily_Summary record for each date.
3. THE Fitness_Page SHALL display the average heart rate for the selected date.
4. WHEN heart rate data is not available for a given date, THE Fitness_Page SHALL display a "No data" indicator instead of a heart rate value.

### Requirement 7: Fetch Sleep Data

**User Story:** As a user, I want to see my sleep data from Google Fit, so that I can understand my rest patterns.

#### Acceptance Criteria

1. WHEN a Sync_Operation is triggered, THE Fitness_Service SHALL fetch sleep session data from the Google_Fit_API for the requested date range.
2. THE Fitness_Service SHALL store sleep records with the user ID, date, total sleep duration in minutes, and sleep start and end times.
3. THE Fitness_Page SHALL display the total sleep duration for the selected date formatted as hours and minutes.
4. WHEN sleep data is not available for a given date, THE Fitness_Page SHALL display a "No data" indicator instead of sleep values.

### Requirement 8: Data Sync Mechanism

**User Story:** As a user, I want my fitness data to sync automatically and on demand, so that I always see up-to-date information.

#### Acceptance Criteria

1. WHEN the user navigates to the Fitness_Page and a Fitness_Connection exists, THE Fitness_Service SHALL automatically trigger a Sync_Operation for the past 7 days.
2. THE Fitness_Page SHALL display a "Sync Now" button that triggers a manual Sync_Operation for the past 30 days.
3. WHILE a Sync_Operation is in progress, THE Fitness_Page SHALL display a loading indicator.
4. WHEN a Sync_Operation completes, THE Fitness_Page SHALL refresh the displayed data with the latest records.
5. THE Fitness_Service SHALL store the timestamp of the last successful Sync_Operation for each user.
6. IF the Fitness_Token has expired, THEN THE Fitness_Service SHALL use the refresh token to obtain a new access token before proceeding with the Sync_Operation.
7. IF the refresh token is invalid or revoked, THEN THE Fitness_Service SHALL mark the Fitness_Connection as disconnected and THE Fitness_Page SHALL prompt the user to reconnect.

### Requirement 9: Fitness API Endpoints

**User Story:** As a developer, I want backend API endpoints for managing the Google Fit connection and retrieving fitness data, so that the frontend can interact with the fitness features.

#### Acceptance Criteria

1. THE Fitness_Service SHALL expose a GET endpoint at `/api/fitness/auth-url` that returns the Google OAuth 2.0 authorization URL.
2. THE Fitness_Service SHALL expose a POST endpoint at `/api/fitness/callback` that accepts the OAuth 2.0 authorization code and establishes the Fitness_Connection.
3. THE Fitness_Service SHALL expose a DELETE endpoint at `/api/fitness/connection` that disconnects the user's Google Fit account.
4. THE Fitness_Service SHALL expose a GET endpoint at `/api/fitness/connection` that returns the current Fitness_Connection status for the authenticated user.
5. THE Fitness_Service SHALL expose a POST endpoint at `/api/fitness/sync` that triggers a manual Sync_Operation and returns the sync result.
6. THE Fitness_Service SHALL expose a GET endpoint at `/api/fitness/summary` that accepts a date range and returns Daily_Summary records for the authenticated user.
7. THE Fitness_Service SHALL expose a GET endpoint at `/api/fitness/workouts` that accepts a date range and returns Workout_Record entries for the authenticated user.
8. THE Fitness_Service SHALL expose a GET endpoint at `/api/fitness/steps` that accepts a date range and returns Step_Record entries for the authenticated user.
9. THE Fitness_Service SHALL require user authentication for all fitness endpoints.

### Requirement 10: Fitness Page Navigation and Layout

**User Story:** As a user, I want to access my fitness data from the main navigation, so that I can easily view my health metrics.

#### Acceptance Criteria

1. THE Fitness_Page SHALL be accessible via the URL path `/fitness`.
2. THE Sidebar SHALL include a navigation link to the Fitness_Page with the label "Fitness" and an appropriate icon.
3. THE Fitness_Page SHALL display a date selector allowing the user to choose a specific date or date range to view.
4. THE Fitness_Page SHALL organize fitness data into sections: Steps, Workouts, Calories & Active Minutes, Heart Rate, and Sleep.

### Requirement 11: Dashboard Fitness Widget

**User Story:** As a user, I want to see a summary of my fitness data on the Dashboard, so that I get a quick overview without navigating to the Fitness page.

#### Acceptance Criteria

1. WHEN a Fitness_Connection exists, THE Dashboard SHALL display a fitness summary widget showing today's step count, calories burned, and active minutes.
2. WHEN no Fitness_Connection exists, THE Dashboard SHALL display a prompt to connect Google Fit with a link to the Fitness_Page.
3. THE Dashboard fitness widget SHALL display a "View Details" link that navigates to the Fitness_Page.

### Requirement 12: Token Security

**User Story:** As a user, I want my Google Fit credentials to be stored securely, so that my fitness data access is protected.

#### Acceptance Criteria

1. THE Fitness_Service SHALL encrypt the Fitness_Token (access token and refresh token) before storing them in the database.
2. THE Fitness_Service SHALL transmit Fitness_Token values only over HTTPS connections.
3. THE Fitness_Service SHALL return only the Fitness_Connection status (connected or disconnected) to the frontend, and SHALL NOT expose raw token values in any API response.
