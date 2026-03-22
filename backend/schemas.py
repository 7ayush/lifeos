from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List, Literal
from datetime import date, datetime

PriorityLevel = Literal["High", "Medium", "Low", "None"]


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


class ProgressSnapshotOut(BaseModel):
    date: date
    progress: int

class GoalMilestoneOut(BaseModel):
    threshold: int
    achieved_at: datetime

class GoalWithProgress(Goal):
    progress: int = 0

class GoalDetailWithHistory(GoalDetail):
    progress: int = 0
    milestones: List[GoalMilestoneOut] = []
    progress_history: List[ProgressSnapshotOut] = []


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
# TAG SCHEMAS
# ============================

TAG_COLORS = [
    "#ef4444",  # red
    "#f97316",  # orange
    "#eab308",  # yellow
    "#22c55e",  # green
    "#06b6d4",  # cyan
    "#3b82f6",  # blue
    "#8b5cf6",  # purple
    "#ec4899",  # pink
]

class TagBase(BaseModel):
    name: str
    color: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Tag name must not be empty or whitespace-only")
        if len(v) > 30:
            raise ValueError("Tag name must be 30 characters or fewer")
        return v

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in TAG_COLORS:
            raise ValueError(f"Color must be one of {TAG_COLORS}")
        return v

class TagCreate(TagBase):
    pass

class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("Tag name must not be empty or whitespace-only")
            if len(v) > 30:
                raise ValueError("Tag name must be 30 characters or fewer")
        return v

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in TAG_COLORS:
            raise ValueError(f"Color must be one of {TAG_COLORS}")
        return v

class TagOut(TagBase):
    id: int
    user_id: int
    model_config = ConfigDict(from_attributes=True)


# ============================
# TASK SCHEMAS
# ============================

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    target_date: Optional[date] = None
    goal_id: Optional[int] = None
    habit_id: Optional[int] = None
    task_type: Optional[str] = "manual"  # manual, habit, recurring
    energy_level: Optional[str] = None  # High, Medium, Low
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    priority: Optional[PriorityLevel] = "None"

class TaskCreate(TaskBase):
    frequency_type: Optional[str] = None  # daily, weekly, monthly, annually, custom
    repeat_interval: Optional[int] = 1
    repeat_days: Optional[str] = None  # comma-separated day numbers (0=Sun..6=Sat)
    ends_type: Optional[str] = None  # never, on, after
    ends_on_date: Optional[date] = None
    ends_after_occurrences: Optional[int] = None
    tag_ids: Optional[List[int]] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    target_date: Optional[date] = None
    goal_id: Optional[int] = None
    habit_id: Optional[int] = None
    task_type: Optional[str] = None
    energy_level: Optional[str] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    priority: Optional[PriorityLevel] = None
    frequency_type: Optional[str] = None
    repeat_interval: Optional[int] = None
    repeat_days: Optional[str] = None
    ends_type: Optional[str] = None
    ends_on_date: Optional[date] = None
    ends_after_occurrences: Optional[int] = None
    tag_ids: Optional[List[int]] = None

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
    habit_id: Optional[int] = None
    task_type: Optional[str] = "manual"
    parent_task_id: Optional[int] = None
    frequency_type: Optional[str] = None
    repeat_interval: Optional[int] = 1
    repeat_days: Optional[str] = None
    ends_type: Optional[str] = None
    ends_on_date: Optional[date] = None
    ends_after_occurrences: Optional[int] = None
    sort_order: Optional[int] = 0
    subtasks: Optional[List[SubTask]] = []
    tags: Optional[List[TagOut]] = []
    model_config = ConfigDict(from_attributes=True)

class RecurringSyncResponse(BaseModel):
    created: int
    active_templates: int


class ReorderRequest(BaseModel):
    status: str
    ordered_task_ids: List[int]



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


# ============================
# NOTIFICATION SCHEMAS
# ============================

class NotificationOut(BaseModel):
    id: int
    user_id: int
    task_id: int
    type: str
    message: str
    is_read: bool
    dismissed: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class NotificationSyncResponse(BaseModel):
    created: int

class UnreadCountResponse(BaseModel):
    count: int


# ============================
# REMINDER CONFIG SCHEMAS
# ============================

class ReminderConfigOut(BaseModel):
    user_id: int
    remind_days_before: int
    remind_on_due_date: bool
    remind_when_overdue: bool
    model_config = ConfigDict(from_attributes=True)

class ReminderConfigUpdate(BaseModel):
    remind_days_before: Optional[int] = None
    remind_on_due_date: Optional[bool] = None
    remind_when_overdue: Optional[bool] = None


# ============================
# WEEKLY REVIEW SCHEMAS
# ============================

class WeeklyReflectionIn(BaseModel):
    content: str

class WeeklyReflectionOut(BaseModel):
    id: int
    user_id: int
    week_identifier: str
    content: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class FocusTaskIn(BaseModel):
    task_id: int

class FocusTaskOut(BaseModel):
    id: int
    user_id: int
    task_id: int
    week_identifier: str
    task_title: str
    task_status: str
    task_priority: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class CompletedTaskOut(BaseModel):
    id: int
    title: str
    priority: str
    goal_title: Optional[str] = None
    completed_date: date

class HabitWeekSummary(BaseModel):
    habit_id: int
    title: str
    adherence_rate: float
    current_streak: int
    daily_status: dict[str, str]

class GoalWeekProgress(BaseModel):
    goal_id: int
    title: str
    priority: str
    current_progress: int
    progress_delta: int
    target_date: Optional[date] = None

class JournalEntrySummary(BaseModel):
    id: int
    entry_date: date
    mood: Optional[int] = None
    content_preview: str

class DailyTaskCount(BaseModel):
    day: str
    count: int

class WeekComparisonStats(BaseModel):
    completion_rate: float
    previous_completion_rate: float
    completion_rate_change: float
    habit_adherence_rate: float
    previous_habit_adherence_rate: float
    habit_adherence_rate_change: float
    total_estimated_minutes: int
    total_actual_minutes: int
    efficiency_ratio: float

class WeeklyReviewResponse(BaseModel):
    week_identifier: str
    week_start: date
    week_end: date
    completed_tasks: dict[str, list[CompletedTaskOut]]
    total_tasks: int
    completed_task_count: int
    completion_rate: float
    habits: list[HabitWeekSummary]
    overall_habit_adherence: float
    goals: list[GoalWeekProgress]
    journal_entries: list[JournalEntrySummary]
    average_mood: Optional[float] = None
    reflection: Optional[WeeklyReflectionOut] = None
    focus_tasks: list[FocusTaskOut]
    daily_task_counts: list[DailyTaskCount]
    comparison: WeekComparisonStats
