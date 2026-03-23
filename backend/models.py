from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, UniqueConstraint, Table
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
    theme_preference = Column(String, default="dark")

    goals = relationship("Goal", back_populates="user")
    habits = relationship("Habit", back_populates="user")
    tasks = relationship("Task", back_populates="user")
    journal_entries = relationship("JournalEntry", back_populates="user")
    notes = relationship("Note", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    reminder_config = relationship("ReminderConfig", back_populates="user", uselist=False)
    tags = relationship("Tag", back_populates="user")
    weekly_reflections = relationship("WeeklyReflection", back_populates="user")
    focus_tasks = relationship("FocusTask", back_populates="user")

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
    snapshots = relationship("ProgressSnapshot", back_populates="goal", cascade="all, delete-orphan")
    milestones = relationship("GoalMilestone", back_populates="goal", cascade="all, delete-orphan")

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
    logs = relationship("HabitLog", back_populates="habit", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="habit", cascade="all, delete-orphan")

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
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=True)
    parent_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="Todo")  # Todo, InProgress, Done
    task_type = Column(String, default="manual")  # manual, habit, recurring
    energy_level = Column(String, nullable=True)  # High, Medium, Low
    estimated_minutes = Column(Integer, nullable=True)
    actual_minutes = Column(Integer, nullable=True)
    target_date = Column(Date, nullable=True)
    priority = Column(String, default="None")  # High, Medium, Low, None
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Recurrence fields (used when task_type = "recurring" and parent_task_id is null, i.e. template)
    frequency_type = Column(String, nullable=True)  # daily, weekly, monthly, annually, custom
    repeat_interval = Column(Integer, default=1)  # e.g. every 2 weeks
    repeat_days = Column(String, nullable=True)  # comma-separated day numbers (0=Sun..6=Sat) for weekly
    ends_type = Column(String, nullable=True)  # never, on, after
    ends_on_date = Column(Date, nullable=True)
    ends_after_occurrences = Column(Integer, nullable=True)

    user = relationship("User", back_populates="tasks")
    goal = relationship("Goal", back_populates="tasks")
    habit = relationship("Habit", back_populates="tasks")
    parent_task = relationship("Task", remote_side=[id], backref="instances")
    subtasks = relationship("SubTask", back_populates="task", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="task", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary="task_tags", backref="tasks")

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

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)  # "upcoming", "due_today", "overdue"
    message = Column(String, nullable=False)
    is_read = Column(Integer, default=0)  # 0 = unread, 1 = read (SQLite boolean)
    dismissed = Column(Integer, default=0)  # 0 = active, 1 = dismissed
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
    task = relationship("Task", back_populates="notifications")


class ReminderConfig(Base):
    __tablename__ = "reminder_configs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    remind_days_before = Column(Integer, default=1)
    remind_on_due_date = Column(Integer, default=1)  # SQLite boolean
    remind_when_overdue = Column(Integer, default=1)  # SQLite boolean

    user = relationship("User", back_populates="reminder_config")



class ProgressSnapshot(Base):
    __tablename__ = "progress_snapshots"
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    date = Column(Date, nullable=False)
    progress = Column(Integer, nullable=False)
    __table_args__ = (UniqueConstraint("goal_id", "date", name="uq_snapshot_goal_date"),)

    goal = relationship("Goal", back_populates="snapshots")


class GoalMilestone(Base):
    __tablename__ = "goal_milestones"
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    threshold = Column(Integer, nullable=False)
    achieved_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("goal_id", "threshold", name="uq_milestone_goal_threshold"),)

    goal = relationship("Goal", back_populates="milestones")


task_tags = Table(
    "task_tags",
    Base.metadata,
    Column("task_id", Integer, ForeignKey("tasks.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(30), nullable=False)
    color = Column(String, nullable=True)
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tag_user_name"),)

    user = relationship("User", back_populates="tags")

class WeeklyReflection(Base):
    __tablename__ = "weekly_reflections"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    week_identifier = Column(String, nullable=False)
    content = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "week_identifier", name="uq_reflection_user_week"),
    )

    user = relationship("User", back_populates="weekly_reflections")


class FocusTask(Base):
    __tablename__ = "focus_tasks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    week_identifier = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "task_id", "week_identifier", name="uq_focus_user_task_week"),
    )

    user = relationship("User", back_populates="focus_tasks")
    task = relationship("Task")

