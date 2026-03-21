# Multi-Feature Implementation

## Feature 4: Label Renames
- [ ] Rename "Flexible (X/Y)" → "Daily", "Target (X days)" → "Target Days", "Period (Y days)" → "Total Days"

## Feature 1: PARA Tooltips
- [ ] Add PARA_DESCRIPTIONS constant and tooltips to GoalsPage category filter + modal

## Feature 2: Task Efficiency Carousel
- [ ] Backend: Add daily/monthly/annual breakdowns to dashboard stats
- [ ] Frontend: Replace KPI card with rotating carousel + circular progress

## Feature 3: X/Y in All Scheduled Types + Last Date
- [ ] Show X/Y inputs for ALL scheduled frequency types (not just custom)
- [ ] Add computed "Last Date" display for both modes

## Feature 5: Habit↔Task Sync
- [ ] DB migration: Add habit_id and task_type to tasks table
- [ ] Backend models + schemas update
- [ ] CRUD: sync_habit_tasks, auto-create/update/delete task on habit changes
- [ ] New sync endpoint
- [ ] Frontend: sync API call, Kanban badge, habit task completion
