from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    goals = relationship("Goal", back_populates="user")
    habits = relationship("Habit", back_populates="user")
    tasks = relationship("Task", back_populates="user")
    journal_entries = relationship("JournalEntry", back_populates="user")

class Goal(Base):
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="Active")
    target_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="goals")
    habits = relationship("Habit", back_populates="goal")

class Habit(Base):
    __tablename__ = "habits"
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    target_x = Column(Integer, nullable=False)
    target_y_days = Column(Integer, nullable=False)
    current_streak = Column(Integer, default=0)
    start_date = Column(Date, nullable=False)

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
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="Todo") # "Todo", "InProgress", "Done"
    timeframe_view = Column(String, default="Daily") # "Daily", "Monthly", "Annual"
    target_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="tasks")

class JournalEntry(Base):
    __tablename__ = "journal_entries"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    entry_date = Column(Date, nullable=False)
    content = Column(Text, nullable=False)
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
