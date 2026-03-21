import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardStats, getDashboardToday, logHabit, updateTask, getGoals } from '../api';
import type { DashboardStats, DashboardToday, Goal } from '../types';
import { Target, Activity, CheckSquare, Clock, Zap, CheckCircle2, Circle, Flame, Star, TrendingUp, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayData, setTodayData] = useState<DashboardToday | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const loadDashboardData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [statsRes, todayRes, goalsRes] = await Promise.all([
        getDashboardStats(user.id),
        getDashboardToday(user.id),
        getGoals(user.id),
      ]);
      setStats(statsRes);
      setTodayData(todayRes);
      setGoals(goalsRes);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const handleToggleHabit = async (habitId: number, currentLogs: any[]) => {
    if (!user) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const hasLoggedToday = currentLogs?.some(l => l.log_date === todayStr && l.status === 'Done');
    const newStatus = hasLoggedToday ? 'Missed' : 'Done';

    setTodayData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        habits: prev.habits.map(h => {
          if (h.id === habitId) {
            let logs = [...(h.logs || [])];
            if (hasLoggedToday) {
              logs = logs.filter(l => !(l.log_date === todayStr && l.status === 'Done'));
            } else {
              logs.push({ id: Date.now(), habit_id: habitId, log_date: todayStr, status: 'Done' });
            }
            return { ...h, logs, current_streak: newStatus === 'Done' ? h.current_streak + 1 : Math.max(0, h.current_streak - 1) };
          }
          return h;
        })
      };
    });

    try {
      await logHabit(user.id, habitId, newStatus);
      loadDashboardData();
    } catch (err) {
      console.error('Failed to log habit', err);
      loadDashboardData();
    }
  };

  const handleToggleTask = async (taskId: number) => {
    if (!user) return;

    setTodayData(prev => {
      if (!prev) return prev;
      return { ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) };
    });

    try {
      await updateTask(user.id, taskId, { status: 'Done' });
      loadDashboardData();
    } catch (err) {
      console.error('Failed to complete task', err);
      loadDashboardData();
    }
  };

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Computed data
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const totalHabits = todayData?.habits.length || 0;
  const completedHabits = todayData?.habits.filter(h => h.logs?.some(l => l.log_date === todayStr && l.status === 'Done')).length || 0;
  const allHabitsDone = totalHabits > 0 && completedHabits === totalHabits;

  // Most Important Task (first task due today/overdue)
  const mit = todayData?.tasks?.[0] || null;

  // Most critical pending habit (not done today, highest streak)
  const criticalHabit = todayData?.habits
    .filter(h => !h.logs?.some(l => l.log_date === todayStr && l.status === 'Done'))
    .sort((a, b) => b.current_streak - a.current_streak)[0] || null;

  // Active goals sorted by priority
  const activeGoals = goals
    .filter(g => g.status === 'Active')
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
      return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
    })
    .slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-emerald-400 to-cyan-500 font-['Outfit'] tracking-tight drop-shadow-sm">
          {getGreeting()}, {user.username.split(' ')[0]}
        </h1>
        <p className="text-neutral-500 font-medium mt-1">
          Here's an overview of your progress today.
        </p>
      </div>

      {/* ======================== */}
      {/* DAILY FOCUS HERO WIDGET */}
      {/* ======================== */}
      {(mit || criticalHabit) && (
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-indigo-950/40 via-[#0a0a0a] to-emerald-950/20 p-6 shadow-[0_0_60px_rgba(99,102,241,0.05)]">
          {/* Decorative glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-5">
              <Star className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-extrabold text-amber-400/80 uppercase tracking-[0.2em] font-['Outfit']">Daily Focus</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* MIT Card */}
              {mit && (
                <div className="group p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-cyan-500/20 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                      <CheckSquare className="w-4 h-4 text-cyan-400" />
                    </div>
                    <span className="text-[10px] font-bold text-cyan-400/70 uppercase tracking-wider">Most Important Task</span>
                  </div>
                  <h3 className="text-lg font-bold text-white font-['Outfit'] mb-1 line-clamp-1">{mit.title}</h3>
                  {mit.description && (
                    <p className="text-xs text-neutral-500 line-clamp-1 mb-3">{mit.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    {mit.target_date && (
                      <span className="text-[10px] text-neutral-600 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due {format(new Date(mit.target_date), 'MMM d')}
                      </span>
                    )}
                    <button
                      onClick={() => handleToggleTask(mit.id)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider hover:bg-cyan-500/20 transition-all active:scale-95"
                    >
                      Complete
                    </button>
                  </div>
                </div>
              )}

              {/* Critical Habit Card */}
              {criticalHabit && (
                <div className="group p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-indigo-500/20 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-wider">Don't Break the Streak</span>
                  </div>
                  <h3 className="text-lg font-bold text-white font-['Outfit'] mb-1 line-clamp-1">{criticalHabit.title}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-xs font-semibold text-yellow-400/80">{criticalHabit.current_streak} day streak at risk</span>
                  </div>
                  <button
                    onClick={() => handleToggleHabit(criticalHabit.id, criticalHabit.logs || [])}
                    className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-500/20 transition-all active:scale-95"
                  >
                    Log Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Streaks',
            value: stats?.active_streaks || 0,
            icon: Zap,
            color: 'text-yellow-400',
            bg: 'bg-yellow-400/10',
            celebrate: allHabitsDone,
          },
          { label: 'Goal Progress', value: `${stats?.goal_completion_percentage || 0}%`, icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { label: 'Task Efficiency', value: `${stats?.task_efficiency_percentage || 0}%`, icon: CheckSquare, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
          { label: 'Upcoming Deadlines', value: stats?.upcoming_deadlines || 0, icon: Clock, color: 'text-rose-400', bg: 'bg-rose-400/10' },
        ].map((kpi, index) => (
          <div
            key={index}
            className={`glass-panel p-6 rounded-2xl flex items-center justify-between group hover:border-white/10 hover:-translate-y-1 transition-all duration-300 ${
              kpi.celebrate
                ? 'border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)] bg-emerald-500/[0.03]'
                : ''
            }`}
          >
            <div className="relative z-10">
              <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-2">{kpi.label}</p>
              <p className="text-3xl font-bold text-white font-['Outfit'] drop-shadow-md">{kpi.value}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex flex-shrink-0 items-center justify-center relative z-10 ${kpi.bg} shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]`}>
              <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
              {kpi.celebrate && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center animate-bounce">
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ======================== */}
      {/* GOAL PROGRESS CARDS */}
      {/* ======================== */}
      {activeGoals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Active Goals</h2>
            </div>
            <button
              onClick={() => navigate('/goals')}
              className="text-[10px] font-bold text-neutral-600 hover:text-white uppercase tracking-wider transition-colors"
            >
              View All →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeGoals.map(goal => {
              const priorityColors: Record<string, { text: string; dot: string }> = {
                High: { text: 'text-rose-400', dot: 'bg-rose-400' },
                Medium: { text: 'text-amber-400', dot: 'bg-amber-400' },
                Low: { text: 'text-emerald-400', dot: 'bg-emerald-400' },
              };
              const pc = priorityColors[goal.priority] || priorityColors.Medium;
              const categoryColors: Record<string, string> = {
                Project: 'from-indigo-500/20 to-indigo-500/5',
                Area: 'from-emerald-500/20 to-emerald-500/5',
                Resource: 'from-amber-500/20 to-amber-500/5',
                Archive: 'from-neutral-500/20 to-neutral-500/5',
              };
              const catGrad = categoryColors[goal.category] || categoryColors.Project;

              return (
                <div
                  key={goal.id}
                  onClick={() => navigate('/goals')}
                  className={`relative overflow-hidden rounded-2xl border border-white/5 bg-linear-to-br ${catGrad} p-5 cursor-pointer group hover:border-white/10 hover:-translate-y-1 transition-all duration-300`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{goal.category}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${pc.text}`}>{goal.priority}</span>
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-white font-['Outfit'] mb-3 line-clamp-1 group-hover:text-emerald-300 transition-colors">{goal.title}</h3>
                  {goal.target_date && (
                    <p className="text-[10px] text-neutral-600 font-medium flex items-center gap-1 mb-3">
                      <Clock className="w-3 h-3" />
                      {format(new Date(goal.target_date), 'MMM d, yyyy')}
                    </p>
                  )}
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-emerald-500 to-cyan-500 transition-all duration-1000"
                      style={{ width: '0%' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================== */}
      {/* ALL DONE CELEBRATION */}
      {/* ======================== */}
      {allHabitsDone && totalHabits > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-linear-to-r from-emerald-950/30 via-[#0a0a0a] to-emerald-950/30 p-6 text-center shadow-[0_0_40px_rgba(16,185,129,0.1)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.06)_0%,_transparent_70%)]" />
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
              <h3 className="text-lg font-extrabold text-emerald-400 font-['Outfit'] tracking-tight">All Habits Complete!</h3>
              <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <p className="text-sm text-emerald-400/60">You've completed all {totalHabits} habits today. Keep the momentum going! 🎉</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Today's Habits Widget */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-white font-['Outfit']">Daily Habits</h2>
            </div>
            <span className="text-xs font-bold text-neutral-600 bg-white/5 px-3 py-1 rounded-full border border-white/5">
              {completedHabits}/{totalHabits}
            </span>
          </div>

          <div className="flex-1 space-y-3">
            {todayData?.habits.length === 0 ? (
              <p className="text-neutral-500 text-sm italic">No habits scheduled for today.</p>
            ) : (
              todayData?.habits.map((habit) => {
                const isDone = habit.logs?.some(l => l.log_date === todayStr && l.status === 'Done');
                return (
                  <div key={habit.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.015] border border-white/[0.03] hover:bg-white/[0.04] hover:border-white/[0.08] hover:translate-x-1 transition-all group">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleToggleHabit(habit.id, habit.logs || [])}
                        className="cursor-pointer group flex items-center justify-center transition-transform active:scale-90"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-7 h-7 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] rounded-full" />
                        ) : (
                          <Circle className="w-7 h-7 text-neutral-600 group-hover:text-emerald-400/50 transition-colors" />
                        )}
                      </button>
                      <div>
                        <p className={`font-semibold transition-colors ${isDone ? 'text-neutral-400 line-through decoration-emerald-500/30' : 'text-white'}`}>
                          {habit.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Zap className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs font-medium text-neutral-500">{habit.current_streak} snap streak</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Tasks Due Today Widget */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold text-white font-['Outfit']">Action Items</h2>
          </div>

          <div className="flex-1 space-y-3">
            {todayData?.tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-white/10 rounded-xl">
                <CheckCircle2 className="w-10 h-10 text-emerald-400/50 mb-3" />
                <p className="text-neutral-300 font-medium">All caught up!</p>
                <p className="text-neutral-500 text-sm mt-1">No tasks due today.</p>
              </div>
            ) : (
              todayData?.tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.015] border border-white/[0.03] hover:bg-white/[0.04] hover:border-white/[0.08] hover:translate-x-1 transition-all group">
                  <div className="flex items-start gap-4">
                     <button
                        onClick={() => handleToggleTask(task.id)}
                        className="cursor-pointer mt-0.5 group-hover:scale-110 flex shrink-0 items-center justify-center transition-transform active:scale-90"
                      >
                        <Circle className="w-6 h-6 text-neutral-600 group-hover:text-cyan-400/50 transition-colors" />
                      </button>
                    <div>
                      <p className="font-semibold text-white">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{task.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
