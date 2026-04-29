import api from './config';
import type { Task, TaskCreate, Habit, HabitCreate, JournalEntry, JournalEntryCreate, DashboardStats, DashboardToday, LeaderboardEntry, Goal, GoalCreate, GoalUpdate, GoalDetail, SubTask, Note, NoteCreate, NoteUpdate, PersonalStats, YearInPixelsData, Notification, ReminderConfig, NotificationSyncResponse, Tag, TagCreate } from '../types';

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
// GOALS API
// ============================

export const getGoals = async (userId: number): Promise<Goal[]> => {
  const res = await api.get(`/users/${userId}/goals/`);
  return res.data;
};

export const getGoalDetail = async (userId: number, goalId: number): Promise<GoalDetail> => {
  const res = await api.get(`/users/${userId}/goals/${goalId}`);
  return res.data;
};

export const createGoal = async (userId: number, goal: GoalCreate): Promise<Goal> => {
  const res = await api.post(`/users/${userId}/goals/`, goal);
  return res.data;
};

export const updateGoal = async (userId: number, goalId: number, goal: GoalUpdate): Promise<Goal> => {
  const res = await api.put(`/users/${userId}/goals/${goalId}`, goal);
  return res.data;
};

export const deleteGoal = async (userId: number, goalId: number): Promise<void> => {
  await api.delete(`/users/${userId}/goals/${goalId}`);
};

