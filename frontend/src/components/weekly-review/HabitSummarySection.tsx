import { Activity } from 'lucide-react';
import type { HabitWeekSummary } from '../../types';

interface HabitSummarySectionProps {
  habits: HabitWeekSummary[];
  overallAdherence: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function statusColor(status: string): string {
  switch (status) {
    case 'Done':
      return 'bg-emerald-500';
    case 'Missed':
      return 'bg-red-500';
    default:
      return 'bg-neutral-600';
  }
}

export function HabitSummarySection({
  habits,
  overallAdherence,
}: HabitSummarySectionProps) {
  return (
    <div className="bg-secondary/50 border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-violet-400" />
          <h2 className="text-foreground font-semibold">Habit Performance</h2>
        </div>
        <span className="text-violet-400 font-medium text-sm">
          {Math.round(overallAdherence)}% adherence
        </span>
      </div>

      {habits.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4 text-center">
          No habits tracked this week.
        </p>
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => (
            <div
              key={habit.habit_id}
              className="px-3 py-3 rounded-lg bg-secondary/50 border border-border"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-foreground truncate">
                  {habit.title}
                </span>
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <span className="text-muted-foreground">
                    {Math.round(habit.adherence_rate)}%
                  </span>
                  <span className="text-amber-400">
                    🔥 {habit.current_streak}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {DAY_LABELS.map((day) => {
                  const status = habit.daily_status[day] ?? 'N/A';
                  return (
                    <div key={day} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">
                        {day.charAt(0)}
                      </span>
                      <div
                        className={`w-3.5 h-3.5 rounded-full ${statusColor(status)}`}
                        title={`${day}: ${status}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
