import datetime
from datetime import date, timedelta
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from . import models, schemas

# ============================
# USER CRUD
# ============================

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    # In a real app, hash the password here
    fake_hashed_password = user.password + "notreallyhashed"
    db_user = models.User(email=user.email, username=user.username, password_hash=fake_hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

# ============================
# GOAL CRUD
# ============================

def create_user_goal(db: Session, goal: schemas.GoalCreate, user_id: int):
    db_goal = models.Goal(**goal.model_dump(), user_id=user_id)
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

def get_user_goals(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Goal).filter(models.Goal.user_id == user_id).offset(skip).limit(limit).all()

def get_goal(db: Session, goal_id: int):
    return db.query(models.Goal).filter(models.Goal.id == goal_id).first()

def get_goal_detail(db: Session, goal_id: int):
    """Get goal with linked habits (including logs) and tasks."""
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not goal:
        return None
    
    habits = db.query(models.Habit).filter(models.Habit.goal_id == goal_id).all()
    tasks = db.query(models.Task).filter(models.Task.goal_id == goal_id).all()
    progress = compute_goal_progress(db, goal_id)
    
    return {
        "id": goal.id,
        "user_id": goal.user_id,
        "title": goal.title,
        "description": goal.description,
        "status": goal.status,
        "category": goal.category,
        "priority": goal.priority,
        "target_date": goal.target_date,
        "created_at": goal.created_at,
        "habits": habits,
        "tasks": tasks,
        "progress": progress,
    }

def compute_goal_progress(db: Session, goal_id: int) -> float:
    """Compute goal progress as weighted average of habit success rates and task completion."""
    import datetime
    
    habits = db.query(models.Habit).filter(models.Habit.goal_id == goal_id).all()
    tasks = db.query(models.Task).filter(models.Task.goal_id == goal_id).all()
    
    scores = []
    
    # Habit contribution: % of "Done" logs vs expected days
    for h in habits:
        done_count = db.query(models.HabitLog).filter(
            models.HabitLog.habit_id == h.id,
            models.HabitLog.status == "Done"
        ).count()
        days_elapsed = max(1, (datetime.date.today() - h.start_date).days + 1)
        expected = (days_elapsed / h.target_y_days) * h.target_x if h.target_y_days > 0 else 0
        if expected > 0:
            scores.append(min(done_count / expected, 1.0) * 100)
    
    # Task contribution: % of completed tasks
    if tasks:
        done_tasks = len([t for t in tasks if t.status == "Done"])
        scores.append((done_tasks / len(tasks)) * 100)
    
    return round(sum(scores) / len(scores), 2) if scores else 0.0

def update_user_goal(db: Session, goal_id: int, goal: schemas.GoalUpdate):
    db_goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if db_goal:
        update_data = goal.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_goal, key, value)
        db.commit()
        db.refresh(db_goal)
    return db_goal

def delete_user_goal(db: Session, goal_id: int):
    db_goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if db_goal:
        # Unlink habits and tasks before deleting
        db.query(models.Habit).filter(models.Habit.goal_id == goal_id).update({"goal_id": None})
        db.query(models.Task).filter(models.Task.goal_id == goal_id).update({"goal_id": None})
        db.delete(db_goal)
        db.commit()
        return True
    return False

# ============================
# HABIT CRUD
# ============================

def create_user_habit(db: Session, habit: schemas.HabitCreate, user_id: int):
    import datetime as _dt
    data = habit.model_dump(exclude_none=True)
    # SQLite NOT NULL constraint on legacy columns — default to 0 for scheduled habits
    data.setdefault('target_x', 0)
    data.setdefault('target_y_days', 0)
    db_habit = models.Habit(**data, user_id=user_id)
    db.add(db_habit)
    db.commit()
    db.refresh(db_habit)

    # Auto-create a linked task for this habit, but ONLY if the start date is
    # today or in the past. For future-dated habits we defer task creation to
    # sync_habit_tasks — which runs on the day itself — to avoid cluttering the
    # Tasks view with long-horizon future tasks that do nothing.
    today = _dt.date.today()
    if db_habit.start_date <= today:
        db_task = models.Task(
            user_id=user_id,
            title=f"🔁 {db_habit.title}",
            habit_id=db_habit.id,
            task_type="habit",
            goal_id=db_habit.goal_id,
            target_date=db_habit.start_date,
            status="Todo",
        )
        db.add(db_task)
        db.commit()

    return db_habit

def get_user_habits(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Habit).filter(models.Habit.user_id == user_id).offset(skip).limit(limit).all()

def log_habit(db: Session, habit_id: int, status: str, log_date):
    """Log or update a habit's status for a given date.

    status values:
      • "Done"   — habit was completed
      • "Missed" — habit was explicitly skipped/failed
      • "Clear"  — delete any existing log for that date (pseudo-status)

    Also keeps the linked habit-task in sync:
      • Done  → task.status = "Done"
      • Missed → task.status = "Failed"
      • Clear → task.status = "Todo"
    """
    import datetime as _dt

    # Find existing log (if any)
    existing_log = db.query(models.HabitLog).filter(
        models.HabitLog.habit_id == habit_id,
        models.HabitLog.log_date == log_date
    ).first()

    if status == "Clear":
        if existing_log:
            db.delete(existing_log)
        db_log = None
    else:
        if existing_log:
            existing_log.status = status
            db_log = existing_log
        else:
            db_log = models.HabitLog(habit_id=habit_id, status=status, log_date=log_date)
            db.add(db_log)

    db.commit()

    # Sync the corresponding habit-task (same habit, same target_date) to match
    task_status_map = {"Done": "Done", "Missed": "Failed", "Clear": "Todo"}
    task_status = task_status_map.get(status)
    if task_status is not None:
        linked_task = db.query(models.Task).filter(
            models.Task.habit_id == habit_id,
            models.Task.task_type == "habit",
            models.Task.target_date == log_date,
        ).first()
        if linked_task and linked_task.status != task_status:
            linked_task.status = task_status
            db.commit()

    # Recalculate streak using centralized function
    recalculate_habit_streak(db, habit_id)

    return db_log

