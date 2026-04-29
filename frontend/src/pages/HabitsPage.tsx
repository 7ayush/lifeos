import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { getHabits, createHabit, logHabit, updateHabit, deleteHabit, getGoals } from '../api';
import type { Habit, HabitCreate, HabitLog, Goal } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { Plus, Activity, CheckCircle2, Flame, Pencil, Trash2, Calendar, ChevronLeft, ChevronRight, Target, TrendingUp, Repeat, X as XIcon } from 'lucide-react';
import { format, subDays, addDays, isSameDay, isAfter, isBefore, startOfDay } from 'date-fns';

export function HabitsPage() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [targetX, setTargetX] = useState(3);
  const [targetY, setTargetY] = useState(7);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [goalId, setGoalId] = useState<number | undefined>(undefined);
  const [goals, setGoals] = useState<Goal[]>([]);

  // Scheduling state
  const [frequencyType, setFrequencyType] = useState<string>('flexible');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatDays, setRepeatDays] = useState<string>('');
  const [endsType, setEndsType] = useState<string>('never');
  const [endsOnDate, setEndsOnDate] = useState<string>('');
  const [endsAfterOccurrences, setEndsAfterOccurrences] = useState<number>(30);
  const [minThresholdPct, setMinThresholdPct] = useState<number>(80);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState<number | null>(null);

  const [viewOffset, setViewOffset] = useState(0);

  const loadHabits = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getHabits(user.id);
      setHabits(data);
    } catch (err) {
      console.error('Failed to load habits', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadHabits();
    if (user) {
      getGoals(user.id).then(setGoals).catch(console.error);
    }
  }, [user, loadHabits]);

  const scrollRefs = useRef<{ [key: number]: HTMLElement | null }>({});

  useEffect(() => {
    if (!loading && habits.length > 0) {
      setTimeout(() => {
        Object.values(scrollRefs.current).forEach(ref => {
          if (ref instanceof HTMLElement) {
            ref.scrollLeft = ref.scrollWidth;
          }
        });
      }, 100);
    }
  }, [loading, habits.length, viewOffset]);


  const openCreateModal = () => {
    setEditingHabit(null);
    setNewTitle('');
    setTargetX(3);
    setTargetY(7);
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setGoalId(undefined);
    setFrequencyType('flexible');
    setRepeatInterval(1);
    setRepeatDays('');
    setEndsType('never');
    setEndsOnDate('');
    setEndsAfterOccurrences(30);
    setMinThresholdPct(80);
    setIsModalOpen(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setNewTitle(habit.title);
    setTargetX(habit.target_x ?? 3);
    setTargetY(habit.target_y_days ?? 7);
    setStartDate(habit.start_date);
    setGoalId(habit.goal_id || undefined);
    setFrequencyType(habit.frequency_type || 'flexible');
    setRepeatInterval(habit.repeat_interval || 1);
    setRepeatDays(habit.repeat_days || '');
    setEndsType(habit.ends_type || 'never');
    setEndsOnDate(habit.ends_on_date || '');
    setEndsAfterOccurrences(habit.ends_after_occurrences || 30);
    setMinThresholdPct(habit.min_threshold_pct ?? 80);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;
    
    if (targetX > targetY) {
      alert("Target Days cannot be greater than Total Days.");
      return;
    }

    try {
      const scheduleFields = {
        frequency_type: frequencyType,
        repeat_interval: repeatInterval,
        repeat_days: repeatDays || undefined,
        ends_type: endsType,
        ends_on_date: endsType === 'on' ? endsOnDate || undefined : undefined,
        ends_after_occurrences: endsType === 'after' ? endsAfterOccurrences : undefined,
        min_threshold_pct: minThresholdPct,
      };

      if (editingHabit) {
        await updateHabit(user.id, editingHabit.id, {
          title: newTitle,
          target_x: frequencyType === 'flexible' ? targetX : undefined,
          target_y_days: frequencyType === 'flexible' ? targetY : undefined,
          start_date: startDate,
          goal_id: goalId || undefined,
          ...scheduleFields,
        });
      } else {
        const data: HabitCreate = {
          title: newTitle,
          target_x: frequencyType === 'flexible' ? targetX : undefined,
          target_y_days: frequencyType === 'flexible' ? targetY : undefined,
          start_date: startDate,
          goal_id: goalId,
          ...scheduleFields,
        };
        await createHabit(user.id, data);
      }
      setIsModalOpen(false);
      loadHabits();
    } catch (err) {
      console.error('Failed to save habit', err);
    }
  };

  const handleDeleteHabit = async (habitId: number) => {
    setHabitToDelete(habitId);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteHabit = async () => {
    if (!user || habitToDelete === null) return;
    try {
      await deleteHabit(user.id, habitToDelete);
      loadHabits();
    } catch (err) {
      console.error('Failed to delete habit', err);
    }
  };

  const handleToggleLog = async (habitId: number, dateStr: string, currentLogs: HabitLog[]) => {
    if (!user) return;

    // Safety check: prevent logging for future dates
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (dateStr > todayStr) return;

    // Tri-state cycle: unset (no log) → Done → Missed → unset (Clear)
    const existing = currentLogs.find(l => l.log_date === dateStr);
    const current: 'none' | 'Done' | 'Missed' = !existing
      ? 'none'
      : existing.status === 'Done' ? 'Done' : 'Missed';
    const nextApi: 'Done' | 'Missed' | 'Clear' =
      current === 'none' ? 'Done' : current === 'Done' ? 'Missed' : 'Clear';

    // Optimistic update
    setHabits(prev => prev.map(h => {
      if (h.id !== habitId) return h;
      let logs = [...(h.logs || [])];
      logs = logs.filter(l => l.log_date !== dateStr);
      if (nextApi !== 'Clear') {
        logs.push({ id: Date.now(), habit_id: habitId, log_date: dateStr, status: nextApi });
      }
      return { ...h, logs };
    }));

    try {
      await logHabit(user.id, habitId, nextApi, dateStr);
      loadHabits();
    } catch (err) {
      console.error('Failed to log habit', err);
      loadHabits();
    }
  };

  const getPastDays = (numDays: number, offset: number = 0) => {
    const days = [];
    const today = new Date();
    const baseDate = subDays(today, offset);
    for (let i = numDays - 1; i >= 0; i--) {
        days.push(subDays(baseDate, i));
    }
    return days;
  };

  if (loading && habits.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground font-['Outfit'] tracking-tight">Habits</h1>
          <p className="text-muted-foreground font-medium mt-1">Consistency is the key to mastery.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-900 text-indigo-50 hover:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:text-white rounded-xl font-bold transition-all shadow-md dark:shadow-[0_0_20px_rgba(99,102,241,0.2)] dark:hover:shadow-[0_0_25px_rgba(99,102,241,0.4)]"
        >
          <Plus className="w-5 h-5" />
          New Habit
        </button>
      </div>

      <div className="grid gap-6">
        {habits.length === 0 ? (
          <div className="glass-panel p-12 rounded-3xl flex flex-col items-center justify-center text-center border-dashed border-border">
            <div className="w-16 h-16 bg-secondary/50 rounded-2xl flex items-center justify-center mb-4">
              <Activity className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No habits tracked yet</h3>
            <p className="text-muted-foreground max-w-sm mb-6">Build a new routine by tracking your desired actions over set periods.</p>
            <button
              onClick={openCreateModal}
              className="px-6 py-2.5 bg-secondary/50 hover:bg-secondary/50 text-foreground rounded-xl font-semibold transition-colors border border-border"
            >
              Start Tracking
            </button>
          </div>
        ) : (
          habits.map(habit => {
            const isFlexible = !habit.frequency_type || habit.frequency_type === 'flexible';
            const logs = habit.logs || [];

            // Calculate expected days and done count based on schedule type
            let expectedDays: number;
            let lookbackDays: number;
            let doneInPeriod: number;

            if (isFlexible) {
              lookbackDays = habit.target_y_days || 7;
              expectedDays = habit.target_x || 1;
              const currentPeriodDays = getPastDays(lookbackDays, 0);
              doneInPeriod = currentPeriodDays.filter(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                return logs.some(l => l.log_date === dateStr && l.status === 'Done');
              }).length;
            } else {
              // For scheduled habits, compute expected days in the last 30 days
              lookbackDays = 30;
              const periodDaysForCalc = getPastDays(lookbackDays, 0);
              const habitStart = startOfDay(new Date(habit.start_date));
              const activeDays = periodDaysForCalc.filter(d => !isBefore(startOfDay(d), habitStart));

              // Count expected scheduled days
              const interval = habit.repeat_interval || 1;
              const repeatDaysList = habit.repeat_days ? habit.repeat_days.split(',').map(Number) : [];

              const isScheduledDay = (d: Date): boolean => {
                switch (habit.frequency_type) {
                  case 'daily':
                    // Every N days from start
                    const diffDays = Math.floor((d.getTime() - habitStart.getTime()) / 86400000);
                    return diffDays >= 0 && diffDays % interval === 0;
                  case 'weekly':
                    if (repeatDaysList.length > 0) {
                      return repeatDaysList.includes(d.getDay());
                    }
                    const diffWeekDays = Math.floor((d.getTime() - habitStart.getTime()) / 86400000);
                    return diffWeekDays >= 0 && diffWeekDays % (interval * 7) === 0;
                  case 'monthly':
                    return d.getDate() === habitStart.getDate();
                  case 'annually':
                    return d.getDate() === habitStart.getDate() && d.getMonth() === habitStart.getMonth();
                  case 'custom':
                    if (repeatDaysList.length > 0) {
                      return repeatDaysList.includes(d.getDay());
                    }
                    const diffCustom = Math.floor((d.getTime() - habitStart.getTime()) / 86400000);
                    return diffCustom >= 0 && diffCustom % interval === 0;
                  default:
                    return true;
                }
              };

              expectedDays = activeDays.filter(d => isScheduledDay(d)).length || 1;
              doneInPeriod = activeDays.filter(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                return logs.some(l => l.log_date === dateStr && l.status === 'Done');
              }).length;
            }

            const threshold = habit.min_threshold_pct ?? 80;
            const thresholdTarget = Math.ceil(expectedDays * threshold / 100);
            const isSuccess = doneInPeriod >= thresholdTarget;
            const progressPct = expectedDays > 0 ? Math.min(100, Math.round((doneInPeriod / expectedDays) * 100)) : 0;
            const displayDays = Math.max(30, lookbackDays);
            const periodDays = getPastDays(displayDays, viewOffset);

            return (
              <div key={habit.id} className="glass-panel p-6 rounded-2xl border border-border group hover:border-indigo-500/40 hover:-translate-y-1 transition-all duration-300">
                <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                  
                  <div className="flex-initial md:w-64 min-w-0 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xl font-bold text-foreground font-['Outfit'] truncate leading-tight" title={habit.title}>
                          {habit.title}
                        </h3>
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            onClick={(e) => { e.stopPropagation(); openEditModal(habit); }}
                            className="p-1.5 bg-secondary/50 hover:bg-secondary/50 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                            title="Edit Habit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteHabit(habit.id); }}
                            className="p-1.5 bg-secondary/50 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 rounded-lg transition-colors"
                            title="Delete Habit"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {habit.current_streak > 0 && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-yellow-500/10 text-amber-950 dark:text-yellow-400 text-[10px] font-bold border border-amber-200 dark:border-yellow-500/20 shrink-0">
                            <Flame className="w-3 h-3" />
                            {habit.current_streak} Streak
                          </div>
                        )}
                        {/* Habit Strength Badge */}
                        {(() => {
                          const doneLogs = habit.logs?.filter((l: HabitLog) => l.status === 'Done').length || 0;
                          if (doneLogs === 0) return null;

                          // For scheduled habits, count only scheduled days elapsed
                          let scheduledDaysElapsed: number;
                          if (isFlexible) {
                            scheduledDaysElapsed = Math.max(1, Math.floor((new Date().getTime() - new Date(habit.start_date).getTime()) / 86400000) + 1);
                          } else {
                            scheduledDaysElapsed = expectedDays;
                          }

                          const consistency = Math.min(100, Math.round((doneLogs / Math.max(1, scheduledDaysElapsed)) * 100));
                          const cColor = consistency >= 75 ? 'text-emerald-950 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/20' 
                                        : consistency >= 40 ? 'text-amber-950 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/20' 
                                        : 'text-rose-950 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/20';
                          return (
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${cColor}`}>
                              <TrendingUp className="w-3 h-3" />
                              {consistency}%
                            </div>
                          );
                        })()}
                        {/* Goal Link Badge */}
                        {(() => {
                          const linkedGoal = habit.goal_id ? goals.find(g => g.id === habit.goal_id) : null;
                          return linkedGoal ? (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/10 text-indigo-950 dark:text-indigo-400 text-[10px] font-bold border border-indigo-200 dark:border-indigo-500/20 shrink-0">
                              <Target className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[100px]">{linkedGoal.title}</span>
                            </div>
                          ) : null;
                        })()}
                    </div>

                    <div className="flex flex-col gap-0.5 mt-2">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Target Status</span>
                      <div className="flex items-baseline gap-1.5">
                        <strong className={`text-2xl font-black font-['Outfit'] ${isSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                          {doneInPeriod} / {expectedDays}
                        </strong>
                        <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">days</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {isFlexible ? `per ${lookbackDays}-day period` : `last ${lookbackDays} days`}
                        {' · '}min {threshold}%
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-3 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Activity History</p>
                      <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setViewOffset(v => v + 10); }}
                            className="p-1 px-2.5 hover:bg-secondary/50 rounded-md text-muted-foreground hover:text-foreground transition-all active:scale-90"
                            title="Older (10 Days)"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-px h-3 bg-border mx-0.5" />
                        <button 
                            onClick={(e) => { e.stopPropagation(); setViewOffset(v => Math.max(0, v - 10)); }}
                            disabled={viewOffset === 0}
                            className="p-1 px-2.5 hover:bg-secondary/50 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-10 transition-all active:scale-90"
                            title="Newer (10 Days)"
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="relative group/scroll">
                      <div 
                        ref={(el) => { if (el) scrollRefs.current[habit.id] = el; }}
                        className="flex gap-2.5 pb-3 overflow-x-auto custom-scrollbar-hidden md:custom-scrollbar scroll-smooth min-w-0 snap-x"
                      >
                        {(() => {
                          const today = new Date();
                          const habitStart = startOfDay(new Date(habit.start_date));
                          const interval = habit.repeat_interval || 1;
                          const repeatDaysList = habit.repeat_days ? habit.repeat_days.split(',').map(Number) : [];

                          const isScheduledDay = (d: Date): boolean => {
                            if (isFlexible) return true;
                            switch (habit.frequency_type) {
                              case 'daily': {
                                const diff = Math.floor((startOfDay(d).getTime() - habitStart.getTime()) / 86400000);
                                return diff >= 0 && diff % interval === 0;
                              }
                              case 'weekly':
                                if (repeatDaysList.length > 0) return repeatDaysList.includes(d.getDay());
                                const diffW = Math.floor((startOfDay(d).getTime() - habitStart.getTime()) / 86400000);
                                return diffW >= 0 && diffW % (interval * 7) === 0;
                              case 'monthly':
                                return d.getDate() === habitStart.getDate();
                              case 'annually':
                                return d.getDate() === habitStart.getDate() && d.getMonth() === habitStart.getMonth();
                              case 'custom':
                                if (repeatDaysList.length > 0) return repeatDaysList.includes(d.getDay());
                                const diffC = Math.floor((startOfDay(d).getTime() - habitStart.getTime()) / 86400000);
                                return diffC >= 0 && diffC % interval === 0;
                              default:
                                return true;
                            }
                          };

                          return periodDays
                              .filter(date => !isBefore(startOfDay(date), habitStart))
                              .filter(date => {
                                // For scheduled habits: show only scheduled days, today (for adhoc), and days with logs
                                if (isFlexible) return true;
                                const isToday = isSameDay(date, today);
                                const dateStr = format(date, 'yyyy-MM-dd');
                                const hasLog = logs.some(l => l.log_date === dateStr);
                                return isScheduledDay(date) || isToday || hasLog;
                              })
                              .map((date, idx) => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const existingLog = logs.find(l => l.log_date === dateStr);
                            const logStatus: 'none' | 'Done' | 'Missed' = !existingLog
                              ? 'none'
                              : existingLog.status === 'Done' ? 'Done' : 'Missed';
                            const isFuture = isAfter(startOfDay(date), startOfDay(today));
                            const isBeforeStart = isBefore(startOfDay(date), habitStart);
                            const isDisabled = isFuture || isBeforeStart;
                            const isToday = isSameDay(date, today);
                            const isScheduled = isScheduledDay(date);
                            const isAdhoc = !isFlexible && !isScheduled && isToday;

                            // Button styling per tri-state
                            let buttonClass: string;
                            if (isDisabled) {
                              buttonClass = 'bg-secondary/50 border-border cursor-not-allowed';
                            } else if (logStatus === 'Done') {
                              buttonClass = 'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] active:scale-95';
                            } else if (logStatus === 'Missed') {
                              buttonClass = 'bg-rose-100 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)] active:scale-95';
                            } else if (isAdhoc) {
                              buttonClass = 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/10 hover:border-amber-300 dark:hover:border-amber-500/30 active:scale-95';
                            } else {
                              buttonClass = 'bg-secondary/50 border-border hover:bg-secondary/80 hover:border-border active:scale-95';
                            }

                            return (
                              <div key={idx} className={`flex flex-col items-center gap-2 min-w-[42px] snap-center transition-opacity duration-300 ${isDisabled ? 'opacity-20' : ''}`}>
                                <span className={`text-[10px] uppercase font-bold transition-colors ${isToday ? 'text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/30 px-1 rounded' : isAdhoc ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                  {format(date, 'EEE')}
                                </span>
                                <button
                                  onClick={(e) => {
                                    if (isDisabled) return;
                                    e.stopPropagation();
                                    handleToggleLog(habit.id, dateStr, logs);
                                  }}
                                  disabled={isDisabled}
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${buttonClass}`}
                                  title={
                                    logStatus === 'Done' ? 'Done — click to mark Missed'
                                    : logStatus === 'Missed' ? 'Missed — click to clear'
                                    : isAdhoc ? 'Not scheduled — adhoc tracking'
                                    : 'Click to mark Done'
                                  }
                                >
                                  {logStatus === 'Done' ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                                  ) : logStatus === 'Missed' ? (
                                    <XIcon className="w-5 h-5 text-rose-600 dark:text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                                  ) : (
                                    <div className={`w-2.5 h-2.5 rounded-full transition-colors ${isDisabled ? 'bg-muted' : isAdhoc ? 'bg-amber-500/40' : 'bg-muted'}`} />
                                  )}
                                </button>
                                <span className={`text-[10px] font-medium ${isToday ? 'text-indigo-600 dark:text-indigo-300' : 'text-muted-foreground'}`}>
                                  {format(date, 'd')}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      
                      {/* Subtle shadows to indicate more content */}
                      <div className="absolute inset-y-0 left-0 w-8 bg-linear-to-r from-card to-transparent pointer-events-none opacity-0 group-hover/scroll:opacity-100 transition-opacity" />
                      <div className="absolute inset-y-0 right-0 w-8 bg-linear-to-l from-card to-transparent pointer-events-none opacity-0 group-hover/scroll:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>

                {/* Progress Bar moved to bottom for full width */}
                <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4">
                    <div className="flex items-center justify-between text-[10px] font-bold tracking-tighter uppercase">
                        <div className="flex items-center gap-2">
                            <span className={isSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}>{progressPct}% Complete</span>
                            <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                            <span className="text-muted-foreground">{doneInPeriod} of {expectedDays} days achieved</span>
                        </div>
                        <span className="text-muted-foreground">{Math.max(0, thresholdTarget - doneInPeriod)} more to reach {threshold}% target</span>
                    </div>
                    <div className="w-full h-2 bg-secondary/50 rounded-full overflow-hidden border border-border">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 relative ${
                                isSuccess 
                                    ? 'bg-linear-to-r from-emerald-500 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                                    : 'bg-linear-to-r from-indigo-600 to-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                            }`}
                            style={{ width: `${progressPct}%` }}
                        >
                            <div className="absolute inset-0 bg-foreground/10 animate-pulse" />
                        </div>
                    </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
          <div className="relative bg-popover w-full max-w-md rounded-3xl p-8 shadow-2xl border border-border" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-foreground mb-2 font-['Outfit']">
              {editingHabit ? 'Edit Habit' : 'Create New Habit'}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">Set a realistic target using the X/Y system.</p>
            
            <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Habit Name</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                  placeholder="e.g. Read 10 pages, Meditate..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-11 pr-4 py-3.5 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                  />
                </div>
              </div>

              {/* Schedule Type */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <span className="flex items-center gap-2"><Repeat className="w-4 h-4 text-indigo-400" /> Schedule</span>
                </label>
                <select
                  value={frequencyType}
                  onChange={(e) => setFrequencyType(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow appearance-none"
                >
                  <option value="flexible" className="bg-popover">Flexible (X days in Y days)</option>
                  <option value="daily" className="bg-popover">Daily</option>
                  <option value="weekly" className="bg-popover">Weekly</option>
                  <option value="monthly" className="bg-popover">Monthly</option>
                  <option value="annually" className="bg-popover">Annually</option>
                  <option value="custom" className="bg-popover">Custom</option>
                </select>
              </div>

              {/* Flexible: X/Y target */}
              {frequencyType === 'flexible' && (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-foreground mb-2">Target Days</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={targetX}
                      onChange={(e) => setTargetX(parseInt(e.target.value))}
                      className={`w-full bg-secondary/50 border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow ${
                          targetX > targetY ? 'border-red-500/50' : 'border-border'
                      }`}
                    />
                  </div>
                  <div className="pt-7 text-muted-foreground font-bold">in</div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-foreground mb-2">Total Days</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      required
                      value={targetY}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) setTargetY(val);
                      }}
                      className={`w-full bg-secondary/50 border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow ${
                          targetX > targetY ? 'border-red-500/50' : 'border-border'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Repeat Interval for non-flexible */}
              {frequencyType !== 'flexible' && (
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground whitespace-nowrap">Repeat every</label>
                  <input
                    type="number"
                    min="1"
                    value={repeatInterval}
                    onChange={(e) => setRepeatInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-foreground text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <span className="text-sm text-muted-foreground font-medium">
                    {frequencyType === 'daily' && (repeatInterval === 1 ? 'day' : 'days')}
                    {frequencyType === 'weekly' && (repeatInterval === 1 ? 'week' : 'weeks')}
                    {frequencyType === 'monthly' && (repeatInterval === 1 ? 'month' : 'months')}
                    {frequencyType === 'annually' && (repeatInterval === 1 ? 'year' : 'years')}
                    {frequencyType === 'custom' && (repeatInterval === 1 ? 'day' : 'days')}
                  </span>
                </div>
              )}

              {/* Day-of-week picker for weekly */}
              {(frequencyType === 'weekly' || frequencyType === 'custom') && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">Repeat on</label>
                  <div className="flex gap-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, idx) => {
                      const selected = repeatDays.split(',').filter(Boolean).includes(String(idx));
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const current = repeatDays.split(',').filter(Boolean);
                            const dayStr = String(idx);
                            const next = selected
                              ? current.filter(d => d !== dayStr)
                              : [...current, dayStr];
                            setRepeatDays(next.sort().join(','));
                          }}
                          className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${
                            selected
                              ? 'bg-indigo-900 border border-indigo-900 dark:border-transparent text-indigo-50 dark:bg-indigo-500 dark:text-white shadow-md dark:shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                              : 'bg-secondary/50 text-muted-foreground border border-border hover:bg-secondary/80'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ends configuration */}
              {frequencyType !== 'flexible' && (
                <div className="space-y-3 p-4 rounded-xl bg-secondary/30 border border-border">
                  <label className="block text-sm font-medium text-foreground">Ends</label>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="endsType"
                        value="never"
                        checked={endsType === 'never'}
                        onChange={() => setEndsType('never')}
                        className="accent-indigo-500"
                      />
                      <span className="text-sm text-foreground">Never</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="endsType"
                        value="on"
                        checked={endsType === 'on'}
                        onChange={() => setEndsType('on')}
                        className="accent-indigo-500"
                      />
                      <span className="text-sm text-foreground">On</span>
                      {endsType === 'on' && (
                        <input
                          type="date"
                          value={endsOnDate}
                          onChange={(e) => setEndsOnDate(e.target.value)}
                          className="bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                      )}
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="endsType"
                        value="after"
                        checked={endsType === 'after'}
                        onChange={() => setEndsType('after')}
                        className="accent-indigo-500"
                      />
                      <span className="text-sm text-foreground">After</span>
                      {endsType === 'after' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={endsAfterOccurrences}
                            onChange={(e) => setEndsAfterOccurrences(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                          <span className="text-sm text-muted-foreground">occurrences</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {/* Schedule Summary */}
              {frequencyType !== 'flexible' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                  <Repeat className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs text-muted-foreground">
                    {(() => {
                      const intervalText = repeatInterval > 1 ? `${repeatInterval} ` : '';
                      const unitMap: Record<string, [string, string]> = {
                        daily: ['day', 'days'],
                        weekly: ['week', 'weeks'],
                        monthly: ['month', 'months'],
                        annually: ['year', 'years'],
                        custom: ['day', 'days'],
                      };
                      const [singular, plural] = unitMap[frequencyType] || ['', ''];
                      const unit = repeatInterval > 1 ? plural : singular;
                      let summary = `Every ${intervalText}${unit}`;
                      if ((frequencyType === 'weekly' || frequencyType === 'custom') && repeatDays) {
                        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        const days = repeatDays.split(',').filter(Boolean).map(d => dayNames[parseInt(d)]).join(', ');
                        summary += ` on ${days}`;
                      }
                      if (endsType === 'on' && endsOnDate) summary += ` until ${format(new Date(endsOnDate), 'MMM d, yyyy')}`;
                      if (endsType === 'after') summary += `, ${endsAfterOccurrences} times`;
                      return summary;
                    })()}
                  </span>
                </div>
              )}

              {/* Computed Last Date for flexible */}
              {frequencyType === 'flexible' && startDate && targetY > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs text-muted-foreground">Ends on:</span>
                  <span className="text-xs font-bold text-indigo-300">
                    {format(addDays(new Date(startDate), targetY), 'MMM d, yyyy')}
                  </span>
                </div>
              )}

              {/* Minimum Adherence Threshold */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Minimum Adherence Threshold
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={minThresholdPct}
                    onChange={(e) => setMinThresholdPct(parseInt(e.target.value))}
                    className="flex-1 accent-indigo-500 h-2 rounded-full"
                  />
                  <span className="text-lg font-bold text-indigo-400 min-w-[3.5rem] text-right">{minThresholdPct}%</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  You should complete this habit at least {minThresholdPct}% of scheduled times.
                </p>
              </div>

              {/* Goal Selector */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Link to Goal (optional)</label>
                <select
                  value={goalId || ''}
                  onChange={(e) => {
                    const selectedId = e.target.value ? parseInt(e.target.value) : undefined;
                    setGoalId(selectedId);
                    if (selectedId) {
                      const goal = goals.find(g => g.id === selectedId);
                      if (goal?.target_date) {
                        setEndsType('on');
                        setEndsOnDate(goal.target_date);
                      }
                    }
                  }}
                  className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow appearance-none"
                >
                  <option value="" className="bg-popover">No goal linked</option>
                  {goals.filter(g => g.status === 'Active').map(g => (
                    <option key={g.id} value={g.id} className="bg-popover">
                      {g.title}{g.target_date ? ` (due ${format(new Date(g.target_date), 'MMM d, yyyy')})` : ''}
                    </option>
                  ))}
                </select>
                {goalId && (() => {
                  const linkedGoal = goals.find(g => g.id === goalId);
                  return linkedGoal?.target_date ? (
                    <p className="text-[11px] text-indigo-400 mt-1.5 flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      End date set to goal deadline — you can change it above.
                    </p>
                  ) : null;
                })()}
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-6 py-2.5 bg-indigo-900 border-indigo-900 text-indigo-50 hover:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:text-white border dark:border-transparent rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md dark:shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                >
                  {editingHabit ? 'Save Changes' : 'Create Habit'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteHabit}
        title="Delete Habit"
        message="Are you sure you want to delete this habit? This action cannot be undone."
        confirmText="Delete Habit"
      />
    </div>
  );
}
