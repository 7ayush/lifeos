"""Unit tests for backend.progress_engine.compute_goal_progress."""

import datetime
from contextlib import contextmanager

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base, User, Goal, Task, Habit, HabitLog
from backend.models import (
    Base, User, Goal, Task, Habit, HabitLog, ProgressSnapshot, GoalMilestone,
)
from backend.progress_engine import (
    compute_goal_progress,
    batch_compute_progress,
    _upsert_snapshot,
    _check_milestones,
    _check_auto_complete,
    recalculate_goal_progress,
)


# ---------------------------------------------------------------------------
# DB helper
# ---------------------------------------------------------------------------

@contextmanager
def fresh_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def _make_user(db):
    user = User(username="tester", email="tester@test.com")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_goal(db, user, status="Active"):
    goal = Goal(user_id=user.id, title="Test Goal", status=status)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def _make_task(db, user, goal, status="Todo"):
    task = Task(user_id=user.id, goal_id=goal.id, title="Task", status=status)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _make_habit(db, user, goal, target_x=1, target_y_days=1, start_date=None):
    if start_date is None:
        start_date = datetime.date.today()
    habit = Habit(
        user_id=user.id,
        goal_id=goal.id,
        title="Habit",
        target_x=target_x,
        target_y_days=target_y_days,
        start_date=start_date,
    )
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


def _make_habit_log(db, habit, status="Done", log_date=None):
    if log_date is None:
        log_date = datetime.date.today()
    log = HabitLog(habit_id=habit.id, status=status, log_date=log_date)
    db.add(log)
    db.commit()
    return log


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestComputeGoalProgress:
    """Tests for compute_goal_progress — Requirements 1.1, 1.2, 1.3."""

    def test_no_tasks_no_habits_returns_zero(self):
        """Goal with 0 tasks and 0 habits → progress is 0."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            assert compute_goal_progress(db, goal.id) == 0

    def test_nonexistent_goal_returns_zero(self):
        with fresh_db() as db:
            assert compute_goal_progress(db, 9999) == 0

    def test_tasks_only_all_done(self):
        """3 tasks all Done → 100."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            for _ in range(3):
                _make_task(db, user, goal, status="Done")
            assert compute_goal_progress(db, goal.id) == 100

    def test_tasks_only_partial(self):
        """3 tasks, 2 Done, 1 Todo → round(66.67) = 67."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _make_task(db, user, goal, status="Done")
            _make_task(db, user, goal, status="Done")
            _make_task(db, user, goal, status="Todo")
            assert compute_goal_progress(db, goal.id) == 67

    def test_tasks_only_none_done(self):
        """2 tasks, none Done → 0."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _make_task(db, user, goal, status="Todo")
            _make_task(db, user, goal, status="InProgress")
            assert compute_goal_progress(db, goal.id) == 0

    def test_habit_with_target_y_days_zero_skipped(self):
        """Habit with target_y_days=0 is excluded from average."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _make_habit(db, user, goal, target_x=1, target_y_days=0)
            # Only a bad habit, no tasks → should return 0
            assert compute_goal_progress(db, goal.id) == 0

    def test_habit_success_rate(self):
        """Single habit, started today, target 1 per 1 day, 1 done log → 100."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            habit = _make_habit(db, user, goal, target_x=1, target_y_days=1)
            _make_habit_log(db, habit, status="Done")
            assert compute_goal_progress(db, goal.id) == 100

    def test_weighted_average_tasks_and_habits(self):
        """Tasks 50% done + habit 100% done → average = 75."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _make_task(db, user, goal, status="Done")
            _make_task(db, user, goal, status="Todo")
            habit = _make_habit(db, user, goal, target_x=1, target_y_days=1)
            _make_habit_log(db, habit, status="Done")
            assert compute_goal_progress(db, goal.id) == 75

    def test_result_clamped_to_100(self):
        """Over-completion of habits should still clamp to 100."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            # Habit: target 1 per 7 days, started today, but 10 done logs
            habit = _make_habit(db, user, goal, target_x=1, target_y_days=7)
            for _ in range(10):
                _make_habit_log(db, habit, status="Done")
            progress = compute_goal_progress(db, goal.id)
            assert 0 <= progress <= 100


