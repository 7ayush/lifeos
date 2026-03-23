import { Target, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import type { GoalWeekProgress } from '../../types';
import { ProgressBar } from '../ProgressBar';
import { PriorityBadge } from '../PriorityBadge';

interface GoalProgressSectionProps {
  goals: GoalWeekProgress[];
}

function DeltaIndicator({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-400 text-xs font-medium">
        <TrendingUp className="w-3.5 h-3.5" />
        +{delta}%
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-400 text-xs font-medium">
        <TrendingDown className="w-3.5 h-3.5" />
        {delta}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400 text-xs font-medium">
      <Minus className="w-3.5 h-3.5" />
      0%
    </span>
  );
}

export function GoalProgressSection({ goals }: GoalProgressSectionProps) {
  return (
    <div className="bg-secondary/50 border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-cyan-400" />
          <h2 className="text-foreground font-semibold">Goal Progress</h2>
        </div>
        <span className="text-muted-foreground text-sm">
          {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
        </span>
      </div>

      {goals.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4 text-center">
          No active goals this week.
        </p>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div
              key={goal.goal_id}
              className="px-3 py-3 rounded-lg bg-secondary/50 border border-border"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-foreground truncate">
                    {goal.title}
                  </span>
                  <PriorityBadge priority={goal.priority} />
                </div>
                <DeltaIndicator delta={goal.progress_delta} />
              </div>

              <div className="mb-2">
                <ProgressBar progress={goal.current_progress} showLabel size="sm" />
              </div>

              {goal.target_date && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>Target: {goal.target_date}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