def get_habit_logs(db: Session, habit_id: int):
    return db.query(models.HabitLog).filter(models.HabitLog.habit_id == habit_id).all()

def recalculate_habit_streak(db: Session, habit_id: int):
    import datetime
    habit = db.query(models.Habit).filter(models.Habit.id == habit_id).first()
    if not habit:
        return 0
    
    all_logs = db.query(models.HabitLog).filter(models.HabitLog.habit_id == habit_id).all()
    log_map = {l.log_date: l.status for l in all_logs}
    
    streak = 0
    curr = datetime.date.today()
    
    # Determine which days of the week are scheduled (for scheduled habits)
    scheduled_weekdays = None
    if habit.frequency_type in ('weekly', 'custom') and habit.repeat_days:
        scheduled_weekdays = set(int(d) for d in habit.repeat_days.split(',') if d.strip())
    
    def is_scheduled_day(d):
        """Check if a given date is a day the habit is scheduled for."""
        if habit.frequency_type == 'flexible':
            return True  # X/Y system — every day counts
        if habit.frequency_type == 'daily':
            return True
        if habit.frequency_type in ('weekly', 'custom') and scheduled_weekdays is not None:
            # Python weekday: Mon=0..Sun=6. Our storage: 0=Sun..6=Sat
            # Convert Python weekday to our format: (python_weekday + 1) % 7
            our_weekday = (d.weekday() + 1) % 7
            return our_weekday in scheduled_weekdays
        # For monthly/annually, simplified — always True for now
        return True
    
    # If today is not a scheduled day or not logged, walk back to the most recent scheduled day
    if not is_scheduled_day(curr) or curr not in log_map:
        # Walk backwards to find the last scheduled day
        for _ in range(365):  # safety limit
            curr -= datetime.timedelta(days=1)
            if curr < habit.start_date:
                break
            if is_scheduled_day(curr):
                break
    
    # Now count consecutive "Done" entries on scheduled days
    while curr >= habit.start_date:
        if is_scheduled_day(curr):
            if curr in log_map and log_map[curr] == "Done":
                streak += 1
            else:
                break  # streak broken
        # Skip non-scheduled days silently
        curr -= datetime.timedelta(days=1)
        
    habit.current_streak = streak
    db.commit()
    return streak

def update_user_habit(db: Session, habit_id: int, habit: schemas.HabitUpdate):
    db_habit = db.query(models.Habit).filter(models.Habit.id == habit_id).first()
    if db_habit:
        update_data = habit.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_habit, key, value)
        # Propagate changes to pending (non-Done) habit tasks
        pending_tasks = (
            db.query(models.Task)
            .filter(
                models.Task.habit_id == habit_id,
                models.Task.task_type == "habit",
                models.Task.status != "Done",
            )
            .all()
        )
        for task in pending_tasks:
            task.title = f"🔁 {db_habit.title}"
            task.goal_id = db_habit.goal_id
        db.commit()
        # Recalculate streak in case start_date or other parameters changed
        recalculate_habit_streak(db, habit_id)
        db.refresh(db_habit)
    return db_habit

def delete_user_habit(db: Session, habit_id: int):
    db_habit = db.query(models.Habit).filter(models.Habit.id == habit_id).first()
    if db_habit:
        db.delete(db_habit)
        db.commit()
        return True
    return False

# ============================
# TAG CRUD
# ============================

