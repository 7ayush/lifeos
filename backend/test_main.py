from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.main import app
from backend.database import get_db, Base
from backend.models import User, Goal, Habit

# Setup in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def setup_module(module):
    Base.metadata.create_all(bind=engine)

def teardown_module(module):
    Base.metadata.drop_all(bind=engine)

def test_create_user():
    response = client.post(
        "/users/",
        json={"username": "testuser", "email": "test@example.com", "password": "password"},
    )
    assert response.status_code == 200
    assert response.json()["username"] == "testuser"
    assert response.json()["email"] == "test@example.com"

def test_create_goal():
    response = client.post(
        "/users/1/goals/",
        json={"title": "Test Goal", "description": "This is a test goal"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Test Goal"

def test_create_and_log_habit():
    # 1. Create a habit
    response = client.post(
        "/users/1/habits/",
        json={"title": "Test Habit", "target_x": 10, "target_y_days": 30, "start_date": "2025-01-01"},
    )
    assert response.status_code == 200
    habit_id = response.json()["id"]

    # 2. Log habit as "Done"
    response_log = client.post(
        f"/users/1/habits/{habit_id}/log?status=Done&log_date=2025-01-02",
    )
    assert response_log.status_code == 200
    assert response_log.json()["current_streak"] == 1

def test_get_leaderboard():
    response = client.get("/analytics/leaderboard")
    assert response.status_code == 200
    leaderboard = response.json()
    assert len(leaderboard) > 0
    # Our test user should be there
    assert leaderboard[0]["username"] == "testuser"
