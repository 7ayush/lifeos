"""Progress Engine — computes goal progress from linked tasks and habits."""

from __future__ import annotations

import datetime
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from . import models


def _habit_adherence_pct(db: Session, habit: "models.Habit") -> Optional[float]:
    """Compute a 0-100 adherence score for a habit based on its schedule.

    Returns None if the habit hasn't started yet (so it doesn't drag the goal
    down before the sprint begins) or if no adherence can be computed.

    Rules:
      • flexible:   done_count / expected_by_ratio, where
                    expected = (days_elapsed / target_y_days) * target_x
      • daily:      done_count_on_scheduled / scheduled_days_elapsed
                    (respects repeat_days if set; otherwise every day is scheduled)
      • weekly / custom:
                    same as daily, restricted to weekdays in repeat_days
      • monthly:    done_count / (distinct months elapsed)
      • annually:   done_count / max(1, years elapsed)
    """
    today = datetime.date.today()
    start = habit.start_date
    if start is None or today < start:
        return None  # habit hasn't started yet

    freq = (habit.frequency_type or "flexible").lower()

    done_count = (
        db.query(models.HabitLog)
        .filter(
            models.HabitLog.habit_id == habit.id,
            models.HabitLog.status == "Done",
        )
        .count()
    )

    # ----- flexible (legacy X in Y days system) -----
    if freq == "flexible":
        if not habit.target_y_days or habit.target_y_days <= 0:
            return None
        days_elapsed = (today - start).days + 1
        expected = (days_elapsed / habit.target_y_days) * (habit.target_x or 0)
        if expected <= 0:
            return None
        return min(done_count / expected, 1.0) * 100

    # Helper: enumerate dates from start to today
    def _dates_in_range():
        d = start
        while d <= today:
            yield d
            d += datetime.timedelta(days=1)

    # Helper: weekday set using 0=Sun..6=Sat convention
    def _scheduled_weekday_set():
        if not habit.repeat_days:
            return None  # all days scheduled
        try:
            return {int(x) for x in habit.repeat_days.split(",") if x.strip()}
        except ValueError:
            return None

    def _is_scheduled_weekday(d: datetime.date) -> bool:
        wset = _scheduled_weekday_set()
        if wset is None:
            return True
        our_weekday = (d.weekday() + 1) % 7  # Mon=0..Sun=6 -> Sun=0..Sat=6
        return our_weekday in wset

    # ----- daily / weekly / custom: count scheduled days in range -----
    if freq in ("daily", "weekly", "custom"):
        scheduled_days = sum(1 for d in _dates_in_range() if _is_scheduled_weekday(d))
        if scheduled_days <= 0:
            return None
        return min(done_count / scheduled_days, 1.0) * 100

    # ----- monthly: one expected per calendar month elapsed -----
    if freq == "monthly":
        months = (today.year - start.year) * 12 + (today.month - start.month) + 1
        if months <= 0:
            return None
        return min(done_count / months, 1.0) * 100

    # ----- annually -----
    if freq == "annually":
        years = max(1, today.year - start.year + 1)
        return min(done_count / years, 1.0) * 100

    # Unknown frequency — don't penalise
    return None


def compute_goal_progress(db: Session, goal_id: int) -> int:
    """Compute goal progress as integer 0-100.

    Weighted average of task completion ratio and habit adherence rate.
    Returns 0 when the goal has no linked tasks and no linked habits.
    Clamps result to 0-100 range.
    """
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if goal is None:
        return 0

    tasks = goal.tasks
    habits = goal.habits

    components: list[float] = []

    # Task completion ratio (manual + recurring instances; exclude habit-type
    # tasks since they're already counted via the habit adherence path below).
    countable_tasks = [t for t in tasks if t.task_type != "habit"]
    if countable_tasks:
        done_tasks = sum(1 for t in countable_tasks if t.status == "Done")
        components.append((done_tasks / len(countable_tasks)) * 100)

    # Habit adherence rate
    habit_scores: list[float] = []
    for h in habits:
        score = _habit_adherence_pct(db, h)
        if score is not None:
            habit_scores.append(score)

    if habit_scores:
        components.append(sum(habit_scores) / len(habit_scores))

    if not components:
        return 0

    progress = sum(components) / len(components)
    return int(round(max(0, min(progress, 100))))


