import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getHabits, createHabit, logHabit, updateHabit, deleteHabit, getGoals } from '../api';
import type { Habit, HabitCreate, HabitLog, Goal } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { Plus, Activity, CheckCircle2, Flame, Pencil, Trash2, Calendar, ChevronLeft, ChevronRight, Target, TrendingUp } from 'lucide-react';
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
    setIsModalOpen(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setNewTitle(habit.title);
    setTargetX(habit.target_x);
    setTargetY(habit.target_y_days);
    setStartDate(habit.start_date);
    setGoalId(habit.goal_id || undefined);
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
      if (editingHabit) {
        await updateHabit(user.id, editingHabit.id, {
          title: newTitle,
          target_x: targetX,
          target_y_days: targetY,
          start_date: startDate,
          goal_id: goalId || undefined,
        });
      } else {
        const data: HabitCreate = {
          title: newTitle,
          target_x: targetX,
          target_y_days: targetY,
          start_date: startDate,
          goal_id: goalId,
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

    const isDone = currentLogs.some(l => l.log_date === dateStr && l.status === 'Done');
    const newStatus = isDone ? 'Missed' : 'Done';

    // Optimistic Update
    setHabits(prev => prev.map(h => {
      if (h.id === habitId) {
        let logs = [...(h.logs || [])];
        if (isDone) {
          logs = logs.filter(l => !(l.log_date === dateStr && l.status === 'Done'));
        } else {
          logs.push({ id: Date.now(), habit_id: habitId, log_date: dateStr, status: 'Done' });
        }
        return { ...h, logs };
      }
      return h;
    }));

    try {
      await logHabit(user.id, habitId, newStatus, dateStr);
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
          <h1 className="text-3xl font-extrabold text-white font-['Outfit'] tracking-tight">Habits</h1>
          <p className="text-neutral-500 font-medium mt-1">Consistency is the key to mastery.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)]"
        >
          <Plus className="w-5 h-5" />
          New Habit
        </button>
      </div>

      <div className="grid gap-6">
        {habits.length === 0 ? (
          <div className="glass-panel p-12 rounded-3xl flex flex-col items-center justify-center text-center border-dashed border-white/20">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
              <Activity className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No habits tracked yet</h3>
            <p className="text-neutral-500 max-w-sm mb-6">Build a new routine by tracking your desired actions over set periods.</p>
            <button
              onClick={openCreateModal}
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-colors border border-white/10"
            >
              Start Tracking
            </button>
          </div>
        ) : (
          habits.map(habit => {
            const displayDays = Math.max(30, habit.target_y_days);
            const periodDays = getPastDays(displayDays, viewOffset);
            
            // For the progress bar/target, we always look at the current period (last target_y days from today)
            const currentPeriodDays = getPastDays(habit.target_y_days, 0);
            const logs = habit.logs || [];
            const doneInPeriod = currentPeriodDays.filter(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              return logs.some(l => l.log_date === dateStr && l.status === 'Done');
            }).length;

            const isSuccess = doneInPeriod >= habit.target_x;
            const progressPct = Math.min(100, Math.round((doneInPeriod / habit.target_x) * 100));

            return (
              <div key={habit.id} className="glass-panel p-6 rounded-2xl border border-white/5 group hover:border-indigo-500/40 hover:-translate-y-1 transition-all duration-300">
                <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                  
                  <div className="flex-initial md:w-64 min-w-0 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xl font-bold text-white font-['Outfit'] truncate leading-tight" title={habit.title}>
                          {habit.title}
                        </h3>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button 
                            onClick={(e) => { e.stopPropagation(); openEditModal(habit); }}
                            className="p-1.5 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-lg transition-colors"
                            title="Edit Habit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteHabit(habit.id); }}
                            className="p-1.5 bg-white/5 hover:bg-red-500/10 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Delete Habit"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {habit.current_streak > 0 && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-[10px] font-bold border border-yellow-500/20 shrink-0">
                            <Flame className="w-3 h-3" />
                            {habit.current_streak} Streak
                          </div>
                        )}
                        {/* Habit Strength Badge */}
                        {(() => {
                          const totalLogs = habit.logs?.length || 0;
                          const doneLogs = habit.logs?.filter((l: HabitLog) => l.status === 'Done').length || 0;
                          const daysElapsed = Math.max(1, Math.floor((new Date().getTime() - new Date(habit.start_date).getTime()) / 86400000) + 1);
                          const consistency = Math.min(100, Math.round((doneLogs / daysElapsed) * 100));
                          const cColor = consistency >= 75 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                                        : consistency >= 40 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
                                        : 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                          return totalLogs > 0 ? (
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${cColor}`}>
                              <TrendingUp className="w-3 h-3" />
                              {consistency}%
                            </div>
                          ) : null;
                        })()}
                        {/* Goal Link Badge */}
                        {(() => {
                          const linkedGoal = habit.goal_id ? goals.find(g => g.id === habit.goal_id) : null;
                          return linkedGoal ? (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold border border-indigo-500/20 shrink-0">
                              <Target className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[100px]">{linkedGoal.title}</span>
                            </div>
                          ) : null;
                        })()}
                    </div>

                    <div className="flex flex-col gap-0.5 mt-2">
                      <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Target Status</span>
                      <div className="flex items-baseline gap-1.5">
                        <strong className={`text-2xl font-black font-['Outfit'] ${isSuccess ? 'text-emerald-400' : 'text-white'}`}>
                          {doneInPeriod} / {habit.target_x}
                        </strong>
                        <span className="text-xs text-neutral-400 font-medium whitespace-nowrap">days</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-medium">per {habit.target_y_days}-day period</span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-3 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Activity History</p>
                      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setViewOffset(v => v + 10); }}
                            className="p-1 px-2.5 hover:bg-white/10 rounded-md text-neutral-400 hover:text-white transition-all active:scale-90"
                            title="Older (10 Days)"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-px h-3 bg-white/10 mx-0.5" />
                        <button 
                            onClick={(e) => { e.stopPropagation(); setViewOffset(v => Math.max(0, v - 10)); }}
                            disabled={viewOffset === 0}
                            className="p-1 px-2.5 hover:bg-white/10 rounded-md text-neutral-400 hover:text-white disabled:opacity-10 transition-all active:scale-90"
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
                          
                            return periodDays
                              .filter(date => !isBefore(startOfDay(date), startOfDay(new Date(habit.start_date))))
                              .map((date, idx) => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const isDone = logs.some(l => l.log_date === dateStr && l.status === 'Done');
                            const isFuture = isAfter(startOfDay(date), startOfDay(today));
                            const isBeforeStart = isBefore(startOfDay(date), startOfDay(new Date(habit.start_date)));
                            const isDisabled = isFuture || isBeforeStart;
                            const isToday = isSameDay(date, today);
                            
                            return (
                              <div key={idx} className={`flex flex-col items-center gap-2 min-w-[42px] snap-center transition-opacity duration-300 ${isDisabled ? 'opacity-20' : ''}`}>
                                <span className={`text-[10px] uppercase font-bold transition-colors ${isToday ? 'text-indigo-400 ring-1 ring-indigo-400/30 px-1 rounded' : 'text-neutral-600'}`}>
                                  {format(date, 'EEE')}
                                </span>
                                <button
                                  onClick={(e) => { 
                                    if (isDisabled) return;
                                    e.stopPropagation(); 
                                    handleToggleLog(habit.id, dateStr, logs); 
                                  }}
                                  disabled={isDisabled}
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                                    isDisabled 
                                      ? 'bg-neutral-900/50 border-white/5 cursor-not-allowed' 
                                      : isDone 
                                        ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] active:scale-95' 
                                        : 'bg-white/3 border-white/5 hover:bg-white/8 hover:border-white/10 active:scale-95'
                                  }`}
                                >
                                  {isDone ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                                  ) : (
                                    <div className={`w-2.5 h-2.5 rounded-full transition-colors ${isDisabled ? 'bg-neutral-800' : 'bg-neutral-800'}`} />
                                  )}
                                </button>
                                <span className={`text-[10px] font-medium ${isToday ? 'text-indigo-300' : 'text-neutral-500'}`}>
                                  {format(date, 'd')}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      
                      {/* Subtle shadows to indicate more content */}
                      <div className="absolute inset-y-0 left-0 w-8 bg-linear-to-r from-[#0d0d0d] to-transparent pointer-events-none opacity-0 group-hover/scroll:opacity-100 transition-opacity" />
                      <div className="absolute inset-y-0 right-0 w-8 bg-linear-to-l from-[#0d0d0d] to-transparent pointer-events-none opacity-0 group-hover/scroll:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>

                {/* Progress Bar moved to bottom for full width */}
                <div className="mt-6 flex flex-col gap-2 border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between text-[10px] font-bold tracking-tighter uppercase">
                        <div className="flex items-center gap-2">
                            <span className={isSuccess ? 'text-emerald-400' : 'text-indigo-400'}>{progressPct}% Complete</span>
                            <div className="w-1 h-1 rounded-full bg-neutral-700" />
                            <span className="text-neutral-500">{doneInPeriod} of {habit.target_x} days achieved</span>
                        </div>
                        <span className="text-neutral-600">{habit.target_x - doneInPeriod} more to reach target</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 relative ${
                                isSuccess 
                                    ? 'bg-linear-to-r from-emerald-500 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                                    : 'bg-linear-to-r from-indigo-600 to-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                            }`}
                            style={{ width: `${progressPct}%` }}
                        >
                            <div className="absolute inset-0 bg-white/10 animate-pulse" />
                        </div>
                    </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="glass-panel w-full max-w-md rounded-3xl p-8 shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-2 font-['Outfit']">
              {editingHabit ? 'Edit Habit' : 'Create New Habit'}
            </h2>
            <p className="text-neutral-400 text-sm mb-6">Set a realistic target using the X/Y system.</p>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Habit Name</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                  placeholder="e.g. Read 10 pages, Meditate..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow scheme-dark"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Target Days</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={targetX}
                    onChange={(e) => setTargetX(parseInt(e.target.value))}
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow ${
                        targetX > targetY ? 'border-red-500/50' : 'border-white/10'
                    }`}
                  />
                </div>
                <div className="pt-7 text-neutral-500 font-bold">in</div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Total Days</label>
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
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow ${
                        targetX > targetY ? 'border-red-500/50' : 'border-white/10'
                    }`}
                  />
                  {targetX > targetY && (
                    <p className="absolute -bottom-6 left-0 text-[10px] text-red-400 font-medium">
                        Target cannot be greater than Period
                    </p>
                  )}
                </div>
              </div>

              {/* Computed Last Date */}
              {startDate && targetY > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs text-neutral-400">Ends on:</span>
                  <span className="text-xs font-bold text-indigo-300">
                    {format(addDays(new Date(startDate), targetY), 'MMM d, yyyy')}
                  </span>
                </div>
              )}

              {/* Goal Selector */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Link to Goal (optional)</label>
                <select
                  value={goalId || ''}
                  onChange={(e) => setGoalId(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow appearance-none"
                >
                  <option value="" className="bg-neutral-900">No goal linked</option>
                  {goals.filter(g => g.status === 'Active').map(g => (
                    <option key={g.id} value={g.id} className="bg-neutral-900">{g.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                >
                  {editingHabit ? 'Save Changes' : 'Create Habit'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
