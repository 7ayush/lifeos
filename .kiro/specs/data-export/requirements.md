# Requirements Document

## Introduction

The Data Export feature enables LifeOS users to export their productivity data (tasks, goals, habits, journal entries, and notes) in CSV or JSON format. Users can select which data types to include, optionally filter by date range, and download the resulting file directly from the browser. This supports data portability, backup, and external analysis workflows.

## Glossary

- **Export_Service**: The backend service responsible for querying user data, applying filters, and serializing the result into the requested format (CSV or JSON).
- **Export_Page**: The frontend page where users configure and initiate data exports.
- **Export_Format**: The file format for the exported data. Supported values: `csv`, `json`.
- **Data_Type**: A category of user data available for export. Supported values: `tasks`, `goals`, `habits`, `journal`, `notes`.
- **Date_Range_Filter**: An optional filter consisting of a start date and/or end date used to restrict exported records to a specific time window.
- **Export_Request**: A user-initiated request specifying the desired data types, export format, and optional date range filter.
- **Export_File**: The downloadable file produced by the Export_Service containing the requested data.

## Requirements

### Requirement 1: Export Data Types Selection

**User Story:** As a user, I want to choose which data types to include in my export, so that I only download the data I need.

#### Acceptance Criteria

1. THE Export_Page SHALL display selectable checkboxes for each Data_Type: `tasks`, `goals`, `habits`, `journal`, and `notes`.
2. THE Export_Page SHALL allow the user to select one or more Data_Type values in a single Export_Request.
3. WHEN the user has not selected any Data_Type, THE Export_Page SHALL disable the export action button.
4. THE Export_Page SHALL provide a "Select All" control that selects all five Data_Type checkboxes simultaneously.

### Requirement 2: Export Format Selection

**User Story:** As a user, I want to choose between CSV and JSON export formats, so that I can use the exported data in my preferred tools.

#### Acceptance Criteria

1. THE Export_Page SHALL display a format selector with two options: `csv` and `json`.
2. THE Export_Page SHALL default the format selector to `json`.
3. WHEN the user selects `json` as the Export_Format, THE Export_Service SHALL return a single JSON file containing all selected Data_Type collections as top-level keys.
4. WHEN the user selects `csv` as the Export_Format and selects multiple Data_Type values, THE Export_Service SHALL return a ZIP archive containing one CSV file per selected Data_Type.
5. WHEN the user selects `csv` as the Export_Format and selects exactly one Data_Type, THE Export_Service SHALL return a single CSV file for that Data_Type.

### Requirement 3: Date Range Filtering

**User Story:** As a user, I want to optionally filter my exported data by date range, so that I can export only the data from a specific time period.

#### Acceptance Criteria

1. THE Export_Page SHALL display optional start date and end date input fields for the Date_Range_Filter.
2. WHEN the user provides a start date, THE Export_Service SHALL include only records with a created date on or after the start date.
3. WHEN the user provides an end date, THE Export_Service SHALL include only records with a created date on or before the end date.
4. WHEN the user provides both a start date and an end date, THE Export_Service SHALL include only records with a created date within the inclusive range.
5. WHEN the user provides no Date_Range_Filter, THE Export_Service SHALL include all records for the selected Data_Type values.
6. IF the user provides a start date that is after the end date, THEN THE Export_Page SHALL display a validation error message and prevent the export.

### Requirement 4: Export API Endpoint

**User Story:** As a developer, I want a backend API endpoint that generates export files, so that the frontend can trigger data exports.

#### Acceptance Criteria

1. THE Export_Service SHALL expose a GET endpoint at `/api/export` that accepts query parameters for data types, format, start date, and end date.
2. THE Export_Service SHALL require user authentication for the export endpoint.
3. THE Export_Service SHALL return only data belonging to the authenticated user.
4. WHEN the export request specifies `json` format, THE Export_Service SHALL return a response with `Content-Type: application/json` and a `Content-Disposition` header indicating a file download.
5. WHEN the export request specifies `csv` format with multiple data types, THE Export_Service SHALL return a response with `Content-Type: application/zip` and a `Content-Disposition` header indicating a file download.
6. WHEN the export request specifies `csv` format with a single data type, THE Export_Service SHALL return a response with `Content-Type: text/csv` and a `Content-Disposition` header indicating a file download.
7. IF the export request contains no valid Data_Type values, THEN THE Export_Service SHALL return HTTP status 422 with a descriptive error message.

### Requirement 5: JSON Export Structure

**User Story:** As a user, I want my JSON export to be well-structured, so that I can easily parse and use the data programmatically.

#### Acceptance Criteria