def batch_compute_progress(db: Session, goal_ids: list[int]) -> dict[int, int]:
    """Compute progress for multiple goals in a single batch. Returns {goal_id: progress}."""
    if not goal_ids:
        return {}

    goals = (
        db.query(models.Goal)
        .options(joinedload(models.Goal.tasks), joinedload(models.Goal.habits))
        .filter(models.Goal.id.in_(goal_ids))
        .all()
    )

    result: dict[int, int] = {}
    for goal in goals:
        tasks = goal.tasks
        habits = goal.habits
        components: list[float] = []

        # Task completion ratio (exclude habit-type tasks to avoid double-counting)
        countable_tasks = [t for t in tasks if t.task_type != "habit"]
        if countable_tasks:
            done_tasks = sum(1 for t in countable_tasks if t.status == "Done")
            components.append((done_tasks / len(countable_tasks)) * 100)

        # Habit adherence rate
        habit_scores: list[float] = []
        for h in habits:
            score = _habit_adherence_pct(db, h)
            if score is not None:
                habit_scores.append(score)

        if habit_scores:
            components.append(sum(habit_scores) / len(habit_scores))

        if not components:
            result[goal.id] = 0
        else:
            progress = sum(components) / len(components)
            result[goal.id] = int(round(max(0, min(progress, 100))))

    return result


def _upsert_snapshot(db: Session, goal_id: int, progress: int) -> None:
    """Create or update today's ProgressSnapshot for the goal.

    Skips the upsert if the existing snapshot already has the same progress value.
    Requirements: 5.1, 5.2
    """
    today = datetime.date.today()
    existing = (
        db.query(models.ProgressSnapshot)
        .filter(
            models.ProgressSnapshot.goal_id == goal_id,
            models.ProgressSnapshot.date == today,
        )
        .first()
    )

    if existing is not None:
        if existing.progress == progress:
            return  # no change needed
        existing.progress = progress
    else:
        snapshot = models.ProgressSnapshot(
            goal_id=goal_id, date=today, progress=progress
        )
        db.add(snapshot)

    db.commit()

_MILESTONE_THRESHOLDS = {25, 50, 75, 100}


def _check_milestones(db: Session, goal_id: int, progress: int) -> None:
    """Record any newly crossed milestone thresholds (25, 50, 75, 100).

    Uses check-then-insert to avoid duplicates (unique constraint as safety net).
    Requirements: 6.1, 6.2, 6.4
    """
    for threshold in _MILESTONE_THRESHOLDS:
        if progress >= threshold:
            exists = (
                db.query(models.GoalMilestone)
                .filter(
                    models.GoalMilestone.goal_id == goal_id,
                    models.GoalMilestone.threshold == threshold,
                )
                .first()
            )
            if exists is None:
                milestone = models.GoalMilestone(
                    goal_id=goal_id, threshold=threshold
                )
                db.add(milestone)

    db.commit()


def _check_auto_complete(db: Session, goal_id: int) -> None:
    """Auto-set goal to Completed if all linked tasks are Done. Revert to Active if not.

    Never overrides "Archived" status.
    Requirements: 4.1, 4.2, 4.3, 4.4
    """
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if goal is None:
        return

    # Never override Archived status
    if goal.status == "Archived":
        return

    tasks = goal.tasks
    if not tasks:
        return

    all_done = all(t.status == "Done" for t in tasks)

    if all_done and goal.status != "Completed":
        goal.status = "Completed"
        db.commit()
    elif not all_done and goal.status == "Completed":
        goal.status = "Active"
        db.commit()

def recalculate_goal_progress(db: Session, goal_id: int) -> int:
    """Compute progress and trigger all side effects (snapshot, milestone, auto-complete).

    Returns the computed progress value.
    Requirements: 1.4, 4.4, 5.1, 6.2
    """
    progress = compute_goal_progress(db, goal_id)
    _upsert_snapshot(db, goal_id, progress)
    _check_milestones(db, goal_id, progress)
    _check_auto_complete(db, goal_id)
    return progress





