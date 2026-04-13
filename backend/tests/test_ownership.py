"""Unit tests for backend/ownership.py — registry and require_ownership factory."""

import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.auth import get_current_user
from backend import models
from backend.ownership import (
    _registry,
    register_ownership_checker,
    require_ownership,
    _checker_wants_path_params,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _clean_registry():
    """Snapshot and restore the global registry around each test."""
    saved = dict(_registry)
    yield
    _registry.clear()
    _registry.update(saved)


@pytest.fixture()
def db_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session_factory(db_engine):
    return sessionmaker(bind=db_engine)


@pytest.fixture()
def db_session(db_session_factory):
    session = db_session_factory()
    yield session
    session.close()


@pytest.fixture()
def owner_user(db_session):
    user = models.User(id=1, username="owner", email="owner@test.com")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture()
def other_user(db_session):
    user = models.User(id=2, username="other", email="other@test.com")
    db_session.add(user)
    db_session.commit()
    return user


def _make_app(db_session_factory, current_user):
    """Build a tiny FastAPI app wired to the given session factory and user."""

    def override_db():
        s = db_session_factory()
        try:
            yield s
        finally:
            s.close()

    app = FastAPI()
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current_user
    return app


# ---------------------------------------------------------------------------
# Tests: register_ownership_checker
# ---------------------------------------------------------------------------

class TestRegisterOwnershipChecker:
    def test_registers_new_type(self):
        checker = lambda db, rid: (object(), 1)
        register_ownership_checker("widget", checker)
        assert "widget" in _registry
        assert _registry["widget"] is checker

    def test_overwrites_existing_type(self):
        first = lambda db, rid: None
        second = lambda db, rid: (object(), 2)
        register_ownership_checker("widget", first)
        register_ownership_checker("widget", second)
        assert _registry["widget"] is second

    def test_multiple_types_coexist(self):
        a = lambda db, rid: None
        b = lambda db, rid: None
        register_ownership_checker("alpha", a)
        register_ownership_checker("beta", b)
        assert _registry["alpha"] is a
        assert _registry["beta"] is b


# ---------------------------------------------------------------------------
# Tests: require_ownership dependency
# ---------------------------------------------------------------------------

class TestRequireOwnership:
    def test_returns_resource_when_owner_matches(
        self, db_session_factory, db_session, owner_user
    ):
        """Happy path: resource exists and belongs to the requester."""
        task = models.Task(id=10, user_id=owner_user.id, title="My task")
        db_session.add(task)
        db_session.commit()

        def task_checker(db, rid):
            t = db.query(models.Task).filter(models.Task.id == rid).first()
            return (t, t.user_id) if t else None

        register_ownership_checker("task", task_checker)

        app = _make_app(db_session_factory, owner_user)

        @app.get("/users/{user_id}/tasks/{task_id}")
        def get_task(task_id: int, resource=Depends(require_ownership("task"))):
            return {"id": resource.id, "title": resource.title}

        resp = TestClient(app).get("/users/1/tasks/10")
        assert resp.status_code == 200
        assert resp.json()["id"] == 10

    def test_returns_404_when_resource_missing(
        self, db_session_factory, owner_user
    ):
        """Resource doesn't exist → 404."""
        register_ownership_checker("task", lambda db, rid: None)

        app = _make_app(db_session_factory, owner_user)

        @app.get("/users/{user_id}/tasks/{task_id}")
        def get_task(task_id: int, resource=Depends(require_ownership("task"))):
            return {}

        resp = TestClient(app).get("/users/1/tasks/999")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Task not found"

    def test_returns_403_when_not_owner(
        self, db_session_factory, db_session, owner_user, other_user
    ):
        """Resource exists but belongs to someone else → 403."""
        task = models.Task(id=20, user_id=owner_user.id, title="Owner task")
        db_session.add(task)
        db_session.commit()

        def task_checker(db, rid):
            t = db.query(models.Task).filter(models.Task.id == rid).first()
            return (t, t.user_id) if t else None

        register_ownership_checker("task", task_checker)

        # Authenticate as *other_user*
        app = _make_app(db_session_factory, other_user)

        @app.get("/users/{user_id}/tasks/{task_id}")
        def get_task(task_id: int, resource=Depends(require_ownership("task"))):
            return {}

        resp = TestClient(app).get("/users/2/tasks/20")
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Not authorized"

    def test_custom_id_param(
        self, db_session_factory, db_session, owner_user
    ):
        """id_param override lets us use a non-default path param name."""
        task = models.Task(id=1, user_id=owner_user.id, title="t")
        db_session.add(task)
        db_session.flush()

        notif = models.Notification(
            id=5, user_id=owner_user.id, task_id=1,
            type="upcoming", message="test",
        )
        db_session.add(notif)
        db_session.commit()

        def notif_checker(db, rid):
            n = db.query(models.Notification).filter(
                models.Notification.id == rid
            ).first()
            return (n, n.user_id) if n else None

        register_ownership_checker("notification", notif_checker)

        app = _make_app(db_session_factory, owner_user)

        @app.get("/users/{user_id}/notifications/{nid}")
        def read_notif(
            nid: int,
            resource=Depends(require_ownership("notification", id_param="nid")),
        ):
            return {"id": resource.id}

        resp = TestClient(app).get("/users/1/notifications/5")
        assert resp.status_code == 200

    def test_custom_error_detail(self, db_session_factory, owner_user):
        """error_detail override appears in the 404 body."""
        register_ownership_checker("gadget", lambda db, rid: None)

        app = _make_app(db_session_factory, owner_user)

        @app.get("/gadgets/{gadget_id}")
        def get_gadget(
            gadget_id: int,
            resource=Depends(
                require_ownership("gadget", error_detail="Gadget vanished")
            ),
        ):
            return {}

        resp = TestClient(app).get("/gadgets/1")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Gadget vanished"

    def test_unregistered_type_returns_500(self, db_session_factory, owner_user):
        """Calling require_ownership for an unregistered type → 500."""
        app = _make_app(db_session_factory, owner_user)

        @app.get("/things/{thing_id}")
        def get_thing(
            thing_id: int, resource=Depends(require_ownership("thing"))
        ):
            return {}

        resp = TestClient(app).get("/things/1")
        assert resp.status_code == 500


# ---------------------------------------------------------------------------
# Tests: _checker_wants_path_params helper
# ---------------------------------------------------------------------------

class TestCheckerWantsPathParams:
    def test_simple_checker_returns_false(self):
        def simple(db, rid):
            return None
        assert _checker_wants_path_params(simple) is False

    def test_multi_param_checker_returns_true(self):
        def multi(db, rid, path_params):
            return None
        assert _checker_wants_path_params(multi) is True

    def test_lambda_two_args_returns_false(self):
        assert _checker_wants_path_params(lambda db, rid: None) is False


# ---------------------------------------------------------------------------
# Tests: subtask ownership checker
# ---------------------------------------------------------------------------

class TestSubtaskOwnershipChecker:
    """Tests for the subtask checker registered in ownership.py."""

    def test_subtask_found_with_matching_task_id(
        self, db_session_factory, db_session, owner_user
    ):
        """Subtask exists and task_id in path matches → 200 with subtask."""
        task = models.Task(id=100, user_id=owner_user.id, title="Parent")
        db_session.add(task)
        db_session.flush()
        subtask = models.SubTask(id=50, task_id=100, title="Child")
        db_session.add(subtask)
        db_session.commit()

        app = _make_app(db_session_factory, owner_user)

        @app.get("/users/{user_id}/tasks/{task_id}/subtasks/{subtask_id}")
        def get_subtask(
            subtask_id: int,
            resource=Depends(
                require_ownership("subtask", error_detail="SubTask not found")
            ),
        ):
            return {"id": resource.id, "title": resource.title}

        resp = TestClient(app).get("/users/1/tasks/100/subtasks/50")
        assert resp.status_code == 200
        assert resp.json()["id"] == 50

    def test_subtask_not_found_returns_404(
        self, db_session_factory, owner_user
    ):
        """Subtask ID doesn't exist → 404."""
        app = _make_app(db_session_factory, owner_user)

        @app.get("/users/{user_id}/tasks/{task_id}/subtasks/{subtask_id}")
        def get_subtask(
            subtask_id: int,
            resource=Depends(
                require_ownership("subtask", error_detail="SubTask not found")
            ),
        ):
            return {}

        resp = TestClient(app).get("/users/1/tasks/100/subtasks/999")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "SubTask not found"

    def test_subtask_task_id_mismatch_returns_404(
        self, db_session_factory, db_session, owner_user
    ):
        """Subtask exists but task_id in path doesn't match → 404."""
        task = models.Task(id=100, user_id=owner_user.id, title="Parent")
        db_session.add(task)
        db_session.flush()
        subtask = models.SubTask(id=50, task_id=100, title="Child")
        db_session.add(subtask)
        db_session.commit()

        app = _make_app(db_session_factory, owner_user)

        @app.get("/users/{user_id}/tasks/{task_id}/subtasks/{subtask_id}")
        def get_subtask(
            subtask_id: int,
            resource=Depends(
                require_ownership("subtask", error_detail="SubTask not found")
            ),
        ):
            return {}

        # task_id=999 doesn't match subtask.task_id=100
        resp = TestClient(app).get("/users/1/tasks/999/subtasks/50")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "SubTask not found"

    def test_subtask_wrong_owner_returns_403(
        self, db_session_factory, db_session, owner_user, other_user
    ):
        """Subtask's parent task belongs to another user → 403."""
        task = models.Task(id=100, user_id=owner_user.id, title="Owner task")
        db_session.add(task)
        db_session.flush()
        subtask = models.SubTask(id=50, task_id=100, title="Child")
        db_session.add(subtask)
        db_session.commit()

        # Authenticate as other_user
        app = _make_app(db_session_factory, other_user)

        @app.get("/users/{user_id}/tasks/{task_id}/subtasks/{subtask_id}")
        def get_subtask(
            subtask_id: int,
            resource=Depends(
                require_ownership("subtask", error_detail="SubTask not found")
            ),
        ):
            return {}

        resp = TestClient(app).get("/users/2/tasks/100/subtasks/50")
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Not authorized"
