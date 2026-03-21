from sqlalchemy.orm import Session
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
    data = habit.model_dump(exclude_none=True)
    # SQLite NOT NULL constraint on legacy columns — default to 0 for scheduled habits
    data.setdefault('target_x', 0)
    data.setdefault('target_y_days', 0)
    db_habit = models.Habit(**data, user_id=user_id)
    db.add(db_habit)
    db.commit()
    db.refresh(db_habit)
    return db_habit

def get_user_habits(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Habit).filter(models.Habit.user_id == user_id).offset(skip).limit(limit).all()

def log_habit(db: Session, habit_id: int, status: str, log_date):
    # Check if a log already exists for this date
    existing_log = db.query(models.HabitLog).filter(
        models.HabitLog.habit_id == habit_id,
        models.HabitLog.log_date == log_date
    ).first()

    if existing_log:
        existing_log.status = status
        db_log = existing_log
    else:
        db_log = models.HabitLog(habit_id=habit_id, status=status, log_date=log_date)
        db.add(db_log)
    
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
# TASK CRUD
# ============================

def create_user_task(db: Session, task: schemas.TaskCreate, user_id: int):
    db_task = models.Task(**task.model_dump(), user_id=user_id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def get_user_tasks(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Task).filter(models.Task.user_id == user_id).offset(skip).limit(limit).all()

def update_task(db: Session, task_id: int, task_update: schemas.TaskUpdate):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if db_task:
        update_data = task_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_task, key, value)
        db.commit()
        db.refresh(db_task)
    return db_task

def delete_task(db: Session, task_id: int):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if db_task:
        db.delete(db_task)
        db.commit()
        return True
    return False

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

