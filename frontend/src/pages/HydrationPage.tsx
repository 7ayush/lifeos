import { useState, useEffect, useCallback } from 'react';
import { Droplets, Plus, Trash2, Trophy, GlassWater } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { createWaterEntry, getWaterEntries, deleteWaterEntry, getDailyProgress, getWaterGoal, updateWaterGoal } from '../api/water';
import type { WaterEntry, DailyProgress } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

const QUICK_ADD_AMOUNTS = [250, 500, 750];

function formatTime(timestamp: string): string {
  return format(new Date(timestamp), 'h:mm a');
}

function getDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(getDateStr(subDays(new Date(), i)));
  }
  return days;
}

export function HydrationPage() {
  const today = getDateStr(new Date());

  const [selectedDate, setSelectedDate] = useState(today);
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [progressData, setProgressData] = useState<DailyProgress[]>([]);
  const [goalMl, setGoalMl] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [goalError, setGoalError] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);

  const last7Days = getLast7Days();

  const loadGoal = useCallback(async () => {
    try {
      const g = await getWaterGoal();
      setGoalMl(g.amount_ml);
    } catch (err) {
      console.error('Failed to load water goal', err);
    }
  }, []);

  const loadEntries = useCallback(async () => {
    try {
      const data = await getWaterEntries(selectedDate);
      setEntries(data);
    } catch (err) {
      console.error('Failed to load water entries', err);
    }
  }, [selectedDate]);

  const loadProgress = useCallback(async () => {
    try {
      const start = last7Days[0];
      const end = last7Days[last7Days.length - 1];
      const data = await getDailyProgress(start, end);
      setProgressData(data);
    } catch (err) {
      console.error('Failed to load daily progress', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadGoal(), loadEntries(), loadProgress()]);
      setLoading(false);
    };
    init();
  }, [loadGoal, loadEntries, loadProgress]);

  // Refresh entries when selectedDate changes (after initial load)
  useEffect(() => {
    if (!loading) {
      loadEntries();
    }
  }, [selectedDate]);

  const selectedProgress = progressData.find(p => p.date === selectedDate);
  const totalMl = selectedProgress?.total_ml ?? 0;
  const percentage = goalMl > 0 ? Math.min(Math.round((totalMl / goalMl) * 100), 100) : 0;
  const goalReached = totalMl >= goalMl;

  const handleAddEntry = async (amount: number) => {
    try {
      await createWaterEntry(amount);
      await Promise.all([loadEntries(), loadProgress()]);
    } catch (err) {
      console.error('Failed to add water entry', err);
    }
  };

  const handleCustomAdd = async () => {
    const val = parseInt(customAmount, 10);
    if (isNaN(val) || val < 1 || val > 5000) {
      setCustomError('Enter a value between 1 and 5000 ml');
      return;
    }
    setCustomError('');
    setCustomAmount('');
    await handleAddEntry(val);
  };

  const handleDeleteEntry = async () => {
    if (entryToDelete === null) return;
    try {
      await deleteWaterEntry(entryToDelete);
      await Promise.all([loadEntries(), loadProgress()]);
    } catch (err) {
      console.error('Failed to delete water entry', err);
    }
  };

  const handleGoalSave = async () => {
    const val = parseInt(goalInput, 10);
    if (isNaN(val) || val < 500 || val > 10000) {
      setGoalError('Goal must be between 500 and 10000 ml');
      return;
    }
    setGoalError('');
    try {
      await updateWaterGoal(val);
      setGoalMl(val);
      setEditingGoal(false);
      await loadProgress();
    } catch (err) {
      console.error('Failed to update goal', err);
    }
  };

  const handleBarClick = (date: string) => {
    setSelectedDate(date);
  };

  // Chart calculations
  const maxBarValue = Math.max(goalMl, ...progressData.map(p => p.total_ml), 1);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground font-['Outfit'] tracking-tight">Hydration</h1>
          <p className="text-muted-foreground font-medium mt-1">Stay hydrated, stay healthy.</p>
        </div>
        <div className="flex items-center gap-2">
          {editingGoal ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={goalInput}
                onChange={e => { setGoalInput(e.target.value); setGoalError(''); }}
                className="w-28 bg-secondary/50 border border-border rounded-xl px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="ml"
                min={500}
                max={10000}
              />
              <button
                onClick={handleGoalSave}
                className="px-4 py-2 bg-indigo-900 border-indigo-900 text-indigo-50 hover:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:text-white border dark:border-transparent rounded-xl font-bold text-sm transition-all"
              >
                Save
              </button>
              <button
                onClick={() => { setEditingGoal(false); setGoalError(''); }}
                className="px-3 py-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingGoal(true); setGoalInput(String(goalMl)); }}
              className="flex items-center gap-2 px-4 py-2 bg-secondary/50 hover:bg-secondary/80 text-foreground rounded-xl font-semibold text-sm transition-colors border border-border"
            >
              <GlassWater className="w-4 h-4 text-indigo-400" />
              Goal: {goalMl} ml
            </button>
          )}
        </div>
      </div>
      {goalError && <p className="text-rose-400 text-sm mb-4 -mt-4">{goalError}</p>}

      {/* Daily Progress Section */}
      <div className="glass-panel p-6 rounded-2xl border border-border mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Droplets className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-foreground font-['Outfit']">
            Daily Progress — {selectedDate === today ? 'Today' : format(new Date(selectedDate + 'T00:00:00'), 'MMM d, yyyy')}
          </h2>
          {goalReached && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-950 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">
              <Trophy className="w-3.5 h-3.5" />
              Goal Reached!
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-2xl font-black font-['Outfit'] text-foreground">{totalMl} ml</span>
            <span className="text-sm text-muted-foreground font-medium">of {goalMl} ml ({percentage}%)</span>
          </div>
          <div className="w-full h-3 bg-secondary/50 rounded-full overflow-hidden border border-border">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                goalReached
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Quick-add buttons */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {QUICK_ADD_AMOUNTS.map(amount => (
            <button
              key={amount}
              onClick={() => handleAddEntry(amount)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-950 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-400 rounded-xl font-bold text-sm transition-all border border-indigo-200 dark:border-indigo-500/20 hover:border-indigo-300 dark:hover:border-indigo-500/40 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              {amount} ml
            </button>
          ))}
        </div>

        {/* Custom amount input */}
        <div className="flex items-center gap-2 mb-6">
          <input
            type="number"
            value={customAmount}
            onChange={e => { setCustomAmount(e.target.value); setCustomError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleCustomAdd(); }}
            className="w-32 bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            placeholder="Custom ml"
            min={1}
            max={5000}
          />
          <button
            onClick={handleCustomAdd}
            className="px-4 py-2.5 bg-indigo-900 border-indigo-900 text-indigo-50 hover:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:text-white border dark:border-transparent rounded-xl font-bold text-sm transition-all active:scale-95"
          >
            Add
          </button>
          {customError && <span className="text-rose-400 text-sm">{customError}</span>}
        </div>

        {/* Entry list */}
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Entries</h3>
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No entries yet for this date.</p>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-4 py-3 bg-secondary/30 rounded-xl border border-border group hover:border-indigo-500/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Droplets className="w-4 h-4 text-indigo-400/60" />
                    <span className="font-semibold text-foreground">{entry.amount_ml} ml</span>
                    <span className="text-muted-foreground text-sm">{formatTime(entry.timestamp)}</span>
                  </div>
                  <button
                    onClick={() => { setEntryToDelete(entry.id); setDeleteConfirmOpen(true); }}
                    className="p-1.5 text-muted-foreground hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-rose-500/10"
                    title="Delete entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* History Section — 7-day bar chart */}
      <div className="glass-panel p-6 rounded-2xl border border-border">
        <h2 className="text-lg font-bold text-foreground font-['Outfit'] mb-6">7-Day History</h2>

        <div className="relative">
          {/* Chart area */}
          <div className="flex items-end gap-2 sm:gap-4" style={{ height: 200 }}>
            {last7Days.map(date => {
              const dp = progressData.find(p => p.date === date);
              const total = dp?.total_ml ?? 0;
              const barHeight = maxBarValue > 0 ? Math.max((total / maxBarValue) * 100, 2) : 2;
              const isSelected = date === selectedDate;
              const isToday = date === today;
              const meetsGoal = total >= goalMl;

              return (
                <div
                  key={date}
                  className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
                  onClick={() => handleBarClick(date)}
                >
                  {/* Amount label */}
                  <span className="text-[10px] font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    {total} ml
                  </span>

                  {/* Bar container */}
                  <div className="w-full flex items-end justify-center" style={{ height: 160 }}>
                    <div
                      className={`w-full max-w-[48px] rounded-t-lg transition-all duration-300 ${
                        meetsGoal
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                          : 'bg-gradient-to-t from-indigo-600 to-indigo-400'
                      } ${
                        isSelected
                          ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-card'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>

                  {/* Day label */}
                  <span className={`text-xs font-bold ${isToday ? 'text-indigo-400' : isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {format(new Date(date + 'T00:00:00'), 'EEE')}
                  </span>
                  <span className={`text-[10px] ${isToday ? 'text-indigo-300' : 'text-muted-foreground'}`}>
                    {format(new Date(date + 'T00:00:00'), 'M/d')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Goal reference line */}
          {maxBarValue > 0 && (
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed border-amber-500/50 pointer-events-none"
              style={{
                bottom: `${(goalMl / maxBarValue) * 160 + 40}px`,
              }}
            >
              <span className="absolute -top-4 right-0 text-[10px] font-bold text-amber-400">
                Goal: {goalMl} ml
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => { setDeleteConfirmOpen(false); setEntryToDelete(null); }}
        onConfirm={handleDeleteEntry}
        title="Delete Entry"
        message="Are you sure you want to delete this water entry? This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
