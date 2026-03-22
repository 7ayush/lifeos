"""Tests for recurring task validation and template creation (Task 2)."""
import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app
from backend import models, crud, schemas

# In-memory SQLite for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_recurring_validation.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def user(db):
    u = models.User(username="recur_user", email="recur@test.com", password_hash="hash")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


# ============================
# validate_recurrence_config unit tests
# ============================

def test_validate_rejects_invalid_frequency_type():
    task = schemas.TaskCreate(
        title="Test", task_type="recurring", frequency_type="biweekly"
    )
    try:
        crud.validate_recurrence_config(task)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "frequency_type must be one of" in str(e)


def test_validate_rejects_weekly_without_repeat_days():
    task = schemas.TaskCreate(
        title="Test", task_type="recurring", frequency_type="weekly", repeat_days=None
    )
    try:
        crud.validate_recurrence_config(task)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "repeat_days is required" in str(e)


def test_validate_rejects_ends_on_without_date():
    task = schemas.TaskCreate(
        title="Test", task_type="recurring", frequency_type="daily",
        ends_type="on", ends_on_date=None
    )
    try:
        crud.validate_recurrence_config(task)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "ends_on_date is required" in str(e)


def test_validate_rejects_ends_after_without_occurrences():
    task = schemas.TaskCreate(
        title="Test", task_type="recurring", frequency_type="daily",
        ends_type="after", ends_after_occurrences=None
    )
    try:
        crud.validate_recurrence_config(task)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "ends_after_occurrences must be >= 1" in str(e)


def test_validate_rejects_ends_after_with_zero():
    task = schemas.TaskCreate(
        title="Test", task_type="recurring", frequency_type="daily",
        ends_type="after", ends_after_occurrences=0
    )
    try:
        crud.validate_recurrence_config(task)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "ends_after_occurrences must be >= 1" in str(e)


def test_validate_accepts_valid_daily():
    task = schemas.TaskCreate(
        title="Test", task_type="recurring", frequency_type="daily", ends_type="never"
    )
    crud.validate_recurrence_config(task)


def test_validate_accepts_valid_weekly():
    task = schemas.TaskCreate(
        title="Test", task_type="recurring", frequency_type="weekly", repeat_days="1,3,5"
    )
    crud.validate_recurrence_config(task)


# ============================
# API endpoint tests (422 on invalid config)
# ============================

def test_api_returns_422_for_invalid_frequency(user):
    response = client.post(
        f"/users/{user.id}/tasks/",
        json={"title": "Bad Task", "task_type": "recurring", "frequency_type": "biweekly"},
    )
    assert response.status_code == 422
    assert "frequency_type must be one of" in response.json()["detail"]


def test_api_returns_422_for_weekly_without_repeat_days(user):
    response = client.post(
        f"/users/{user.id}/tasks/",
        json={"title": "Bad Task", "task_type": "recurring", "frequency_type": "weekly"},
    )
    assert response.status_code == 422
    assert "repeat_days is required" in response.json()["detail"]


def test_api_returns_422_for_ends_on_without_date(user):
    response = client.post(
        f"/users/{user.id}/tasks/",
        json={
            "title": "Bad Task", "task_type": "recurring",
            "frequency_type": "daily", "ends_type": "on",
        },
    )
    assert response.status_code == 422
    assert "ends_on_date is required" in response.json()["detail"]


def test_api_creates_valid_recurring_template(user):
    response = client.post(
        f"/users/{user.id}/tasks/",
        json={
            "title": "Daily Standup",
            "task_type": "recurring",
            "frequency_type": "daily",
            "ends_type": "never",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["task_type"] == "recurring"
    assert data["frequency_type"] == "daily"
    assert data["title"] == "Daily Standup"


def test_api_creates_manual_task_without_validation(user):
    """Manual tasks should not trigger recurrence validation."""
    response = client.post(
        f"/users/{user.id}/tasks/",
        json={"title": "Normal Task"},
    )
    assert response.status_code == 200
    assert response.json()["task_type"] == "manual"


# ============================
# API endpoint tests for template update/delete (Task 5.3)
# ============================

def test_api_update_instance_recurrence_returns_400(db, user):
    """Updating recurrence fields on an instance returns 400."""
    resp = client.post(
        f"/users/{user.id}/tasks/",
        json={
            "title": "Daily Task",
            "task_type": "recurring",
            "frequency_type": "daily",
            "ends_type": "never",
        },
    )
    assert resp.status_code == 200
    template_id = resp.json()["id"]

    tasks_resp = client.get(f"/users/{user.id}/tasks/")
    instances = [t for t in tasks_resp.json() if t.get("parent_task_id") == template_id]
    assert len(instances) >= 1
    instance_id = instances[0]["id"]

    update_resp = client.put(
        f"/users/{user.id}/tasks/{instance_id}",
        json={"frequency_type": "weekly"},
    )
    assert update_resp.status_code == 400
    assert "Cannot modify recurrence config on a task instance" in update_resp.json()["detail"]


def test_api_update_template_recurrence_validates(db, user):
    """Updating template recurrence config with invalid data returns 422."""
    resp = client.post(
        f"/users/{user.id}/tasks/",
        json={
            "title": "Daily Task",
            "task_type": "recurring",
            "frequency_type": "daily",
            "ends_type": "never",
        },
    )
    assert resp.status_code == 200
    template_id = resp.json()["id"]

    update_resp = client.put(
        f"/users/{user.id}/tasks/{template_id}",
        json={"frequency_type": "weekly"},
    )
    assert update_resp.status_code == 422
    assert "repeat_days is required" in update_resp.json()["detail"]


def test_api_delete_template_cleans_up(db, user):
    """Deleting a template via API removes it and its Todo instances."""
    resp = client.post(
        f"/users/{user.id}/tasks/",
        json={
            "title": "Daily Task",
            "task_type": "recurring",
            "frequency_type": "daily",
            "ends_type": "never",
        },
    )
    assert resp.status_code == 200
    template_id = resp.json()["id"]

    del_resp = client.delete(f"/users/{user.id}/tasks/{template_id}")
    assert del_resp.status_code == 200

    tasks_resp = client.get(f"/users/{user.id}/tasks/")
    task_ids = [t["id"] for t in tasks_resp.json()]
    assert template_id not in task_ids
