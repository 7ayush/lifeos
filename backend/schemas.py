from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class GoalBase(BaseModel):
    title: str
    description: Optional[str] = None
    target_date: Optional[date] = None

class GoalCreate(GoalBase):
    pass

class Goal(GoalBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class HabitBase(BaseModel):
    title: str
    target_x: int
    target_y_days: int
    start_date: date

class HabitCreate(HabitBase):
    goal_id: Optional[int] = None

class Habit(HabitBase):
    id: int
    user_id: int
    goal_id: Optional[int]
    current_streak: int
    model_config = ConfigDict(from_attributes=True)

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    timeframe_view: str = "Daily"
    target_date: Optional[date] = None

class TaskCreate(TaskBase):
    pass

class Task(TaskBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class JournalEntryBase(BaseModel):
    entry_date: date
    content: str

class JournalEntryCreate(JournalEntryBase):
    pass

class JournalEntry(JournalEntryBase):
    id: int
    user_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
