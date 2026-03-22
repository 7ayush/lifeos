"""
Property-based tests for the notification engine.
Uses Hypothesis to verify correctness properties from the design document.
"""

import datetime
from contextlib import contextmanager
from datetime import date, timedelta

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base, User, Task, Notification, ReminderConfig
from backend import crud


# ---------------------------------------------------------------------------
# DB helper — context manager instead of fixture for Hypothesis compat
# ---------------------------------------------------------------------------

@contextmanager
def fresh_db():
    """Create a fresh in-memory SQLite database."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def _make_user(db, username="testuser"):
    user = User(username=username, email=f"{username}@test.com")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_task(db, user, title="Test Task", status="Todo", target_date=None):
    task = Task(user_id=user.id, title=title, status=status, target_date=target_date)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _make_config(db, user, days_before=1, on_due=1, when_overdue=1):
    config = ReminderConfig(
        user_id=user.id,
        remind_days_before=days_before,
        remind_on_due_date=on_due,
        remind_when_overdue=when_overdue,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def _make_notification(db, user, task, ntype="overdue", is_read=0, dismissed=0, created_at=None):
    n = Notification(
        user_id=user.id,
        task_id=task.id,
        type=ntype,
        message=f"Test notification for '{task.title}'",
        is_read=is_read,
        dismissed=dismissed,
    )
    db.add(n)
    db.commit()
    if created_at is not None:
        n.created_at = created_at
        db.commit()
    db.refresh(n)
    return n


# ---------------------------------------------------------------------------
# Hypothesis strategies
# ---------------------------------------------------------------------------

valid_statuses = st.sampled_from(["Todo", "InProgress", "Done"])
non_done_statuses = st.sampled_from(["Todo", "InProgress"])
valid_days_before = st.sampled_from([0, 1, 2, 3, 5, 7])
task_titles = st.text(
    min_size=1, max_size=50,
    alphabet=st.characters(whitelist_categories=("L", "N", "Z")),
)


# ---------------------------------------------------------------------------
# Property 6: Engine filters only eligible tasks
# Feature: due-date-reminders, Property 6: Engine filters only eligible tasks
# **Validates: Requirements 3.1, 3.7**
# ---------------------------------------------------------------------------

@given(
    status=valid_statuses,
    has_target_date=st.booleans(),
    days_before=valid_days_before,
)
@settings(max_examples=100)
def test_property6_engine_filters_eligible_tasks(status, has_target_date, days_before):
    """
    For any set of tasks, the engine should only generate notifications for tasks
    where target_date is not null AND status is not 'Done'.
    """
    with fresh_db() as db:
        user = _make_user(db)
        _make_config(db, user, days_before=days_before, on_due=1, when_overdue=1)

        today = date.today()
        target = today + timedelta(days=days_before) if has_target_date else None
        task = _make_task(db, user, title="FilterTest", status=status, target_date=target)

        crud.sync_notifications(db, user.id)

        notifications = db.query(Notification).filter(Notification.task_id == task.id).all()

        if status == "Done" or not has_target_date:
            assert len(notifications) == 0, (
                f"Should not create notifications for status={status}, "
                f"has_target_date={has_target_date}"
            )


# ---------------------------------------------------------------------------
# Property 7: Engine generates correct notification type
# Feature: due-date-reminders, Property 7: Engine generates correct notification type
# **Validates: Requirements 3.2, 3.3, 3.4**
# ---------------------------------------------------------------------------

@given(
    day_offset=st.integers(min_value=-30, max_value=30),
    days_before=valid_days_before,
    on_due=st.booleans(),
    when_overdue=st.booleans(),
)
@settings(max_examples=100)
def test_property7_engine_generates_correct_notification_type(
    day_offset, days_before, on_due, when_overdue
):
    """
    For any task with non-null target_date and status != 'Done', the engine
    should create the correct notification type based on config and date offset.
    """
    with fresh_db() as db:
        user = _make_user(db)
        _make_config(db, user, days_before=days_before, on_due=int(on_due), when_overdue=int(when_overdue))

        today = date.today()
        target = today + timedelta(days=day_offset)
        task = _make_task(db, user, title="TypeTest", status="Todo", target_date=target)

        crud.sync_notifications(db, user.id)

        notifications = db.query(Notification).filter(Notification.task_id == task.id).all()
        types_created = {n.type for n in notifications}

        expected = set()
        if days_before > 0 and day_offset == days_before:
            expected.add("upcoming")
        if on_due and day_offset == 0:
            expected.add("due_today")
        if when_overdue and day_offset < 0:
            expected.add("overdue")

        assert types_created == expected, (
            f"day_offset={day_offset}, days_before={days_before}, on_due={on_due}, "
            f"when_overdue={when_overdue}: expected {expected}, got {types_created}"
        )


# ---------------------------------------------------------------------------
# Property 8: Notification message includes task title
# Feature: due-date-reminders, Property 8: Notification message includes task title
# **Validates: Requirements 3.5**
# ---------------------------------------------------------------------------

@given(
    title=task_titles,
    day_offset=st.sampled_from([-5, -1, 0, 1, 3]),
)
@settings(max_examples=100)
def test_property8_notification_message_includes_task_title(title, day_offset):
    """
    For any notification generated by the engine, the message field should
    contain the title of the task it references.
    """
    assume(title.strip())

    with fresh_db() as db:
        user = _make_user(db)

        # Set days_before to match day_offset for upcoming, or 1 as default
        cfg_days = day_offset if day_offset > 0 else 1
        _make_config(db, user, days_before=cfg_days, on_due=1, when_overdue=1)

        today = date.today()
        target = today + timedelta(days=day_offset)
        task = _make_task(db, user, title=title, status="Todo", target_date=target)

        crud.sync_notifications(db, user.id)

        notifications = db.query(Notification).filter(Notification.task_id == task.id).all()

        for n in notifications:
            assert title in n.message, (
                f"Notification message '{n.message}' should contain task title '{title}'"
            )


# ---------------------------------------------------------------------------
# Property 9: Engine idempotence
# Feature: due-date-reminders, Property 9: Engine idempotence
# **Validates: Requirements 3.6, 4.2**
# ---------------------------------------------------------------------------

@given(
    day_offset=st.sampled_from([-3, -1, 0, 1, 2, 5]),
    days_before=valid_days_before,
)
@settings(max_examples=100)
def test_property9_engine_idempotence(day_offset, days_before):
    """
    Running the notification engine twice on the same day should produce the
    same set of notifications as running it once. The second run returns created: 0.
    """
    with fresh_db() as db:
        user = _make_user(db)
        _make_config(db, user, days_before=days_before, on_due=1, when_overdue=1)

        today = date.today()
        target = today + timedelta(days=day_offset)
        task = _make_task(db, user, title="IdempotenceTest", status="Todo", target_date=target)

        # First run
        result1 = crud.sync_notifications(db, user.id)
        count_after_first = db.query(Notification).filter(
            Notification.task_id == task.id
        ).count()

        # Second run
        result2 = crud.sync_notifications(db, user.id)
        count_after_second = db.query(Notification).filter(
            Notification.task_id == task.id
        ).count()

        assert count_after_second == count_after_first, (
            f"Second run changed notification count: {count_after_first} -> {count_after_second}"
        )
        assert result2["created"] == 0, (
            f"Second run should create 0 notifications, got {result2['created']}"
        )


# ---------------------------------------------------------------------------
# Property 15: Cleanup removes old dismissed notifications
# Feature: due-date-reminders, Property 15: Cleanup removes old dismissed notifications
# **Validates: Requirements 10.1**
# ---------------------------------------------------------------------------

@given(
    days_old=st.integers(min_value=1, max_value=90),
    is_dismissed=st.booleans(),
)
@settings(max_examples=100)
def test_property15_cleanup_removes_old_dismissed_notifications(days_old, is_dismissed):
    """
    After cleanup, no dismissed notification older than 30 days should remain.
    Non-dismissed or recent dismissed notifications should remain.
    """
    with fresh_db() as db:
        user = _make_user(db)
        task = _make_task(db, user, title="CleanupTest", status="Todo", target_date=date.today())

        created_at = datetime.datetime.utcnow() - timedelta(days=days_old)
        n = _make_notification(
            db, user, task,
            ntype="due_today",
            dismissed=int(is_dismissed),
            created_at=created_at,
        )
        notif_id = n.id

        crud.cleanup_notifications(db)

        remaining = db.query(Notification).filter(Notification.id == notif_id).first()

        if is_dismissed and days_old >= 30:
            # The cleanup uses `created_at < cutoff` where cutoff = now - 30 days.
            # Due to time elapsed between creating the notification and running cleanup,
            # notifications exactly 30 days old will also be deleted.
            assert remaining is None, (
                f"Dismissed notification {days_old} days old should be deleted"
            )
        else:
            assert remaining is not None, (
                f"Notification (dismissed={is_dismissed}, days_old={days_old}) should NOT be deleted"
            )


# ---------------------------------------------------------------------------
# Property 16: Cleanup removes read overdue for done tasks
# Feature: due-date-reminders, Property 16: Cleanup removes read overdue for done tasks
# **Validates: Requirements 10.2**
# ---------------------------------------------------------------------------

@given(
    task_status=valid_statuses,
    is_read=st.booleans(),
    ntype=st.sampled_from(["upcoming", "due_today", "overdue"]),
)
@settings(max_examples=100)
def test_property16_cleanup_removes_read_overdue_for_done_tasks(task_status, is_read, ntype):
    """
    After cleanup, no read 'overdue' notification for a Done task should remain.
    Other combinations should be unaffected.
    """
    with fresh_db() as db:
        user = _make_user(db)
        task = _make_task(
            db, user, title="CleanupDoneTest", status=task_status,
            target_date=date.today() - timedelta(days=5),
        )

        n = _make_notification(
            db, user, task,
            ntype=ntype,
            is_read=int(is_read),
            dismissed=0,
        )
        notif_id = n.id

        crud.cleanup_notifications(db)

        remaining = db.query(Notification).filter(Notification.id == notif_id).first()

        should_be_deleted = (task_status == "Done" and is_read and ntype == "overdue")

        if should_be_deleted:
            assert remaining is None, (
                f"Read overdue notification for Done task should be deleted"
            )
        else:
            assert remaining is not None, (
                f"Notification (status={task_status}, is_read={is_read}, type={ntype}) "
                f"should NOT be deleted"
            )
