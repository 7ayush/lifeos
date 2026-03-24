import { useState, useMemo } from 'react';
import { Crosshair, X, Plus, Search } from 'lucide-react';
import { PriorityBadge } from '../PriorityBadge';
import type { FocusTaskItem, Task } from '../../types';

const MAX_FOCUS_TASKS = 7;

interface FocusTasksSectionProps {
  focusTasks: FocusTaskItem[];
  allTasks: Task[];
  onAdd: (taskId: number) => void;
  onRemove: (taskId: number) => void;
  onCreate: (title: string) => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Todo: { bg: 'bg-muted', text: 'text-muted-foreground' },
  InProgress: { bg: 'bg-sky-500/10', text: 'text-sky-400' },
  Done: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.Todo;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}
    >
      {status}
    </span>
  );
}

export function FocusTasksSection({
  focusTasks,
  allTasks,
  onAdd,
  onRemove,
  onCreate,
}: FocusTasksSectionProps) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const atLimit = focusTasks.length >= MAX_FOCUS_TASKS;
  const focusedTaskIds = useMemo(
    () => new Set(focusTasks.map((ft) => ft.task_id)),
    [focusTasks],
  );

  const filteredTasks = useMemo(() => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return allTasks
      .filter(
        (t) =>
          !focusedTaskIds.has(t.id) &&
          t.title.toLowerCase().includes(lower),
      )
      .slice(0, 8);
  }, [query, allTasks, focusedTaskIds]);

  const handleSelect = (taskId: number) => {
    onAdd(taskId);
    setQuery('');
    setShowDropdown(false);
  };

  const handleCreate = () => {
    const title = query.trim();
    if (!title) return;
    onCreate(title);
    setQuery('');
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredTasks.length === 0 && query.trim()) {
      handleCreate();
    }
  };

  return (
    <div className="bg-secondary/50 border border-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crosshair className="w-5 h-5 text-violet-400" />
          <h2 className="text-foreground font-semibold">Focus Tasks</h2>
        </div>
        <span className="text-muted-foreground text-sm">
          {focusTasks.length}/{MAX_FOCUS_TASKS}
        </span>
      </div>

      {/* Focus task list */}
      {focusTasks.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4 text-center">
          No focus tasks set for this week.
        </p>
      ) : (
        <div className="space-y-1.5 mb-4">
          {focusTasks.map((ft) => (
            <div
              key={ft.task_id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-secondary/50 border border-border"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-foreground truncate">
                  {ft.task_title}
                </span>
                <StatusBadge status={ft.task_status} />
                <PriorityBadge priority={ft.task_priority} />
              </div>
              <button
                type="button"
                onClick={() => onRemove(ft.task_id)}
                className="shrink-0 p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-red-400 transition-colors"
                aria-label={`Remove ${ft.task_title} from focus`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search / create input */}
      {!atLimit && (
        <div className="relative">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/50 focus-within:border-violet-500/50 transition-colors">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => {
                // Delay to allow click on dropdown items
                setTimeout(() => setShowDropdown(false), 200);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search tasks or type to create new…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
            />
          </div>

          {/* Dropdown */}
          {showDropdown && query.trim() && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-xl max-h-52 overflow-y-auto">
              {filteredTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(task.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-sm text-foreground truncate">
                    {task.title}
                  </span>
                  <PriorityBadge priority={task.priority} />
                </button>
              ))}

              {/* Create new option */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCreate}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/50 transition-colors border-t border-border"
              >
                <Plus className="w-4 h-4 text-violet-400" />
                <span className="text-sm text-violet-400">
                  Create "{query.trim()}"
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {atLimit && (
        <p className="text-muted-foreground text-xs text-center mt-2">
          Maximum of {MAX_FOCUS_TASKS} focus tasks reached.
        </p>
      )}
    </div>
  );
}