class TestBatchComputeProgress:
    """Tests for batch_compute_progress — Requirement 7.4."""

    def test_empty_input_returns_empty_dict(self):
        with fresh_db() as db:
            assert batch_compute_progress(db, []) == {}

    def test_single_goal_matches_individual(self):
        """Batch result for one goal matches compute_goal_progress."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _make_task(db, user, goal, status="Done")
            _make_task(db, user, goal, status="Todo")
            expected = compute_goal_progress(db, goal.id)
            result = batch_compute_progress(db, [goal.id])
            assert result == {goal.id: expected}

    def test_multiple_goals(self):
        """Batch computes progress for multiple goals correctly."""
        with fresh_db() as db:
            user = _make_user(db)
            g1 = _make_goal(db, user)
            g2 = _make_goal(db, user)
            # g1: 1/2 tasks done → 50
            _make_task(db, user, g1, status="Done")
            _make_task(db, user, g1, status="Todo")
            # g2: no tasks/habits → 0
            result = batch_compute_progress(db, [g1.id, g2.id])
            assert result[g1.id] == 50
            assert result[g2.id] == 0

    def test_nonexistent_goal_ids_omitted(self):
        """Goal IDs not in DB are simply absent from the result dict."""
        with fresh_db() as db:
            result = batch_compute_progress(db, [9999])
            assert result == {}

    def test_with_habits(self):
        """Batch correctly computes progress including habit success rate."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _make_task(db, user, goal, status="Done")
            _make_task(db, user, goal, status="Todo")
            habit = _make_habit(db, user, goal, target_x=1, target_y_days=1)
            _make_habit_log(db, habit, status="Done")
            # tasks 50% + habits 100% → average 75
            result = batch_compute_progress(db, [goal.id])
            assert result[goal.id] == 75


# ---------------------------------------------------------------------------
# Tests for _upsert_snapshot — Requirements 5.1, 5.2
# ---------------------------------------------------------------------------

