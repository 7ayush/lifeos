export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  status: string; // 'Todo', 'InProgress', 'Done'
  target_date?: string;
  created_at: string;
}

export interface TaskCreate {
  title: string;
  description?: string;
  target_date?: string;
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
  target_x: number;
  target_y_days: number;
  start_date: string;
  current_streak: number;
  logs?: HabitLog[];
}

export interface HabitCreate {
  title: string;
  target_x: number;
  target_y_days: number;
  start_date: string;
  goal_id?: number;
}

export interface JournalEntry {
  id: number;
  user_id: number;
  entry_date: string;
  content: string;
  created_at: string;
}

export interface JournalEntryCreate {
  entry_date: string;
  content: string;
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
