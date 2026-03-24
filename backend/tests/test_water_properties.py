"""
Property-based tests for Water Intake Tracker.

Feature: water-intake-tracker
"""

import sys
import os
import datetime
import uuid

import pytest
from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import Base
from backend import models, crud, schemas

# Separate test database to avoid conflicts
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_water_properties.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def setup_module(module):
    Base.metadata.create_all(bind=engine)


def teardown_module(module):
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_water_properties.db"):
        os.remove("./test_water_properties.db")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_db():
    return TestingSessionLocal()


def _create_user(db, username="water_user"):
    """Create a test user with a unique email."""
    email = f"{username}_{uuid.uuid4().hex[:8]}@test.com"
    user = models.User(username=username, email=email, password_hash="hash")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ===========================================================================
# Property 1 — Water entry creation preserves all required fields
# Feature: water-intake-tracker, Property 1: Water entry creation preserves all required fields
# **Validates: Requirements 1.1, 7.1, 10.1**
# ===========================================================================
class TestEntryCreationPreservesFields:
    """
    **Validates: Requirements 1.1, 7.1, 10.1**

    For any valid amount between 1 and 5000 ml, creating a Water_Entry should
    produce a record with a non-null user_id matching the authenticated user,
    the exact amount_ml submitted, and a non-null timestamp.
    """

    @given(amount=st.integers(min_value=1, max_value=5000))
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_entry_creation_preserves_required_fields(self, amount: int):
        # Feature: water-intake-tracker, Property 1: Water entry creation preserves all required fields
        db = _get_db()
        try:
            user = _create_user(db)
            entry_data = schemas.WaterEntryCreate(amount_ml=amount)
            entry = crud.create_water_entry(db, user.id, entry_data)

            assert entry.user_id is not None, "user_id should not be None"
            assert entry.user_id == user.id, (
                f"user_id should match authenticated user: expected {user.id}, got {entry.user_id}"
            )
            assert entry.amount_ml == amount, (
                f"amount_ml should match submitted value: expected {amount}, got {entry.amount_ml}"
            )
            assert entry.timestamp is not None, "timestamp should not be None"
            assert entry.id is not None, "entry id should not be None"
        finally:
            db.close()


# ===========================================================================
# Property 2 — Entry amount validation rejects out-of-range values
# Feature: water-intake-tracker, Property 2: Entry amount validation rejects out-of-range values
# **Validates: Requirements 1.2**
# ===========================================================================
class TestEntryAmountValidation:
    """
    **Validates: Requirements 1.2**

    For any integer amount less than 1 or greater than 5000, attempting to
    create a Water_Entry should be rejected with a validation error, and no
    entry should be persisted.
    """

    @given(
        amount=st.one_of(
            st.integers(max_value=0),
            st.integers(min_value=5001),
        )
    )
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_entry_amount_validation_rejects_out_of_range(self, amount: int):
        # Feature: water-intake-tracker, Property 2: Entry amount validation rejects out-of-range values
        db = _get_db()
        try:
            user = _create_user(db)

            # Count entries before
            before_count = (
                db.query(models.WaterEntry)
                .filter(models.WaterEntry.user_id == user.id)
                .count()
            )

            with pytest.raises(ValidationError):
                entry_data = schemas.WaterEntryCreate(amount_ml=amount)
                # If validation somehow passes, try to create (should not reach here)
                crud.create_water_entry(db, user.id, entry_data)

            # Verify no entry was persisted
            after_count = (
                db.query(models.WaterEntry)
                .filter(models.WaterEntry.user_id == user.id)
                .count()
            )
            assert after_count == before_count, (
                f"No entry should be persisted for invalid amount {amount}"
            )
        finally:
            db.close()


