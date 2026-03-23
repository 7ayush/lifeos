import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getLeaderboard, getPersonalStats, getYearInPixels } from '../api';
import type { LeaderboardEntry, PersonalStats, PixelDay } from '../types';
import { Trophy, Medal, TrendingUp, Target, Zap, CheckSquare, BarChart3, CalendarDays, BookOpen, Activity } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const TABS = [
  { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { key: 'stats', label: 'My Stats', icon: BarChart3 },
  { key: 'pixels', label: 'Year in Pixels', icon: CalendarDays },
] as const;

type TabKey = typeof TABS[number]['key'];

// ================= RADAR CHART (SVG) =================
function RadarChart({ stats }: { stats: PersonalStats }) {
  const axes = [
    { key: 'goal_score', label: 'Goals', color: '#38bdf8' },
    { key: 'habit_score', label: 'Habits', color: '#34d399' },
    { key: 'task_score', label: 'Tasks', color: '#a78bfa' },
    { key: 'journal_score', label: 'Journal', color: '#fbbf24' },
    { key: 'streak_score', label: 'Streaks', color: '#f472b6' },
  ] as const;

  const cx = 150, cy = 150, maxR = 110;
  const n = axes.length;

  const getPoint = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (value / 100) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  // background rings
  const rings = [20, 40, 60, 80, 100];

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 300" className="w-72 h-72">
        {/* Grid rings */}
        {rings.map(v => {
          const points = axes.map((_, i) => {
            const p = getPoint(i, v);
            return `${p.x},${p.y}`;
          }).join(' ');
          return <polygon key={v} points={points} fill="none" stroke="white" strokeOpacity={0.06} strokeWidth={1} />;
        })}

        {/* Axis lines */}
        {axes.map((_, i) => {
          const p = getPoint(i, 100);
          return <line key={`axis-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="white" strokeOpacity={0.08} strokeWidth={1} />;
        })}

        {/* Data polygon */}
        <polygon
          points={axes.map((a, i) => {
            const p = getPoint(i, stats[a.key]);
            return `${p.x},${p.y}`;
          }).join(' ')}
          fill="url(#radarGrad)"
          fillOpacity={0.25}
          stroke="url(#radarStroke)"
          strokeWidth={2}
        />

        {/* Data points */}
        {axes.map((a, i) => {
          const p = getPoint(i, stats[a.key]);
          return (
            <circle key={a.key} cx={p.x} cy={p.y} r={4}
              fill={a.color} stroke="black" strokeWidth={1.5}
              className="drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]"
            />
          );
        })}

        {/* Labels */}
        {axes.map((a, i) => {
          const p = getPoint(i, 125);
          return (
            <text key={`label-${a.key}`} x={p.x} y={p.y}
              textAnchor="middle" dominantBaseline="middle"
              fill={a.color} fontSize={11} fontWeight={700}
              className="font-['Outfit']"
            >
              {a.label}
            </text>
          );
        })}

        <defs>
          <linearGradient id="radarGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <linearGradient id="radarStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// ================= YEAR IN PIXELS =================
function YearInPixelsGrid({ pixels }: { pixels: PixelDay[] }) {
  const months = useMemo(() => {
    const m: { label: string; startIdx: number }[] = [];
    let lastMonth = '';
    pixels.forEach((p, i) => {
      const mo = format(parseISO(p.date), 'MMM');
      if (mo !== lastMonth) {
        m.push({ label: mo, startIdx: i });
        lastMonth = mo;
      }
    });
    return m;
  }, [pixels]);

  const getColor = (intensity: number, mood: number | null) => {
    if (intensity === 0 && mood === null) return 'bg-secondary/50';
    if (intensity <= 0.15) return 'bg-emerald-900/40';
    if (intensity <= 0.3) return 'bg-emerald-700/50';
    if (intensity <= 0.5) return 'bg-emerald-600/60';
    if (intensity <= 0.7) return 'bg-emerald-500/70';
    return 'bg-emerald-400/80';
  };

  const getMoodEmoji = (mood: number | null) => {
    if (mood === null) return '';
    const emojis = ['', '😔', '😕', '😐', '🙂', '🤩'];
    return emojis[mood] || '';
  };

  return (
    <div className="space-y-3">
      {/* Month labels */}
      <div className="flex gap-0.5 ml-1">
        {months.map((m, i) => (
          <div key={i}
            className="text-[10px] text-muted-foreground font-bold"
            style={{ marginLeft: i === 0 ? 0 : `${(m.startIdx - (months[i - 1]?.startIdx ?? 0) - 1) * 14}px` }}
          >
            {m.label}
          </div>
        ))}
      </div>

      {/* Pixel grid — 7 rows (days of week), columns = weeks */}
      <div className="flex gap-[3px] overflow-x-auto custom-scrollbar pb-2">
        {Array.from({ length: Math.ceil(pixels.length / 7) }, (_, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, dayIdx) => {
              const idx = weekIdx * 7 + dayIdx;
              if (idx >= pixels.length) return <div key={dayIdx} className="w-3 h-3" />;
              const p = pixels[idx];
              return (
                <div
                  key={dayIdx}
                  className={`w-3 h-3 rounded-[3px] transition-all hover:scale-150 hover:z-10 cursor-pointer relative group ${getColor(p.intensity, p.mood)}`}
                  title={`${p.date}\nMood: ${getMoodEmoji(p.mood) || 'n/a'}\nHabits: ${Math.round(p.habit_ratio * 100)}%`}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border border-border rounded-lg text-[10px] text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 font-medium">
                    {format(parseISO(p.date), 'MMM d')} {getMoodEmoji(p.mood)} • {Math.round(p.habit_ratio * 100)}%
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-2">
        <span>Less</span>
        {['bg-secondary/50', 'bg-emerald-900/40', 'bg-emerald-700/50', 'bg-emerald-600/60', 'bg-emerald-500/70', 'bg-emerald-400/80'].map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-[3px] ${c}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// ================= MAIN PAGE =================
export function AnalyticsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [personalStats, setPersonalStats] = useState<PersonalStats | null>(null);
  const [pixels, setPixels] = useState<PixelDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (activeTab === 'leaderboard') {
          const data = await getLeaderboard();
          setLeaderboard(data);
        } else if (activeTab === 'stats' && user) {
          const data = await getPersonalStats(user.id);
          setPersonalStats(data);
        } else if (activeTab === 'pixels' && user) {
          const data = await getYearInPixels(user.id);
          setPixels(data.pixels);
        }
      } catch (err) {
        console.error('Failed to load analytics', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeTab, user]);

  const getRankBadge = (index: number) => {
    if (index === 0) return <Medal className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />;
    if (index === 1) return <Medal className="w-6 h-6 text-stone-300 drop-shadow-[0_0_8px_rgba(214,211,209,0.5)]" />;
    if (index === 2) return <Medal className="w-6 h-6 text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.5)]" />;
    return <span className="text-muted-foreground font-bold text-lg w-6 text-center">{index + 1}</span>;
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <TrendingUp className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-foreground font-['Outfit'] tracking-tight">Analytics</h1>
            <p className="text-muted-foreground font-medium mt-1">Track your growth across every dimension.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 border border-border">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === tab.key
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'text-muted-foreground hover:text-foreground border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ===== LEADERBOARD TAB ===== */}
          {activeTab === 'leaderboard' && (
            <div className="glass-panel rounded-3xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-secondary/50 border-b border-border">
                      <th className="p-4 pl-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16 text-center">Rank</th>
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Goals</div>
                      </th>
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5" /> Tasks</div>
                      </th>
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Streaks</div>
                      </th>
                      <th className="p-4 pr-6 text-xs font-semibold text-amber-400 uppercase tracking-wider text-right">
                        <div className="flex items-center justify-end gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Growth</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leaderboard.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No data available.</td></tr>
                    ) : (
                      leaderboard.map((entry, idx) => {
                        let rowStyles = "hover:bg-secondary/50 transition-colors group border-l-2 border-transparent";
                        if (idx === 0) rowStyles = "bg-gradient-to-r from-yellow-500/[0.08] to-transparent border-l-2 border-yellow-400 transition-colors group";
                        else if (idx === 1) rowStyles = "bg-gradient-to-r from-stone-300/[0.08] to-transparent border-l-2 border-stone-300 transition-colors group";
                        else if (idx === 2) rowStyles = "bg-gradient-to-r from-amber-600/[0.08] to-transparent border-l-2 border-amber-600 transition-colors group";
                        return (
                          <tr key={entry.user_id} className={rowStyles}>
                            <td className="p-4 pl-6 text-center"><div className="flex justify-center">{getRankBadge(idx)}</div></td>
                            <td className="p-4"><div className="font-bold text-foreground text-base">{entry.username}</div></td>
                            <td className="p-4"><span className="text-muted-foreground font-medium">{Math.round(entry.goal_rate)}%</span></td>
                            <td className="p-4"><span className="text-muted-foreground font-medium">{Math.round(entry.task_efficiency)}%</span></td>
                            <td className="p-4"><span className="text-muted-foreground font-medium flex items-center gap-1">{entry.snap_streaks} <Zap className="w-3 h-3 text-yellow-400/50" /></span></td>
                            <td className="p-4 pr-6 text-right"><span className="text-lg font-bold text-amber-400 font-['Outfit']">{Math.round(entry.growth_score)}</span></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== MY STATS TAB ===== */}
          {activeTab === 'stats' && personalStats && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Growth Score Big Card */}
              <div className="glass-panel rounded-3xl border border-border p-8 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-emerald-500/5" />
                <div className="relative z-10 text-center">
                  <p className="text-muted-foreground font-bold text-sm uppercase tracking-widest mb-2">Overall Growth Score</p>
                  <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-400 to-emerald-400 font-['Outfit'] mb-4">
                    {Math.round(personalStats.growth_score)}
                  </div>
                  <p className="text-muted-foreground text-sm">out of 100</p>
                </div>
              </div>

              {/* Radar Chart */}
              <div className="glass-panel rounded-3xl border border-border p-6 flex flex-col items-center justify-center">
                <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest mb-4">Growth Breakdown</p>
                <RadarChart stats={personalStats} />
              </div>

              {/* Stat Cards */}
              {[
                { label: 'Goals', value: `${personalStats.completed_goals}/${personalStats.total_goals}`, score: personalStats.goal_score, icon: Target, color: 'text-sky-400', bg: 'from-sky-500/10' },
                { label: 'Habits', value: `${personalStats.total_habits} active`, score: personalStats.habit_score, icon: Activity, color: 'text-emerald-400', bg: 'from-emerald-500/10' },
                { label: 'Tasks', value: `${personalStats.done_tasks}/${personalStats.total_tasks}`, score: personalStats.task_score, icon: CheckSquare, color: 'text-violet-400', bg: 'from-violet-500/10' },
                { label: 'Journal', value: `${personalStats.journal_entries} entries`, score: personalStats.journal_score, icon: BookOpen, color: 'text-amber-400', bg: 'from-amber-500/10' },
                { label: 'Streaks', value: `${personalStats.active_streaks} total`, score: personalStats.streak_score, icon: Zap, color: 'text-pink-400', bg: 'from-pink-500/10' },
              ].map(card => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="glass-panel rounded-2xl border border-border p-5 flex items-center gap-4 relative overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-r ${card.bg} to-transparent opacity-50`} />
                    <div className={`w-11 h-11 rounded-xl bg-secondary/50 flex items-center justify-center z-10 ${card.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="z-10 flex-1 min-w-0">
                      <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">{card.label}</p>
                      <p className="text-foreground font-bold text-lg">{card.value}</p>
                    </div>
                    <div className="z-10 text-right">
                      <p className={`text-2xl font-black font-['Outfit'] ${card.color}`}>{Math.round(card.score)}</p>
                      <p className="text-muted-foreground text-[10px]">/100</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ===== YEAR IN PIXELS TAB ===== */}
          {activeTab === 'pixels' && (
            <div className="glass-panel rounded-3xl border border-border p-8">
              <div className="flex items-center gap-3 mb-6">
                <CalendarDays className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl font-bold text-foreground font-['Outfit']">Year in Pixels</h2>
                <span className="text-muted-foreground text-sm">365-day activity heatmap from mood & habit data</span>
              </div>
              {pixels.length > 0 ? (
                <YearInPixelsGrid pixels={pixels} />
              ) : (
                <p className="text-muted-foreground text-center py-12">No data to show yet. Log moods and complete habits to fill in your year!</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
