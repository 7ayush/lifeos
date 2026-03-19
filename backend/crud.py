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

# ============================
# HABIT CRUD
# ============================

def create_user_habit(db: Session, habit: schemas.HabitCreate, user_id: int):
    db_habit = models.Habit(**habit.model_dump(), user_id=user_id)
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

    # Recalculate streak
    habit = db.query(models.Habit).filter(models.Habit.id == habit_id).first()
    if habit:
        # Simple streak calculation: If today's log is Done, increment, otherwise reset
        # For a full implementation, this needs to look back at consecutive days
        if status == "Done":
            habit.current_streak += 1
        else:
            habit.current_streak = 0
        db.commit()

    return db_log

def get_habit_logs(db: Session, habit_id: int):
    return db.query(models.HabitLog).filter(models.HabitLog.habit_id == habit_id).all()

def update_user_habit(db: Session, habit_id: int, habit: schemas.HabitUpdate):
    db_habit = db.query(models.Habit).filter(models.Habit.id == habit_id).first()
    if db_habit:
        update_data = habit.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_habit, key, value)
        db.commit()
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

def update_task(db: Session, task_id: int, status: str = None, title: str = None, description: str = None, target_date = None):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if db_task:
        if status:
            db_task.status = status
        if title:
            db_task.title = title
        if description is not None:
            db_task.description = description
        if target_date is not None:
            db_task.target_date = target_date
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
