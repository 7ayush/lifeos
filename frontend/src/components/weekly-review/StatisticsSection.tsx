import { BarChart3, TrendingUp, TrendingDown, Clock, Target, Activity } from 'lucide-react';
import type { DailyTaskCount, WeekComparisonStats } from '../../types';

interface StatisticsSectionProps {
  dailyTaskCounts: DailyTaskCount[];
  comparison: WeekComparisonStats;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ChangeIndicator({ change }: { change: number }) {
  const rounded = Math.round(change * 10) / 10;
  if (rounded > 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-emerald-400">
        <TrendingUp className="w-3 h-3" />
        +{rounded}%
      </span>
    );
  }
  if (rounded < 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-red-400">
        <TrendingDown className="w-3 h-3" />
        {rounded}%
      </span>
    );
  }
  return <span className="text-xs text-neutral-500">No change</span>;
}

export function StatisticsSection({
  dailyTaskCounts,
  comparison,
}: StatisticsSectionProps) {
  const maxCount = Math.max(...dailyTaskCounts.map((d) => d.count), 1);

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-cyan-400" />
        <h2 className="text-white font-semibold">Weekly Statistics</h2>
      </div>

      {/* Bar Chart */}
      <div className="mb-6">
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
          Daily Completions
        </h3>
        <div className="flex items-end gap-2 h-28">
          {DAY_LABELS.map((label) => {
            const entry = dailyTaskCounts.find((d) => d.day === label);
            const count = entry?.count ?? 0;
            const heightPct = (count / maxCount) * 100;

            return (
              <div
                key={label}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <span className="text-[10px] text-neutral-400">{count}</span>
                <div className="w-full flex items-end" style={{ height: '80px' }}>
                  <div
                    className="w-full rounded-t bg-cyan-500/80 transition-all"
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  />
                </div>
                <span className="text-[10px] text-neutral-600">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Completion Rate Card */}
        <div className="px-3 py-3 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-neutral-400">Completion Rate</span>
          </div>
          <div className="text-xl font-semibold text-white">
            {Math.round(comparison.completion_rate)}%
          </div>
          <div className="mt-1">
            <ChangeIndicator change={comparison.completion_rate_change} />
          </div>
        </div>

        {/* Habit Adherence Card */}
        <div className="px-3 py-3 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs text-neutral-400">Habit Adherence</span>
          </div>
          <div className="text-xl font-semibold text-white">
            {Math.round(comparison.habit_adherence_rate)}%
          </div>
          <div className="mt-1">
            <ChangeIndicator change={comparison.habit_adherence_rate_change} />
          </div>
        </div>
      </div>

      {/* Time Tracking Card */}
      <div className="px-3 py-3 rounded-lg bg-white/[0.02] border border-white/5">
        <div className="flex items-center gap-1.5 mb-2">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-neutral-400">Time Tracking</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-neutral-400">Est.</span>{' '}
            <span className="text-white font-medium">
              {comparison.total_estimated_minutes}m
            </span>
          </div>
          <div className="text-sm">
            <span className="text-neutral-400">Actual</span>{' '}
            <span className="text-white font-medium">
              {comparison.total_actual_minutes}m
            </span>
          </div>
          <div className="text-sm">
            <span className="text-neutral-400">Efficiency</span>{' '}
            <span className="text-amber-400 font-medium">
              {Math.round(comparison.efficiency_ratio * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