def create_tag(db: Session, user_id: int, tag: schemas.TagCreate):
    existing = db.query(models.Tag).filter(
        models.Tag.user_id == user_id,
        models.Tag.name == tag.name,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Tag with this name already exists")
    db_tag = models.Tag(user_id=user_id, **tag.model_dump())
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

def get_user_tags(db: Session, user_id: int):
    return db.query(models.Tag).filter(models.Tag.user_id == user_id).all()

def update_tag(db: Session, tag_id: int, user_id: int, tag_update: schemas.TagUpdate):
    db_tag = db.query(models.Tag).filter(
        models.Tag.id == tag_id,
        models.Tag.user_id == user_id,
    ).first()
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    update_data = tag_update.model_dump(exclude_unset=True)
    if "name" in update_data:
        existing = db.query(models.Tag).filter(
            models.Tag.user_id == user_id,
            models.Tag.name == update_data["name"],
            models.Tag.id != tag_id,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Tag with this name already exists")
    for key, value in update_data.items():
        setattr(db_tag, key, value)
    db.commit()
    db.refresh(db_tag)
    return db_tag

def delete_tag(db: Session, tag_id: int, user_id: int):
    db_tag = db.query(models.Tag).filter(
        models.Tag.id == tag_id,
        models.Tag.user_id == user_id,
    ).first()
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(db_tag)
    db.commit()
    return True


def _resolve_tag_ids(db: Session, user_id: int, tag_ids: list):
    """Look up tags by IDs and verify they all belong to the user."""
    tags = db.query(models.Tag).filter(
        models.Tag.id.in_(tag_ids),
        models.Tag.user_id == user_id,
    ).all()
    if len(tags) != len(tag_ids):
        raise HTTPException(status_code=422, detail="One or more tag IDs are invalid or do not belong to this user")
    return tags

# ============================
# TASK CRUD
# ============================


VALID_FREQUENCY_TYPES = {"daily", "weekly", "monthly", "annually", "custom"}

def validate_recurrence_config(task: schemas.TaskCreate):
    """Validate recurrence configuration for recurring tasks. Raises ValueError on invalid config."""
    if task.frequency_type not in VALID_FREQUENCY_TYPES:
        raise ValueError(f"frequency_type must be one of: daily, weekly, monthly, annually, custom")
    if task.frequency_type == "weekly" and not task.repeat_days:
        raise ValueError("repeat_days is required for weekly frequency")
    if task.ends_type == "on" and task.ends_on_date is None:
        raise ValueError("ends_on_date is required when ends_type is 'on'")
    if task.ends_type == "after" and (task.ends_after_occurrences is None or task.ends_after_occurrences < 1):
        raise ValueError("ends_after_occurrences must be >= 1 when ends_type is 'after'")

def create_user_task(db: Session, task: schemas.TaskCreate, user_id: int):
    if task.task_type == "recurring":
        validate_recurrence_config(task)

    task_data = task.model_dump(exclude={"tag_ids"})
    db_task = models.Task(**task_data, user_id=user_id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # Handle tag assignment
    if task.tag_ids is not None:
        db_task.tags = _resolve_tag_ids(db, user_id, task.tag_ids)
        db.commit()
        db.refresh(db_task)

    # After persisting a recurring template, generate the first instance
    if task.task_type == "recurring":
        sync_recurring_tasks(db, user_id)

    return db_task


def get_user_tasks(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return (
        db.query(models.Task)
        .filter(models.Task.user_id == user_id)
        .filter(
            ~(
                (models.Task.task_type == "recurring")
                & (models.Task.parent_task_id.is_(None))
            )
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

RECURRENCE_CONFIG_FIELDS = {
    "frequency_type", "repeat_interval", "repeat_days",
    "ends_type", "ends_on_date", "ends_after_occurrences",
}

DETAIL_FIELDS = {"title", "description", "energy_level", "estimated_minutes"}


def update_task(db: Session, task_id: int, task_update: schemas.TaskUpdate):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        return None

    update_data = task_update.model_dump(exclude_unset=True)

    # Extract tag_ids before processing other fields
    tag_ids = update_data.pop("tag_ids", None)

    is_template = db_task.task_type == "recurring" and db_task.parent_task_id is None
    is_instance = db_task.task_type == "recurring" and db_task.parent_task_id is not None

    # Block recurrence field changes on instances
    if is_instance:
        recurrence_changes = set(update_data.keys()) & RECURRENCE_CONFIG_FIELDS
        if recurrence_changes:
            raise ValueError("Cannot modify recurrence config on a task instance. Edit the template instead.")

    if is_template:
        # Validate recurrence config if recurrence fields are being changed
        recurrence_changed = any(
            key in update_data and update_data[key] != getattr(db_task, key)
            for key in RECURRENCE_CONFIG_FIELDS
        )
        detail_changed = any(
            key in update_data and update_data[key] != getattr(db_task, key)
            for key in DETAIL_FIELDS
        )

        if recurrence_changed:
            # Validate the new recurrence config by building a temporary object
            validate_recurrence_config(_build_config_for_validation(db_task, update_data))

        # Apply changes to the template itself
        for key, value in update_data.items():
            setattr(db_task, key, value)
        db.commit()
        db.refresh(db_task)

        if recurrence_changed:
            # Delete all Todo instances, then regenerate
            db.query(models.Task).filter(
                models.Task.parent_task_id == db_task.id,
                models.Task.status == "Todo",
            ).delete(synchronize_session="fetch")
            db.commit()
            sync_recurring_tasks(db, db_task.user_id)
        elif detail_changed:
            # Propagate detail field changes to all Todo instances
            todo_instances = db.query(models.Task).filter(
                models.Task.parent_task_id == db_task.id,
                models.Task.status == "Todo",
            ).all()
            for instance in todo_instances:
                for key in DETAIL_FIELDS:
                    if key in update_data:
                        setattr(instance, key, getattr(db_task, key))
            db.commit()

        db.refresh(db_task)
    else:
        # Regular task or instance — simple update
        for key, value in update_data.items():
            setattr(db_task, key, value)
        db.commit()

    # Handle tag assignment when tag_ids is provided
    if tag_ids is not None:
        db_task.tags = _resolve_tag_ids(db, db_task.user_id, tag_ids)
        db.commit()

    return db_task


def _build_config_for_validation(db_task, update_data: dict):
    """Build a TaskCreate-like object for validation, merging existing template fields with updates."""
    return schemas.TaskCreate(
        title=update_data.get("title", db_task.title),
        task_type="recurring",
        frequency_type=update_data.get("frequency_type", db_task.frequency_type),
        repeat_interval=update_data.get("repeat_interval", db_task.repeat_interval),
        repeat_days=update_data.get("repeat_days", db_task.repeat_days),
        ends_type=update_data.get("ends_type", db_task.ends_type),
        ends_on_date=update_data.get("ends_on_date", db_task.ends_on_date),
        ends_after_occurrences=update_data.get("ends_after_occurrences", db_task.ends_after_occurrences),
    )

def delete_task(db: Session, task_id: int):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        return False

    is_template = db_task.task_type == "recurring" and db_task.parent_task_id is None

    if is_template:
        # Delete all linked Todo instances
        db.query(models.Task).filter(
            models.Task.parent_task_id == db_task.id,
            models.Task.status == "Todo",
        ).delete(synchronize_session="fetch")

        # Orphan InProgress/Done instances: set parent_task_id to null, task_type to "manual"
        db.query(models.Task).filter(
            models.Task.parent_task_id == db_task.id,
            models.Task.status.in_(["InProgress", "Done"]),
        ).update(
            {"parent_task_id": None, "task_type": "manual"},
            synchronize_session="fetch",
        )

    db.delete(db_task)
    db.commit()
    return True


def reorder_tasks(db: Session, user_id: int, status: str, ordered_task_ids: List[int]) -> list:
    """
    Assigns consecutive sort_order values (0-based) to tasks in the given order.
    Validates all task IDs belong to the user. Raises ValueError if any ID is invalid.
    Returns the updated tasks list.
    """
    if not ordered_task_ids:
        return []

    # Fetch all tasks in one query for all-or-nothing validation
    tasks = (
        db.query(models.Task)
        .filter(
            models.Task.id.in_(ordered_task_ids),
            models.Task.user_id == user_id,
        )
        .all()
    )

    # Build a lookup by ID
    task_map = {task.id: task for task in tasks}

    # Validate every requested ID was found and belongs to the user
    for task_id in ordered_task_ids:
        if task_id not in task_map:
            raise ValueError(f"Task {task_id} not found for user {user_id}")

    # Assign consecutive sort_order values in the provided order
    for index, task_id in enumerate(ordered_task_ids):
        task_map[task_id].sort_order = index

    db.commit()

    # Return tasks in the requested order (SQLAlchemy already reflects the new
    # sort_order values on the in-session objects; no need to round-trip per row).
    return [task_map[task_id] for task_id in ordered_task_ids]


# ============================
# SUBTASK CRUD
# ============================

def create_subtask(db: Session, subtask: schemas.SubTaskCreate, task_id: int):
    db_subtask = models.SubTask(**subtask.model_dump(), task_id=task_id)
    db.add(db_subtask)
    db.commit()
    db.refresh(db_subtask)
    return db_subtask

def toggle_subtask(db: Session, subtask_id: int):
    db_subtask = db.query(models.SubTask).filter(models.SubTask.id == subtask_id).first()
    if db_subtask:
        db_subtask.is_complete = 0 if db_subtask.is_complete else 1
        db.commit()
        db.refresh(db_subtask)
    return db_subtask

def delete_subtask(db: Session, subtask_id: int):
    db_subtask = db.query(models.SubTask).filter(models.SubTask.id == subtask_id).first()
    if db_subtask:
        db.delete(db_subtask)
        db.commit()
        return True
    return False

# ============================
# JOURNAL CRUD
# ============================

def create_journal_entry(db: Session, entry: schemas.JournalEntryCreate, user_id: int):
    db_entry = models.JournalEntry(**entry.model_dump(), user_id=user_id)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

def get_user_journal_entries(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.JournalEntry).filter(models.JournalEntry.user_id == user_id).order_by(models.JournalEntry.entry_date.desc()).offset(skip).limit(limit).all()

def update_journal_entry(db: Session, entry_id: int, entry: schemas.JournalEntryCreate):
    db_entry = db.query(models.JournalEntry).filter(models.JournalEntry.id == entry_id).first()
    if db_entry:
        db_entry.content = entry.content
        db_entry.entry_date = entry.entry_date
        db_entry.mood = entry.mood
        db.commit()
        db.refresh(db_entry)
    return db_entry

def delete_journal_entry(db: Session, entry_id: int):
    db_entry = db.query(models.JournalEntry).filter(models.JournalEntry.id == entry_id).first()
    if db_entry:
        db.delete(db_entry)
        db.commit()
        return True
    return False

# ============================
# NOTE CRUD
# ============================

def create_note(db: Session, note: schemas.NoteCreate, user_id: int):
    db_note = models.Note(**note.model_dump(), user_id=user_id)
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

def get_user_notes(db: Session, user_id: int, folder: str = None, skip: int = 0, limit: int = 100):
    query = db.query(models.Note).filter(models.Note.user_id == user_id)
    if folder:
        query = query.filter(models.Note.folder == folder)
    return query.order_by(models.Note.updated_at.desc()).offset(skip).limit(limit).all()

def update_note(db: Session, note_id: int, note_update: schemas.NoteUpdate):
    db_note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if db_note:
        update_data = note_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_note, key, value)
        db.commit()
        db.refresh(db_note)
    return db_note

def delete_note(db: Session, note_id: int):
    db_note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if db_note:
        db.delete(db_note)
        db.commit()
        return True
    return False


# ============================
# HABIT-TASK SYNC
# ============================

def sync_habit_tasks(db: Session, user_id: int):
    """
    Ensures every active habit has a linked task for the current period.
    Creates missing ones and removes orphaned habit-tasks.

    Guarantees (so the Tasks view stays uncluttered):
      • A habit's task is NEVER created before habit.start_date.
      • For daily habits with repeat_days, a task is only created on days
        listed in repeat_days.
      • For weekly habits, a task is only created on the day(s) listed
        in repeat_days. If repeat_days is empty, fall back to "any day
        this week" (legacy behavior).
      • For monthly habits, only one task per calendar month (created on
        the first sync of that month).
    """
    today = datetime.date.today()
    # Python weekday: Mon=0..Sun=6. repeat_days uses Sun=0..Sat=6 convention.
    today_sun0 = (today.weekday() + 1) % 7
    habits = db.query(models.Habit).filter(models.Habit.user_id == user_id).all()
    habit_ids = {h.id for h in habits}

    existing_habit_tasks = (
        db.query(models.Task)
        .filter(models.Task.user_id == user_id, models.Task.task_type == "habit")
        .all()
    )

    def _repeat_day_set(csv):
        if not csv:
            return set()
        return {int(d.strip()) for d in csv.split(",") if d.strip().isdigit()}

    # Create tasks for habits missing a task in the current period
    created = 0
    for habit in habits:
        # Never create a task before the habit is active.
        if habit.start_date and habit.start_date > today:
            continue

        freq = habit.frequency_type or "flexible"
        repeat_day_set = _repeat_day_set(habit.repeat_days)

        if freq in ("daily", "flexible"):
            # If repeat_days is specified, only create on listed weekdays.
            if repeat_day_set and today_sun0 not in repeat_day_set:
                continue
            has_current = any(
                t for t in existing_habit_tasks
                if t.habit_id == habit.id and t.target_date == today
            )
        elif freq == "weekly":
            # Only create on days explicitly scheduled; if unscheduled, fall back
            # to "any day this week" for legacy habits.
            if repeat_day_set and today_sun0 not in repeat_day_set:
                continue
            monday = today - datetime.timedelta(days=today.weekday())
            sunday = monday + datetime.timedelta(days=6)
            has_current = any(
                t for t in existing_habit_tasks
                if t.habit_id == habit.id
                and t.target_date is not None
                and monday <= t.target_date <= sunday
            )
        elif freq == "monthly":
            # Current month: 1st to last day
            first_of_month = today.replace(day=1)
            if today.month == 12:
                last_of_month = today.replace(year=today.year + 1, month=1, day=1) - datetime.timedelta(days=1)
            else:
                last_of_month = today.replace(month=today.month + 1, day=1) - datetime.timedelta(days=1)
            has_current = any(
                t for t in existing_habit_tasks
                if t.habit_id == habit.id
                and t.target_date is not None
                and first_of_month <= t.target_date <= last_of_month
            )
        else:
            # For other frequency types, check if any task exists
            has_current = any(
                t for t in existing_habit_tasks
                if t.habit_id == habit.id
            )

        if not has_current:
            # If a log already exists for today, seed the task's status to match
            # (so a freshly-synced task reflects a pre-existing Done/Missed).
            existing_log = db.query(models.HabitLog).filter(
                models.HabitLog.habit_id == habit.id,
                models.HabitLog.log_date == today,
            ).first()
            initial_status = "Todo"
            if existing_log:
                if existing_log.status == "Done":
                    initial_status = "Done"
                elif existing_log.status == "Missed":
                    initial_status = "Failed"

            db_task = models.Task(
                user_id=user_id,
                title=f"🔁 {habit.title}",
                habit_id=habit.id,
                task_type="habit",
                goal_id=habit.goal_id,
                target_date=today,
                status=initial_status,
            )
            db.add(db_task)
            try:
                # Flush per-task so a concurrent insert (caught by the
                # uq_habit_task_per_day unique index) raises here and we can
                # skip this habit without losing the rest of the batch.
                db.flush()
                created += 1
            except IntegrityError:
                db.rollback()
                # Another concurrent sync inserted the same habit-task; skip.
                continue

    # Remove orphaned habit-tasks (habit was deleted)
    removed = 0
    for task in existing_habit_tasks:
        if task.habit_id and task.habit_id not in habit_ids:
            db.delete(task)
            removed += 1

    db.commit()
    return {"created": created, "removed": removed, "total_habits": len(habits)}

# ============================
# RECURRING TASK SYNC
# ============================

def sync_recurring_tasks(db: Session, user_id: int):
    """
    Ensures every active recurring task template has a linked instance for the current period.
    Creates missing instances based on template recurrence configuration.
    """
    today = datetime.date.today()

    # Fetch all recurring templates for this user (task_type "recurring", parent_task_id is null)
    templates = (
        db.query(models.Task)
        .filter(
            models.Task.user_id == user_id,
            models.Task.task_type == "recurring",
            models.Task.parent_task_id.is_(None),
        )
        .all()
    )

    # Fetch all existing recurring instances for this user
    existing_instances = (
        db.query(models.Task)
        .filter(
            models.Task.user_id == user_id,
            models.Task.task_type == "recurring",
            models.Task.parent_task_id.isnot(None),
        )
        .all()
    )

    created = 0
    active_templates = 0

    for template in templates:
        freq = template.frequency_type
        if not freq:
            continue

        # Check end conditions
        if template.ends_type == "on" and template.ends_on_date is not None:
            if today > template.ends_on_date:
                continue
        if template.ends_type == "after" and template.ends_after_occurrences is not None:
            instance_count = sum(
                1 for t in existing_instances if t.parent_task_id == template.id
            )
            if instance_count >= template.ends_after_occurrences:
                continue

        active_templates += 1

        # Determine current period boundaries and check for existing instance
        repeat_interval = template.repeat_interval or 1
        template_created = template.created_at.date() if template.created_at else today

        if freq == "daily":
            # Check repeat_interval: days elapsed since creation
            days_elapsed = (today - template_created).days
            if repeat_interval > 1 and days_elapsed % repeat_interval != 0:
                continue
            has_current = any(
                t for t in existing_instances
                if t.parent_task_id == template.id and t.target_date == today
            )
            target_date = today

        elif freq == "weekly":
            # Current week: Monday to Sunday
            monday = today - datetime.timedelta(days=today.weekday())
            sunday = monday + datetime.timedelta(days=6)
            # Check repeat_interval: weeks elapsed since creation
            template_monday = template_created - datetime.timedelta(days=template_created.weekday())
            weeks_elapsed = (monday - template_monday).days // 7
            if repeat_interval > 1 and weeks_elapsed % repeat_interval != 0:
                continue
            has_current = any(
                t for t in existing_instances
                if t.parent_task_id == template.id
                and t.target_date is not None
                and monday <= t.target_date <= sunday
            )
            # Set target_date to next matching day from repeat_days
            target_date = _next_matching_weekday(today, template.repeat_days)

        elif freq == "monthly":
            # Current month
            first_of_month = today.replace(day=1)
            if today.month == 12:
                last_of_month = today.replace(year=today.year + 1, month=1, day=1) - datetime.timedelta(days=1)
            else:
                last_of_month = today.replace(month=today.month + 1, day=1) - datetime.timedelta(days=1)
            # Check repeat_interval: months elapsed since creation
            months_elapsed = (today.year - template_created.year) * 12 + (today.month - template_created.month)
            if repeat_interval > 1 and months_elapsed % repeat_interval != 0:
                continue
            has_current = any(
                t for t in existing_instances
                if t.parent_task_id == template.id
                and t.target_date is not None
                and first_of_month <= t.target_date <= last_of_month
            )
            # target_date: use template's start_date day-of-month, clamped to month
            template_day = template_created.day
            max_day = last_of_month.day
            target_date = today.replace(day=min(template_day, max_day))

        elif freq == "annually":
            # Current year
            first_of_year = today.replace(month=1, day=1)
            last_of_year = today.replace(month=12, day=31)
            # Check repeat_interval: years elapsed since creation
            years_elapsed = today.year - template_created.year
            if repeat_interval > 1 and years_elapsed % repeat_interval != 0:
                continue
            has_current = any(
                t for t in existing_instances
                if t.parent_task_id == template.id
                and t.target_date is not None
                and first_of_year <= t.target_date <= last_of_year
            )
            # target_date: template's month/day in current year
            try:
                target_date = today.replace(month=template_created.month, day=template_created.day)
            except ValueError:
                # Handle Feb 29 in non-leap years
                target_date = today.replace(month=template_created.month, day=28)

        else:
            # custom or unknown frequency — skip
            continue

        if not has_current:
            db_instance = models.Task(
                user_id=user_id,
                title=template.title,
                description=template.description,
                goal_id=template.goal_id,
                energy_level=template.energy_level,
                estimated_minutes=template.estimated_minutes,
                task_type="recurring",
                parent_task_id=template.id,
                status="Todo",
                target_date=target_date,
            )
            db.add(db_instance)
            created += 1

    db.commit()
    return {"created": created, "active_templates": active_templates}


def _next_matching_weekday(today: datetime.date, repeat_days: str) -> datetime.date:
    """
    Given today's date and a comma-separated string of weekday numbers (0=Sun..6=Sat),
    return the next matching weekday from today within the current week, or the first
    matching day if all have passed.
    """
    if not repeat_days:
        return today

    # Parse repeat_days: "1,3,5" -> list of ints (0=Sun convention)
    day_nums = sorted(int(d.strip()) for d in repeat_days.split(",") if d.strip().isdigit())
    if not day_nums:
        return today

    # Convert from 0=Sun convention to Python's 0=Mon convention
    # 0=Sun -> 6, 1=Mon -> 0, 2=Tue -> 1, ..., 6=Sat -> 5
    python_days = [(d - 1) % 7 for d in day_nums]

    today_weekday = today.weekday()  # 0=Mon

    # Find the next matching day from today onwards within the current week
    for pd in sorted(python_days):
        if pd >= today_weekday:
            return today + datetime.timedelta(days=pd - today_weekday)

    # All matching days have passed this week; return the first matching day of this week
    first_day = min(python_days)
    monday = today - datetime.timedelta(days=today_weekday)
    return monday + datetime.timedelta(days=first_day)




# ============================
# NOTIFICATION CLEANUP
# ============================

def cleanup_notifications(db: Session):
    """
    Delete dismissed notifications older than 30 days.
    Delete read 'overdue' notifications for tasks with status 'Done'.
    """
    cutoff = datetime.datetime.utcnow() - timedelta(days=30)

    # Delete old dismissed notifications
    db.query(models.Notification).filter(
        models.Notification.dismissed == 1,
        models.Notification.created_at < cutoff,
    ).delete(synchronize_session=False)

    # Delete read overdue notifications for done tasks
    done_task_ids = db.query(models.Task.id).filter(models.Task.status == "Done").subquery()
    db.query(models.Notification).filter(
        models.Notification.type == "overdue",
        models.Notification.is_read == 1,
        models.Notification.task_id.in_(done_task_ids),
    ).delete(synchronize_session=False)

    db.commit()


# ============================
# REMINDER CONFIG CRUD
# ============================

VALID_REMIND_DAYS_BEFORE = {0, 1, 2, 3, 5, 7}


def get_reminder_config(db: Session, user_id: int):
    """Get or create a ReminderConfig for the user with defaults."""
    config = db.query(models.ReminderConfig).filter(
        models.ReminderConfig.user_id == user_id
    ).first()
    if not config:
        config = models.ReminderConfig(
            user_id=user_id,
            remind_days_before=1,
            remind_on_due_date=1,
            remind_when_overdue=1,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def update_reminder_config(db: Session, user_id: int, config_update):
    """
    Update reminder config for a user. Validates remind_days_before.
    config_update should have optional fields: remind_days_before, remind_on_due_date, remind_when_overdue.
    """
    if config_update.remind_days_before is not None:
        if config_update.remind_days_before not in VALID_REMIND_DAYS_BEFORE:
            raise ValueError(
                f"remind_days_before must be one of {sorted(VALID_REMIND_DAYS_BEFORE)}"
            )

    config = get_reminder_config(db, user_id)

    if config_update.remind_days_before is not None:
        config.remind_days_before = config_update.remind_days_before
    if config_update.remind_on_due_date is not None:
        config.remind_on_due_date = int(config_update.remind_on_due_date)
    if config_update.remind_when_overdue is not None:
        config.remind_when_overdue = int(config_update.remind_when_overdue)

    db.commit()
    db.refresh(config)
    return config


# ============================
# NOTIFICATION CRUD
# ============================

def get_user_notifications(db: Session, user_id: int):
    """Return non-dismissed notifications for a user, ordered by created_at desc."""
    return (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == user_id,
            models.Notification.dismissed == 0,
        )
        .order_by(models.Notification.created_at.desc())
        .all()
    )


def get_unread_count(db: Session, user_id: int):
    """Return count of unread, non-dismissed notifications."""
    return (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == user_id,
            models.Notification.is_read == 0,
            models.Notification.dismissed == 0,
        )
        .count()
    )


def mark_notification_read(db: Session, notification_id: int):
    """Mark a single notification as read."""
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id
    ).first()
    if notification:
        notification.is_read = 1
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_notifications_read(db: Session, user_id: int):
    """Bulk mark all unread notifications as read for a user."""
    db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.is_read == 0,
    ).update({"is_read": 1}, synchronize_session=False)
    db.commit()


def dismiss_notification(db: Session, notification_id: int):
    """Mark a notification as dismissed."""
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id
    ).first()
    if notification:
        notification.dismissed = 1
        db.commit()
        db.refresh(notification)
    return notification


# ============================
# NOTIFICATION SYNC ENGINE
# ============================

def sync_notifications(db: Session, user_id: int):
    """
    Generate notifications for tasks with approaching or passed deadlines.
    Deduplicates by (task_id, type, current date). Runs cleanup at the end.
    """
    today = date.today()
    today_start = datetime.datetime.combine(today, datetime.time.min)
    today_end = datetime.datetime.combine(today, datetime.time.max)

    # Get or create reminder config
    config = get_reminder_config(db, user_id)

    # Query eligible tasks: non-null target_date, status != "Done"
    tasks = (
        db.query(models.Task)
        .filter(
            models.Task.user_id == user_id,
            models.Task.target_date.isnot(None),
            models.Task.status != "Done",
        )
        .all()
    )

    created_count = 0

    for task in tasks:
        days_until = (task.target_date - today).days

        # Upcoming reminder
        if config.remind_days_before > 0 and days_until == config.remind_days_before:
            exists = db.query(models.Notification).filter(
                models.Notification.task_id == task.id,
                models.Notification.type == "upcoming",
                models.Notification.created_at >= today_start,
                models.Notification.created_at <= today_end,
            ).first()
            if not exists:
                notification = models.Notification(
                    user_id=user_id,
                    task_id=task.id,
                    type="upcoming",
                    message=f"'{task.title}' is due in {days_until} day(s)",
                )
                db.add(notification)
                created_count += 1

        # Due today reminder
        if config.remind_on_due_date and days_until == 0:
            exists = db.query(models.Notification).filter(
                models.Notification.task_id == task.id,
                models.Notification.type == "due_today",
                models.Notification.created_at >= today_start,
                models.Notification.created_at <= today_end,
            ).first()
            if not exists:
                notification = models.Notification(
                    user_id=user_id,
                    task_id=task.id,
                    type="due_today",
                    message=f"'{task.title}' is due today",
                )
                db.add(notification)
                created_count += 1

        # Overdue reminder
        if config.remind_when_overdue and days_until < 0:
            exists = db.query(models.Notification).filter(
                models.Notification.task_id == task.id,
                models.Notification.type == "overdue",
                models.Notification.created_at >= today_start,
                models.Notification.created_at <= today_end,
            ).first()
            if not exists:
                days_overdue = abs(days_until)
                notification = models.Notification(
                    user_id=user_id,
                    task_id=task.id,
                    type="overdue",
                    message=f"'{task.title}' is {days_overdue} day(s) overdue",
                )
                db.add(notification)
                created_count += 1

    db.commit()

    # Run cleanup
    cleanup_notifications(db)

    return {"created": created_count}

# ============================
# WEEKLY REVIEW CRUD
# ============================

def get_weekly_reflection(db: Session, user_id: int, week_identifier: str):
    return (
        db.query(models.WeeklyReflection)
        .filter(
            models.WeeklyReflection.user_id == user_id,
            models.WeeklyReflection.week_identifier == week_identifier,
        )
        .first()
    )


def upsert_weekly_reflection(db: Session, user_id: int, week_identifier: str, content: str):
    reflection = get_weekly_reflection(db, user_id, week_identifier)
    if reflection:
        reflection.content = content
        reflection.updated_at = datetime.datetime.utcnow()
    else:
        reflection = models.WeeklyReflection(
            user_id=user_id,
            week_identifier=week_identifier,
            content=content,
        )
        db.add(reflection)
    db.commit()
    db.refresh(reflection)
    return reflection


def get_focus_tasks(db: Session, user_id: int, week_identifier: str):
    from sqlalchemy.orm import joinedload

    return (
        db.query(models.FocusTask)
        .options(joinedload(models.FocusTask.task))
        .filter(
            models.FocusTask.user_id == user_id,
            models.FocusTask.week_identifier == week_identifier,
        )
        .all()
    )


def add_focus_task(db: Session, user_id: int, task_id: int, week_identifier: str):
    focus_task = models.FocusTask(
        user_id=user_id,
        task_id=task_id,
        week_identifier=week_identifier,
    )
    db.add(focus_task)
    db.commit()
    db.refresh(focus_task)
    return focus_task


def remove_focus_task(db: Session, user_id: int, task_id: int, week_identifier: str):
    focus_task = (
        db.query(models.FocusTask)
        .filter(
            models.FocusTask.user_id == user_id,
            models.FocusTask.task_id == task_id,
            models.FocusTask.week_identifier == week_identifier,
        )
        .first()
    )
    if focus_task:
        db.delete(focus_task)
        db.commit()


def count_focus_tasks(db: Session, user_id: int, week_identifier: str) -> int:
    return (
        db.query(func.count(models.FocusTask.id))
        .filter(
            models.FocusTask.user_id == user_id,
            models.FocusTask.week_identifier == week_identifier,
        )
        .scalar()
    )

# ============================
# WATER INTAKE CRUD
# ============================

def create_water_entry(db: Session, user_id: int, entry: schemas.WaterEntryCreate) -> models.WaterEntry:
    db_entry = models.WaterEntry(user_id=user_id, amount_ml=entry.amount_ml)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


def get_water_entries_by_date(db: Session, user_id: int, target_date: date) -> List[models.WaterEntry]:
    start = datetime.datetime.combine(target_date, datetime.time.min)
    end = datetime.datetime.combine(target_date, datetime.time.max)
    return (
        db.query(models.WaterEntry)
        .filter(
            models.WaterEntry.user_id == user_id,
            models.WaterEntry.timestamp >= start,
            models.WaterEntry.timestamp <= end,
        )
        .order_by(models.WaterEntry.timestamp)
        .all()
    )


def delete_water_entry(db: Session, entry_id: int, user_id: int) -> bool:
    entry = db.query(models.WaterEntry).filter(models.WaterEntry.id == entry_id).first()
    if not entry or entry.user_id != user_id:
        return False
    db.delete(entry)
    db.commit()
    return True


def get_daily_progress(
    db: Session, user_id: int, start_date: date, end_date: date
) -> List[schemas.DailyProgressOut]:
    start = datetime.datetime.combine(start_date, datetime.time.min)
    end = datetime.datetime.combine(end_date, datetime.time.max)

    rows = (
        db.query(
            func.date(models.WaterEntry.timestamp).label("entry_date"),
            func.sum(models.WaterEntry.amount_ml).label("total_ml"),
        )
        .filter(
            models.WaterEntry.user_id == user_id,
            models.WaterEntry.timestamp >= start,
            models.WaterEntry.timestamp <= end,
        )
        .group_by(func.date(models.WaterEntry.timestamp))
        .all()
    )

    goal = get_water_goal(db, user_id)
    goal_ml = goal.amount_ml if goal else 2000

    results = []
    for row in rows:
        entry_date = row.entry_date
        if isinstance(entry_date, str):
            entry_date = date.fromisoformat(entry_date)
        total = row.total_ml or 0
        percentage = (total / goal_ml) * 100 if goal_ml > 0 else 0.0
        results.append(
            schemas.DailyProgressOut(
                date=entry_date,
                total_ml=total,
                goal_ml=goal_ml,
                percentage=round(percentage, 1),
            )
        )
    return results


def get_water_goal(db: Session, user_id: int):
    return (
        db.query(models.WaterGoal)
        .filter(models.WaterGoal.user_id == user_id)
        .first()
    )


def upsert_water_goal(db: Session, user_id: int, amount_ml: int) -> models.WaterGoal:
    goal = get_water_goal(db, user_id)
    if goal:
        goal.amount_ml = amount_ml
    else:
        goal = models.WaterGoal(user_id=user_id, amount_ml=amount_ml)
        db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal
