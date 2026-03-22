"""
Preservation property tests for Habit-Task Sync.

These tests verify EXISTING behavior that MUST be preserved after the bugfix.
All tests should PASS on unfixed code — confirming baseline behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
"""

import sys
import os
import datetime
import uuid

import pytest
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import Base
from backend import models, crud, schemas

# Separate test database to avoid conflicts
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_preservation.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def setup_module(module):
    Base.metadata.create_all(bind=engine)


def teardown_module(module):
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_preservation.db"):
        os.remove("./test_preservation.db")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_db():
    return TestingSessionLocal()


def _create_user(db, username="preserve_user"):
    """Create a test user with a unique email."""
    email = f"{username}_{uuid.uuid4().hex[:8]}@test.com"
    user = models.User(username=username, email=email, password_hash="hash")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_goal(db, user_id, title="Test Goal"):
    """Create a goal for a user."""
    goal_data = schemas.GoalCreate(title=title)
    return crud.create_user_goal(db, goal_data, user_id)


# Hypothesis strategy for generating valid habit titles
habit_title_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z")),
    min_size=1,
    max_size=50,
)


# ===========================================================================
# Property 5 (Preservation) — Habit Creation Preservation
# **Validates: Requirements 3.1**
# ===========================================================================
class TestHabitCreationPreservation:
    """
    **Validates: Requirements 3.1**

    Creating a habit via crud should auto-generate a linked task with
    task_type="habit" and title="🔁 {habit_title}". Should PASS on unfixed code.
    """

    @given(title=habit_title_strategy)
    @settings(
        max_examples=10,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_habit_creation_generates_linked_task(self, title):
        """Creating a habit auto-generates a linked task with correct attributes."""
        db = _get_db()
        try:
            user = _create_user(db)
            habit_data = schemas.HabitCreate(
                title=title,
                target_x=1,
                target_y_days=1,
                start_date=datetime.date.today(),
                frequency_type="daily",
            )
            habit = crud.create_user_habit(db, habit_data, user.id)

            # Query linked tasks
            linked_tasks = (
                db.query(models.Task)
                .filter(
                    models.Task.habit_id == habit.id,
                    models.Task.task_type == "habit",
                )
                .all()
            )

            assert len(linked_tasks) == 1, (
                f"Expected exactly 1 linked task, got {len(linked_tasks)}"
            )
            assert linked_tasks[0].title == f"🔁 {title}", (
                f"Expected title '🔁 {title}', got '{linked_tasks[0].title}'"
            )
            assert linked_tasks[0].user_id == user.id
            assert linked_tasks[0].status == "Todo"
        finally:
            db.close()


# ===========================================================================
# Property 5 (Preservation) — Cascade Delete Preservation
# **Validates: Requirements 3.2**
# ===========================================================================
class TestCascadeDeletePreservation:
    """
    **Validates: Requirements 3.2**

    Deleting a habit should cascade-delete all linked tasks.
    Should PASS on unfixed code.
    """

    @given(title=habit_title_strategy)
    @settings(
        max_examples=10,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_habit_delete_cascades_to_tasks(self, title):
        """Deleting a habit removes all linked tasks via cascade."""
        db = _get_db()
        try:
            user = _create_user(db)
            habit_data = schemas.HabitCreate(
                title=title,
                target_x=1,
                target_y_days=1,
                start_date=datetime.date.today(),
                frequency_type="daily",
            )
            habit = crud.create_user_habit(db, habit_data, user.id)
            habit_id = habit.id

            # Verify task exists before delete
            tasks_before = (
                db.query(models.Task)
                .filter(models.Task.habit_id == habit_id)
                .all()
            )
            assert len(tasks_before) >= 1, "Should have at least 1 linked task"

            # Delete the habit
            crud.delete_user_habit(db, habit_id)

            # Verify all linked tasks are gone
            tasks_after = (
                db.query(models.Task)
                .filter(models.Task.habit_id == habit_id)
                .all()
            )
            assert len(tasks_after) == 0, (
                f"Expected 0 tasks after cascade delete, got {len(tasks_after)}"
            )
        finally:
            db.close()


# ===========================================================================
# Property 5 (Preservation) — Orphan Cleanup Preservation
# **Validates: Requirements 3.3**
# ===========================================================================
class TestOrphanCleanupPreservation:
    """
    **Validates: Requirements 3.3**

    Orphaned habit-tasks (tasks with habit_id pointing to a non-existent habit)
    should be removed by sync_habit_tasks. Should PASS on unfixed code.
    """

    def test_orphaned_habit_tasks_are_removed_by_sync(self):
        """sync_habit_tasks removes tasks whose linked habit no longer exists."""
        db = _get_db()
        try:
            user = _create_user(db)

            # Create an orphaned habit-task (habit_id points to non-existent habit)
            orphan_task = models.Task(
                user_id=user.id,
                title="🔁 Orphaned Task",
                habit_id=999999,  # non-existent habit
                task_type="habit",
                status="Todo",
                target_date=datetime.date.today(),
            )
            db.add(orphan_task)
            db.commit()
            orphan_id = orphan_task.id

            # Run sync
            result = crud.sync_habit_tasks(db, user.id)

            # Verify orphan was removed
            remaining = db.query(models.Task).filter(models.Task.id == orphan_id).first()
            assert remaining is None, "Orphaned habit-task should be removed by sync"
            assert result["removed"] >= 1, "Sync should report at least 1 removed task"
        finally:
            db.close()


# ===========================================================================
# Property 5 (Preservation) — Manual Task Independence
# **Validates: Requirements 3.4**
# ===========================================================================
class TestManualTaskIndependence:
    """
    **Validates: Requirements 3.4**

    Manual tasks (non-habit) should be unaffected by sync operations.
    Should PASS on unfixed code.
    """

    @given(title=habit_title_strategy)
    @settings(
        max_examples=10,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_manual_tasks_unaffected_by_sync(self, title):
        """Manual tasks are never modified or deleted by sync_habit_tasks."""
        db = _get_db()
        try:
            user = _create_user(db)

            # Create a manual task
            manual_task_data = schemas.TaskCreate(
                title=title,
                task_type="manual",
                target_date=datetime.date.today(),
            )
            manual_task = crud.create_user_task(db, manual_task_data, user.id)
            manual_task_id = manual_task.id

            # Run sync
            crud.sync_habit_tasks(db, user.id)

            # Verify manual task is unchanged
            task_after = db.query(models.Task).filter(models.Task.id == manual_task_id).first()
            assert task_after is not None, "Manual task should still exist after sync"
            assert task_after.title == title, (
                f"Manual task title should be unchanged: expected '{title}', got '{task_after.title}'"
            )
            assert task_after.task_type == "manual", "Task type should remain 'manual'"
        finally:
            db.close()


# ===========================================================================
# Property 5 (Preservation) — Done Task Immutability
# **Validates: Requirements 3.5**
# ===========================================================================
class TestDoneTaskImmutability:
    """
    **Validates: Requirements 3.5**

    Habit tasks marked as "Done" should not be modified when the parent habit
    is updated. Should PASS on unfixed code (since update_user_habit doesn't
    touch tasks at all currently).
    """

    @given(
        original_title=habit_title_strategy,
        new_title=habit_title_strategy,
    )
    @settings(
        max_examples=10,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        database=None,
        deadline=None,
    )
    def test_done_task_title_unchanged_after_habit_update(self, original_title, new_title):
        """Done habit tasks are not modified when the parent habit is updated."""
        db = _get_db()
        try:
            user = _create_user(db)
            habit_data = schemas.HabitCreate(
                title=original_title,
                target_x=1,
                target_y_days=1,
                start_date=datetime.date.today(),
                frequency_type="daily",
            )
            habit = crud.create_user_habit(db, habit_data, user.id)

            # Mark the linked task as Done
            linked_task = (
                db.query(models.Task)
                .filter(
                    models.Task.habit_id == habit.id,
                    models.Task.task_type == "habit",
                )
                .first()
            )
            assert linked_task is not None
            done_title = linked_task.title
            linked_task.status = "Done"
            db.commit()

            # Update the habit title
            update_data = schemas.HabitUpdate(title=new_title)
            crud.update_user_habit(db, habit.id, update_data)

            # Verify the Done task title is unchanged
            db.refresh(linked_task)
            assert linked_task.title == done_title, (
                f"Done task title should be unchanged: expected '{done_title}', "
                f"got '{linked_task.title}'"
            )
            assert linked_task.status == "Done"
        finally:
            db.close()


# ===========================================================================
# Property 5 (Preservation) — Other Router Stability
# **Validates: Requirements 3.6**
# ===========================================================================
class TestOtherRouterStability:
    """
    **Validates: Requirements 3.6**

    Goals, habits, tasks, and other CRUD operations continue to function
    normally. Should PASS on unfixed code.
    """

    def test_goal_crud_operations(self):
        """Goal create, read, update, delete work correctly."""
        db = _get_db()
        try:
            user = _create_user(db)

            # Create
            goal = _create_goal(db, user.id, title="Stability Goal")
            assert goal.id is not None
            assert goal.title == "Stability Goal"

            # Read
            fetched = crud.get_goal(db, goal.id)
            assert fetched is not None
            assert fetched.title == "Stability Goal"

            # Update
            updated = crud.update_user_goal(
                db, goal.id, schemas.GoalUpdate(title="Updated Goal")
            )
            assert updated.title == "Updated Goal"

            # Delete
            crud.delete_user_goal(db, goal.id)
            assert crud.get_goal(db, goal.id) is None
        finally:
            db.close()

    def test_habit_crud_operations(self):
        """Habit create, read, delete work correctly."""
        db = _get_db()
        try:
            user = _create_user(db)

            # Create
            habit_data = schemas.HabitCreate(
                title="Stability Habit",
                target_x=1,
                target_y_days=1,
                start_date=datetime.date.today(),
                frequency_type="daily",
            )
            habit = crud.create_user_habit(db, habit_data, user.id)
            assert habit.id is not None
            assert habit.title == "Stability Habit"

            # Read
            habits = crud.get_user_habits(db, user.id)
            assert any(h.id == habit.id for h in habits)

            # Delete
            crud.delete_user_habit(db, habit.id)
            habits_after = crud.get_user_habits(db, user.id)
            assert not any(h.id == habit.id for h in habits_after)
        finally:
            db.close()

    def test_task_crud_operations(self):
        """Task create, read, update, delete work correctly."""
        db = _get_db()
        try:
            user = _create_user(db)

            # Create
            task_data = schemas.TaskCreate(title="Stability Task")
            task = crud.create_user_task(db, task_data, user.id)
            assert task.id is not None
            assert task.title == "Stability Task"

            # Read
            tasks = crud.get_user_tasks(db, user.id)
            assert any(t.id == task.id for t in tasks)

            # Update
            updated = crud.update_task(
                db, task.id, schemas.TaskUpdate(title="Updated Task")
            )
            assert updated.title == "Updated Task"

            # Delete
            crud.delete_task(db, task.id)
            tasks_after = crud.get_user_tasks(db, user.id)
            assert not any(t.id == task.id for t in tasks_after)
        finally:
            db.close()

    def test_journal_crud_operations(self):
        """Journal entry create, read, delete work correctly."""
        db = _get_db()
        try:
            user = _create_user(db)

            # Create
            entry_data = schemas.JournalEntryCreate(
                entry_date=datetime.date.today(),
                content="Stability test entry",
                mood=4,
            )
            entry = crud.create_journal_entry(db, entry_data, user.id)
            assert entry.id is not None

            # Read
            entries = crud.get_user_journal_entries(db, user.id)
            assert any(e.id == entry.id for e in entries)

            # Delete
            crud.delete_journal_entry(db, entry.id)
            entries_after = crud.get_user_journal_entries(db, user.id)
            assert not any(e.id == entry.id for e in entries_after)
        finally:
            db.close()

    def test_note_crud_operations(self):
        """Note create, read, update, delete work correctly."""
        db = _get_db()
        try:
            user = _create_user(db)

            # Create
            note_data = schemas.NoteCreate(title="Stability Note", content="Test")
            note = crud.create_note(db, note_data, user.id)
            assert note.id is not None

            # Read
            notes = crud.get_user_notes(db, user.id)
            assert any(n.id == note.id for n in notes)

            # Update
            updated = crud.update_note(
                db, note.id, schemas.NoteUpdate(title="Updated Note")
            )
            assert updated.title == "Updated Note"

            # Delete
            crud.delete_note(db, note.id)
            notes_after = crud.get_user_notes(db, user.id)
            assert not any(n.id == note.id for n in notes_after)
        finally:
            db.close()
