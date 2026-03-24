"""
Unit tests for Water Intake Tracker API endpoints.

Requirements: 1.1, 1.2, 3.1, 3.3, 4.1, 4.2, 4.3, 7.1–7.7, 10.2
"""

import sys
import os
import uuid
from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app
from backend.database import get_db, Base
from backend.models import User, WaterEntry, WaterGoal
from backend.auth import create_access_token

# ---------------------------------------------------------------------------
# Test database setup
# ---------------------------------------------------------------------------
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_water_api.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app, raise_server_exceptions=False)


def setup_module(module):
    Base.metadata.create_all(bind=engine)


def teardown_module(module):
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)
    if os.path.exists("./test_water_api.db"):
        os.remove("./test_water_api.db")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _create_user(username="water_api_user"):
    db = TestingSessionLocal()
    email = f"{username}_{uuid.uuid4().hex[:8]}@test.com"
    user = User(username=username, email=email, password_hash="hash")
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _auth_header(user_id: int) -> dict:
    token = create_access_token(data={"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Entry CRUD tests (Requirements 1.1, 1.2, 7.1, 7.2, 7.3)
# ---------------------------------------------------------------------------
class TestCreateEntry:
    def test_create_entry_valid(self):
        """Create entry with valid amount returns 200 with correct fields."""
        user = _create_user("create_valid")
        headers = _auth_header(user.id)

        response = client.post(
            "/api/water/entries",
            json={"amount_ml": 500},
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["amount_ml"] == 500
        assert data["user_id"] == user.id
        assert "id" in data
        assert "timestamp" in data

    def test_create_entry_invalid_zero(self):
        """Create entry with amount 0 returns 422."""
        user = _create_user("create_zero")
        headers = _auth_header(user.id)

        response = client.post(
            "/api/water/entries",
            json={"amount_ml": 0},
            headers=headers,
        )
        assert response.status_code == 422

    def test_create_entry_invalid_too_large(self):
        """Create entry with amount > 5000 returns 422."""
        user = _create_user("create_large")
        headers = _auth_header(user.id)

        response = client.post(
            "/api/water/entries",
            json={"amount_ml": 5001},
            headers=headers,
        )
        assert response.status_code == 422


class TestGetEntries:
    def test_get_entries_by_date(self):
        """Get entries returns only entries for the requested date."""
        user = _create_user("get_entries")
        headers = _auth_header(user.id)
        today = date.today().isoformat()

        # Create two entries for today
        client.post("/api/water/entries", json={"amount_ml": 250}, headers=headers)
        client.post("/api/water/entries", json={"amount_ml": 750}, headers=headers)

        response = client.get(
            "/api/water/entries",
            params={"date": today},
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        amounts = {e["amount_ml"] for e in data}
        assert amounts == {250, 750}

    def test_get_entries_empty_date(self):
        """Get entries for a date with no entries returns empty list."""
        user = _create_user("get_empty")
        headers = _auth_header(user.id)

        response = client.get(
            "/api/water/entries",
            params={"date": "2020-01-01"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json() == []


class TestDeleteEntry:
    def test_delete_own_entry(self):
        """Delete own entry returns 200 and entry is removed."""
        user = _create_user("delete_own")
        headers = _auth_header(user.id)

        resp = client.post("/api/water/entries", json={"amount_ml": 300}, headers=headers)
        entry_id = resp.json()["id"]

        del_resp = client.delete(f"/api/water/entries/{entry_id}", headers=headers)
        assert del_resp.status_code == 200

        # Verify entry is gone
        today = date.today().isoformat()
        entries = client.get("/api/water/entries", params={"date": today}, headers=headers)
        ids = [e["id"] for e in entries.json()]
        assert entry_id not in ids

    def test_delete_nonexistent_entry(self):
        """Delete nonexistent entry returns 404."""
        user = _create_user("delete_404")
        headers = _auth_header(user.id)

        response = client.delete("/api/water/entries/999999", headers=headers)
        assert response.status_code == 404

    def test_delete_other_users_entry(self):
        """Delete another user's entry returns 403."""
        user_a = _create_user("owner_a")
        user_b = _create_user("thief_b")
        headers_a = _auth_header(user_a.id)
        headers_b = _auth_header(user_b.id)

        resp = client.post("/api/water/entries", json={"amount_ml": 400}, headers=headers_a)
        entry_id = resp.json()["id"]

        del_resp = client.delete(f"/api/water/entries/{entry_id}", headers=headers_b)
        assert del_resp.status_code == 403


# ---------------------------------------------------------------------------
# Goal management tests (Requirements 4.1, 4.2, 4.3, 7.5, 7.6)
# ---------------------------------------------------------------------------
class TestGoal:
    def test_set_goal(self):
        """Set goal returns 200 with the goal amount."""
        user = _create_user("set_goal")
        headers = _auth_header(user.id)

        response = client.put(
            "/api/water/goal",
            json={"amount_ml": 3000},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["amount_ml"] == 3000

    def test_get_goal_when_set(self):
        """Get goal returns the previously set value."""
        user = _create_user("get_goal_set")
        headers = _auth_header(user.id)

        client.put("/api/water/goal", json={"amount_ml": 2500}, headers=headers)
        response = client.get("/api/water/goal", headers=headers)
        assert response.status_code == 200
        assert response.json()["amount_ml"] == 2500

    def test_get_goal_default(self):
        """Get goal when not set returns default 2000 ml."""
        user = _create_user("get_goal_default")
        headers = _auth_header(user.id)

        response = client.get("/api/water/goal", headers=headers)
        assert response.status_code == 200
        assert response.json()["amount_ml"] == 2000

    def test_update_existing_goal(self):
        """Update an existing goal returns the new value."""
        user = _create_user("update_goal")
        headers = _auth_header(user.id)

        client.put("/api/water/goal", json={"amount_ml": 1500}, headers=headers)
        response = client.put("/api/water/goal", json={"amount_ml": 4000}, headers=headers)
        assert response.status_code == 200
        assert response.json()["amount_ml"] == 4000

        # Confirm via GET
        get_resp = client.get("/api/water/goal", headers=headers)
        assert get_resp.json()["amount_ml"] == 4000

    def test_set_goal_invalid_too_low(self):
        """Set goal with amount < 500 returns 422."""
        user = _create_user("goal_low")
        headers = _auth_header(user.id)

        response = client.put(
            "/api/water/goal",
            json={"amount_ml": 499},
            headers=headers,
        )
        assert response.status_code == 422

    def test_set_goal_invalid_too_high(self):
        """Set goal with amount > 10000 returns 422."""
        user = _create_user("goal_high")
        headers = _auth_header(user.id)

        response = client.put(
            "/api/water/goal",
            json={"amount_ml": 10001},
            headers=headers,
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Daily progress tests (Requirements 10.2, 7.4)
# ---------------------------------------------------------------------------
class TestDailyProgress:
    def test_progress_with_entries(self):
        """Daily progress returns correct totals for a date with entries."""
        user = _create_user("progress_entries")
        headers = _auth_header(user.id)
        today = date.today().isoformat()

        client.post("/api/water/entries", json={"amount_ml": 200}, headers=headers)
        client.post("/api/water/entries", json={"amount_ml": 300}, headers=headers)

        response = client.get(
            "/api/water/progress",
            params={"start_date": today, "end_date": today},
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["date"] == today
        assert data[0]["total_ml"] == 500
        assert data[0]["goal_ml"] == 2000  # default goal
        assert data[0]["percentage"] == 25.0

    def test_progress_no_entries(self):
        """Daily progress with no entries returns empty list."""
        user = _create_user("progress_empty")
        headers = _auth_header(user.id)

        response = client.get(
            "/api/water/progress",
            params={"start_date": "2020-01-01", "end_date": "2020-01-01"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_progress_across_date_range(self):
        """Daily progress across a date range returns correct dates."""
        user = _create_user("progress_range")
        headers = _auth_header(user.id)

        # Insert entries on two different dates via direct DB manipulation
        db = TestingSessionLocal()
        today = date.today()
        yesterday = today - timedelta(days=1)

        entry1 = WaterEntry(
            user_id=user.id,
            amount_ml=100,
            timestamp=datetime.combine(yesterday, datetime.min.time().replace(hour=10)),
        )
        entry2 = WaterEntry(
            user_id=user.id,
            amount_ml=400,
            timestamp=datetime.combine(today, datetime.min.time().replace(hour=12)),
        )
        db.add_all([entry1, entry2])
        db.commit()
        db.close()

        response = client.get(
            "/api/water/progress",
            params={
                "start_date": yesterday.isoformat(),
                "end_date": today.isoformat(),
            },
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        dates = {d["date"] for d in data}
        assert yesterday.isoformat() in dates
        assert today.isoformat() in dates