# ===========================================================================
# Property 3 — Goal amount validation rejects out-of-range values
# Feature: water-intake-tracker, Property 3: Goal amount validation rejects out-of-range values
# **Validates: Requirements 4.2**
# ===========================================================================
class TestGoalAmountValidation:
    """
    **Validates: Requirements 4.2**

    For any integer amount less than 500 or greater than 10000, attempting to
    set a Daily_Goal should be rejected with a validation error, and the
    existing goal should remain unchanged.
    """

    @given(
        amount=st.one_of(
            st.integers(max_value=499),
            st.integers(min_value=10001),
        )
    )
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_goal_amount_validation_rejects_out_of_range(self, amount: int):
        # Feature: water-intake-tracker, Property 3: Goal amount validation rejects out-of-range values
        db = _get_db()
        try:
            user = _create_user(db)

            # Set an initial valid goal
            initial_goal = crud.upsert_water_goal(db, user.id, 2000)
            initial_amount = initial_goal.amount_ml

            with pytest.raises(ValidationError):
                schemas.WaterGoalUpdate(amount_ml=amount)

            # Verify existing goal is unchanged
            current_goal = crud.get_water_goal(db, user.id)
            assert current_goal is not None, "Goal should still exist"
            assert current_goal.amount_ml == initial_amount, (
                f"Goal should remain unchanged at {initial_amount}, got {current_goal.amount_ml}"
            )
        finally:
            db.close()


# ===========================================================================
# Property 4 — Deleting an entry removes it from the database
# Feature: water-intake-tracker, Property 4: Deleting an entry removes it from the database
# **Validates: Requirements 3.1, 7.3**
# ===========================================================================
class TestDeleteEntryRemovesFromDB:
    """
    **Validates: Requirements 3.1, 7.3**

    For any Water_Entry that exists in the database, after deletion, querying
    for that entry should return no result, and the daily total for that date
    should decrease by the deleted entry's amount.
    """

    @given(amount=st.integers(min_value=1, max_value=5000))
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_delete_entry_removes_from_database(self, amount: int):
        # Feature: water-intake-tracker, Property 4: Deleting an entry removes it from the database
        db = _get_db()
        try:
            user = _create_user(db)
            entry_data = schemas.WaterEntryCreate(amount_ml=amount)
            entry = crud.create_water_entry(db, user.id, entry_data)
            entry_id = entry.id
            entry_date = entry.timestamp.date()

            # Get daily total before deletion
            progress_before = crud.get_daily_progress(db, user.id, entry_date, entry_date)
            total_before = progress_before[0].total_ml if progress_before else 0

            # Delete the entry
            result = crud.delete_water_entry(db, entry_id, user.id)
            assert result is True, "delete_water_entry should return True for owned entry"

            # Verify entry no longer exists
            deleted = (
                db.query(models.WaterEntry)
                .filter(models.WaterEntry.id == entry_id)
                .first()
            )
            assert deleted is None, f"Entry {entry_id} should not exist after deletion"

            # Verify daily total decreased by the deleted amount
            progress_after = crud.get_daily_progress(db, user.id, entry_date, entry_date)
            total_after = progress_after[0].total_ml if progress_after else 0
            assert total_before - total_after == amount, (
                f"Daily total should decrease by {amount}: was {total_before}, now {total_after}"
            )
        finally:
            db.close()


# ===========================================================================
# Property 5 — Entry access is scoped to the owning user
# Feature: water-intake-tracker, Property 5: Entry access is scoped to the owning user
# **Validates: Requirements 3.3, 10.3**
# ===========================================================================
class TestEntryAccessScopedToOwner:
    """
    **Validates: Requirements 3.3, 10.3**

    For any two distinct users A and B, Water_Entry records created by user A
    should never appear in query results for user B, and user B should receive
    a False result (403 at API level) when attempting to delete user A's entries.
    """

    @given(amount=st.integers(min_value=1, max_value=5000))
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_entry_access_scoped_to_owning_user(self, amount: int):
        # Feature: water-intake-tracker, Property 5: Entry access is scoped to the owning user
        db = _get_db()
        try:
            user_a = _create_user(db, username="user_a")
            user_b = _create_user(db, username="user_b")

            # User A creates an entry
            entry_data = schemas.WaterEntryCreate(amount_ml=amount)
            entry_a = crud.create_water_entry(db, user_a.id, entry_data)
            entry_date = entry_a.timestamp.date()

            # User B should not see user A's entries
            entries_b = crud.get_water_entries_by_date(db, user_b.id, entry_date)
            entry_ids_b = [e.id for e in entries_b]
            assert entry_a.id not in entry_ids_b, (
                f"User B should not see user A's entry {entry_a.id}"
            )

            # User B should not be able to delete user A's entry
            delete_result = crud.delete_water_entry(db, entry_a.id, user_b.id)
            assert delete_result is False, (
                "User B should not be able to delete user A's entry"
            )

            # Verify entry still exists for user A
            entry_still_exists = (
                db.query(models.WaterEntry)
                .filter(models.WaterEntry.id == entry_a.id)
                .first()
            )
            assert entry_still_exists is not None, (
                "User A's entry should still exist after user B's failed delete"
            )
        finally:
            db.close()


