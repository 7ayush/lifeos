#!/usr/bin/env python3
"""
Integration test script for LifeOS security hardening.
Tests auth enforcement, IDOR protection, pagination caps, and input validation.
"""

import json
import requests

BASE = "http://127.0.0.1:8000"
PASS = "\033[92m✅ PASS\033[0m"
FAIL = "\033[91m❌ FAIL\033[0m"
results = {"pass": 0, "fail": 0}


def test(name, condition, detail=""):
    if condition:
        results["pass"] += 1
        print(f"  {PASS}  {name}")
    else:
        results["fail"] += 1
        print(f"  {FAIL}  {name}  — {detail}")


# ============================================================
# 1. Public root endpoint should work
# ============================================================
print("\n🔹 1. Public root endpoint")
r = requests.get(f"{BASE}/")
test("GET / returns 200", r.status_code == 200)
test("Returns welcome message", "Life OS" in r.json().get("message", ""))


# ============================================================
# 2. Auth flow — get a token via Google OAuth bypass
# ============================================================
print("\n🔹 2. Auth flow (Google OAuth bypass)")
r = requests.post(f"{BASE}/auth/google", json={"credential": "fake-token"})
# BYPASS_GOOGLE_AUTH is guarded — only works in pytest, so this should fail
if r.status_code == 200:
    token_data = r.json()
    TOKEN = token_data["access_token"]
    USER_ID = token_data["user"]["id"]
    test("Login succeeded (bypass enabled)", True)
    test("Got access token", bool(TOKEN))
    test(f"Got user_id={USER_ID}", USER_ID is not None)
    HEADERS = {"Authorization": f"Bearer {TOKEN}"}
