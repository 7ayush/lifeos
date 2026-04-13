"""
Property-based tests for API Security Middleware.

Feature: api-security-middleware
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st

from backend.database import Base, get_db
from backend.auth import get_current_user
from backend import models
from backend.ownership import (
    _registry,
    register_ownership_checker,
    require_ownership,
)
from backend.routers import analytics as analytics_router


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_engine():
    """Create an in-memory SQLite engine with shared cache."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine


def _make_session_factory(engine):
    return sessionmaker(bind=engine)


def _build_app(session_factory, current_user):
    """Build a minimal FastAPI app with DB and auth overrides."""

    def override_db():
        s = session_factory()
        try:
            yield s
        finally:
            s.close()

    app = FastAPI()
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current_user

    @app.get("/users/{user_id}/tasks/{task_id}")
    def get_task(task_id: int, resource=Depends(require_ownership("task"))):
        return {"id": resource.id, "title": resource.title}

    return app


# ===========================================================================
# Property 1 — Ownership validation grants access iff requester is owner
# Feature: api-security-middleware, Property 1: Ownership validation grants access iff requester is owner
# **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.4, 3.1, 3.2**
# ===========================================================================
class TestOwnershipValidationProperty:
    """
    **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.4, 3.1, 3.2**

    For any resource and any pair of user IDs (requester, owner), the
    ownership checker SHALL grant access if and only if
    requester_id == owner_user_id. When they differ, the system SHALL
    raise a 403 error.
    """

    @pytest.fixture(autouse=True)
    def _save_registry(self):
        """Snapshot and restore the global registry around each test."""
        saved = dict(_registry)
        yield
        _registry.clear()
        _registry.update(saved)

    @given(
        owner_id=st.integers(min_value=1, max_value=1000),
        requester_id=st.integers(min_value=1, max_value=1000),
    )
    @settings(
        max_examples=200,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_ownership_grants_access_iff_requester_is_owner(
        self, owner_id: int, requester_id: int
    ):
        """
        Feature: api-security-middleware, Property 1: Ownership validation grants access iff requester is owner

        **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.4, 3.1, 3.2**

        Generate random (requester_id, owner_id) pairs, create a task owned
        by owner_id, and verify:
        - requester_id == owner_id  → HTTP 200
        - requester_id != owner_id  → HTTP 403
        """
        engine = _make_engine()
        session_factory = _make_session_factory(engine)
        session = session_factory()

        try:
            # Create the owner user
            owner_user = models.User(
                id=owner_id,
                username=f"owner_{owner_id}",
                email=f"owner_{owner_id}@test.com",
            )
            session.merge(owner_user)
            session.flush()

            # Create the requester user (may be the same as owner)
            requester_user = models.User(
                id=requester_id,
                username=f"requester_{requester_id}",
                email=f"requester_{requester_id}@test.com",
            )
            requester_user = session.merge(requester_user)
            session.flush()

            # Create a task owned by owner_id
            task = models.Task(
                id=1, user_id=owner_id, title="Property test task"
            )
            session.merge(task)
            session.commit()

            # Build app with requester as the authenticated user
            app = _build_app(session_factory, requester_user)
            client = TestClient(app, raise_server_exceptions=False)

            resp = client.get(f"/users/{requester_id}/tasks/1")

            if requester_id == owner_id:
                assert resp.status_code == 200, (
                    f"Expected 200 when requester ({requester_id}) == owner ({owner_id}), "
                    f"got {resp.status_code}: {resp.text}"
                )
                assert resp.json()["id"] == 1
            else:
                assert resp.status_code == 403, (
                    f"Expected 403 when requester ({requester_id}) != owner ({owner_id}), "
                    f"got {resp.status_code}: {resp.text}"
                )
                assert resp.json()["detail"] == "Not authorized"
        finally:
            session.close()
            Base.metadata.drop_all(bind=engine)
            engine.dispose()


# ===========================================================================
# Property 2 — Subtask path consistency rejects mismatched task IDs
# Feature: api-security-middleware, Property 2: Subtask path consistency rejects mismatched task IDs
# **Validates: Requirements 2.3, 2.5**
# ===========================================================================
class TestSubtaskPathConsistencyProperty:
    """
    **Validates: Requirements 2.3, 2.5**

    For any subtask with task_id = T and any URL path task_id = U,
    the ownership checker SHALL return the subtask only when T == U.
    When T != U, the system SHALL raise a 404 error.
    """

    @pytest.fixture(autouse=True)
    def _save_registry(self):
        """Snapshot and restore the global registry around each test."""
        saved = dict(_registry)
        yield
        _registry.clear()
        _registry.update(saved)

    @given(
        actual_task_id=st.integers(min_value=1, max_value=1000),
        url_task_id=st.integers(min_value=1, max_value=1000),
    )
    @settings(
        max_examples=200,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_subtask_path_consistency_rejects_mismatched_task_ids(
        self, actual_task_id: int, url_task_id: int
    ):
        """
        Feature: api-security-middleware, Property 2: Subtask path consistency rejects mismatched task IDs

        **Validates: Requirements 2.3, 2.5**

        Generate random (url_task_id, actual_task_id) pairs, create a task
        with actual_task_id and a subtask belonging to it, and verify:
        - url_task_id == actual_task_id  → HTTP 200
        - url_task_id != actual_task_id  → HTTP 404
        """
        engine = _make_engine()
        session_factory = _make_session_factory(engine)
        session = session_factory()

        try:
            # Create a single user who owns everything
            user = models.User(id=1, username="owner", email="owner@test.com")
            session.merge(user)
            session.flush()

            # Create the task with actual_task_id
            task = models.Task(
                id=actual_task_id,
                user_id=1,
                title=f"Task {actual_task_id}",
            )
            session.merge(task)
            session.flush()

            # If url_task_id differs, also create that task so the path
            # parameter is a valid integer (but the subtask doesn't belong to it)
            if url_task_id != actual_task_id:
                other_task = models.Task(
                    id=url_task_id,
                    user_id=1,
                    title=f"Task {url_task_id}",
                )
                session.merge(other_task)
                session.flush()

            # Create a subtask belonging to actual_task_id
            subtask = models.SubTask(
                id=1,
                task_id=actual_task_id,
                title="Test subtask",
            )
            session.merge(subtask)
            session.commit()

            # Build a minimal FastAPI app with the subtask ownership route
            def override_db():
                s = session_factory()
                try:
                    yield s
                finally:
                    s.close()

            app = FastAPI()
            app.dependency_overrides[get_db] = override_db
            app.dependency_overrides[get_current_user] = lambda: user

            @app.get(
                "/users/{user_id}/tasks/{task_id}/subtasks/{subtask_id}"
            )
            def get_subtask(
                subtask_id: int,
                resource=Depends(
                    require_ownership("subtask", error_detail="SubTask not found")
                ),
            ):
                return {"id": resource.id, "title": resource.title}

            client = TestClient(app, raise_server_exceptions=False)

            resp = client.get(
                f"/users/1/tasks/{url_task_id}/subtasks/1"
            )

            if url_task_id == actual_task_id:
                assert resp.status_code == 200, (
                    f"Expected 200 when url_task_id ({url_task_id}) == actual_task_id "
                    f"({actual_task_id}), got {resp.status_code}: {resp.text}"
                )
                assert resp.json()["id"] == 1
            else:
                assert resp.status_code == 404, (
                    f"Expected 404 when url_task_id ({url_task_id}) != actual_task_id "
                    f"({actual_task_id}), got {resp.status_code}: {resp.text}"
                )
                assert resp.json()["detail"] == "SubTask not found"
        finally:
            session.close()
            Base.metadata.drop_all(bind=engine)
            engine.dispose()


from backend.routers import users as users_router


# ===========================================================================
# Property 3 — Profile visibility round-trip
# Feature: api-security-middleware, Property 3: Profile visibility round-trip
# **Validates: Requirements 5.2, 5.3, 6.2**
# ===========================================================================
class TestProfileVisibilityRoundTripProperty:
    """
    **Validates: Requirements 5.2, 5.3, 6.2**

    For any valid visibility value ("public" or "private") and for any user,
    setting the user's profile_visibility to that value and then reading it
    back SHALL return the same value.
    """

    @given(
        visibility=st.sampled_from(["public", "private"]),
    )
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_profile_visibility_round_trip(self, visibility: str):
        """
        Feature: api-security-middleware, Property 3: Profile visibility round-trip

        **Validates: Requirements 5.2, 5.3, 6.2**

        Generate random valid visibility values (sampled from ["public", "private"]),
        create a user, set visibility via PUT, read back via GET, verify equality.
        """
        engine = _make_engine()
        session_factory = _make_session_factory(engine)
        session = session_factory()

        try:
            # Create a user
            user = models.User(
                id=1,
                username="vis_user",
                email="vis_user@test.com",
                profile_visibility="public",
                theme_preference="dark",
            )
            session.add(user)
            session.commit()
            user_id = user.id
            session.close()

            # Build a FastAPI app that includes the real users router.
            # The DB override yields a fresh session each time, and the
            # current_user override loads the user from that same session
            # so that db.refresh(current_user) works inside the endpoint.
            def override_db():
                s = session_factory()
                try:
                    yield s
                finally:
                    s.close()

            def override_current_user(db: Session = Depends(get_db)):
                return db.query(models.User).filter(
                    models.User.id == user_id
                ).first()

            app = FastAPI()
            app.dependency_overrides[get_db] = override_db
            app.dependency_overrides[get_current_user] = override_current_user
            app.include_router(users_router.router)

            client = TestClient(app, raise_server_exceptions=False)

            # PUT to set visibility
            put_resp = client.put(
                f"/users/{user_id}/settings/profile-visibility",
                json={"profile_visibility": visibility},
            )
            assert put_resp.status_code == 200, (
                f"PUT failed with {put_resp.status_code}: {put_resp.text}"
            )
            assert put_resp.json()["profile_visibility"] == visibility

            # GET to read back
            get_resp = client.get(f"/users/{user_id}/settings")
            assert get_resp.status_code == 200, (
                f"GET failed with {get_resp.status_code}: {get_resp.text}"
            )
            assert get_resp.json()["profile_visibility"] == visibility, (
                f"Round-trip mismatch: set '{visibility}', "
                f"got '{get_resp.json()['profile_visibility']}'"
            )
        finally:
            Base.metadata.drop_all(bind=engine)
            engine.dispose()


# ===========================================================================
# Property 4 — Invalid visibility values are rejected
# Feature: api-security-middleware, Property 4: Invalid visibility values are rejected
# **Validates: Requirements 5.4**
# ===========================================================================
class TestInvalidVisibilityRejectedProperty:
    """
    **Validates: Requirements 5.4**

    For any string that is not "public" or "private", submitting it as a
    profile_visibility update SHALL result in an HTTP 422 response.
    """

    @given(
        invalid_value=st.text().filter(lambda s: s not in ("public", "private")),
    )
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_invalid_visibility_values_are_rejected(self, invalid_value: str):
        """
        Feature: api-security-middleware, Property 4: Invalid visibility values are rejected

        **Validates: Requirements 5.4**

        Generate random strings (excluding "public" and "private"), create a
        user, call PUT /users/{user_id}/settings/profile-visibility with the
        invalid value, and assert HTTP 422 response.
        """
        engine = _make_engine()
        session_factory = _make_session_factory(engine)
        session = session_factory()

        try:
            # Create a user
            user = models.User(
                id=1,
                username="vis_user",
                email="vis_user@test.com",
                profile_visibility="public",
                theme_preference="dark",
            )
            session.add(user)
            session.commit()
            user_id = user.id
            session.close()

            # Build a FastAPI app that includes the real users router
            def override_db():
                s = session_factory()
                try:
                    yield s
                finally:
                    s.close()

            def override_current_user(db: Session = Depends(get_db)):
                return db.query(models.User).filter(
                    models.User.id == user_id
                ).first()

            app = FastAPI()
            app.dependency_overrides[get_db] = override_db
            app.dependency_overrides[get_current_user] = override_current_user
            app.include_router(users_router.router)

            client = TestClient(app, raise_server_exceptions=False)

            # PUT with the invalid visibility value
            resp = client.put(
                f"/users/{user_id}/settings/profile-visibility",
                json={"profile_visibility": invalid_value},
            )
            assert resp.status_code == 422, (
                f"Expected 422 for invalid visibility '{invalid_value!r}', "
                f"got {resp.status_code}: {resp.text}"
            )
        finally:
            Base.metadata.drop_all(bind=engine)
            engine.dispose()


# ---------------------------------------------------------------------------
# Strategy: generate a list of users with random visibility settings
# ---------------------------------------------------------------------------
_user_visibility_strategy = st.lists(
    st.sampled_from(["public", "private"]),
    min_size=1,
    max_size=15,
)


# ===========================================================================
# Property 5 — Leaderboard excludes private users
# Feature: api-security-middleware, Property 5: Leaderboard excludes private users
# **Validates: Requirements 7.1, 7.2, 7.3**
# ===========================================================================
class TestLeaderboardExcludesPrivateUsersProperty:
    """
    **Validates: Requirements 7.1, 7.2, 7.3**

    For any set of users with mixed profile_visibility settings, the
    leaderboard response SHALL contain only users whose
    profile_visibility is "public" (plus the authenticated user per
    Property 6, which is tested separately).
    """

    @given(
        visibilities=_user_visibility_strategy,
    )
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_leaderboard_excludes_private_users(self, visibilities: list):
        """
        Feature: api-security-middleware, Property 5: Leaderboard excludes private users

        **Validates: Requirements 7.1, 7.2, 7.3**

        Generate random sets of users with random visibility settings.
        Authenticate as a PUBLIC user. Call GET /analytics/leaderboard.
        Assert that all returned user_ids (except possibly the authenticated
        user) have profile_visibility == "public". Assert that NO private
        user (other than the authenticated user) appears in the results.
        """
        # Ensure at least one public user to authenticate as
        assume(any(v == "public" for v in visibilities))

        engine = _make_engine()
        session_factory = _make_session_factory(engine)
        session = session_factory()

        try:
            # Create users with the generated visibility settings
            users_created = []
            for idx, vis in enumerate(visibilities, start=1):
                user = models.User(
                    id=idx,
                    username=f"user_{idx}",
                    email=f"user_{idx}@test.com",
                    profile_visibility=vis,
                )
                session.add(user)
                users_created.append((idx, vis))
            session.commit()

            # Pick the first public user as the authenticated user
            auth_user_id = next(
                uid for uid, vis in users_created if vis == "public"
            )

            # Track which user IDs are public vs private
            public_user_ids = {
                uid for uid, vis in users_created if vis == "public"
            }
            private_user_ids = {
                uid for uid, vis in users_created if vis == "private"
            }

            # Build a FastAPI app with the analytics router
            def override_db():
                s = session_factory()
                try:
                    yield s
                finally:
                    s.close()

            def override_current_user(db: Session = Depends(get_db)):
                return (
                    db.query(models.User)
                    .filter(models.User.id == auth_user_id)
                    .first()
                )

            app = FastAPI()
            app.dependency_overrides[get_db] = override_db
            app.dependency_overrides[get_current_user] = override_current_user
            app.include_router(analytics_router.router)

            client = TestClient(app, raise_server_exceptions=False)

            resp = client.get("/analytics/leaderboard")
            assert resp.status_code == 200, (
                f"Expected 200, got {resp.status_code}: {resp.text}"
            )

            leaderboard = resp.json()
            returned_ids = {entry["user_id"] for entry in leaderboard}

            # All returned user_ids (except the auth user) must be public
            non_self_ids = returned_ids - {auth_user_id}
            for uid in non_self_ids:
                assert uid in public_user_ids, (
                    f"User {uid} appeared in leaderboard but is not public. "
                    f"Public IDs: {public_user_ids}, Private IDs: {private_user_ids}"
                )

            # No private user (other than the auth user) should appear
            private_in_results = private_user_ids & non_self_ids
            assert len(private_in_results) == 0, (
                f"Private users {private_in_results} appeared in leaderboard "
                f"(auth user: {auth_user_id})"
            )

            # All public users should appear in the leaderboard
            for uid in public_user_ids:
                assert uid in returned_ids, (
                    f"Public user {uid} missing from leaderboard. "
                    f"Returned IDs: {returned_ids}"
                )

        finally:
            session.close()
            Base.metadata.drop_all(bind=engine)
            engine.dispose()


# ===========================================================================
# Property 6 — Leaderboard always includes the authenticated user
# Feature: api-security-middleware, Property 6: Leaderboard always includes the authenticated user
# **Validates: Requirements 7.4**
# ===========================================================================
class TestLeaderboardAlwaysIncludesAuthUserProperty:
    """
    **Validates: Requirements 7.4**

    For any authenticated user, regardless of their profile_visibility
    setting ("public" or "private"), the leaderboard response SHALL
    include that user's entry.
    """

    @given(
        auth_visibility=st.sampled_from(["public", "private"]),
    )
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_leaderboard_always_includes_authenticated_user(
        self, auth_visibility: str
    ):
        """
        Feature: api-security-middleware, Property 6: Leaderboard always includes the authenticated user

        **Validates: Requirements 7.4**

        Generate a random visibility for the authenticated user (sampled from
        ["public", "private"]). Create the authenticated user and some other
        users. Call GET /analytics/leaderboard as the authenticated user.
        Assert that the authenticated user's user_id always appears in the
        leaderboard response, regardless of their visibility setting.
        """
        engine = _make_engine()
        session_factory = _make_session_factory(engine)
        session = session_factory()

        try:
            # Create the authenticated user with the generated visibility
            auth_user = models.User(
                id=1,
                username="auth_user",
                email="auth_user@test.com",
                profile_visibility=auth_visibility,
            )
            session.add(auth_user)

            # Create a few other users (mix of public/private)
            other_users = [
                models.User(
                    id=2,
                    username="other_public",
                    email="other_public@test.com",
                    profile_visibility="public",
                ),
                models.User(
                    id=3,
                    username="other_private",
                    email="other_private@test.com",
                    profile_visibility="private",
                ),
            ]
            for u in other_users:
                session.add(u)
            session.commit()

            auth_user_id = auth_user.id

            # Build a FastAPI app with the analytics router
            def override_db():
                s = session_factory()
                try:
                    yield s
                finally:
                    s.close()

            def override_current_user(db: Session = Depends(get_db)):
                return (
                    db.query(models.User)
                    .filter(models.User.id == auth_user_id)
                    .first()
                )

            app = FastAPI()
            app.dependency_overrides[get_db] = override_db
            app.dependency_overrides[get_current_user] = override_current_user
            app.include_router(analytics_router.router)

            client = TestClient(app, raise_server_exceptions=False)

            resp = client.get("/analytics/leaderboard")
            assert resp.status_code == 200, (
                f"Expected 200, got {resp.status_code}: {resp.text}"
            )

            leaderboard = resp.json()
            returned_ids = {entry["user_id"] for entry in leaderboard}

            # The authenticated user MUST always appear in the leaderboard
            assert auth_user_id in returned_ids, (
                f"Authenticated user (id={auth_user_id}, visibility={auth_visibility!r}) "
                f"missing from leaderboard. Returned IDs: {returned_ids}"
            )

        finally:
            session.close()
            Base.metadata.drop_all(bind=engine)
            engine.dispose()
