"""Week Summary Engine — computes weekly review aggregations."""

import re
import datetime
from datetime import date


# ISO 8601 week identifier pattern: YYYY-Www where ww is 01–53
_WEEK_ID_RE = re.compile(r"^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$")


def get_week_boundaries(week_identifier: str) -> tuple[date, date]:
    """Parse an ISO 8601 week string and return (monday, sunday) dates.

    Args:
        week_identifier: Week string in "YYYY-Www" format (e.g. "2025-W03").

    Returns:
        Tuple of (monday, sunday) date objects for the given week.

    Raises:
        ValueError: If the week identifier does not match the expected format.
    """
    if not _WEEK_ID_RE.match(week_identifier):
        raise ValueError(
            f"Invalid week format: '{week_identifier}'. Expected YYYY-Www (e.g. 2025-W03)"
        )

    year_str, week_str = week_identifier.split("-W")
    year = int(year_str)
    week = int(week_str)

    monday = date.fromisocalendar(year, week, 1)
    sunday = monday + datetime.timedelta(days=6)
    return monday, sunday


def get_current_week_identifier() -> str:
    """Return the current week as an ISO 8601 week identifier string.

    Returns:
        String in "YYYY-Www" format (e.g. "2025-W03").
    """
    today = date.today()
    iso_year, iso_week, _ = today.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


def compute_task_summary(db, user_id: int, monday: date, sunday: date) -> dict:
    """Compute task summary for a given week.

    Queries tasks completed within the week boundary, groups them by day,
    and computes the completion rate.

    Args:
        db: SQLAlchemy Session.
        user_id: The user's ID.
        monday: Start of the week (Monday).
        sunday: End of the week (Sunday).

    Returns:
        Dict with completed_tasks (grouped by day), total_tasks,
        completed_task_count, and completion_rate.
    """
    from .models import Task, Goal

    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    # All tasks for this user
    all_tasks = db.query(Task).filter(Task.user_id == user_id).all()
    total_tasks = len(all_tasks)

    # Completed tasks within the week boundary
    # Use target_date if available, otherwise fall back to created_at date
    completed_in_week = []
    for task in all_tasks:
        if task.status != "Done":
            continue
        completed_date = task.target_date if task.target_date else task.created_at.date()
        if monday <= completed_date <= sunday:
            goal_title = None
            if task.goal_id:
                goal = db.query(Goal).filter(Goal.id == task.goal_id).first()
                if goal:
                    goal_title = goal.title
            completed_in_week.append({
                "id": task.id,
                "title": task.title,
                "priority": task.priority,
                "goal_title": goal_title,
                "completed_date": completed_date,
            })

    # Group by day of the week
    completed_tasks: dict[str, list[dict]] = {day: [] for day in day_names}
    for task_dict in completed_in_week:
        weekday_index = task_dict["completed_date"].weekday()  # 0=Mon, 6=Sun
        day_name = day_names[weekday_index]
        completed_tasks[day_name].append(task_dict)

    completed_task_count = len(completed_in_week)
    completion_rate = (completed_task_count / total_tasks * 100.0) if total_tasks > 0 else 0.0

    return {
        "completed_tasks": completed_tasks,
        "total_tasks": total_tasks,
        "completed_task_count": completed_task_count,
        "completion_rate": completion_rate,
    }

