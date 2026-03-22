"""Tests for the recurring task sync engine and endpoint."""
import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app
from backend import models, crud, schemas

# In-memory SQLite for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_recurring_sync.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


@pytest.fixture
def db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def user(db):
    u = models.User(username="testuser", email="test@example.com", password_hash="hash")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _create_template(db, user_id, freq="daily", repeat_days=None, ends_type="never",
                      ends_on_date=None, ends_after_occurrences=None, repeat_interval=1,
                      title="Test Task"):
    template = models.Task(
        user_id=user_id,
        title=title,
        task_type="recurring",
        frequency_type=freq,
        repeat_interval=repeat_interval,
        repeat_days=repeat_days,
        ends_type=ends_type,
        ends_on_date=ends_on_date,
        ends_after_occurrences=ends_after_occurrences,
        status="Todo",
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


# ============================
# sync_recurring_tasks unit tests
# ============================

def test_sync_creates_daily_instance(db, user):
    _create_template(db, user.id, freq="daily", title="Daily Standup")
    result = crud.sync_recurring_tasks(db, user.id)
    assert result["created"] == 1
    assert result["active_templates"] == 1

    instances = db.query(models.Task).filter(
        models.Task.parent_task_id.isnot(None)
    ).all()
    assert len(instances) == 1
    assert instances[0].title == "Daily Standup"
    assert instances[0].status == "Todo"
    assert instances[0].target_date == datetime.date.today()


def test_sync_idempotent(db, user):
    """Running sync twice should not create duplicate instances."""
    _create_template(db, user.id, freq="daily")
    crud.sync_recurring_tasks(db, user.id)
    result = crud.sync_recurring_tasks(db, user.id)
    assert result["created"] == 0

    instances = db.query(models.Task).filter(
        models.Task.parent_task_id.isnot(None)
    ).all()
    assert len(instances) == 1


def test_sync_weekly_creates_instance(db, user):
    today = datetime.date.today()
    # Use today's weekday in 0=Sun convention: Python weekday 0=Mon -> 1, etc.
    today_sun_based = (today.weekday() + 1) % 7
    _create_template(db, user.id, freq="weekly", repeat_days=str(today_sun_based))
    result = crud.sync_recurring_tasks(db, user.id)
    assert result["created"] == 1
    assert result["active_templates"] == 1


def test_sync_monthly_creates_instance(db, user):
    _create_template(db, user.id, freq="monthly")
    result = crud.sync_recurring_tasks(db, user.id)
    assert result["created"] == 1
    assert result["active_templates"] == 1


def test_sync_annually_creates_instance(db, user):
    _create_template(db, user.id, freq="annually")
    result = crud.sync_recurring_tasks(db, user.id)
    assert result["created"] == 1
    assert result["active_templates"] == 1


def test_sync_respects_ends_on(db, user):
    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    _create_template(db, user.id, freq="daily", ends_type="on", ends_on_date=yesterday)
    result = crud.sync_recurring_tasks(db, user.id)
    assert result["created"] == 0
    assert result["active_templates"] == 0


def test_sync_respects_ends_after(db, user):
    template = _create_template(db, user.id, freq="daily", ends_type="after", ends_after_occurrences=1)
    # Manually create one instance to hit the limit
    instance = models.Task(
        user_id=user.id, title="Test Task", task_type="recurring",
        parent_task_id=template.id, status="Todo",
        target_date=datetime.date.today() - datetime.timedelta(days=1),
    )
    db.add(instance)
    db.commit()
    result = crud.sync_recurring_tasks(db, user.id)
    assert result["created"] == 0
    assert result["active_templates"] == 0


def test_sync_copies_template_fields(db, user):
    template = models.Task(
        user_id=user.id, title="Review", description="Weekly review",
        task_type="recurring", frequency_type="daily",
        energy_level="High", estimated_minutes=30,
        ends_type="never", status="Todo",
    )
    db.add(template)
    db.commit()
    db.refresh(template)

    crud.sync_recurring_tasks(db, user.id)
    instance = db.query(models.Task).filter(
        models.Task.parent_task_id == template.id
    ).first()
    assert instance.title == "Review"
    assert instance.description == "Weekly review"
    assert instance.energy_level == "High"
    assert instance.estimated_minutes == 30
    assert instance.status == "Todo"


def test_sync_repeat_interval_skips(db, user):
    """With repeat_interval=2 for daily, sync should skip odd days from creation."""
    template = _create_template(db, user.id, freq="daily", repeat_interval=2)
    # The template was just created (today), so days_elapsed=0, 0%2==0 -> should create
    result = crud.sync_recurring_tasks(db, user.id)
    assert result["created"] == 1


# ============================
# Sync endpoint tests
# ============================

def test_sync_endpoint_returns_response(user):
    resp = client.post(f"/sync/recurring-tasks/{user.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "created" in data
    assert "active_templates" in data


def test_sync_endpoint_creates_instances(db, user):
    _create_template(db, user.id, freq="daily", title="Endpoint Test")
    resp = client.post(f"/sync/recurring-tasks/{user.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["created"] == 1
    assert data["active_templates"] == 1


# ============================
# Template update tests (Task 5.1)
# ============================

def test_template_detail_update_propagates_to_todo_instances(db, user):
    """Updating template detail fields propagates to Todo instances."""
    template = _create_template(db, user.id, freq="daily", title="Old Title")
    crud.sync_recurring_tasks(db, user.id)

    # Verify instance exists
    instances = db.query(models.Task).filter(models.Task.parent_task_id == template.id).all()
    assert len(instances) == 1
    assert instances[0].title == "Old Title"

    # Update template title
    update = schemas.TaskUpdate(title="New Title", description="Updated desc")
    crud.update_task(db, template.id, update)

    # Verify propagation to Todo instance
    instances = db.query(models.Task).filter(models.Task.parent_task_id == template.id).all()
    assert len(instances) == 1
    assert instances[0].title == "New Title"
    assert instances[0].description == "Updated desc"


def test_template_detail_update_preserves_non_todo_instances(db, user):
    """InProgress/Done instances are not affected by detail updates."""
    template = _create_template(db, user.id, freq="daily", title="Old Title")
    crud.sync_recurring_tasks(db, user.id)

    # Mark instance as Done
    instance = db.query(models.Task).filter(models.Task.parent_task_id == template.id).first()
    instance.status = "Done"
    db.commit()

    # Update template title
    update = schemas.TaskUpdate(title="New Title")
    crud.update_task(db, template.id, update)

    # Done instance should keep old title
    db.refresh(instance)
    assert instance.title == "Old Title"
    assert instance.status == "Done"


def test_template_recurrence_config_update_regenerates(db, user):
    """Changing recurrence config deletes Todo instances and regenerates."""
    template = _create_template(db, user.id, freq="daily", title="Task")
    crud.sync_recurring_tasks(db, user.id)

    old_instances = db.query(models.Task).filter(models.Task.parent_task_id == template.id).all()
    assert len(old_instances) == 1

    # Change frequency to monthly
    update = schemas.TaskUpdate(frequency_type="monthly")
    crud.update_task(db, template.id, update)

    # Template should now have monthly frequency
    db.refresh(template)
    assert template.frequency_type == "monthly"

    # Should still have exactly one instance (old deleted, new created)
    new_instances = db.query(models.Task).filter(models.Task.parent_task_id == template.id).all()
    assert len(new_instances) == 1
    assert new_instances[0].status == "Todo"


def test_instance_blocks_recurrence_field_changes(db, user):
    """Updating recurrence fields on an instance raises ValueError."""
    template = _create_template(db, user.id, freq="daily", title="Task")
    crud.sync_recurring_tasks(db, user.id)

    instance = db.query(models.Task).filter(models.Task.parent_task_id == template.id).first()

    update = schemas.TaskUpdate(frequency_type="weekly")
    try:
        crud.update_task(db, instance.id, update)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "Cannot modify recurrence config on a task instance" in str(e)


def test_instance_allows_status_change(db, user):
    """Instances can have their status changed normally."""
    template = _create_template(db, user.id, freq="daily", title="Task")
    crud.sync_recurring_tasks(db, user.id)

    instance = db.query(models.Task).filter(models.Task.parent_task_id == template.id).first()
    update = schemas.TaskUpdate(status="Done")
    result = crud.update_task(db, instance.id, update)
    assert result.status == "Done"


# ============================
# Template deletion tests (Task 5.2)
# ============================

def test_template_deletion_removes_todo_instances(db, user):
    """Deleting a template removes all Todo instances."""
    template = _create_template(db, user.id, freq="daily", title="Task")
    crud.sync_recurring_tasks(db, user.id)

    instances_before = db.query(models.Task).filter(models.Task.parent_task_id == template.id).count()
    assert instances_before == 1

    crud.delete_task(db, template.id)

    # Template and Todo instances should be gone
    assert db.query(models.Task).filter(models.Task.id == template.id).first() is None
    remaining = db.query(models.Task).filter(models.Task.parent_task_id == template.id).count()
    assert remaining == 0


def test_template_deletion_orphans_done_instances(db, user):
    """Deleting a template orphans InProgress/Done instances."""
    template = _create_template(db, user.id, freq="daily", title="Task")
    crud.sync_recurring_tasks(db, user.id)

    # Mark instance as Done
    instance = db.query(models.Task).filter(models.Task.parent_task_id == template.id).first()
    instance.status = "Done"
    db.commit()
    instance_id = instance.id

    crud.delete_task(db, template.id)

    # Instance should still exist but be orphaned
    orphaned = db.query(models.Task).filter(models.Task.id == instance_id).first()
    assert orphaned is not None
    assert orphaned.parent_task_id is None
    assert orphaned.task_type == "manual"


# ============================
# Query filtering tests (Task 6.1)
# ============================

def test_get_user_tasks_excludes_templates(db, user):
    """Templates should not appear in get_user_tasks results."""
    template = _create_template(db, user.id, freq="daily", title="Template Task")
    crud.sync_recurring_tasks(db, user.id)

    tasks = crud.get_user_tasks(db, user.id)
    task_ids = [t.id for t in tasks]

    # Template should be excluded
    assert template.id not in task_ids
    # Instance should be included
    instance = db.query(models.Task).filter(models.Task.parent_task_id == template.id).first()
    assert instance.id in task_ids


def test_get_user_tasks_includes_manual_tasks(db, user):
    """Manual tasks should still appear in results."""
    manual = models.Task(user_id=user.id, title="Manual Task", task_type="manual", status="Todo")
    db.add(manual)
    db.commit()
    db.refresh(manual)

    tasks = crud.get_user_tasks(db, user.id)
    task_ids = [t.id for t in tasks]
    assert manual.id in task_ids


def test_get_user_tasks_includes_recurring_instances(db, user):
    """Recurring instances (with parent_task_id) should appear in results."""
    template = _create_template(db, user.id, freq="daily", title="Recurring")
    crud.sync_recurring_tasks(db, user.id)

    tasks = crud.get_user_tasks(db, user.id)
    recurring_tasks = [t for t in tasks if t.task_type == "recurring"]
    # All recurring tasks in the list should be instances (have parent_task_id)
    for t in recurring_tasks:
        assert t.parent_task_id is not None
