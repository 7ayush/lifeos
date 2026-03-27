import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardStats, getDashboardToday, logHabit, updateTask, syncHabits, syncNotifications } from '../api';
import type { DashboardStats, DashboardToday } from '../types';
import { Target, Activity, CheckSquare, Clock, Zap, CheckCircle2, Circle, Flame, Star, TrendingUp, Sparkles, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { PriorityBadge } from '../components/PriorityBadge';
import { ProgressBar } from '../components/ProgressBar';
import { HydrationWidget } from '../components/HydrationWidget';

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [efficiencySlide, setEfficiencySlide] = useState(0);
  const [todayData, setTodayData] = useState<DashboardToday | null>(null);
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
      // Sync habits to tasks first
      await syncHabits(user.id).catch(err => console.error('Sync failed', err));
      // Sync notifications (fire-and-forget, don't block page)
      syncNotifications(user.id).catch(err => console.error('Notification sync failed', err));

      const [statsRes, todayRes] = await Promise.all([
        getDashboardStats(user.id),
        getDashboardToday(user.id),
      ]);
      setStats(statsRes);
      setTodayData(todayRes);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  // Auto-rotate task efficiency carousel
  useEffect(() => {
    const timer = setInterval(() => setEfficiencySlide(prev => (prev + 1) % 3), 4000);
    return () => clearInterval(timer);
  }, []);

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
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
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

  // Overdue and due-today task counts for KPI and indicators
  const overdueTasks = todayData?.tasks.filter(t => t.target_date && t.target_date < todayStr && t.status !== 'Done') || [];
  const overdueCount = overdueTasks.length;

  // Most critical pending habit (not done today, highest streak)
  const criticalHabit = todayData?.habits
    .filter(h => !h.logs?.some(l => l.log_date === todayStr && l.status === 'Done'))
    .sort((a, b) => b.current_streak - a.current_streak)[0] || null;

  // Active goals from stats API (already sorted by priority, limited to 3)
  const activeGoals = stats?.active_goals ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-amber-400 via-orange-400 to-primary font-['Outfit'] tracking-tight drop-shadow-sm">
          {getGreeting()}, {user.username.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground font-medium mt-1 tracking-wide">
          Here's an overview of your progress today.
        </p>
      </div>

      {/* ======================== */}
      {/* DAILY FOCUS HERO WIDGET */}
      {/* ======================== */}
      {(mit || criticalHabit) && (
        <div className="relative overflow-hidden rounded-3xl border border-border glass-panel p-6">
          {/* Decorative glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/4 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-accent/3 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-5">
              <Star className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-bold text-amber-400/80 uppercase tracking-[0.2em] font-['Outfit']">Daily Focus</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* MIT Card */}
              {mit && (
                <div className="group p-5 rounded-2xl bg-secondary/40 border border-border hover:border-accent/20 transition-all duration-300 cursor-pointer card-glow">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
                      <CheckSquare className="w-4 h-4 text-accent" />
                    </div>
                    <span className="text-[10px] font-bold text-accent/70 uppercase tracking-wider">Most Important Task</span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground font-['Outfit'] mb-1 line-clamp-1">{mit.title}</h3>
                  {mit.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-3">{mit.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    {mit.target_date && (
                      <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due {format(new Date(mit.target_date), 'MMM d')}
                      </span>
                    )}
                    <button
                      onClick={() => handleToggleTask(mit.id)}
                      className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-wider hover:bg-accent/20 transition-all active:scale-95 cursor-pointer"
                    >
                      Complete
                    </button>
                  </div>
                </div>
              )}

              {/* Critical Habit Card */}
              {criticalHabit && (
                <div className="group p-5 rounded-2xl bg-secondary/40 border border-border hover:border-primary/20 transition-all duration-300 cursor-pointer card-glow">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-[10px] font-bold text-primary/70 uppercase tracking-wider">Don't Break the Streak</span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground font-['Outfit'] mb-1 line-clamp-1">{criticalHabit.title}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400/80">{criticalHabit.current_streak} day streak at risk</span>
                  </div>
                  <button
                    onClick={() => handleToggleHabit(criticalHabit.id, criticalHabit.logs || [])}
                    className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/20 transition-all active:scale-95 cursor-pointer"
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
            color: 'text-amber-950 dark:text-amber-400',
            bg: 'bg-amber-100 dark:bg-amber-400/10',
            celebrate: allHabitsDone,
          },
          { label: 'Avg. Goal Progress', value: `${Math.round(stats?.goal_completion_percentage || 0)}%`, icon: Target, color: 'text-emerald-950 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-400/10' },
          { label: 'Upcoming Deadlines', value: stats?.upcoming_deadlines || 0, icon: Clock, color: 'text-rose-950 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-400/10' },
          ...(overdueCount > 0 ? [{ label: 'Overdue Tasks', value: overdueCount, icon: AlertTriangle, color: 'text-rose-950 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-400/10' }] : []),
        ].map((kpi, index) => (
          <div
            key={index}
            className={`glass-panel p-6 rounded-2xl flex items-center justify-between card-glow ${
              kpi.celebrate
                ? 'border-primary/20 shadow-[0_0_40px_rgba(245,158,11,0.08)] bg-primary/2'
                : ''
            }`}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="relative z-10">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{kpi.label}</p>
              <p className="text-3xl font-bold text-foreground font-['Outfit'] drop-shadow-md">{kpi.value}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex shrink-0 items-center justify-center relative z-10 ${kpi.bg}`}>
              <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
              {kpi.celebrate && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center animate-bounce">
                  <Sparkles className="w-2.5 h-2.5 text-primary-foreground" />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Task Efficiency Carousel */}
        {(() => {
          const slides = [
            { label: 'Today', value: stats?.task_efficiency?.daily || 0, color: '#22d3ee' },
            { label: 'This Month', value: stats?.task_efficiency?.monthly || 0, color: '#a78bfa' },
            { label: 'This Year', value: stats?.task_efficiency?.annual || 0, color: '#f59e0b' },
          ];
          const current = slides[efficiencySlide];
          const radius = 36;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (current.value / 100) * circumference;

          return (
            <div className="glass-panel p-6 rounded-2xl card-glow flex flex-col items-center justify-center relative">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Task Efficiency</p>
              <div className="relative w-24 h-24 mb-2">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
                  <circle
                    cx="40" cy="40" r={radius}
                    fill="none"
                    stroke={current.color}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-700 ease-out"
                    style={{ filter: `drop-shadow(0 0 8px ${current.color}44)` }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground font-['Outfit']">
                  {current.value}%
                </span>
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2" style={{ color: current.color }}>{current.label}</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEfficiencySlide((prev) => (prev - 1 + slides.length) % slides.length)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary/50 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex gap-1.5">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setEfficiencySlide(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer ${i === efficiencySlide ? 'bg-primary scale-125' : 'bg-muted-foreground/40 hover:bg-muted-foreground'}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setEfficiencySlide((prev) => (prev + 1) % slides.length)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary/50 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ======================== */}
      {/* GOAL PROGRESS CARDS */}
      {/* ======================== */}
      {activeGoals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Active Goals</h2>
            </div>
            <button
              onClick={() => navigate('/goals')}
              className="text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors cursor-pointer"
            >
              View All →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeGoals.map(goal => {
              const priorityColors: Record<string, { text: string; dot: string }> = {
                High: { text: 'text-rose-950 dark:text-rose-400', dot: 'bg-rose-500 dark:bg-rose-400' },
                Medium: { text: 'text-amber-950 dark:text-amber-400', dot: 'bg-amber-500 dark:bg-amber-400' },
                Low: { text: 'text-emerald-950 dark:text-emerald-400', dot: 'bg-emerald-500 dark:bg-emerald-400' },
              };
              const pc = priorityColors[goal.priority] || priorityColors.Medium;
              const categoryColors: Record<string, string> = {
                Project: 'from-indigo-500/10 to-indigo-500/5',
                Area: 'from-emerald-500/10 to-emerald-500/5',
                Resource: 'from-amber-500/10 to-amber-500/5',
                Archive: 'from-neutral-500/10 to-neutral-500/5',
              };
              const catGrad = categoryColors[goal.category] || categoryColors.Project;

              return (
                <div
                  key={goal.id}
                  onClick={() => navigate('/goals')}
                  className={`relative overflow-hidden rounded-2xl border border-border bg-linear-to-br ${catGrad} p-5 cursor-pointer group card-glow`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{goal.category}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${pc.text}`}>{goal.priority}</span>
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-foreground font-['Outfit'] mb-3 line-clamp-1 group-hover:text-primary transition-colors">{goal.title}</h3>
                  {goal.target_date && (
                    <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mb-3">
                      <Clock className="w-3 h-3" />
                      {format(new Date(goal.target_date), 'MMM d, yyyy')}
                    </p>
                  )}
                  <ProgressBar progress={goal.progress} showLabel size="sm" />
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
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-r from-primary/4 via-card to-primary/4 p-6 text-center shimmer">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.04)_0%,transparent_70%)]" />
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <h3 className="text-lg font-bold text-primary font-['Outfit'] tracking-tight">All Habits Complete!</h3>
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            </div>
            <p className="text-sm text-primary/60">You've completed all {totalHabits} habits today. Keep the momentum going!</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Hydration Widget */}
        <HydrationWidget />

        {/* Today's Habits Widget */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-foreground font-['Outfit']">Daily Habits</h2>
            </div>
            <span className="text-xs font-bold text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full border border-border">
              {completedHabits}/{totalHabits}
            </span>
          </div>

          <div className="flex-1 space-y-2.5">
            {todayData?.habits.length === 0 ? (
              <p className="text-muted-foreground text-sm italic">No habits scheduled for today.</p>
            ) : (
              todayData?.habits.map((habit) => {
                const isDone = habit.logs?.some(l => l.log_date === todayStr && l.status === 'Done');
                return (
                  <div key={habit.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border hover:bg-secondary/50 hover:border-border transition-all group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleToggleHabit(habit.id, habit.logs || [])}
                        className="cursor-pointer group flex items-center justify-center transition-transform active:scale-90"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.3)] rounded-full" />
                        ) : (
                          <Circle className="w-6 h-6 text-muted-foreground group-hover:text-emerald-400/50 transition-colors" />
                        )}
                      </button>
                      <div>
                        <p className={`font-medium transition-colors ${isDone ? 'text-muted-foreground line-through decoration-emerald-500/30' : 'text-foreground'}`}>
                          {habit.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span className="text-xs font-medium text-muted-foreground">{habit.current_streak} day streak</span>
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
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-xl font-bold text-foreground font-['Outfit']">Action Items</h2>
          </div>

          <div className="flex-1 space-y-2.5">
            {todayData?.tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-border rounded-xl">
                <CheckCircle2 className="w-10 h-10 text-emerald-400/50 mb-3" />
                <p className="text-foreground font-medium">All caught up!</p>
                <p className="text-muted-foreground text-sm mt-1">No tasks due today.</p>
              </div>
            ) : (
              todayData?.tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border hover:bg-secondary/50 hover:border-border transition-all group cursor-pointer">
                  <div className="flex items-start gap-4">
                     <button
                        onClick={() => handleToggleTask(task.id)}
                        className="cursor-pointer mt-0.5 group-hover:scale-110 flex shrink-0 items-center justify-center transition-transform active:scale-90"
                      >
                        <Circle className="w-5 h-5 text-muted-foreground group-hover:text-accent/50 transition-colors" />
                      </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{task.title}</p>
                        <PriorityBadge priority={task.priority} />
                        {task.target_date && task.target_date < todayStr && task.status !== 'Done' && (
                          <span className="px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-[8px] font-bold text-rose-950 dark:text-rose-400 uppercase tracking-tighter">Overdue</span>
                        )}
                        {task.target_date && task.target_date === todayStr && task.status !== 'Done' && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-[8px] font-bold text-amber-950 dark:text-amber-400 uppercase tracking-tighter">Due Today</span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
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