1. THE Export_Service SHALL structure the JSON export with a top-level `metadata` object containing `exported_at` (ISO 8601 timestamp), `user_id`, and `format` fields.
2. THE Export_Service SHALL include each selected Data_Type as a top-level key in the JSON export, with its value being an array of records.
3. WHEN exporting tasks, THE Export_Service SHALL include for each task: `id`, `title`, `description`, `status`, `priority`, `energy_level`, `estimated_minutes`, `actual_minutes`, `target_date`, `created_at`, `task_type`, `subtasks` (as nested array), and `tags` (as array of tag names).
4. WHEN exporting goals, THE Export_Service SHALL include for each goal: `id`, `title`, `description`, `status`, `category`, `priority`, `target_date`, `created_at`, and `progress`.
5. WHEN exporting habits, THE Export_Service SHALL include for each habit: `id`, `title`, `target_x`, `target_y_days`, `start_date`, `current_streak`, `frequency_type`, `repeat_interval`, `repeat_days`, and `logs` (as nested array with `log_date` and `status`).
6. WHEN exporting journal entries, THE Export_Service SHALL include for each entry: `id`, `entry_date`, `content`, `mood`, and `created_at`.
7. WHEN exporting notes, THE Export_Service SHALL include for each note: `id`, `title`, `content`, `folder`, `created_at`, and `updated_at`.

### Requirement 6: CSV Export Structure

**User Story:** As a user, I want my CSV exports to have clear column headers, so that I can open them in spreadsheet applications.

#### Acceptance Criteria

1. THE Export_Service SHALL include a header row as the first row of each CSV file.
2. WHEN exporting tasks as CSV, THE Export_Service SHALL use columns: `id`, `title`, `description`, `status`, `priority`, `energy_level`, `estimated_minutes`, `actual_minutes`, `target_date`, `created_at`, `task_type`, `tags`.
3. WHEN exporting goals as CSV, THE Export_Service SHALL use columns: `id`, `title`, `description`, `status`, `category`, `priority`, `target_date`, `created_at`, `progress`.
4. WHEN exporting habits as CSV, THE Export_Service SHALL use columns: `id`, `title`, `target_x`, `target_y_days`, `start_date`, `current_streak`, `frequency_type`, `repeat_interval`, `repeat_days`.
5. WHEN exporting journal entries as CSV, THE Export_Service SHALL use columns: `id`, `entry_date`, `content`, `mood`, `created_at`.
6. WHEN exporting notes as CSV, THE Export_Service SHALL use columns: `id`, `title`, `content`, `folder`, `created_at`, `updated_at`.
7. THE Export_Service SHALL encode CSV files using UTF-8 encoding with a BOM (Byte Order Mark) for compatibility with spreadsheet applications.

### Requirement 7: File Download

**User Story:** As a user, I want to download the export file directly in my browser, so that I can save it to my local machine without extra steps.

#### Acceptance Criteria

1. WHEN the user initiates an export, THE Export_Page SHALL display a loading indicator until the download begins.
2. WHEN the Export_Service returns the Export_File, THE Export_Page SHALL trigger a browser file download automatically.
3. THE Export_Service SHALL name the downloaded file using the pattern `lifeos-export-{YYYY-MM-DD}.{ext}` where `{ext}` is `json`, `csv`, or `zip` depending on the Export_Format and number of selected Data_Type values.
4. IF the Export_Service returns an error, THEN THE Export_Page SHALL display the error message to the user and hide the loading indicator.

### Requirement 8: Export Page Navigation

**User Story:** As a user, I want to access the export feature easily, so that I can find it when I need to download my data.

#### Acceptance Criteria

1. THE Export_Page SHALL be accessible via the URL path `/export`.
2. THE Sidebar SHALL include a navigation link to the Export_Page with a descriptive label "Export Data" and an appropriate icon.
3. WHEN the user navigates to the Export_Page, THE Export_Page SHALL display the data type selection, format selection, optional date range filter, and an export action button.

### Requirement 9: Export Data Completeness

**User Story:** As a user, I want my export to contain all relevant records, so that I have a complete backup of my selected data.

#### Acceptance Criteria

1. WHEN exporting tasks, THE Export_Service SHALL include tasks of all statuses: `Todo`, `InProgress`, and `Done`.
2. WHEN exporting tasks, THE Export_Service SHALL include tasks of all task types: `manual`, `habit`, and `recurring`.
3. WHEN exporting goals, THE Export_Service SHALL include goals of all statuses: `Active`, `Completed`, and `Archived`.
4. WHEN exporting habits, THE Export_Service SHALL include all habit log entries associated with each exported habit.
5. WHEN exporting tasks with the JSON format, THE Export_Service SHALL include all subtasks nested within their parent task record.
