export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface Goal {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  status: string; // 'Active', 'Completed', 'Archived'
  category: string; // 'Project', 'Area', 'Resource', 'Archive'
  priority: string; // 'High', 'Medium', 'Low'
  target_date?: string;
  created_at: string;
  progress?: number;
}

export interface GoalCreate {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  target_date?: string;
}

export interface GoalUpdate {
  title?: string;
  description?: string;
  status?: string;
  category?: string;
  priority?: string;
  target_date?: string;
}

export interface ProgressSnapshot {
  date: string;
  progress: number;
}

export interface GoalMilestone {
  threshold: number;
  achieved_at: string;
}

export interface GoalDetail extends Goal {
  habits: Habit[];
  tasks: Task[];
  progress: number;
  milestones: GoalMilestone[];
  progress_history: ProgressSnapshot[];
}

export interface SubTask {
  id: number;
  task_id: number;
  title: string;
  is_complete: number;
}

export interface Tag {
  id: number;
  name: string;
  color: string | null;
}

export interface TagCreate {
  name: string;
  color?: string;
}

export interface Task {
  id: number;
  user_id: number;
  goal_id?: number;
  habit_id?: number;
  parent_task_id?: number | null;
  task_type: string; // 'manual', 'habit', 'recurring'
  title: string;
  description?: string;
  status: string; // 'Todo', 'InProgress', 'Done'
  energy_level?: string; // 'High', 'Medium', 'Low'
  estimated_minutes?: number;
  actual_minutes?: number;
  target_date?: string;
  created_at: string;
  subtasks?: SubTask[];
  priority?: string;
  frequency_type?: string;
  repeat_interval?: number;
  repeat_days?: string;
  ends_type?: string;
  ends_on_date?: string;
  ends_after_occurrences?: number;
  sort_order?: number;
  tags?: Tag[];
}

export interface TaskCreate {
  title: string;
  description?: string;
  target_date?: string;
  goal_id?: number;
  habit_id?: number;
  task_type?: string;
  energy_level?: string;
  estimated_minutes?: number;
  priority?: string;
  frequency_type?: string;
  repeat_interval?: number;
  repeat_days?: string;
  ends_type?: string;
  ends_on_date?: string;
  ends_after_occurrences?: number;
  tag_ids?: number[];
}

export interface HabitLog {
  id: number;
  habit_id: number;
  log_date: string;
  status: string;
}

export interface Habit {
  id: number;
  user_id: number;
  goal_id?: number;
  title: string;
  target_x?: number;
  target_y_days?: number;
  start_date: string;
  current_streak: number;
  frequency_type?: string; // flexible, daily, weekly, monthly, annually, custom
  repeat_interval?: number;
  repeat_days?: string; // comma-separated day numbers (0=Sun..6=Sat)
  ends_type?: string; // never, on, after
  ends_on_date?: string;
  ends_after_occurrences?: number;
  min_threshold_pct?: number;
  logs?: HabitLog[];
}

export interface HabitCreate {
  title: string;
  target_x?: number;
  target_y_days?: number;
  start_date: string;
  goal_id?: number;
  frequency_type?: string;
  repeat_interval?: number;
  repeat_days?: string;
  ends_type?: string;
  ends_on_date?: string;
  ends_after_occurrences?: number;
  min_threshold_pct?: number;
}

export interface JournalEntry {
  id: number;
  user_id: number;
  entry_date: string;
  content: string;
  mood?: number; // 1-5 scale
  created_at: string;
}

export interface JournalEntryCreate {
  entry_date: string;
  content: string;
  mood?: number;
}

export interface Note {
  id: number;
  user_id: number;
  title: string;
  content: string;
  folder: string; // 'Project', 'Area', 'Resource', 'Archive'
  created_at: string;
  updated_at: string;
}

export interface NoteCreate {
  title: string;
  content?: string;
  folder?: string;
}

export interface NoteUpdate {
  title?: string;
  content?: string;
  folder?: string;
}

export interface TaskEfficiencyBreakdown {
  daily: number;
  monthly: number;
  annual: number;
}

export interface ActiveGoalSummary {
  id: number;
  title: string;
  priority: string;
  progress: number;
  category: string;
  target_date?: string | null;
}

export interface DashboardStats {
  active_streaks: number;
  goal_completion_percentage: number;
  task_efficiency: TaskEfficiencyBreakdown;
  upcoming_deadlines: number;
  active_goals?: ActiveGoalSummary[];
}

export interface DashboardToday {
  habits: Habit[];
  tasks: Task[];
}

export interface LeaderboardEntry {
  user_id: number;
  username: string;
  goal_rate: number;
  habit_index: number;
  snap_streaks: number;
  task_efficiency: number;
  growth_score: number;
}

export interface PersonalStats {
  growth_score: number;
  goal_score: number;
  habit_score: number;
  task_score: number;
  journal_score: number;
  streak_score: number;
  total_goals: number;
  completed_goals: number;
  total_tasks: number;
  done_tasks: number;
  total_habits: number;
  active_streaks: number;
  journal_entries: number;
}

export interface PixelDay {
  date: string;
  mood: number | null;
  habit_ratio: number;
  intensity: number;
}

export interface YearInPixelsData {
  pixels: PixelDay[];
  start_date: string;
  end_date: string;
}

export interface Notification {
  id: number;
  user_id: number;
  task_id: number;
  type: 'upcoming' | 'due_today' | 'overdue';
  message: string;
  is_read: boolean;
  dismissed: boolean;
  created_at: string;
}

export interface ReminderConfig {
  user_id: number;
  remind_days_before: number;
  remind_on_due_date: boolean;
  remind_when_overdue: boolean;
}

export interface NotificationSyncResponse {
  created: number;
}

export interface WeeklyReflection {
  id: number;
  user_id: number;
  week_identifier: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface FocusTaskItem {
  id: number;
  user_id: number;
  task_id: number;
  week_identifier: string;
  task_title: string;
  task_status: string;
  task_priority: string;
  created_at: string;
}

export interface CompletedTaskItem {
  id: number;
  title: string;
  priority: string;
  goal_title: string | null;
  completed_date: string;
}

export interface HabitWeekSummary {
  habit_id: number;
  title: string;
  adherence_rate: number;
  current_streak: number;
  daily_status: Record<string, string>;
}

export interface GoalWeekProgress {
  goal_id: number;
  title: string;
  priority: string;
  current_progress: number;
  progress_delta: number;
  target_date: string | null;
}

export interface JournalEntrySummary {
  id: number;
  entry_date: string;
  mood: number | null;
  content_preview: string;
}

export interface DailyTaskCount {
  day: string;
  count: number;
}

export interface WeekComparisonStats {
  completion_rate: number;
  previous_completion_rate: number;
  completion_rate_change: number;
  habit_adherence_rate: number;
  previous_habit_adherence_rate: number;
  habit_adherence_rate_change: number;
  total_estimated_minutes: number;
  total_actual_minutes: number;
  efficiency_ratio: number;
}

export interface WeeklyReviewData {
  week_identifier: string;
  week_start: string;
  week_end: string;
  completed_tasks: Record<string, CompletedTaskItem[]>;
  total_tasks: number;
  completed_task_count: number;
  completion_rate: number;
  habits: HabitWeekSummary[];
  overall_habit_adherence: number;
  goals: GoalWeekProgress[];
  journal_entries: JournalEntrySummary[];
  average_mood: number | null;
  reflection: WeeklyReflection | null;
  focus_tasks: FocusTaskItem[];
  daily_task_counts: DailyTaskCount[];
  comparison: WeekComparisonStats;
}
