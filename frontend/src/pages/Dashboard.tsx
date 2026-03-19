import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardStats, getDashboardToday, logHabit, updateTask } from '../api';
import type { DashboardStats, DashboardToday, Habit, Task } from '../types';
import { Target, Activity, CheckSquare, Clock, Zap, CheckCircle2, Circle } from 'lucide-react';
import { format } from 'date-fns';

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayData, setTodayData] = useState<DashboardToday | null>(null);
  const [loading, setLoading] = useState(true);

  // Dynamic greeting
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
      const [statsRes, todayRes] = await Promise.all([
        getDashboardStats(user.id),
        getDashboardToday(user.id)
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

  const handleToggleHabit = async (habitId: number, currentLogs: any[]) => {
    if (!user) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const hasLoggedToday = currentLogs?.some(l => l.log_date === todayStr && l.status === 'Done');
    const newStatus = hasLoggedToday ? 'Missed' : 'Done';
    
    // Optimistic UI update
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
      loadDashboardData(); // Refresh to get precise backend streak
    } catch (err) {
      console.error('Failed to log habit', err);
      loadDashboardData(); // Revert
    }
  };

  const handleToggleTask = async (taskId: number) => {
    if (!user) return;
    
    // Optimistic update
    setTodayData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.filter(t => t.id !== taskId) // Remove if done
      };
    });

    try {
      await updateTask(user.id, taskId, { status: 'Done' });
      loadDashboardData(); // Refresh stats
    } catch (err) {
      console.error('Failed to complete task', err);
      loadDashboardData(); // Revert
    }
  };

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 font-['Outfit'] tracking-tight drop-shadow-sm">
          {getGreeting()}, {user.username.split(' ')[0]}
        </h1>
        <p className="text-neutral-500 font-medium mt-1">
          Here's an overview of your progress today.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Streaks', value: stats?.active_streaks || 0, icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
          { label: 'Goal Progress', value: `${stats?.goal_completion_percentage || 0}%`, icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { label: 'Task Efficiency', value: `${stats?.task_efficiency_percentage || 0}%`, icon: CheckSquare, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
          { label: 'Upcoming Deadlines', value: stats?.upcoming_deadlines || 0, icon: Clock, color: 'text-rose-400', bg: 'bg-rose-400/10' },
        ].map((kpi, index) => (
          <div key={index} className="glass-panel p-6 rounded-2xl flex items-center justify-between group hover:border-white/10 hover:-translate-y-1 transition-all duration-300">
            <div className="relative z-10">
              <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-2">{kpi.label}</p>
              <p className="text-3xl font-bold text-white font-['Outfit'] drop-shadow-md">{kpi.value}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex flex-shrink-0 items-center justify-center relative z-10 ${kpi.bg} shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]`}>
              <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Today's Habits Widget */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white font-['Outfit']">Daily Habits</h2>
          </div>
          
          <div className="flex-1 space-y-3">
            {todayData?.habits.length === 0 ? (
              <p className="text-neutral-500 text-sm italic">No habits scheduled for today.</p>
            ) : (
              todayData?.habits.map((habit) => {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
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
