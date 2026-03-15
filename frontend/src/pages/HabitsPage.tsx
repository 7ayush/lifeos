import { useState, useEffect } from 'react';
import { api } from '../api/config';
import type { Habit } from '../types';

export function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);

  useEffect(() => {
    // Mock user_id = 1
    api.get('/users/1/habits/')
       .then((res: any) => setHabits(res.data))
       .catch((err: any) => console.error(err));
  }, []);

  const handleLogHabit = (habitId: number, status: 'Done' | 'Missed') => {
    api.post(`/users/1/habits/${habitId}/log`, { status })
       .then(() => {
          // Refetch habits to update the score/streak
          return api.get('/users/1/habits/');
       })
       .then((res: any) => setHabits(res.data))
       .catch((err: any) => console.error("Error logging habit:", err));
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <header className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2 tracking-tight">Habits Dashboard</h1>
          <p className="text-neutral-400 font-medium font-[Inter]">Track your Snap-Streaks and X/Y completion thresholds.</p>
        </div>
        <button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white px-6 py-2.5 rounded-xl font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all duration-300 cursor-pointer">
           + New Habit
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {habits.map(habit => {
           const completionPercentage = Math.min((habit.target_x / habit.target_y_days) * 100, 100);
           
           return (
             <div key={habit.id} className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex flex-col hover:border-emerald-500/50 hover:bg-white/5 transition-all duration-500 shadow-xl group hover:-translate-y-1">
               <div className="flex justify-between items-start mb-6">
                 <h3 className="text-xl font-bold text-neutral-100 font-['Outfit']">{habit.title}</h3>
                 <div className="flex flex-col items-center bg-black/60 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
                    <span className="text-[10px] uppercase text-neutral-500 font-bold tracking-wider mb-0.5">Streak</span>
                    <span className="text-emerald-400 font-extrabold flex items-center gap-1.5 text-base">
                       🔥 {habit.current_streak}
                    </span>
                 </div>
               </div>

               {/* Progress Bar UI */}
               <div className="mb-8 flex-1">
                 <div className="flex justify-between text-sm text-neutral-400 font-semibold mb-3">
                    <span>Performance Target</span>
                    <span className="text-neutral-300">{habit.target_x} / <span className="text-neutral-500">{habit.target_y_days} Days</span></span>
                 </div>
                 <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden border border-white/5 shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 relative"
                      style={{ width: `${completionPercentage}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4 mt-auto">
                 <button 
                   onClick={() => handleLogHabit(habit.id, 'Done')}
                   className="flex items-center justify-center py-3 bg-white/5 hover:bg-emerald-500/20 text-emerald-400 border border-white/10 hover:border-emerald-500/50 rounded-xl transition-all duration-300 font-bold cursor-pointer group-hover:bg-emerald-500/10"
                 >
                   ✓ Done
                 </button>
                 <button 
                   onClick={() => handleLogHabit(habit.id, 'Missed')}
                   className="flex items-center justify-center py-3 bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 border border-white/10 hover:border-red-500/50 rounded-xl transition-all duration-300 font-bold cursor-pointer"
                 >
                   ✕ Missed
                 </button>
               </div>
             </div>
           );
        })}
        
        {habits.length === 0 && (
           <div className="col-span-full h-64 flex flex-col items-center justify-center text-neutral-500 border-2 border-dashed border-neutral-800 rounded-2xl bg-neutral-900/50">
             <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">🌱</span>
             </div>
             <p className="text-lg font-medium text-neutral-300">No habits tracked yet.</p>
             <p className="text-sm mt-1">Create your first daily action to get started.</p>
           </div>
        )}
      </div>
    </div>
  );
}