def compute_habit_summary(db, user_id: int, monday: date, sunday: date) -> dict:
    """Compute habit summary for a given week.

    Queries habit logs within the week boundary, computes adherence rate per
    habit, builds a day-by-day status grid, and includes current streak count.

    Args:
        db: SQLAlchemy Session.
        user_id: The user's ID.
        monday: Start of the week (Monday).
        sunday: End of the week (Sunday).

    Returns:
        Dict with habits (list of habit summary dicts) and
        overall_habit_adherence (float 0-100).
    """
    from .models import Habit, HabitLog

    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    # Map Python weekday (0=Mon..6=Sun) to repeat_days encoding (0=Sun..6=Sat)
    # repeat_days uses 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    # Python weekday uses 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
    # So python_weekday -> repeat_day: (python_weekday + 1) % 7
    # And repeat_day -> python_weekday: (repeat_day - 1) % 7

    habits = db.query(Habit).filter(Habit.user_id == user_id).all()

    habit_summaries = []

    for habit in habits:
        # Get logs for this habit within the week
        logs = (
            db.query(HabitLog)
            .filter(
                HabitLog.habit_id == habit.id,
                HabitLog.log_date >= monday,
                HabitLog.log_date <= sunday,
            )
            .all()
        )

        # Build a lookup: log_date -> status
        log_by_date: dict[date, str] = {}
        for log in logs:
            log_by_date[log.log_date] = log.status

        # Determine which days of the week this habit is expected
        if habit.frequency_type == "daily":
            expected_python_weekdays = set(range(7))  # All days
        elif habit.repeat_days:
            # repeat_days is comma-separated day numbers (0=Sun..6=Sat)
            repeat_day_nums = [int(d.strip()) for d in habit.repeat_days.split(",") if d.strip()]
            # Convert to Python weekdays (0=Mon..6=Sun)
            expected_python_weekdays = {(rd - 1) % 7 for rd in repeat_day_nums}
        else:
            # For weekly without repeat_days, or other types, expect all 7 days
            expected_python_weekdays = set(range(7))

        expected_completions = len(expected_python_weekdays)

        # Build day-by-day status grid and count done logs
        daily_status: dict[str, str] = {}
        done_count = 0

        for i in range(7):
            current_date = monday + datetime.timedelta(days=i)
            day_name = day_names[i]
            python_weekday = i  # 0=Mon..6=Sun

            if python_weekday not in expected_python_weekdays:
                daily_status[day_name] = "N/A"
            elif current_date in log_by_date and log_by_date[current_date] == "Done":
                daily_status[day_name] = "Done"
                done_count += 1
            else:
                daily_status[day_name] = "Missed"

        # Compute adherence rate
        adherence_rate = (done_count / expected_completions * 100.0) if expected_completions > 0 else 0.0

        habit_summaries.append({
            "habit_id": habit.id,
            "title": habit.title,
            "adherence_rate": adherence_rate,
            "current_streak": habit.current_streak,
            "daily_status": daily_status,
        })

    # Overall habit adherence: average of all habit adherence rates
    if habit_summaries:
        overall_habit_adherence = sum(h["adherence_rate"] for h in habit_summaries) / len(habit_summaries)
    else:
        overall_habit_adherence = 0.0

    return {
        "habits": habit_summaries,
        "overall_habit_adherence": overall_habit_adherence,
    }

def compute_goal_progress(db, user_id: int, monday: date, sunday: date) -> list[dict]:
    """Compute per-goal progress deltas for a given week.

    Queries ProgressSnapshot records to determine how much each goal's
    progress changed during the week.  Delta is computed as:
        latest snapshot on/before *sunday*  minus
        latest snapshot on/before *previous sunday*  (0 when no prior snapshot).

    Goals are sorted by priority: High → Medium → Low.

    Args:
        db: SQLAlchemy Session.
        user_id: The user's ID.
        monday: Start of the week (Monday).
        sunday: End of the week (Sunday).

    Returns:
        List of dicts, each containing goal_id, title, priority,
        current_progress, progress_delta, and target_date.
    """
    from .models import Goal, ProgressSnapshot

    priority_order = {"High": 0, "Medium": 1, "Low": 2}

    previous_sunday = monday - datetime.timedelta(days=1)

    goals = db.query(Goal).filter(
        Goal.user_id == user_id,
        Goal.status == "Active",
    ).all()

    results: list[dict] = []

    for goal in goals:
        # Latest snapshot on or before this sunday
        end_snapshot = (
            db.query(ProgressSnapshot)
            .filter(
                ProgressSnapshot.goal_id == goal.id,
                ProgressSnapshot.date <= sunday,
            )
            .order_by(ProgressSnapshot.date.desc())
            .first()
        )

        current_progress = end_snapshot.progress if end_snapshot else 0

        # Latest snapshot on or before previous sunday
        start_snapshot = (
            db.query(ProgressSnapshot)
            .filter(
                ProgressSnapshot.goal_id == goal.id,
                ProgressSnapshot.date <= previous_sunday,
            )
            .order_by(ProgressSnapshot.date.desc())
            .first()
        )

        start_progress = start_snapshot.progress if start_snapshot else 0

        progress_delta = current_progress - start_progress

        results.append({
            "goal_id": goal.id,
            "title": goal.title,
            "priority": goal.priority,
            "current_progress": current_progress,
            "progress_delta": progress_delta,
            "target_date": goal.target_date,
        })

    # Sort by priority: High first, then Medium, then Low
    results.sort(key=lambda g: priority_order.get(g["priority"], 3))

    return results

