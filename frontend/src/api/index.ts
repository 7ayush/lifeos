import api from './config';
import type { Task, TaskCreate, Habit, HabitCreate, JournalEntry, JournalEntryCreate, DashboardStats, DashboardToday, LeaderboardEntry } from '../types';

// ============================
// DASHBOARD API
// ============================

export const getDashboardStats = async (userId: number): Promise<DashboardStats> => {
  const res = await api.get(`/users/${userId}/dashboard/stats`);
  return res.data;
};

export const getDashboardToday = async (userId: number): Promise<DashboardToday> => {
  const res = await api.get(`/users/${userId}/dashboard/today`);
  return res.data;
};

// ============================
// TASKS API
// ============================

export const getTasks = async (userId: number, startDate?: string, endDate?: string): Promise<Task[]> => {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const res = await api.get(`/users/${userId}/tasks/`, { params });
  return res.data;
};

export const createTask = async (userId: number, task: TaskCreate): Promise<Task> => {
  const res = await api.post(`/users/${userId}/tasks/`, task);
  return res.data;
};

export const updateTask = async (userId: number, taskId: number, updates: Partial<Task>): Promise<Task> => {
  const res = await api.put(`/users/${userId}/tasks/${taskId}`, updates);
  return res.data;
};

export const deleteTask = async (userId: number, taskId: number): Promise<void> => {
  await api.delete(`/users/${userId}/tasks/${taskId}`);
};

// ============================
// HABITS API
// ============================

export const getHabits = async (userId: number): Promise<Habit[]> => {
  const res = await api.get(`/users/${userId}/habits/`);
  return res.data;
};

export const createHabit = async (userId: number, habit: HabitCreate): Promise<Habit> => {
  const res = await api.post(`/users/${userId}/habits/`, habit);
  return res.data;
};

export const logHabit = async (userId: number, habitId: number, status: 'Done' | 'Missed', logDate?: string): Promise<Habit> => {
  const params = { status, log_date: logDate };
  const res = await api.post(`/users/${userId}/habits/${habitId}/log`, null, { params });
  return res.data;
};

export const updateHabit = async (userId: number, habitId: number, habit: Partial<HabitCreate>): Promise<Habit> => {
  const res = await api.put(`/users/${userId}/habits/${habitId}`, habit);
  return res.data;
};

export const deleteHabit = async (userId: number, habitId: number): Promise<void> => {
  await api.delete(`/users/${userId}/habits/${habitId}`);
};

// ============================
// JOURNAL API
// ============================

export const getJournalEntries = async (userId: number): Promise<JournalEntry[]> => {
  const res = await api.get(`/users/${userId}/journal/`);
  return res.data;
};

export const createJournalEntry = async (userId: number, entry: JournalEntryCreate): Promise<JournalEntry> => {
  const res = await api.post(`/users/${userId}/journal/`, entry);
  return res.data;
};

export const updateJournalEntry = async (userId: number, entryId: number, entry: JournalEntryCreate): Promise<JournalEntry> => {
  const res = await api.put(`/users/${userId}/journal/${entryId}`, entry);
  return res.data;
};

export const deleteJournalEntry = async (userId: number, entryId: number): Promise<void> => {
  await api.delete(`/users/${userId}/journal/${entryId}`);
};

// ============================
// LEADERBOARD API
// ============================

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const res = await api.get(`/analytics/leaderboard`);
  return res.data;
};