export const getGoalProgress = async (userId: number, goalId: number): Promise<{ goal_id: number; progress: number }> => {
  const res = await api.get(`/users/${userId}/goals/${goalId}/progress`);
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

export const updateTask = async (userId: number, taskId: number, updates: Partial<Task> & { tag_ids?: number[] }): Promise<Task> => {
  const res = await api.put(`/users/${userId}/tasks/${taskId}`, updates);
  return res.data;
};

export const getTaskById = async (userId: number, taskId: number): Promise<Task> => {
  // Use update with empty body to fetch a task by ID (returns the task unchanged)
  const res = await api.put(`/users/${userId}/tasks/${taskId}`, {});
  return res.data;
};

export const deleteTask = async (userId: number, taskId: number): Promise<void> => {
  await api.delete(`/users/${userId}/tasks/${taskId}`);
};

export const reorderTasks = async (
  userId: number,
  status: string,
  orderedTaskIds: number[]
): Promise<Task[]> => {
  const res = await api.put(`/users/${userId}/tasks/reorder`, {
    status,
    ordered_task_ids: orderedTaskIds,
  });
  return res.data;
};


// ============================
// SUBTASK API
// ============================

export const createSubTask = async (userId: number, taskId: number, title: string): Promise<SubTask> => {
  const res = await api.post(`/users/${userId}/tasks/${taskId}/subtasks`, { title });
  return res.data;
};

export const toggleSubTask = async (userId: number, taskId: number, subtaskId: number): Promise<SubTask> => {
  const res = await api.patch(`/users/${userId}/tasks/${taskId}/subtasks/${subtaskId}/toggle`);
  return res.data;
};

export const deleteSubTask = async (userId: number, taskId: number, subtaskId: number): Promise<void> => {
  await api.delete(`/users/${userId}/tasks/${taskId}/subtasks/${subtaskId}`);
};
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

export const logHabit = async (userId: number, habitId: number, status: 'Done' | 'Missed' | 'Clear', logDate?: string): Promise<Habit> => {
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

export const getPersonalStats = async (userId: number): Promise<PersonalStats> => {
  const res = await api.get(`/analytics/users/${userId}/personal`);
  return res.data;
};

export const getYearInPixels = async (userId: number): Promise<YearInPixelsData> => {
  const res = await api.get(`/analytics/users/${userId}/year-in-pixels`);
  return res.data;
};

// ============================
// NOTES API
// ============================

export const getNotes = async (userId: number, folder?: string): Promise<Note[]> => {
  const params = folder ? { folder } : {};
  const res = await api.get(`/users/${userId}/notes/`, { params });
  return res.data;
};

export const createNote = async (userId: number, note: NoteCreate): Promise<Note> => {
  const res = await api.post(`/users/${userId}/notes/`, note);
  return res.data;
};

export const updateNote = async (userId: number, noteId: number, note: NoteUpdate): Promise<Note> => {
  const res = await api.put(`/users/${userId}/notes/${noteId}`, note);
  return res.data;
};

export const deleteNote = async (userId: number, note_id: number): Promise<void> => {
  await api.delete(`/users/${userId}/notes/${note_id}`);
};

// ============================
// TAGS API
// ============================

export const getTags = async (userId: number): Promise<Tag[]> => {
  const res = await api.get(`/users/${userId}/tags`);
  return res.data;
};

export const createTag = async (userId: number, tag: TagCreate): Promise<Tag> => {
  const res = await api.post(`/users/${userId}/tags`, tag);
  return res.data;
};

export const updateTag = async (userId: number, tagId: number, tag: Partial<TagCreate>): Promise<Tag> => {
  const res = await api.put(`/users/${userId}/tags/${tagId}`, tag);
  return res.data;
};

export const deleteTag = async (userId: number, tagId: number): Promise<void> => {
  await api.delete(`/users/${userId}/tags/${tagId}`);
};

// ============================
// SYNC API
// ============================

export const syncHabits = async (userId: number): Promise<{ created: number; removed: number; total_habits: number }> => {
  const res = await api.post(`/sync/habits/${userId}`);
  return res.data;
};

export const syncRecurringTasks = async (userId: number): Promise<{ created: number; active_templates: number }> => {
  const res = await api.post(`/sync/recurring-tasks/${userId}`);
  return res.data;
};


// ============================
// NOTIFICATIONS API
// ============================

export const syncNotifications = async (userId: number): Promise<NotificationSyncResponse> => {
  const res = await api.post(`/sync/notifications/${userId}`);
  return res.data;
};

export const getNotifications = async (userId: number): Promise<Notification[]> => {
  const res = await api.get(`/users/${userId}/notifications`);
  return res.data;
};

export const getUnreadCount = async (userId: number): Promise<number> => {
  const res = await api.get(`/users/${userId}/notifications/unread-count`);
  return res.data.count;
};

export const markNotificationRead = async (userId: number, notificationId: number): Promise<Notification> => {
  const res = await api.put(`/users/${userId}/notifications/${notificationId}/read`);
  return res.data;
};

export const markAllNotificationsRead = async (userId: number): Promise<void> => {
  await api.put(`/users/${userId}/notifications/read-all`);
};

export const dismissNotification = async (userId: number, notificationId: number): Promise<Notification> => {
  const res = await api.delete(`/users/${userId}/notifications/${notificationId}`);
  return res.data;
};

export const getReminderConfig = async (userId: number): Promise<ReminderConfig> => {
  const res = await api.get(`/users/${userId}/reminder-config`);
  return res.data;
};

export const updateReminderConfig = async (userId: number, config: Partial<ReminderConfig>): Promise<ReminderConfig> => {
  const res = await api.put(`/users/${userId}/reminder-config`, config);
  return res.data;
};

// ============================
// EXPORT API
// ============================

export const exportData = async (
  userId: number,
  format: 'json' | 'csv',
  types: string[],
  startDate?: string,
  endDate?: string,
): Promise<Blob> => {
  const params = new URLSearchParams({
    format,
    types: types.join(','),
  });
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

  const response = await api.get(
    `/users/${userId}/export?${params.toString()}`,
    { responseType: 'blob' }
  );
  return response.data;
};

// ============================
// USER SETTINGS API
// ============================

export const getUserSettings = async (userId: number): Promise<{ theme_preference: string }> => {
  const res = await api.get(`/users/${userId}/settings`);
  return res.data;
};

export const updateUserSettings = async (
  userId: number,
  settings: { theme_preference?: string }
): Promise<{ theme_preference: string }> => {
  const res = await api.patch(`/users/${userId}/settings`, settings);
  return res.data;
};