class TestUpsertSnapshot:

    def test_creates_snapshot_for_new_day(self):
        """First call creates a new ProgressSnapshot for today."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _upsert_snapshot(db, goal.id, 42)
            snaps = db.query(ProgressSnapshot).filter_by(goal_id=goal.id).all()
            assert len(snaps) == 1
            assert snaps[0].progress == 42
            assert snaps[0].date == datetime.date.today()

    def test_updates_existing_snapshot_when_progress_changes(self):
        """Second call on same day updates the existing snapshot."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _upsert_snapshot(db, goal.id, 30)
            _upsert_snapshot(db, goal.id, 60)
            snaps = db.query(ProgressSnapshot).filter_by(goal_id=goal.id).all()
            assert len(snaps) == 1
            assert snaps[0].progress == 60

    def test_skips_when_progress_unchanged(self):
        """No write when progress hasn't changed from existing snapshot."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _upsert_snapshot(db, goal.id, 50)
            snap_before = db.query(ProgressSnapshot).filter_by(goal_id=goal.id).first()
            _upsert_snapshot(db, goal.id, 50)
            snap_after = db.query(ProgressSnapshot).filter_by(goal_id=goal.id).first()
            assert snap_before.id == snap_after.id
            assert snap_after.progress == 50


# ---------------------------------------------------------------------------
# Tests for _check_milestones — Requirements 6.1, 6.2, 6.4
# ---------------------------------------------------------------------------

class TestCheckMilestones:

    def test_records_milestone_at_25(self):
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _check_milestones(db, goal.id, 25)
            ms = db.query(GoalMilestone).filter_by(goal_id=goal.id).all()
            assert {m.threshold for m in ms} == {25}

    def test_records_multiple_milestones_at_100(self):
        """Progress at 100 should record all four thresholds."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _check_milestones(db, goal.id, 100)
            ms = db.query(GoalMilestone).filter_by(goal_id=goal.id).all()
            assert {m.threshold for m in ms} == {25, 50, 75, 100}

    def test_no_duplicate_milestones(self):
        """Calling twice with same progress doesn't create duplicates."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _check_milestones(db, goal.id, 50)
            _check_milestones(db, goal.id, 50)
            ms = db.query(GoalMilestone).filter_by(goal_id=goal.id).all()
            assert len(ms) == 2  # 25 and 50

    def test_no_milestones_at_zero(self):
        """Progress 0 records no milestones."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _check_milestones(db, goal.id, 0)
            ms = db.query(GoalMilestone).filter_by(goal_id=goal.id).all()
            assert len(ms) == 0

    def test_progressive_milestones(self):
        """Progress rising from 30 to 60 adds 50 milestone without duplicating 25."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _check_milestones(db, goal.id, 30)
            assert db.query(GoalMilestone).filter_by(goal_id=goal.id).count() == 1  # 25
            _check_milestones(db, goal.id, 60)
            ms = db.query(GoalMilestone).filter_by(goal_id=goal.id).all()
            assert {m.threshold for m in ms} == {25, 50}
            assert len(ms) == 2


# ---------------------------------------------------------------------------
# Tests for _check_auto_complete — Requirements 4.1, 4.2, 4.3, 4.4
# ---------------------------------------------------------------------------

class TestCheckAutoComplete:

    def test_auto_completes_when_all_tasks_done(self):
        """Goal with 1 task Done → auto-completes to Completed."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user, status="Active")
            _make_task(db, user, goal, status="Done")
            _check_auto_complete(db, goal.id)
            db.refresh(goal)
            assert goal.status == "Completed"

    def test_reverts_to_active_when_not_all_done(self):
        """Completed goal reverts to Active when a task is not Done."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user, status="Completed")
            _make_task(db, user, goal, status="Done")
            _make_task(db, user, goal, status="Todo")
            _check_auto_complete(db, goal.id)
            db.refresh(goal)
            assert goal.status == "Active"

    def test_archived_never_overridden(self):
        """Archived goal stays Archived even if all tasks are Done."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user, status="Archived")
            _make_task(db, user, goal, status="Done")
            _check_auto_complete(db, goal.id)
            db.refresh(goal)
            assert goal.status == "Archived"

    def test_no_tasks_no_change(self):
        """Goal with no tasks stays Active."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user, status="Active")
            _check_auto_complete(db, goal.id)
            db.refresh(goal)
            assert goal.status == "Active"

    def test_nonexistent_goal_no_error(self):
        """Calling with nonexistent goal_id doesn't raise."""
        with fresh_db() as db:
            _check_auto_complete(db, 9999)  # should not raise


# ---------------------------------------------------------------------------
# Tests for recalculate_goal_progress — Requirements 1.4, 4.4, 5.1, 6.2
# ---------------------------------------------------------------------------

class TestRecalculateGoalProgress:

    def test_returns_computed_progress(self):
        """Returns the progress value from compute_goal_progress."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _make_task(db, user, goal, status="Done")
            _make_task(db, user, goal, status="Todo")
            result = recalculate_goal_progress(db, goal.id)
            assert result == 50

    def test_creates_snapshot(self):
        """Recalculation creates a snapshot for today."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _make_task(db, user, goal, status="Done")
            recalculate_goal_progress(db, goal.id)
            snaps = db.query(ProgressSnapshot).filter_by(goal_id=goal.id).all()
            assert len(snaps) == 1
            assert snaps[0].progress == 100

    def test_records_milestones(self):
        """Recalculation at 100% records all milestones."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            _make_task(db, user, goal, status="Done")
            recalculate_goal_progress(db, goal.id)
            ms = db.query(GoalMilestone).filter_by(goal_id=goal.id).all()
            assert {m.threshold for m in ms} == {25, 50, 75, 100}

    def test_auto_completes_goal(self):
        """Recalculation auto-completes goal when all tasks Done."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user, status="Active")
            _make_task(db, user, goal, status="Done")
            recalculate_goal_progress(db, goal.id)
            db.refresh(goal)
            assert goal.status == "Completed"

    def test_zero_progress_goal(self):
        """Goal with no tasks/habits returns 0 and still creates snapshot."""
        with fresh_db() as db:
            user = _make_user(db)
            goal = _make_goal(db, user)
            result = recalculate_goal_progress(db, goal.id)
            assert result == 0
            snaps = db.query(ProgressSnapshot).filter_by(goal_id=goal.id).all()
            assert len(snaps) == 1
            assert snaps[0].progress == 0
