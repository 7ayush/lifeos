import { Task } from '../types';

const PRIORITY_WEIGHT: Record<string, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
  None: 3,
};

export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const wa = PRIORITY_WEIGHT[a.priority ?? 'None'] ?? 3;
    const wb = PRIORITY_WEIGHT[b.priority ?? 'None'] ?? 3;
    return wa - wb;
  });
}
