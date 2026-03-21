from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)
    google_id = Column(String, unique=True, nullable=True, index=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    goals = relationship("Goal", back_populates="user")
    habits = relationship("Habit", back_populates="user")
    tasks = relationship("Task", back_populates="user")
    journal_entries = relationship("JournalEntry", back_populates="user")
    notes = relationship("Note", back_populates="user")

class Goal(Base):
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="Active")  # Active, Completed, Archived
    category = Column(String, default="Project")  # P.A.R.A.: Project, Area, Resource, Archive
    priority = Column(String, default="Medium")  # High, Medium, Low
    target_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="goals")
    habits = relationship("Habit", back_populates="goal")
    tasks = relationship("Task", back_populates="goal")

class Habit(Base):
    __tablename__ = "habits"
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    target_x = Column(Integer, nullable=True)  # nullable for scheduled habits
    target_y_days = Column(Integer, nullable=True)  # nullable for scheduled habits
    current_streak = Column(Integer, default=0)
    start_date = Column(Date, nullable=False)

    # Recurrence fields
    frequency_type = Column(String, default="flexible")  # flexible, daily, weekly, monthly, annually, custom
    repeat_interval = Column(Integer, default=1)  # e.g. every 2 weeks
    repeat_days = Column(String, nullable=True)  # comma-separated day numbers (0=Sun..6=Sat) for weekly
    ends_type = Column(String, default="never")  # never, on, after
    ends_on_date = Column(Date, nullable=True)
    ends_after_occurrences = Column(Integer, nullable=True)

    user = relationship("User", back_populates="habits")
    goal = relationship("Goal", back_populates="habits")
    logs = relationship("HabitLog", back_populates="habit")

class HabitLog(Base):
    __tablename__ = "habit_logs"
    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"))
    log_date = Column(Date, nullable=False)
    status = Column(String, nullable=False) # "Done", "Missed"

    habit = relationship("Habit", back_populates="logs")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="Todo")  # Todo, InProgress, Done
    energy_level = Column(String, nullable=True)  # High, Medium, Low
    estimated_minutes = Column(Integer, nullable=True)
    actual_minutes = Column(Integer, nullable=True)
    target_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="tasks")
    goal = relationship("Goal", back_populates="tasks")
    subtasks = relationship("SubTask", back_populates="task", cascade="all, delete-orphan")

class SubTask(Base):
    __tablename__ = "subtasks"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    title = Column(String, nullable=False)
    is_complete = Column(Integer, default=0)  # 0 = incomplete, 1 = complete

    task = relationship("Task", back_populates="subtasks")

class JournalEntry(Base):
    __tablename__ = "journal_entries"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    entry_date = Column(Date, nullable=False)
    content = Column(Text, nullable=False)
    mood = Column(Integer, nullable=True)  # 1-5 scale
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="journal_entries")
    tags = relationship("JournalTag", back_populates="journal_entry")

class JournalTag(Base):
    __tablename__ = "journal_tags"
    id = Column(Integer, primary_key=True, index=True)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"))
    entity_type = Column(String, nullable=False) # "Goal", "Habit", "Task"
    entity_id = Column(Integer, nullable=False)

    journal_entry = relationship("JournalEntry", back_populates="tags")

class Note(Base):
    __tablename__ = "notes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True, default="")
    folder = Column(String, default="Resource")  # Project, Area, Resource, Archive
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="notes")
