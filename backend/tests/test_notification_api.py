"""
Unit/integration tests for notification API endpoints.
Tests CRUD endpoints, reminder config endpoints, cascade delete, and sync.
"""

import datetime
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.models import Base, User, Task, Notification, ReminderConfig
from backend.database import get_db
from backend.main import app


# ---------------------------------------------------------------------------
# Test DB setup — StaticPool ensures single connection for in-memory SQLite
# ---------------------------------------------------------------------------

@pytest.fixture
def test_db():
    """Create a fresh in-memory SQLite database for each test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    def _override():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = _override
    yield session
    session.close()
    app.dependency_overrides.clear()


@pytest.fixture
def db(test_db):
    return test_db


@pytest.fixture
def client(test_db):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def user(db):
    u = User(username="testuser", email="test@example.com")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def task_due_today(db, user):
    t = Task(user_id=user.id, title="Due Today Task", status="Todo", target_date=date.today())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@pytest.fixture
def task_overdue(db, user):
    t = Task(
        user_id=user.id, title="Overdue Task", status="InProgress",
        target_date=date.today() - timedelta(days=3),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@pytest.fixture
def notification(db, user, task_due_today):
    n = Notification(
        user_id=user.id, task_id=task_due_today.id,
        type="due_today", message="'Due Today Task' is due today",
        is_read=0, dismissed=0,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


# ===========================================================================
# Notification CRUD endpoint tests
# ===========================================================================

class TestListNotifications:
    def test_list_returns_non_dismissed(self, client, db, user, task_due_today):
        """GET /users/{id}/notifications returns only non-dismissed notifications."""
        n1 = Notification(
            user_id=user.id, task_id=task_due_today.id,
            type="due_today", message="Active", is_read=0, dismissed=0,
        )
        n2 = Notification(
            user_id=user.id, task_id=task_due_today.id,
            type="overdue", message="Dismissed", is_read=0, dismissed=1,
        )
        db.add_all([n1, n2])
        db.commit()

        resp = client.get(f"/users/{user.id}/notifications")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["message"] == "Active"

    def test_list_ordered_by_created_at_desc(self, client, db, user, task_due_today):
        """Notifications should be ordered by created_at descending."""
        n1 = Notification(
            user_id=user.id, task_id=task_due_today.id,
            type="due_today", message="Older", is_read=0, dismissed=0,
        )
        db.add(n1)
        db.commit()
        n1.created_at = datetime.datetime.utcnow() - timedelta(hours=2)
        db.commit()

        n2 = Notification(
            user_id=user.id, task_id=task_due_today.id,
            type="overdue", message="Newer", is_read=0, dismissed=0,
        )
        db.add(n2)
        db.commit()

        resp = client.get(f"/users/{user.id}/notifications")
        data = resp.json()
        assert len(data) == 2
        assert data[0]["message"] == "Newer"
        assert data[1]["message"] == "Older"


class TestMarkRead:
    def test_mark_single_read(self, client, notification, user):
        """PUT /users/{id}/notifications/{nid}/read marks one notification as read."""
        resp = client.put(f"/users/{user.id}/notifications/{notification.id}/read")
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_read"] is True

    def test_mark_read_not_found(self, client, user):
        """PUT with non-existent notification_id returns 404."""
        resp = client.put(f"/users/{user.id}/notifications/99999/read")
        assert resp.status_code == 404


class TestMarkAllRead:
    def test_mark_all_read(self, client, db, user, task_due_today):
        """PUT /users/{id}/notifications/read-all marks all as read."""
        for i in range(3):
            db.add(Notification(
                user_id=user.id, task_id=task_due_today.id,
                type="due_today", message=f"Notif {i}", is_read=0, dismissed=0,
            ))
        db.commit()

        resp = client.put(f"/users/{user.id}/notifications/read-all")
        assert resp.status_code == 200

        unread = db.query(Notification).filter(
            Notification.user_id == user.id, Notification.is_read == 0,
        ).count()
        assert unread == 0


class TestDismiss:
    def test_dismiss_notification(self, client, notification, user):
        """DELETE /users/{id}/notifications/{nid} sets dismissed=True."""
        resp = client.delete(f"/users/{user.id}/notifications/{notification.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["dismissed"] is True

    def test_dismiss_not_found(self, client, user):
        """DELETE with non-existent notification_id returns 404."""
        resp = client.delete(f"/users/{user.id}/notifications/99999")
        assert resp.status_code == 404


class TestUnreadCount:
    def test_unread_count(self, client, db, user, task_due_today):
        """GET /users/{id}/notifications/unread-count returns correct count."""
        db.add_all([
            Notification(user_id=user.id, task_id=task_due_today.id,
                         type="due_today", message="u1", is_read=0, dismissed=0),
            Notification(user_id=user.id, task_id=task_due_today.id,
                         type="overdue", message="u2", is_read=0, dismissed=0),
            Notification(user_id=user.id, task_id=task_due_today.id,
                         type="upcoming", message="r1", is_read=1, dismissed=0),
            Notification(user_id=user.id, task_id=task_due_today.id,
                         type="due_today", message="d1", is_read=0, dismissed=1),
        ])
        db.commit()

        resp = client.get(f"/users/{user.id}/notifications/unread-count")
        assert resp.status_code == 200
        assert resp.json()["count"] == 2


# ===========================================================================
# Reminder config endpoint tests
# ===========================================================================

class TestReminderConfig:
    def test_get_creates_default(self, client, user):
        """GET /users/{id}/reminder-config creates default config if none exists."""
        resp = client.get(f"/users/{user.id}/reminder-config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["remind_days_before"] == 1
        assert data["remind_on_due_date"] is True
        assert data["remind_when_overdue"] is True

    def test_update_config(self, client, user):
        """PUT /users/{id}/reminder-config updates and persists values."""
        resp = client.put(
            f"/users/{user.id}/reminder-config",
            json={"remind_days_before": 3, "remind_on_due_date": False},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["remind_days_before"] == 3
        assert data["remind_on_due_date"] is False
        assert data["remind_when_overdue"] is True

    def test_update_invalid_days_before(self, client, user):
        """PUT with invalid remind_days_before returns 422."""
        resp = client.put(
            f"/users/{user.id}/reminder-config",
            json={"remind_days_before": 4},
        )
        assert resp.status_code == 422


# ===========================================================================
# Cascade delete tests
# ===========================================================================

class TestCascadeDelete:
    def test_deleting_task_removes_notifications(self, client, db, user, task_due_today):
        """When a task is deleted, all its notifications should be cascade-deleted."""
        for ntype in ["due_today", "overdue"]:
            db.add(Notification(
                user_id=user.id, task_id=task_due_today.id,
                type=ntype, message=f"Test {ntype}", is_read=0, dismissed=0,
            ))
        db.commit()

        assert db.query(Notification).filter(
            Notification.task_id == task_due_today.id
        ).count() == 2

        resp = client.delete(f"/users/{user.id}/tasks/{task_due_today.id}")
        assert resp.status_code == 200

        # Expire cached objects so we re-query
        db.expire_all()
        remaining = db.query(Notification).filter(
            Notification.task_id == task_due_today.id
        ).count()
        assert remaining == 0


# ===========================================================================
# Sync endpoint tests
# ===========================================================================

class TestSyncEndpoint:
    def test_sync_returns_created_count(self, client, user, task_due_today):
        """POST /sync/notifications/{id} returns count of newly created notifications."""
        resp = client.post(f"/sync/notifications/{user.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "created" in data
        assert data["created"] >= 1

    def test_sync_idempotent(self, client, user, task_due_today):
        """Calling sync twice returns created=0 on the second call."""
        client.post(f"/sync/notifications/{user.id}")
        resp2 = client.post(f"/sync/notifications/{user.id}")
        assert resp2.json()["created"] == 0

    def test_sync_with_overdue_task(self, client, user, task_overdue):
        """Sync generates overdue notification for past-due tasks."""
        resp = client.post(f"/sync/notifications/{user.id}")
        assert resp.status_code == 200
        assert resp.json()["created"] >= 1

        notifications = client.get(f"/users/{user.id}/notifications").json()
        overdue_notifs = [n for n in notifications if n["type"] == "overdue"]
        assert len(overdue_notifs) >= 1
