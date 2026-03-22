# Requirements Document

## Introduction

The Goal Progress Tracking feature adds visual progress indicators, automated progress calculation, milestone tracking, and auto-status updates to the LifeOS productivity app. Currently, goals exist with linked tasks and habits, and a basic `compute_goal_progress` function calculates a weighted average on the detail view. This feature enhances that foundation with per-goal progress bars on the Goals list page, a progress summary on the Dashboard, a progress history log, and automatic goal completion when all linked tasks are done.

## Glossary

- **Progress_Engine**: The backend service responsible for computing goal progress percentages based on linked Task and Habit completion data.
- **Goal_Card**: A UI card component on the Goals list page that displays a single goal's summary information including its progress bar.
- **Progress_Bar**: A visual horizontal bar indicator that fills proportionally to represent a goal's completion percentage (0–100%).
- **Dashboard_Widget**: The "Active Goals" section on the Dashboard page that displays a summary of the user's top active goals with progress indicators.
- **Progress_Snapshot**: A timestamped record of a goal's progress percentage, stored for historical tracking.
- **Milestone**: A predefined progress threshold (e.g., 25%, 50%, 75%, 100%) that triggers a recorded event when reached.
- **Goal_Status_Automator**: The backend logic that automatically transitions a goal's status based on progress conditions.
- **Goals_Page**: The frontend page that lists all user goals with filtering and detail views.
- **Dashboard_Page**: The frontend landing page that shows an overview of the user's productivity data.
- **Linked_Task**: A Task record whose `goal_id` foreign key references a specific Goal.
- **Linked_Habit**: A Habit record whose `goal_id` foreign key references a specific Goal.

## Requirements

### Requirement 1: Task-Based Progress Calculation

**User Story:** As a user, I want my goal progress to be calculated from linked task completion, so that I can see how close I am to finishing a goal.

#### Acceptance Criteria

1. WHEN a Goal has one or more Linked_Tasks, THE Progress_Engine SHALL calculate progress as the ratio of Linked_Tasks with status "Done" to the total number of Linked_Tasks, expressed as a percentage rounded to the nearest integer.
2. WHEN a Goal has zero Linked_Tasks and zero Linked_Habits, THE Progress_Engine SHALL return a progress value of 0.
3. WHEN a Goal has both Linked_Tasks and Linked_Habits, THE Progress_Engine SHALL calculate progress as the weighted average of the task completion ratio and the habit success rate.
4. WHEN a Linked_Task status changes to "Done" or changes from "Done" to another status, THE Progress_Engine SHALL recalculate the associated Goal's progress within the same request.

### Requirement 2: Progress Display on Goals Page

**User Story:** As a user, I want to see a progress bar on each goal card in the goals list, so that I can quickly assess progress without opening the detail view.

#### Acceptance Criteria

1. THE Goal_Card SHALL display a Progress_Bar showing the goal's current progress percentage.
2. THE Goal_Card SHALL display the numeric progress percentage next to the Progress_Bar.
3. WHEN the progress value is 100%, THE Progress_Bar SHALL render with a distinct completed visual style (e.g., green color).
4. WHEN the progress value is 0%, THE Progress_Bar SHALL render as an empty bar with a background track visible.
5. THE Goals_Page SHALL fetch progress data for all goals in a single API request rather than issuing separate requests per goal.

### Requirement 3: Progress Display on Dashboard

**User Story:** As a user, I want to see my active goals with progress bars on the Dashboard, so that I have a quick overview of my goal progress.

#### Acceptance Criteria

1. THE Dashboard_Widget SHALL display a Progress_Bar for each active goal shown.
2. THE Dashboard_Widget SHALL display the numeric progress percentage for each active goal.
3. THE Dashboard_Page SHALL display up to 3 active goals sorted by priority (High first, then Medium, then Low).
4. WHEN the "Goal Progress" KPI card value is displayed, THE Dashboard_Page SHALL show the average progress across all active goals instead of the completed-goals ratio.

### Requirement 4: Goal Auto-Completion

**User Story:** As a user, I want my goal to automatically mark as completed when all linked tasks are done, so that I don't have to manually update goal status.

#### Acceptance Criteria

1. WHEN all Linked_Tasks of a Goal have status "Done" and the Goal has at least one Linked_Task, THE Goal_Status_Automator SHALL set the Goal status to "Completed".
2. WHEN a previously "Completed" Goal receives a new Linked_Task with status other than "Done", THE Goal_Status_Automator SHALL set the Goal status back to "Active".
3. IF the Goal status was manually set to "Archived" by the user, THEN THE Goal_Status_Automator SHALL NOT override the "Archived" status.
4. WHEN the Goal_Status_Automator changes a Goal's status, THE Progress_Engine SHALL record the status change timestamp.

### Requirement 5: Progress History Tracking

**User Story:** As a user, I want to see how my goal progress has changed over time, so that I can understand my productivity trends.

#### Acceptance Criteria

1. WHEN a Goal's progress percentage changes, THE Progress_Engine SHALL create a Progress_Snapshot with the goal ID, new progress percentage, and current timestamp.
2. THE Progress_Engine SHALL store at most one Progress_Snapshot per Goal per calendar day, updating the existing snapshot if progress changes multiple times in the same day.
3. WHEN a user views the goal detail, THE Goals_Page SHALL display the progress history as a list of Progress_Snapshots ordered by date descending.
4. THE Progress_Engine SHALL retain Progress_Snapshots for the lifetime of the Goal.

### Requirement 6: Milestone Tracking

**User Story:** As a user, I want to be notified when my goal reaches key milestones, so that I feel motivated and aware of my progress.

#### Acceptance Criteria

1. THE Progress_Engine SHALL recognize milestones at 25%, 50%, 75%, and 100% progress thresholds.
2. WHEN a Goal's progress reaches or crosses a Milestone threshold for the first time, THE Progress_Engine SHALL record the Milestone with the goal ID, threshold value, and timestamp.
3. WHEN a user views the goal detail, THE Goals_Page SHALL display achieved Milestones with their completion dates.
4. THE Progress_Engine SHALL NOT record duplicate Milestones for the same Goal and threshold combination.

### Requirement 7: Progress Data in API Responses

**User Story:** As a developer, I want goal progress data included in API responses, so that the frontend can render progress indicators without extra requests.

#### Acceptance Criteria

1. THE Goals API list endpoint (GET /users/{user_id}/goals/) SHALL include a `progress` field (integer, 0–100) in each Goal response object.
2. THE Goals API detail endpoint (GET /users/{user_id}/goals/{goal_id}) SHALL include a `progress` field, a `milestones` list, and a `progress_history` list in the response.
3. WHEN the Dashboard stats endpoint is called, THE Dashboard API SHALL include per-goal progress values for active goals.
4. THE Goals API list endpoint SHALL compute progress for all returned goals in a single optimized database query batch rather than issuing N+1 individual queries.
