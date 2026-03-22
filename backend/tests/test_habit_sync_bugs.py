"""
Bug condition exploration tests for Habit-Task Sync.

These tests are EXPECTED TO FAIL on unfixed code — failure confirms the bugs exist.
DO NOT attempt to fix the test or the code when it fails.

**Validates: Requirements 1.1, 1.2, 1.4, 1.5, 1.6**
"""

import sys
import os
import datetime

import pytest
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import Base
from backend import models, crud, schemas

# Separate test database to avoid conflicts with test_main.py
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_bugs.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def setup_module(module):
    Base.metadata.create_all(bind=engine)


def teardown_module(module):
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_bugs.db"):
        os.remove("./test_bugs.db")


# ---------------------------------------------------------------------------
# Helper: create a fresh DB session for direct DB manipulation
# ---------------------------------------------------------------------------
def _get_db():
    return TestingSessionLocal()


def _create_user(db, username="bugtest_user", email=None):
    """Create a test user and return it."""
    if email is None:
        import uuid
        email = f"{username}_{uuid.uuid4().hex[:8]}@test.com"
    user = models.User(username=username, email=email, password_hash="hash")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_habit(db, user_id, title="Test Habit", frequency_type="daily",
                  start_date=None, goal_id=None):
    """Create a habit via crud (which auto-creates a linked task)."""
    if start_date is None:
        start_date = datetime.date.today()
    habit_data = schemas.HabitCreate(
        title=title,
        target_x=1,
        target_y_days=1,
        start_date=start_date,
        frequency_type=frequency_type,
        goal_id=goal_id,
    )
    return crud.create_user_habit(db, habit_data, user_id)


# ===========================================================================
# Bug 1 — Import Error: sync router uses absolute imports
# **Validates: Requirements 1.1**
# ===========================================================================
class TestBug1ImportError:
    """
    **Validates: Requirements 1.1**

    Test that `from backend.routers.sync import router` succeeds without
    ImportError. This will FAIL on unfixed code because sync.py uses
    `from database import get_db` and `import crud` instead of relative imports.
    """

    def test_sync_router_import_succeeds(self):
        """Importing the sync router should not raise ImportError."""
        try:
            from backend.routers.sync import router  # noqa: F401
            imported = True
        except ImportError:
            imported = False
        assert imported, (
            "Bug 1 confirmed: sync router raises ImportError due to absolute imports "
            "(from database import get_db / import crud)"
        )


