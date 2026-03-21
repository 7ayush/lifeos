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
    category: Optional[str] = "Project"  # Project, Area, Resource, Archive
    priority: Optional[str] = "Medium"  # High, Medium, Low
    target_date: Optional[date] = None

class GoalCreate(GoalBase):
    pass

class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    target_date: Optional[date] = None

class Goal(GoalBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class GoalDetail(Goal):
    """Goal with linked habits and tasks for the detail view."""
    habits: List['Habit'] = []
    tasks: List['Task'] = []
    progress: float = 0.0


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
    target_x: Optional[int] = None
    target_y_days: Optional[int] = None
    start_date: date
    frequency_type: Optional[str] = "flexible"  # flexible, daily, weekly, monthly, annually, custom
    repeat_interval: Optional[int] = 1
    repeat_days: Optional[str] = None  # comma-separated day numbers (0=Sun..6=Sat)
    ends_type: Optional[str] = "never"  # never, on, after
    ends_on_date: Optional[date] = None
    ends_after_occurrences: Optional[int] = None

class HabitCreate(HabitBase):
    goal_id: Optional[int] = None

class HabitUpdate(BaseModel):
    title: Optional[str] = None
    target_x: Optional[int] = None
    target_y_days: Optional[int] = None
    start_date: Optional[date] = None
    goal_id: Optional[int] = None
    frequency_type: Optional[str] = None
    repeat_interval: Optional[int] = None
    repeat_days: Optional[str] = None
    ends_type: Optional[str] = None
    ends_on_date: Optional[date] = None
    ends_after_occurrences: Optional[int] = None

class Habit(HabitBase):
    id: int
    user_id: int
    goal_id: Optional[int]
    current_streak: int
    frequency_type: Optional[str] = "flexible"
    repeat_interval: Optional[int] = 1
    repeat_days: Optional[str] = None
    ends_type: Optional[str] = "never"
    ends_on_date: Optional[date] = None
    ends_after_occurrences: Optional[int] = None
    logs: Optional[List[HabitLog]] = []
    model_config = ConfigDict(from_attributes=True)


# ============================
# TASK SCHEMAS
# ============================

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    target_date: Optional[date] = None
    goal_id: Optional[int] = None
    energy_level: Optional[str] = None  # High, Medium, Low
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    target_date: Optional[date] = None
    goal_id: Optional[int] = None
    energy_level: Optional[str] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None

class SubTaskBase(BaseModel):
    title: str
    is_complete: Optional[int] = 0

class SubTaskCreate(SubTaskBase):
    pass

class SubTask(SubTaskBase):
    id: int
    task_id: int
    model_config = ConfigDict(from_attributes=True)

class Task(TaskBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    subtasks: Optional[List[SubTask]] = []
    model_config = ConfigDict(from_attributes=True)


# ============================
# JOURNAL SCHEMAS
# ============================

class JournalEntryBase(BaseModel):
    entry_date: date
    content: str
    mood: Optional[int] = None  # 1-5 scale

class JournalEntryCreate(JournalEntryBase):
    pass

class JournalEntry(JournalEntryBase):
    id: int
    user_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ============================
# NOTE SCHEMAS
# ============================

class NoteBase(BaseModel):
    title: str
    content: Optional[str] = ""
    folder: Optional[str] = "Resource"  # Project, Area, Resource, Archive

class NoteCreate(NoteBase):
    pass

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    folder: Optional[str] = None

class Note(NoteBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
