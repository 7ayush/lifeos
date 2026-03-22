# Requirements Document

## Introduction

The Weekly Review/Planning View is a dedicated feature in LifeOS that enables users to reflect on the past week and plan the upcoming week. The view aggregates data from tasks, habits, goals, and journal entries to present a comprehensive weekly summary. Users can review accomplishments, identify areas for improvement, set focus priorities for the next week, and write weekly reflections. This feature bridges the gap between daily task management and long-term goal tracking by providing a structured weekly cadence for productivity review.

## Glossary

- **Weekly_Review_System**: The backend and frontend components responsible for aggregating, displaying, and persisting weekly review data
- **Week_Summary_Engine**: The backend service that computes weekly statistics by querying tasks, habits, goals, and journal entries within a given week's date range
- **Weekly_Reflection**: A journal-like entry specifically tied to a calendar week, containing the user's written reflection and optional mood rating
- **Focus_Task**: A task that the user explicitly marks as a priority focus item for the upcoming week
- **Week_Boundary**: A 7-day period defined as Monday 00:00:00 through Sunday 23:59:59 in the user's local context
- **Completion_Rate**: The percentage of tasks moved to "Done" status within a given week, calculated as (done_tasks / total_tasks) × 100
- **Habit_Adherence_Rate**: The percentage of expected habit completions that were logged as "Done" within a given week
- **Review_Navigation**: The UI controls that allow the user to move between different weekly review periods
- **Week_Identifier**: A string in ISO 8601 week format (e.g., "2025-W03") used to uniquely identify a calendar week

## Requirements

### Requirement 1: Weekly Summary Data Retrieval

**User Story:** As a user, I want to see a summary of my past week's activity, so that I can understand what I accomplished and where I fell short.

#### Acceptance Criteria

1. WHEN a user opens the Weekly Review page, THE Week_Summary_Engine SHALL compute and return a summary for the selected week containing: count of completed tasks, count of total tasks, Completion_Rate, Habit_Adherence_Rate, count of journal entries written, and a list of active goals with their progress delta for that week.
2. WHEN the Week_Summary_Engine computes the summary, THE Week_Summary_Engine SHALL include only tasks, habit logs, and journal entries whose dates fall within the selected Week_Boundary.
3. WHEN the Week_Summary_Engine computes goal progress delta, THE Week_Summary_Engine SHALL calculate the difference between the goal's progress at the start and end of the selected week using ProgressSnapshot records.
4. IF no tasks, habits, or journal entries exist for the selected week, THEN THE Week_Summary_Engine SHALL return zero values for all numeric fields and an empty list for goal progress entries.

### Requirement 2: Week Navigation

**User Story:** As a user, I want to navigate between different weeks, so that I can review past weeks or plan ahead.

#### Acceptance Criteria

1. WHEN the Weekly Review page loads, THE Weekly_Review_System SHALL default to the current calendar week based on the user's local date.
2. WHEN the user activates the "previous week" control, THE Review_Navigation SHALL update the view to display the immediately preceding week's data.
3. WHEN the user activates the "next week" control, THE Review_Navigation SHALL update the view to display the immediately following week's data.
4. THE Review_Navigation SHALL display the selected week's date range (Monday through Sunday) and the Week_Identifier in the page header.
5. WHILE the selected week is the current calendar week, THE Review_Navigation SHALL disable the "next week" control to prevent navigating into future weeks beyond the current one.

### Requirement 3: Completed Tasks Breakdown

**User Story:** As a user, I want to see which tasks I completed during the week, so that I can appreciate my progress and identify patterns.

#### Acceptance Criteria

1. WHEN a weekly summary is displayed, THE Weekly_Review_System SHALL show a list of all tasks that transitioned to "Done" status within the selected Week_Boundary.
2. THE Weekly_Review_System SHALL display each completed task with its title, priority level, associated goal title (if linked), and the date the task was completed.
3. WHEN completed tasks exist for the selected week, THE Weekly_Review_System SHALL group the completed tasks by day of the week.

### Requirement 4: Habit Performance Summary

**User Story:** As a user, I want to see how well I maintained my habits during the week, so that I can stay accountable and adjust my routines.

