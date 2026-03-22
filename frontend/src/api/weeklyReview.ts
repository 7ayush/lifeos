import api from './config';
import type {
  WeeklyReviewData,
  WeeklyReflection,
  FocusTaskItem,
  TaskCreate,
} from '../types';

// ============================
// WEEKLY REVIEW API
// ============================

export const getWeeklyReview = async (
  userId: number,
  week?: string
): Promise<WeeklyReviewData> => {
  const params: Record<string, string> = {};
  if (week) params.week = week;
  const res = await api.get(`/users/${userId}/weekly-review`, { params });
  return res.data;
};

export const saveReflection = async (
  userId: number,
  week: string,
  content: string
): Promise<WeeklyReflection> => {
  const res = await api.put(`/users/${userId}/weekly-review/${week}/reflection`, { content });
  return res.data;
};

export const addFocusTask = async (
  userId: number,
  week: string,
  taskId: number
): Promise<FocusTaskItem> => {
  const res = await api.post(`/users/${userId}/weekly-review/${week}/focus-tasks`, { task_id: taskId });
  return res.data;
};

export const removeFocusTask = async (
  userId: number,
  week: string,
  taskId: number
): Promise<void> => {
  await api.delete(`/users/${userId}/weekly-review/${week}/focus-tasks/${taskId}`);
};

export const createFocusTask = async (
  userId: number,
  week: string,
  task: TaskCreate
): Promise<FocusTaskItem> => {
  const res = await api.post(`/users/${userId}/weekly-review/${week}/focus-tasks/create`, task);
  return res.data;
};
