import { CheckCircle2, Calendar } from 'lucide-react';
import { PriorityBadge } from '../PriorityBadge';
import type { CompletedTaskItem } from '../../types';

interface TaskSummarySectionProps {
  completedTasks: Record<string, CompletedTaskItem[]>;
  completedTaskCount: number;
  totalTasks: number;
  completionRate: number;
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TaskSummarySection({
  completedTasks,
  completedTaskCount,
  totalTasks,
  completionRate,
}: TaskSummarySectionProps) {
  const hasTasks = completedTaskCount > 0;

  return (
    <div className="bg-secondary/50 border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <h2 className="text-foreground font-semibold">Completed Tasks</h2>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {completedTaskCount}/{totalTasks}
          </span>
          <span className="text-emerald-400 font-medium">
            {Math.round(completionRate)}%
          </span>
        </div>
      </div>

      {!hasTasks ? (
        <p className="text-muted-foreground text-sm py-4 text-center">
          No tasks completed this week.
        </p>
      ) : (
        <div className="space-y-4">
          {DAY_ORDER.map((day) => {
            const tasks = completedTasks[day];
            if (!tasks || tasks.length === 0) return null;

            return (
              <div key={day}>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {day}
                </h3>
                <div className="space-y-1.5">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-secondary/50 border border-border"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-foreground truncate">
                          {task.title}
                        </span>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {task.goal_title && (
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {task.goal_title}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {task.completed_date}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
