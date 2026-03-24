"""
Property-based tests for theme settings endpoints.

Feature: dark-light-mode
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from hypothesis import given, settings
from hypothesis import strategies as st

from backend.main import app
from backend.database import get_db, Base
from backend.models import User

# In-memory SQLite for isolation
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_theme_props.db"
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
client = TestClient(app)

_user_id = None


def setup_module(module):
    """Create tables and a test user once for the module."""
    global _user_id
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    user = User(username="theme_test_user", email="theme@test.com", password_hash="x")
    db.add(user)
    db.commit()
    db.refresh(user)
    _user_id = user.id
    db.close()


def teardown_module(module):
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("test_theme_props.db"):
        os.remove("test_theme_props.db")


class TestBackendSettingsRoundTrip:
    """Property 6: Backend settings round-trip

    **Validates: Requirements 4.2, 4.3**

    For any valid theme value, PATCH then GET should return the same value.
    """

    @given(theme=st.sampled_from(["dark", "light"]))
    @settings(max_examples=100)
    def test_patch_then_get_returns_same_theme(self, theme: str):
        """
        **Validates: Requirements 4.2, 4.3**

        For any valid theme value ("dark" or "light"), PATCHing the settings
        and then GETting them should return the same theme_preference.
        """
        # PATCH the theme
        patch_resp = client.patch(
            f"/users/{_user_id}/settings",
            json={"theme_preference": theme},
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["theme_preference"] == theme

        # GET the theme back
        get_resp = client.get(f"/users/{_user_id}/settings")
        assert get_resp.status_code == 200
        assert get_resp.json()["theme_preference"] == theme


class TestBackendThemeValidation:
    """Property 7: Backend theme_preference validation

    **Validates: Requirements 4.2**

    For any string that is not "dark" or "light", PATCHing the settings
    should return a 422 error and the stored preference should remain unchanged.
    """

    @given(
        invalid_theme=st.text().filter(lambda s: s not in ("dark", "light"))
    )
    @settings(max_examples=100)
    def test_invalid_theme_returns_422_and_preference_unchanged(self, invalid_theme: str):
        """
        **Validates: Requirements 4.2**

        For any string not in {"dark", "light"}, PATCH should return 422
        and the stored preference should remain unchanged.
        """
        # Record current preference
        before = client.get(f"/users/{_user_id}/settings")
        assert before.status_code == 200
        original_theme = before.json()["theme_preference"]

        # Attempt PATCH with invalid value
        patch_resp = client.patch(
            f"/users/{_user_id}/settings",
            json={"theme_preference": invalid_theme},
        )
        assert patch_resp.status_code == 422

        # Verify preference is unchanged
        after = client.get(f"/users/{_user_id}/settings")
        assert after.status_code == 200
        assert after.json()["theme_preference"] == original_theme