#### Acceptance Criteria

1. WHEN a weekly summary is displayed, THE Weekly_Review_System SHALL show each active habit with its weekly Habit_Adherence_Rate, current streak count, and a day-by-day status grid for the selected week.
2. THE Weekly_Review_System SHALL calculate the Habit_Adherence_Rate for each habit by dividing the number of "Done" logs by the number of expected completions within the selected Week_Boundary.
3. WHEN a habit has a frequency_type of "daily", THE Weekly_Review_System SHALL expect 7 completions per week for Habit_Adherence_Rate calculation.
4. WHEN a habit has a frequency_type of "weekly" or uses repeat_days, THE Weekly_Review_System SHALL expect completions only on the configured days within the selected Week_Boundary.

### Requirement 5: Goal Progress Review

**User Story:** As a user, I want to see how my goals progressed during the week, so that I can evaluate whether I'm on track.

#### Acceptance Criteria

1. WHEN a weekly summary is displayed, THE Weekly_Review_System SHALL show each active goal with its current progress percentage, the progress delta for the selected week, and the goal's target date.
2. WHEN a goal's progress increased during the selected week, THE Weekly_Review_System SHALL display the delta as a positive indicator.
3. WHEN a goal's progress did not change during the selected week, THE Weekly_Review_System SHALL display the delta as zero with a visual stagnation indicator.
4. THE Weekly_Review_System SHALL sort goals by priority (High, Medium, Low) in the weekly review display.

### Requirement 6: Journal Entries Summary

**User Story:** As a user, I want to see my journal entries from the past week in the review, so that I can reflect on my thoughts and moods.

#### Acceptance Criteria

1. WHEN a weekly summary is displayed, THE Weekly_Review_System SHALL show a list of journal entries written during the selected Week_Boundary, displaying each entry's date, mood rating, and a content preview (first 200 characters).
2. WHEN a journal entry has a mood rating, THE Weekly_Review_System SHALL display the mood as a visual indicator on a 1-to-5 scale.
3. WHEN journal entries exist for the selected week, THE Weekly_Review_System SHALL compute and display the average mood rating for the week.
4. IF no journal entries exist for the selected week, THEN THE Weekly_Review_System SHALL display a prompt encouraging the user to write a journal entry.

### Requirement 7: Weekly Reflection Entry

**User Story:** As a user, I want to write a weekly reflection as part of my review, so that I can capture high-level thoughts about my week.

#### Acceptance Criteria

1. THE Weekly_Review_System SHALL provide a text input area for the user to write a Weekly_Reflection for the selected week.
2. THE Weekly_Review_System SHALL support markdown formatting in the Weekly_Reflection text input.
3. WHEN the user submits a Weekly_Reflection, THE Weekly_Review_System SHALL persist the reflection content associated with the selected Week_Identifier and user.
4. WHEN a Weekly_Reflection already exists for the selected week, THE Weekly_Review_System SHALL load and display the existing reflection content in the text input area for editing.
5. WHEN the user modifies an existing Weekly_Reflection, THE Weekly_Review_System SHALL update the persisted reflection with the new content.
6. THE Weekly_Review_System SHALL display a set of guided reflection prompts (e.g., "What went well this week?", "What could be improved?", "What are you grateful for?") above the text input area.

### Requirement 8: Focus Tasks for Next Week

**User Story:** As a user, I want to designate focus tasks for the upcoming week, so that I can prioritize what matters most.

#### Acceptance Criteria

1. THE Weekly_Review_System SHALL provide a section where the user can select existing tasks as Focus_Tasks for the week following the selected week.
2. WHEN the user selects a task as a Focus_Task, THE Weekly_Review_System SHALL persist the focus designation associated with the target Week_Identifier and the task.
3. THE Weekly_Review_System SHALL limit the number of Focus_Tasks per week to a maximum of 7 items.
4. WHEN the user removes a task from the Focus_Tasks list, THE Weekly_Review_System SHALL remove the focus designation for that task and week.
5. WHEN the Weekly Review page loads for a week that has Focus_Tasks set, THE Weekly_Review_System SHALL display the Focus_Tasks with their current status (Todo, InProgress, Done).
6. THE Weekly_Review_System SHALL allow the user to create a new task directly from the Focus_Tasks section and automatically designate the new task as a Focus_Task.

