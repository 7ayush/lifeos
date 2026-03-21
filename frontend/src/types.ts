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

export interface GoalDetail extends Goal {
  habits: Habit[];
  tasks: Task[];
  progress: number;
}

export interface SubTask {
  id: number;
  task_id: number;
  title: string;
  is_complete: number;
}

export interface Task {
  id: number;
  user_id: number;
  goal_id?: number;
  title: string;
  description?: string;
  status: string; // 'Todo', 'InProgress', 'Done'
  energy_level?: string; // 'High', 'Medium', 'Low'
  estimated_minutes?: number;
  actual_minutes?: number;
  target_date?: string;
  created_at: string;
  subtasks?: SubTask[];
}

export interface TaskCreate {
  title: string;
  description?: string;
  target_date?: string;
  goal_id?: number;
  energy_level?: string;
  estimated_minutes?: number;
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

export interface DashboardStats {
  active_streaks: number;
  goal_completion_percentage: number;
  task_efficiency_percentage: number;
  upcoming_deadlines: number;
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
