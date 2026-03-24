import api from './config';
import type { WaterEntry, WaterGoal, DailyProgress } from '../types';

// ============================
// WATER INTAKE API
// ============================

export const createWaterEntry = async (amount_ml: number): Promise<WaterEntry> => {
  const res = await api.post('/api/water/entries', { amount_ml });
  return res.data;
};

export const getWaterEntries = async (date: string): Promise<WaterEntry[]> => {
  const res = await api.get('/api/water/entries', { params: { date } });
  return res.data;
};

export const deleteWaterEntry = async (entryId: number): Promise<void> => {
  await api.delete(`/api/water/entries/${entryId}`);
};

export const getDailyProgress = async (startDate: string, endDate: string): Promise<DailyProgress[]> => {
  const res = await api.get('/api/water/progress', {
    params: { start_date: startDate, end_date: endDate },
  });
  return res.data;
};

export const getWaterGoal = async (): Promise<WaterGoal> => {
  const res = await api.get('/api/water/goal');
  return res.data;
};

export const updateWaterGoal = async (amount_ml: number): Promise<WaterGoal> => {
  const res = await api.put('/api/water/goal', { amount_ml });
  return res.data;
};
