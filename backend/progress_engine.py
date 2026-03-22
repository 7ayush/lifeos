"""Progress Engine — computes goal progress from linked tasks and habits."""

import datetime
from sqlalchemy.orm import Session, joinedload

from . import models


def compute_goal_progress(db: Session, goal_id: int) -> int:
    """Compute goal progress as integer 0-100.

    Weighted average of task completion ratio and habit success rate.
    Returns 0 when the goal has no linked tasks and no linked habits.
    Clamps result to 0-100 range.
    """
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if goal is None:
        return 0

    tasks = goal.tasks
    habits = goal.habits

    components: list[float] = []

    # Task completion ratio
    if tasks:
        done_tasks = sum(1 for t in tasks if t.status == "Done")
        components.append((done_tasks / len(tasks)) * 100)

    # Habit success rate
    habit_scores: list[float] = []
    for h in habits:
        # Guard against division by zero
        if not h.target_y_days or h.target_y_days <= 0:
            continue

        done_count = (
            db.query(models.HabitLog)
            .filter(
                models.HabitLog.habit_id == h.id,
                models.HabitLog.status == "Done",
            )
            .count()
        )

        days_elapsed = max(1, (datetime.date.today() - h.start_date).days + 1)
        expected = (days_elapsed / h.target_y_days) * h.target_x
        if expected > 0:
            habit_scores.append(min(done_count / expected, 1.0) * 100)

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

        # Task completion ratio
        if tasks:
            done_tasks = sum(1 for t in tasks if t.status == "Done")
            components.append((done_tasks / len(tasks)) * 100)

        # Habit success rate
        habit_scores: list[float] = []
        for h in habits:
            if not h.target_y_days or h.target_y_days <= 0:
                continue

            done_count = (
                db.query(models.HabitLog)
                .filter(
                    models.HabitLog.habit_id == h.id,
                    models.HabitLog.status == "Done",
                )
                .count()
            )

            days_elapsed = max(1, (datetime.date.today() - h.start_date).days + 1)
            expected = (days_elapsed / h.target_y_days) * h.target_x
            if expected > 0:
                habit_scores.append(min(done_count / expected, 1.0) * 100)

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