# ===========================================================================
# Property 6 — Goal set/get round trip
# Feature: water-intake-tracker, Property 6: Goal set/get round trip
# **Validates: Requirements 4.1, 7.5, 7.6**
# ===========================================================================
class TestGoalSetGetRoundTrip:
    """
    **Validates: Requirements 4.1, 7.5, 7.6**

    For any valid goal amount between 500 and 10000 ml, setting the Daily_Goal
    and then retrieving it should return the exact amount that was set.
    """

    @given(amount=st.integers(min_value=500, max_value=10000))
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_goal_set_get_round_trip(self, amount: int):
        # Feature: water-intake-tracker, Property 6: Goal set/get round trip
        db = _get_db()
        try:
            user = _create_user(db)

            # Set the goal
            crud.upsert_water_goal(db, user.id, amount)

            # Retrieve the goal
            goal = crud.get_water_goal(db, user.id)
            assert goal is not None, "Goal should exist after setting"
            assert goal.amount_ml == amount, (
                f"Goal should be {amount}, got {goal.amount_ml}"
            )
        finally:
            db.close()


# ===========================================================================
# Property 7 — Date filtering returns only records within the requested range
# Feature: water-intake-tracker, Property 7: Date filtering returns only records within the requested range
# **Validates: Requirements 7.2, 7.4**
# ===========================================================================
class TestDateFilteringReturnsCorrectRange:
    """
    **Validates: Requirements 7.2, 7.4**

    For any date range (start_date, end_date) and any set of Water_Entry
    records across multiple dates, querying entries or daily progress for that
    range should return only records whose date falls within
    [start_date, end_date] inclusive.
    """

    @given(
        data=st.data(),
        num_entries=st.integers(min_value=1, max_value=10),
    )
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_date_filtering_returns_only_records_in_range(self, data, num_entries: int):
        # Feature: water-intake-tracker, Property 7: Date filtering returns only records within the requested range
        db = _get_db()
        try:
            user = _create_user(db)

            # Generate random dates within a reasonable range
            base_date = datetime.date(2024, 6, 1)
            offsets = data.draw(
                st.lists(
                    st.integers(min_value=0, max_value=30),
                    min_size=num_entries,
                    max_size=num_entries,
                )
            )
            amounts = data.draw(
                st.lists(
                    st.integers(min_value=1, max_value=5000),
                    min_size=num_entries,
                    max_size=num_entries,
                )
            )

            # Create entries on various dates
            created_entries = []
            for offset, amount in zip(offsets, amounts):
                entry_date = base_date + datetime.timedelta(days=offset)
                entry_data = schemas.WaterEntryCreate(amount_ml=amount)
                entry = models.WaterEntry(
                    user_id=user.id,
                    amount_ml=amount,
                    timestamp=datetime.datetime.combine(
                        entry_date, datetime.time(12, 0)
                    ),
                )
                db.add(entry)
                created_entries.append((entry_date, amount))
            db.commit()

            # Draw a query range
            range_start_offset = data.draw(st.integers(min_value=0, max_value=30))
            range_end_offset = data.draw(
                st.integers(min_value=range_start_offset, max_value=30)
            )
            query_start = base_date + datetime.timedelta(days=range_start_offset)
            query_end = base_date + datetime.timedelta(days=range_end_offset)

            # Test get_water_entries_by_date for each date in range
            # (entries_by_date queries a single date, so test daily_progress for range)
            progress = crud.get_daily_progress(db, user.id, query_start, query_end)

            # All returned dates should be within the query range
            for p in progress:
                assert query_start <= p.date <= query_end, (
                    f"Returned date {p.date} is outside range [{query_start}, {query_end}]"
                )

            # Compute expected dates that should appear
            expected_dates = set()
            for entry_date, _ in created_entries:
                if query_start <= entry_date <= query_end:
                    expected_dates.add(entry_date)

            returned_dates = {p.date for p in progress}
            assert returned_dates == expected_dates, (
                f"Expected dates {expected_dates}, got {returned_dates}"
            )
        finally:
            db.close()


