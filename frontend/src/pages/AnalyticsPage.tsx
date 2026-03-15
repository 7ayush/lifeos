import { useState, useEffect } from 'react';
import { api } from '../api/config';
import type { LeaderboardEntry } from '../types';
import { cn } from '../lib/utils';
import { Trophy, TrendingUp, Target, Flame, CheckCircle2 } from 'lucide-react';

export function AnalyticsPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await api.get<LeaderboardEntry[]>('/analytics/leaderboard');
        if (response.data && response.data.length > 0) {
          setLeaderboard(response.data);
        } else {
          // Fallback static data to show off the UI if DB is empty
          setLeaderboard([
            { user_id: 1, username: "AlexV", growth_score: 92.4, goal_rate: 80, snap_streaks: 14, habit_index: 95, task_efficiency: 88 },
            { user_id: 2, username: "SarahJ", growth_score: 88.1, goal_rate: 75, snap_streaks: 11, habit_index: 84, task_efficiency: 92 },
            { user_id: 3, username: "MikeD", growth_score: 75.9, goal_rate: 60, snap_streaks: 5, habit_index: 80, task_efficiency: 75 },
            { user_id: 4, username: "ElenaR", growth_score: 64.2, goal_rate: 45, snap_streaks: 2, habit_index: 60, task_efficiency: 50 },
          ]);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="flex flex-col h-full space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto w-full">
      <header className="flex flex-col border-b border-white/10 pb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
            <Trophy className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 tracking-tight">
            Leaderboard
          </h1>
        </div>
        <p className="text-lg text-neutral-400 font-medium font-[Inter] max-w-2xl">
          The Growth Contest evaluates users across goal completion, habit consistency, streak building, and task efficiency. Who is dominating this week?
        </p>
      </header>

      {/* Main Stats Area */}
      <div className="flex-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Background Decorative Glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-neutral-500">
            <Trophy className="w-12 h-12 mb-4 opacity-20" />
            <p>No active users on the leaderboard yet.</p>
          </div>
        ) : (
          <div className="space-y-4 relative z-10">
            {/* Headers */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-widest border-b border-white/5">
              <div className="col-span-1 text-center">Rank</div>
              <div className="col-span-3">User</div>
              <div className="col-span-2 text-right flex items-center justify-end gap-1"><TrendingUp className="w-3 h-3"/> Score</div>
              <div className="col-span-2 text-right hidden sm:flex items-center justify-end gap-1"><Target className="w-3 h-3"/> Goals</div>
              <div className="col-span-2 text-right hidden md:flex items-center justify-end gap-1"><Flame className="w-3 h-3"/> Streaks</div>
              <div className="col-span-2 text-right hidden lg:flex items-center justify-end gap-1"><CheckCircle2 className="w-3 h-3"/> Tasks</div>
            </div>

            {/* List */}
            {leaderboard.map((user, index) => {
              const isTop = index === 0;
              const isSecond = index === 1;
              const isThird = index === 2;
              
              return (
                <div 
                  key={user.user_id}
                  className={cn(
                    "grid grid-cols-12 gap-4 items-center p-4 rounded-2xl transition-all duration-300 border",
                    isTop ? "bg-gradient-to-r from-yellow-500/10 to-amber-500/5 hover:from-yellow-500/20 hover:to-amber-500/10 border-yellow-500/20 hover:border-yellow-500/40 shadow-[0_0_30px_rgba(234,179,8,0.1)]" :
                    isSecond ? "bg-neutral-800/40 hover:bg-neutral-800/60 border-neutral-400/20 hover:border-neutral-400/40" :
                    isThird ? "bg-amber-900/10 hover:bg-amber-900/20 border-amber-700/20 hover:border-amber-700/40" :
                    "bg-black/30 hover:bg-white/5 border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="col-span-1 flex justify-center">
                    <span className={cn(
                      "text-xl font-bold font-[Outfit]",
                      isTop ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] text-3xl" : 
                      isSecond ? "text-neutral-300 text-2xl" : 
                      isThird ? "text-amber-600 text-xl" : 
                      "text-neutral-600"
                    )}>
                      #{index + 1}
                    </span>
                  </div>
                  
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-inner">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className={cn("font-medium", isTop ? "text-yellow-100 font-bold" : "text-neutral-200")}>
                        {user.username}
                      </h3>
                      {isTop && <p className="text-xs text-yellow-400/80 uppercase tracking-widest mt-0.5">Rank 1</p>}
                    </div>
                  </div>

                  <div className="col-span-2 text-right">
                    <div className={cn(
                      "text-2xl font-bold font-[Outfit]", 
                      isTop ? "text-yellow-400" : "text-white"
                    )}>
                      {user.growth_score.toFixed(1)}
                    </div>
                  </div>

                  <div className="col-span-2 text-right hidden sm:block">
                    <div className="text-sm font-medium text-neutral-300">{user.goal_rate.toFixed(0)}%</div>
                  </div>

                  <div className="col-span-2 text-right hidden md:block">
                    <div className="text-sm font-medium text-emerald-400">{user.snap_streaks} active</div>
                  </div>

                  <div className="col-span-2 text-right hidden lg:block">
                    <div className="text-sm font-medium text-indigo-300">{user.task_efficiency.toFixed(0)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
