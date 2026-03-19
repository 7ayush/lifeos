import { useState, useEffect } from 'react';
import { getLeaderboard } from '../api';
import type { LeaderboardEntry } from '../types';
import { Trophy, Medal, TrendingUp, Target, Zap, CheckSquare } from 'lucide-react';

export function AnalyticsPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const data = await getLeaderboard();
      setLeaderboard(data);
    } catch (err) {
      console.error('Failed to load leaderboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  if (loading && leaderboard.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  const getRankBadge = (index: number) => {
    if (index === 0) return <Medal className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />;
    if (index === 1) return <Medal className="w-6 h-6 text-stone-300 drop-shadow-[0_0_8px_rgba(214,211,209,0.5)]" />;
    if (index === 2) return <Medal className="w-6 h-6 text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.5)]" />;
    return <span className="text-neutral-500 font-bold text-lg w-6 text-center">{index + 1}</span>;
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500 pb-10">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <Trophy className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white font-['Outfit'] tracking-tight">Global Leaderboard</h1>
          <p className="text-neutral-500 font-medium mt-1">Ranked by overall Growth Score.</p>
        </div>
      </div>

      <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/10">
                <th className="p-4 pl-6 text-xs font-semibold text-neutral-400 uppercase tracking-wider w-16 text-center">Rank</th>
                <th className="p-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">User</th>
                <th className="p-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                    <Target className="w-3.5 h-3.5" /> Goals
                  </div>
                </th>
                <th className="p-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                    <CheckSquare className="w-3.5 h-3.5" /> Tasks
                  </div>
                </th>
                <th className="p-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                    <Zap className="w-3.5 h-3.5" /> Streaks
                  </div>
                </th>
                <th className="p-4 pr-6 text-xs font-semibold text-amber-400 uppercase tracking-wider text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Growth Score
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-500">
                    No data available.
                  </td>
                </tr>
              ) : (
                leaderboard.map((entry, idx) => {
                  let rowStyles = "hover:bg-white/[0.02] transition-colors group border-l-2 border-transparent";
                  if (idx === 0) rowStyles = "bg-gradient-to-r from-yellow-500/[0.08] to-transparent hover:from-yellow-500/[0.12] border-l-2 border-yellow-400 transition-colors group";
                  else if (idx === 1) rowStyles = "bg-gradient-to-r from-stone-300/[0.08] to-transparent hover:from-stone-300/[0.12] border-l-2 border-stone-300 transition-colors group";
                  else if (idx === 2) rowStyles = "bg-gradient-to-r from-amber-600/[0.08] to-transparent hover:from-amber-600/[0.12] border-l-2 border-amber-600 transition-colors group";

                  return (
                    <tr 
                      key={entry.user_id} 
                      className={rowStyles}
                    >
                      <td className="p-4 pl-6 text-center">
                        <div className="flex justify-center">{getRankBadge(idx)}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-white text-base">{entry.username}</div>
                      </td>
                    <td className="p-4">
                      <span className="text-neutral-400 font-medium">{Math.round(entry.goal_rate)}%</span>
                    </td>
                    <td className="p-4">
                      <span className="text-neutral-400 font-medium">{Math.round(entry.task_efficiency)}%</span>
                    </td>
                    <td className="p-4">
                      <span className="text-neutral-400 font-medium flex items-center gap-1">
                        {entry.snap_streaks} <Zap className="w-3 h-3 text-yellow-400/50" />
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <span className="text-lg font-bold text-amber-400 font-['Outfit'] shadow-amber-400/20">
                        {Math.round(entry.growth_score)}
                      </span>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