# ===========================================================================
# Property 8 — Daily progress total equals sum of individual entries
# Feature: water-intake-tracker, Property 8: Daily progress total equals sum of individual entries
# **Validates: Requirements 10.2**
# ===========================================================================
class TestDailyProgressTotalEqualsSum:
    """
    **Validates: Requirements 10.2**

    For any user and date with one or more Water_Entry records, the total_ml
    in the Daily_Progress response should equal the arithmetic sum of all
    individual Water_Entry amount_ml values for that user and date.
    """

    @given(
        amounts=st.lists(
            st.integers(min_value=1, max_value=5000),
            min_size=1,
            max_size=20,
        )
    )
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_daily_progress_total_equals_sum_of_entries(self, amounts):
        # Feature: water-intake-tracker, Property 8: Daily progress total equals sum of individual entries
        db = _get_db()
        try:
            user = _create_user(db)
            target_date = datetime.date(2024, 7, 15)

            # Create multiple entries for the same date
            for amount in amounts:
                entry_data = schemas.WaterEntryCreate(amount_ml=amount)
                entry = models.WaterEntry(
                    user_id=user.id,
                    amount_ml=amount,
                    timestamp=datetime.datetime.combine(
                        target_date, datetime.time(12, 0)
                    ),
                )
                db.add(entry)
            db.commit()

            # Get daily progress
            progress = crud.get_daily_progress(db, user.id, target_date, target_date)

            assert len(progress) == 1, (
                f"Expected exactly 1 progress record, got {len(progress)}"
            )
            assert progress[0].total_ml == sum(amounts), (
                f"total_ml should be {sum(amounts)}, got {progress[0].total_ml}"
            )
        finally:
            db.close()

# ===========================================================================
# Property 9 — All water endpoints require authentication
# Feature: water-intake-tracker, Property 9: All water endpoints require authentication
# **Validates: Requirements 7.7**
# ===========================================================================
class TestAllWaterEndpointsRequireAuth:
    """
    **Validates: Requirements 7.7**

    For any water API endpoint, a request without a valid JWT token should
    return a 401 Unauthorized response.
    """

    @staticmethod
    def _get_client():
        from fastapi.testclient import TestClient
        from backend.main import app
        from backend.database import get_db

        _engine = create_engine(
            "sqlite:///./test_water_auth_props.db",
            connect_args={"check_same_thread": False},
        )
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
        Base.metadata.create_all(bind=_engine)

        def _override_get_db():
            db = _SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = _override_get_db
        return TestClient(app, raise_server_exceptions=False), _engine

    @given(
        amount=st.integers(min_value=1, max_value=5000),
        entry_id=st.integers(min_value=1, max_value=10000),
    )
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_all_water_endpoints_require_authentication(self, amount: int, entry_id: int):
        # Feature: water-intake-tracker, Property 9: All water endpoints require authentication
        client, _engine = self._get_client()
        try:
            # All 6 water endpoints without auth headers should return 401/403
            endpoints = [
                ("POST", "/api/water/entries", {"json": {"amount_ml": amount}}),
                ("GET", "/api/water/entries", {"params": {"date": "2024-07-15"}}),
                ("DELETE", f"/api/water/entries/{entry_id}", {}),
                ("GET", "/api/water/progress", {"params": {"start_date": "2024-07-01", "end_date": "2024-07-15"}}),
                ("PUT", "/api/water/goal", {"json": {"amount_ml": 2000}}),
                ("GET", "/api/water/goal", {}),
            ]

            for method, path, kwargs in endpoints:
                response = getattr(client, method.lower())(path, **kwargs)
                assert response.status_code in (401, 403), (
                    f"{method} {path} should return 401/403 without auth, got {response.status_code}"
                )
        finally:
            from backend.main import app
            from backend.database import get_db
            app.dependency_overrides.pop(get_db, None)
            Base.metadata.drop_all(bind=_engine)
            if os.path.exists("./test_water_auth_props.db"):
                os.remove("./test_water_auth_props.db")