def compute_journal_summary(db, user_id: int, monday: date, sunday: date) -> dict:
    """Compute journal summary for a given week.

    Queries journal entries within the week boundary, computes average mood
    from non-null mood values, and truncates content previews to 200 chars.

    Args:
        db: SQLAlchemy Session.
        user_id: The user's ID.
        monday: Start of the week (Monday).
        sunday: End of the week (Sunday).

    Returns:
        Dict with journal_entries (list of dicts with id, entry_date, mood,
        content_preview) and average_mood (float or None).
    """
    from .models import JournalEntry

    entries = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.user_id == user_id,
            JournalEntry.entry_date >= monday,
            JournalEntry.entry_date <= sunday,
        )
        .order_by(JournalEntry.entry_date)
        .all()
    )

    journal_entries = []
    mood_values = []

    for entry in entries:
        content_preview = entry.content[:200] if entry.content else ""
        journal_entries.append({
            "id": entry.id,
            "entry_date": entry.entry_date,
            "mood": entry.mood,
            "content_preview": content_preview,
        })
        if entry.mood is not None:
            mood_values.append(entry.mood)

    average_mood = sum(mood_values) / len(mood_values) if mood_values else None

    return {
        "journal_entries": journal_entries,
        "average_mood": average_mood,
    }

def compute_statistics(db, user_id: int, monday: date, sunday: date) -> dict:
    """Compute weekly statistics including daily task counts, week-over-week
    comparison rates, and time tracking efficiency.

    Args:
        db: SQLAlchemy Session.
        user_id: The user's ID.
        monday: Start of the current week (Monday).
        sunday: End of the current week (Sunday).

    Returns:
        Dict with daily_task_counts, completion/habit rates for current and
        previous week, change percentages, and time tracking efficiency.
    """
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    # --- Current week task summary ---
    current_task = compute_task_summary(db, user_id, monday, sunday)
    current_completion_rate = current_task["completion_rate"]

    # Daily task completion counts (Mon–Sun)
    daily_task_counts = []
    for day in day_names:
        daily_task_counts.append({
            "day": day,
            "count": len(current_task["completed_tasks"].get(day, [])),
        })

    # --- Current week habit summary ---
    current_habit = compute_habit_summary(db, user_id, monday, sunday)
    current_habit_adherence = current_habit["overall_habit_adherence"]

    # --- Previous week boundaries ---
    prev_monday = monday - datetime.timedelta(days=7)
    prev_sunday = sunday - datetime.timedelta(days=7)

    # --- Previous week rates ---
    prev_task = compute_task_summary(db, user_id, prev_monday, prev_sunday)
    previous_completion_rate = prev_task["completion_rate"]

    prev_habit = compute_habit_summary(db, user_id, prev_monday, prev_sunday)
    previous_habit_adherence = prev_habit["overall_habit_adherence"]

    # --- Week-over-week change ---
    completion_rate_change = current_completion_rate - previous_completion_rate
    habit_adherence_rate_change = current_habit_adherence - previous_habit_adherence

    # --- Time tracking efficiency for completed tasks in current week ---
    from .models import Task

    all_tasks = db.query(Task).filter(Task.user_id == user_id).all()
    total_estimated = 0
    total_actual = 0
    for task in all_tasks:
        if task.status != "Done":
            continue
        completed_date = task.target_date if task.target_date else task.created_at.date()
        if monday <= completed_date <= sunday:
            total_estimated += task.estimated_minutes or 0
            total_actual += task.actual_minutes or 0

    efficiency_ratio = (total_actual / total_estimated) if total_estimated > 0 else 0.0

    return {
        "daily_task_counts": daily_task_counts,
        "completion_rate": current_completion_rate,
        "previous_completion_rate": previous_completion_rate,
        "completion_rate_change": completion_rate_change,
        "habit_adherence_rate": current_habit_adherence,
        "previous_habit_adherence_rate": previous_habit_adherence,
        "habit_adherence_rate_change": habit_adherence_rate_change,
        "total_estimated_minutes": total_estimated,
        "total_actual_minutes": total_actual,
        "efficiency_ratio": efficiency_ratio,
    }