else:
    # The bypass is blocked (correct behavior in non-pytest mode)
    # We need to create a token manually for testing
    print(f"  ℹ️  Google auth returned {r.status_code} — bypass is correctly blocked outside pytest")
    print("  ℹ️  Generating a test JWT manually...")
    
    import sys
    sys.path.insert(0, "/Users/ayushkaushik/Documents/lifeos")
    
    import os
    os.chdir("/Users/ayushkaushik/Documents/lifeos")
    
    from jose import jwt
    from datetime import datetime, timedelta, timezone
    
    SECRET = "lifeos-dev-testing-secret-key-2026"
    
    # First, create a user directly via the database
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    engine = create_engine("sqlite:///./lifeos.db", connect_args={"check_same_thread": False})
    Session = sessionmaker(bind=engine)
    db = Session()
    
    # Check if test user exists
    from backend.models import User, Base
    Base.metadata.create_all(bind=engine)
    
    user = db.query(User).filter(User.email == "test@lifeos.dev").first()
    if not user:
        user = User(username="Test User", email="test@lifeos.dev", password_hash="", google_id="test-gid-001")
        db.add(user)
        db.commit()
        db.refresh(user)
    
    USER_ID = user.id
    TOKEN = jwt.encode(
        {"sub": str(USER_ID), "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        SECRET,
        algorithm="HS256",
    )
    HEADERS = {"Authorization": f"Bearer {TOKEN}"}
    test("Manual JWT created", bool(TOKEN))
    test(f"Test user_id={USER_ID}", USER_ID is not None)
    db.close()


# ============================================================
# 3. Authenticated endpoints should work
# ============================================================
print("\n🔹 3. Authenticated endpoints work")
r = requests.get(f"{BASE}/auth/me", headers=HEADERS)
test("GET /auth/me returns 200", r.status_code == 200, f"got {r.status_code}: {r.text[:100]}")

r = requests.get(f"{BASE}/users/{USER_ID}", headers=HEADERS)
test("GET /users/{id} returns 200", r.status_code == 200, f"got {r.status_code}")

r = requests.get(f"{BASE}/users/{USER_ID}/dashboard/stats", headers=HEADERS)
test("GET dashboard/stats returns 200", r.status_code == 200, f"got {r.status_code}")

r = requests.get(f"{BASE}/users/{USER_ID}/goals/", headers=HEADERS)
test("GET goals returns 200", r.status_code == 200, f"got {r.status_code}")

r = requests.get(f"{BASE}/users/{USER_ID}/habits/", headers=HEADERS)
test("GET habits returns 200", r.status_code == 200, f"got {r.status_code}")

r = requests.get(f"{BASE}/users/{USER_ID}/tasks/", headers=HEADERS)
test("GET tasks returns 200", r.status_code == 200, f"got {r.status_code}")

r = requests.get(f"{BASE}/users/{USER_ID}/journal/", headers=HEADERS)
test("GET journal returns 200", r.status_code == 200, f"got {r.status_code}")

r = requests.get(f"{BASE}/users/{USER_ID}/notes/", headers=HEADERS)
test("GET notes returns 200", r.status_code == 200, f"got {r.status_code}")

r = requests.get(f"{BASE}/users/{USER_ID}/tags/", headers=HEADERS)
test("GET tags returns 200", r.status_code == 200, f"got {r.status_code}")

r = requests.get(f"{BASE}/users/{USER_ID}/notifications", headers=HEADERS)
test("GET notifications returns 200", r.status_code == 200, f"got {r.status_code}")

r = requests.get(f"{BASE}/analytics/leaderboard", headers=HEADERS)
test("GET leaderboard returns 200", r.status_code == 200, f"got {r.status_code}")

r = requests.get(f"{BASE}/analytics/users/{USER_ID}/personal", headers=HEADERS)
test("GET personal analytics returns 200", r.status_code == 200, f"got {r.status_code}")


# ============================================================
# 4. Unauthenticated requests should be REJECTED (401)
# ============================================================
print("\n🔹 4. Unauthenticated requests rejected (expect 401/403)")
endpoints_needing_auth = [
    ("GET", f"/users/{USER_ID}"),
    ("GET", f"/users/{USER_ID}/goals/"),
    ("GET", f"/users/{USER_ID}/habits/"),
    ("GET", f"/users/{USER_ID}/tasks/"),
    ("GET", f"/users/{USER_ID}/journal/"),
    ("GET", f"/users/{USER_ID}/notes/"),
    ("GET", f"/users/{USER_ID}/tags/"),
    ("GET", f"/users/{USER_ID}/notifications"),
    ("GET", f"/users/{USER_ID}/dashboard/stats"),
    ("GET", f"/users/{USER_ID}/dashboard/today"),
    ("GET", f"/analytics/leaderboard"),
    ("GET", f"/analytics/users/{USER_ID}/personal"),
    ("POST", f"/sync/habits/{USER_ID}"),
    ("POST", f"/sync/recurring-tasks/{USER_ID}"),
    ("POST", f"/sync/notifications/{USER_ID}"),
]

for method, path in endpoints_needing_auth:
    r = requests.request(method, f"{BASE}{path}")  # No auth header
    test(f"{method} {path} → 401/403", r.status_code in (401, 403), f"got {r.status_code}")


# ============================================================
# 5. IDOR protection — user can't access another user's data
# ============================================================
print("\n🔹 5. IDOR protection (can't access other users' data)")
OTHER_USER_ID = USER_ID + 999  # non-existent or different user

idor_endpoints = [
    ("GET", f"/users/{OTHER_USER_ID}"),
    ("GET", f"/users/{OTHER_USER_ID}/goals/"),
    ("GET", f"/users/{OTHER_USER_ID}/habits/"),
    ("GET", f"/users/{OTHER_USER_ID}/tasks/"),
    ("GET", f"/users/{OTHER_USER_ID}/journal/"),
    ("GET", f"/users/{OTHER_USER_ID}/notes/"),
    ("GET", f"/users/{OTHER_USER_ID}/tags/"),
    ("GET", f"/users/{OTHER_USER_ID}/notifications"),
    ("GET", f"/users/{OTHER_USER_ID}/dashboard/stats"),
    ("GET", f"/analytics/users/{OTHER_USER_ID}/personal"),
]

for method, path in idor_endpoints:
    r = requests.request(method, f"{BASE}{path}", headers=HEADERS)
    test(f"{method} {path} → 403", r.status_code == 403, f"got {r.status_code}")


# ============================================================
# 6. Removed endpoints should return 404/405
# ============================================================
print("\n🔹 6. Removed endpoints (POST /users/, GET /users/)")
r = requests.post(f"{BASE}/users/", json={"username": "hacker", "email": "h@h.com", "password": "x"})
test("POST /users/ is gone", r.status_code in (404, 405, 422), f"got {r.status_code}")

r = requests.get(f"{BASE}/users/")
test("GET /users/ is gone", r.status_code in (404, 405), f"got {r.status_code}")


# ============================================================
# 7. CRUD operations work with auth
# ============================================================
print("\n🔹 7. CRUD operations work with auth")

# Create a goal
r = requests.post(
    f"{BASE}/users/{USER_ID}/goals/",
    headers=HEADERS,
    json={"title": "Test Goal", "description": "Security test"}
)
test("Create goal returns 200", r.status_code == 200, f"got {r.status_code}: {r.text[:100]}")
if r.status_code == 200:
    goal_id = r.json()["id"]
    
    # Update it
    r = requests.put(
        f"{BASE}/users/{USER_ID}/goals/{goal_id}",
        headers=HEADERS,
        json={"title": "Updated Goal"}
    )
    test("Update goal returns 200", r.status_code == 200, f"got {r.status_code}")
    
    # Delete it
    r = requests.delete(f"{BASE}/users/{USER_ID}/goals/{goal_id}", headers=HEADERS)
    test("Delete goal returns 200", r.status_code == 200, f"got {r.status_code}")

# Create a task
r = requests.post(
    f"{BASE}/users/{USER_ID}/tasks/",
    headers=HEADERS,
    json={"title": "Test Task"}
)
test("Create task returns 200", r.status_code == 200, f"got {r.status_code}: {r.text[:100]}")
if r.status_code == 200:
    task_id = r.json()["id"]
    r = requests.delete(f"{BASE}/users/{USER_ID}/tasks/{task_id}", headers=HEADERS)
    test("Delete task returns 200", r.status_code == 200, f"got {r.status_code}")

# Create a journal entry
r = requests.post(
    f"{BASE}/users/{USER_ID}/journal/",
    headers=HEADERS,
    json={"entry_date": "2026-04-09", "content": "Test entry", "mood": 4}
)
test("Create journal entry returns 200", r.status_code == 200, f"got {r.status_code}: {r.text[:100]}")
if r.status_code == 200:
    entry_id = r.json()["id"]
    r = requests.delete(f"{BASE}/users/{USER_ID}/journal/{entry_id}", headers=HEADERS)
    test("Delete journal entry returns 200", r.status_code == 200, f"got {r.status_code}")


# ============================================================
# 8. Input validation — oversized payloads rejected
# ============================================================
print("\n🔹 8. Input validation (oversized payloads)")
r = requests.post(
    f"{BASE}/users/{USER_ID}/goals/",
    headers=HEADERS,
    json={"title": "x" * 201}  # exceeds max_length=200
)
test("Title > 200 chars rejected", r.status_code == 422, f"got {r.status_code}")

r = requests.post(
    f"{BASE}/users/{USER_ID}/goals/",
    headers=HEADERS,
    json={"title": ""}  # empty title (min_length=1)
)
test("Empty title rejected", r.status_code == 422, f"got {r.status_code}")

r = requests.post(
    f"{BASE}/users/{USER_ID}/journal/",
    headers=HEADERS,
    json={"entry_date": "2026-04-09", "content": "x" * 50001}  # exceeds max_length=50000
)
test("Journal content > 50K rejected", r.status_code == 422, f"got {r.status_code}")


# ============================================================
# 9. Pagination cap
# ============================================================
print("\n🔹 9. Pagination cap")
r = requests.get(f"{BASE}/users/{USER_ID}/goals/?limit=999", headers=HEADERS)
test("limit=999 rejected (le=200)", r.status_code == 422, f"got {r.status_code}")

r = requests.get(f"{BASE}/users/{USER_ID}/goals/?limit=100", headers=HEADERS)
test("limit=100 accepted", r.status_code == 200, f"got {r.status_code}")


# ============================================================
# 10. Water endpoints (already had auth — verify still works)
# ============================================================
print("\n🔹 10. Water endpoints (pre-existing auth)")
r = requests.get(f"{BASE}/api/water/goal", headers=HEADERS)
test("GET /api/water/goal returns 200", r.status_code == 200, f"got {r.status_code}")


# ============================================================
# Summary
# ============================================================
print(f"\n{'='*60}")
total = results["pass"] + results["fail"]
print(f"Results: {results['pass']}/{total} passed, {results['fail']} failed")
if results["fail"] == 0:
    print("🎉 All tests passed!")
else:
    print(f"⚠️  {results['fail']} test(s) failed — see above")
print(f"{'='*60}")
