export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface Goal {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  status: 'Active' | 'Completed' | 'Abandoned';
  target_date?: string;
  created_at: string;
}

export interface Habit {
  id: number;
  goal_id?: number;
  user_id: number;
  title: string;
  target_x: number;
  target_y_days: number;
  current_streak: number;
  start_date: string;
}

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  status: 'Todo' | 'InProgress' | 'Done';
  timeframe_view: 'Daily' | 'Monthly' | 'Annual';
  target_date?: string;
  created_at: string;
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
