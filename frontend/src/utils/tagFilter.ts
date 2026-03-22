import type { Task } from '../types';

export function filterByTags(tasks: Task[], selectedTagIds: number[]): Task[] {
  if (selectedTagIds.length === 0) return tasks;
  return tasks.filter(task =>
    task.tags?.some(tag => selectedTagIds.includes(tag.id))
  );
}