# ===========================================================================
# Bug 2 — Stale Tasks: update_user_habit doesn't propagate changes
# **Validates: Requirements 1.2**
# ===========================================================================
class TestBug2StaleTasks:
    """
    **Validates: Requirements 1.2**

    Create a user, create a habit (which auto-generates a linked task),
    update the habit title, then assert all pending tasks have
    title == "🔁 {new_title}". This will FAIL on unfixed code because
    update_user_habit doesn't propagate changes.
    """

    @given(new_title=st.text(
        alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z")),
        min_size=1,
        max_size=50,
    ))
    @settings(
        max_examples=5,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_habit_update_propagates_to_pending_tasks(self, new_title):
        """After updating a habit title, all pending tasks should reflect the new title."""
        db = _get_db()
        try:
            user = _create_user(db)
            habit = _create_habit(db, user.id, title="Original Title")

            # Update the habit title
            update_data = schemas.HabitUpdate(title=new_title)
            crud.update_user_habit(db, habit.id, update_data)

            # Query all pending habit tasks for this habit
            pending_tasks = (
                db.query(models.Task)
                .filter(
                    models.Task.habit_id == habit.id,
                    models.Task.task_type == "habit",
                    models.Task.status != "Done",
                )
                .all()
            )

            expected_title = f"🔁 {new_title}"
            for task in pending_tasks:
                assert task.title == expected_title, (
                    f"Bug 2 confirmed: Pending task title is '{task.title}' "
                    f"but expected '{expected_title}' after habit update"
                )
        finally:
            db.close()


# ===========================================================================
# Bug 4 — Period-Unaware Sync (daily)
# **Validates: Requirements 1.4**
# ===========================================================================
class TestBug4DailySync:
    """
    **Validates: Requirements 1.4**

    Create a user with a daily habit, manually insert a habit task with
    target_date = yesterday, run sync_habit_tasks, assert a new task exists
    with target_date = today. This will FAIL because sync only checks if
    ANY task exists for the habit.
    """

    def test_daily_sync_creates_task_for_today(self):
        """sync_habit_tasks should create a new task for today even if yesterday's task exists."""
        db = _get_db()
        try:
            user = _create_user(db)
            today = datetime.date.today()
            yesterday = today - datetime.timedelta(days=1)

            # Create a daily habit — this auto-creates a task via create_user_habit
            habit = _create_habit(
                db, user.id, title="Daily Exercise",
                frequency_type="daily", start_date=yesterday,
            )

            # The auto-created task has target_date = start_date = yesterday.
            auto_task = (
                db.query(models.Task)
                .filter(
                    models.Task.habit_id == habit.id,
                    models.Task.task_type == "habit",
                )
                .first()
            )
            assert auto_task is not None, "Auto-created task should exist"
            assert auto_task.target_date == yesterday

            # Run sync — should create a NEW task for today
            crud.sync_habit_tasks(db, user.id)

            # Query tasks for today
            today_tasks = (
                db.query(models.Task)
                .filter(
                    models.Task.habit_id == habit.id,
                    models.Task.task_type == "habit",
                    models.Task.target_date == today,
                )
                .all()
            )

            assert len(today_tasks) >= 1, (
                "Bug 4 (daily) confirmed: sync_habit_tasks did not create a task "
                f"for today ({today}). It only checks if ANY task exists for the "
                "habit, ignoring the time period."
            )
        finally:
            db.close()


# ===========================================================================
# Bug 4 — Period-Unaware Sync (weekly)
# **Validates: Requirements 1.5**
# ===========================================================================
class TestBug4WeeklySync:
    """
    **Validates: Requirements 1.5**

    Create a weekly habit with a task from last week, run sync, assert a new
    task for this week. Will FAIL because sync only checks if ANY task exists.
    """

    def test_weekly_sync_creates_task_for_this_week(self):
        """sync_habit_tasks should create a new task for this week even if last week's task exists."""
        db = _get_db()
        try:
            user = _create_user(db)
            today = datetime.date.today()
            last_week = today - datetime.timedelta(days=7)

            # Create a weekly habit with start_date = last_week
            habit = _create_habit(
                db, user.id, title="Weekly Review",
                frequency_type="weekly", start_date=last_week,
            )

            # The auto-created task has target_date = last_week
            auto_task = (
                db.query(models.Task)
                .filter(
                    models.Task.habit_id == habit.id,
                    models.Task.task_type == "habit",
                )
                .first()
            )
            assert auto_task is not None, "Auto-created task should exist"

            # Run sync — should create a NEW task for this week
            crud.sync_habit_tasks(db, user.id)

            # Determine current week boundaries (Monday to Sunday)
            monday = today - datetime.timedelta(days=today.weekday())
            sunday = monday + datetime.timedelta(days=6)

            this_week_tasks = (
                db.query(models.Task)
                .filter(
                    models.Task.habit_id == habit.id,
                    models.Task.task_type == "habit",
                    models.Task.target_date >= monday,
                    models.Task.target_date <= sunday,
                )
                .all()
            )

            assert len(this_week_tasks) >= 1, (
                "Bug 4 (weekly) confirmed: sync_habit_tasks did not create a task "
                f"for this week ({monday} to {sunday}). It only checks if ANY task "
                "exists for the habit, ignoring the time period."
            )
        finally:
            db.close()


# ===========================================================================
# Bug 4 — Period-Unaware Sync (monthly)
# **Validates: Requirements 1.6**
# ===========================================================================
class TestBug4MonthlySync:
    """
    **Validates: Requirements 1.6**

    Create a monthly habit with a task from last month, run sync, assert a new
    task for this month. Will FAIL because sync only checks if ANY task exists.
    """

    def test_monthly_sync_creates_task_for_this_month(self):
        """sync_habit_tasks should create a new task for this month even if last month's task exists."""
        db = _get_db()
        try:
            user = _create_user(db)
            today = datetime.date.today()
            # Go back to last month
            if today.month == 1:
                last_month = today.replace(year=today.year - 1, month=12, day=1)
            else:
                last_month = today.replace(month=today.month - 1, day=1)

            # Create a monthly habit with start_date = last_month
            habit = _create_habit(
                db, user.id, title="Monthly Budget Review",
                frequency_type="monthly", start_date=last_month,
            )

            # The auto-created task has target_date = last_month
            auto_task = (
                db.query(models.Task)
                .filter(
                    models.Task.habit_id == habit.id,
                    models.Task.task_type == "habit",
                )
                .first()
            )
            assert auto_task is not None, "Auto-created task should exist"

            # Run sync — should create a NEW task for this month
            crud.sync_habit_tasks(db, user.id)

            # Determine current month boundaries
            first_of_month = today.replace(day=1)
            if today.month == 12:
                last_of_month = today.replace(year=today.year + 1, month=1, day=1) - datetime.timedelta(days=1)
            else:
                last_of_month = today.replace(month=today.month + 1, day=1) - datetime.timedelta(days=1)

            this_month_tasks = (
                db.query(models.Task)
                .filter(
                    models.Task.habit_id == habit.id,
                    models.Task.task_type == "habit",
                    models.Task.target_date >= first_of_month,
                    models.Task.target_date <= last_of_month,
                )
                .all()
            )

            assert len(this_month_tasks) >= 1, (
                "Bug 4 (monthly) confirmed: sync_habit_tasks did not create a task "
                f"for this month ({first_of_month} to {last_of_month}). It only checks "
                "if ANY task exists for the habit, ignoring the time period."
            )
        finally:
            db.close()