### Requirement 9: Weekly Statistics and Trends

**User Story:** As a user, I want to see visual statistics and trends for my week, so that I can quickly gauge my productivity.

#### Acceptance Criteria

1. WHEN a weekly summary is displayed, THE Weekly_Review_System SHALL render a bar chart showing the number of tasks completed per day within the selected Week_Boundary.
2. WHEN a weekly summary is displayed, THE Weekly_Review_System SHALL render a summary card showing the Completion_Rate compared to the previous week's Completion_Rate.
3. WHEN a weekly summary is displayed, THE Weekly_Review_System SHALL render a summary card showing the Habit_Adherence_Rate compared to the previous week's Habit_Adherence_Rate.
4. WHEN the current week's Completion_Rate or Habit_Adherence_Rate differs from the previous week, THE Weekly_Review_System SHALL display the difference as a percentage change with an upward or downward trend indicator.
5. WHEN a weekly summary is displayed, THE Weekly_Review_System SHALL show the total estimated minutes and total actual minutes for completed tasks, along with an efficiency ratio.

### Requirement 10: Weekly Review API Endpoint

**User Story:** As a developer, I want a dedicated API endpoint for weekly review data, so that the frontend can fetch all required data in a single request.

#### Acceptance Criteria

1. THE Weekly_Review_System SHALL expose a GET endpoint at `/users/{user_id}/weekly-review` that accepts a `week` query parameter in Week_Identifier format (e.g., "2025-W03").
2. WHEN the `week` parameter is omitted, THE Weekly_Review_System SHALL default to the current calendar week.
3. IF the `week` parameter is not in valid Week_Identifier format, THEN THE Weekly_Review_System SHALL return an HTTP 422 response with a descriptive validation error message.
4. THE Weekly_Review_System SHALL return the weekly summary data as a JSON object containing: task summary, habit summary, goal progress, journal entries, weekly reflection, focus tasks, and comparison statistics.

### Requirement 11: Weekly Reflection Persistence

**User Story:** As a developer, I want weekly reflections stored in the database, so that users can retrieve and edit past reflections.

#### Acceptance Criteria

1. THE Weekly_Review_System SHALL store Weekly_Reflections in a dedicated database table with columns for: user_id, week_identifier, content, created_at, and updated_at.
2. THE Weekly_Review_System SHALL expose a PUT endpoint at `/users/{user_id}/weekly-review/{week}/reflection` that accepts a JSON body with the reflection content.
3. WHEN a PUT request is received for a week that has no existing reflection, THE Weekly_Review_System SHALL create a new Weekly_Reflection record.
4. WHEN a PUT request is received for a week that has an existing reflection, THE Weekly_Review_System SHALL update the existing Weekly_Reflection record.
5. THE Weekly_Review_System SHALL enforce a unique constraint on the combination of user_id and week_identifier to prevent duplicate reflections.

### Requirement 12: Focus Task Persistence

**User Story:** As a developer, I want focus task designations stored in the database, so that they persist across sessions.

#### Acceptance Criteria

1. THE Weekly_Review_System SHALL store Focus_Task designations in a dedicated database table with columns for: user_id, task_id, week_identifier, and created_at.
2. THE Weekly_Review_System SHALL expose a POST endpoint at `/users/{user_id}/weekly-review/{week}/focus-tasks` that accepts a task_id to add a Focus_Task.
3. THE Weekly_Review_System SHALL expose a DELETE endpoint at `/users/{user_id}/weekly-review/{week}/focus-tasks/{task_id}` to remove a Focus_Task designation.
4. IF the user attempts to add more than 7 Focus_Tasks for a single week, THEN THE Weekly_Review_System SHALL return an HTTP 400 response with a message indicating the maximum limit has been reached.
5. IF the user attempts to add a Focus_Task with a task_id that does not exist, THEN THE Weekly_Review_System SHALL return an HTTP 404 response with a descriptive error message.
6. THE Weekly_Review_System SHALL enforce a unique constraint on the combination of user_id, task_id, and week_identifier to prevent duplicate focus designations.
