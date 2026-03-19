from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date, datetime


# ============================
# AUTH SCHEMAS
# ============================

class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token


class UserProfile(BaseModel):
    id: int
    username: str
    email: str
    avatar_url: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserProfile


# ============================
# USER SCHEMAS
# ============================

class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    avatar_url: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ============================
# GOAL SCHEMAS
# ============================

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


class HabitLogBase(BaseModel):
    log_date: date
    status: str

class HabitLogCreate(HabitLogBase):
    pass

class HabitLog(HabitLogBase):
    id: int
    habit_id: int
    model_config = ConfigDict(from_attributes=True)


# ============================
# HABIT SCHEMAS
# ============================

class HabitBase(BaseModel):
    title: str
    target_x: int
    target_y_days: int
    start_date: date

class HabitCreate(HabitBase):
    goal_id: Optional[int] = None

class HabitUpdate(BaseModel):
    title: Optional[str] = None
    target_x: Optional[int] = None
    target_y_days: Optional[int] = None
    start_date: Optional[date] = None
    goal_id: Optional[int] = None

class Habit(HabitBase):
    id: int
    user_id: int
    goal_id: Optional[int]
    current_streak: int
    logs: Optional[List[HabitLog]] = []
    model_config = ConfigDict(from_attributes=True)


# ============================
# TASK SCHEMAS
# ============================

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    target_date: Optional[date] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    target_date: Optional[date] = None

class Task(TaskBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ============================
# JOURNAL SCHEMAS
# ============================

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
