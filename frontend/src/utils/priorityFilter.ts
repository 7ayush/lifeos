import type { Task } from '../types';

export function filterByPriority(tasks: Task[], priority: string): Task[] {
  if (priority === 'All') return tasks;
  return tasks.filter((t) => (t.priority ?? 'None') === priority);
}