def build_weekly_review(db, user_id: int, week_identifier: str) -> dict:
    """Orchestrate all compute functions and assemble the full weekly review.

    Calls each compute function, fetches the weekly reflection and focus tasks
    from the CRUD layer, and returns a dict matching the WeeklyReviewResponse
    schema.

    Args:
        db: SQLAlchemy Session.
        user_id: The user's ID.
        week_identifier: ISO 8601 week string (e.g. "2025-W03").

    Returns:
        Dict with all weekly review data ready for serialisation.
    """
    from .crud import get_weekly_reflection, get_focus_tasks

    monday, sunday = get_week_boundaries(week_identifier)

    task_summary = compute_task_summary(db, user_id, monday, sunday)
    habit_summary = compute_habit_summary(db, user_id, monday, sunday)
    goals = compute_goal_progress(db, user_id, monday, sunday)
    journal = compute_journal_summary(db, user_id, monday, sunday)
    statistics = compute_statistics(db, user_id, monday, sunday)

    # Reflection (may be None if user hasn't written one yet)
    reflection = get_weekly_reflection(db, user_id, week_identifier)

    # Focus tasks from CRUD layer
    focus_task_records = get_focus_tasks(db, user_id, week_identifier)
    focus_tasks = [
        {
            "id": ft.id,
            "user_id": ft.user_id,
            "task_id": ft.task_id,
            "week_identifier": ft.week_identifier,
            "task_title": ft.task.title,
            "task_status": ft.task.status,
            "task_priority": ft.task.priority,
            "created_at": ft.created_at,
        }
        for ft in focus_task_records
    ]

    return {
        "week_identifier": week_identifier,
        "week_start": monday,
        "week_end": sunday,
        # Task summary fields
        "completed_tasks": task_summary["completed_tasks"],
        "total_tasks": task_summary["total_tasks"],
        "completed_task_count": task_summary["completed_task_count"],
        "completion_rate": task_summary["completion_rate"],
        # Habit summary fields
        "habits": habit_summary["habits"],
        "overall_habit_adherence": habit_summary["overall_habit_adherence"],
        # Goal progress
        "goals": goals,
        # Journal summary fields
        "journal_entries": journal["journal_entries"],
        "average_mood": journal["average_mood"],
        # Reflection
        "reflection": reflection,
        # Focus tasks
        "focus_tasks": focus_tasks,
        # Statistics
        "daily_task_counts": statistics["daily_task_counts"],
        "comparison": {
            "completion_rate": statistics["completion_rate"],
            "previous_completion_rate": statistics["previous_completion_rate"],
            "completion_rate_change": statistics["completion_rate_change"],
            "habit_adherence_rate": statistics["habit_adherence_rate"],
            "previous_habit_adherence_rate": statistics["previous_habit_adherence_rate"],
            "habit_adherence_rate_change": statistics["habit_adherence_rate_change"],
            "total_estimated_minutes": statistics["total_estimated_minutes"],
            "total_actual_minutes": statistics["total_actual_minutes"],
            "efficiency_ratio": statistics["efficiency_ratio"],
        },
    }





