export type BadgeType = 'Overdue' | 'Due Today' | 'Due Soon' | null;

/**
 * Determines the deadline badge for a task based on its target_date, status,
 * and the remind_days_before configuration.
 *
 * - Overdue: target_date < today and status != "Done"
 * - Due Today: target_date == today and status != "Done"
 * - Due Soon: target_date within remind_days_before window and status != "Done"
 * - null: no badge (no target_date, status is "Done", or outside window)
 */
export function getDeadlineBadge(
  targetDate: string | undefined | null,
  status: string,
  todayStr: string,
  remindDaysBefore: number = 3,
): BadgeType {
  if (!targetDate || status === 'Done') {
    return null;
  }

  const daysUntil = Math.floor(
    (new Date(targetDate + 'T00:00:00').getTime() -
      new Date(todayStr + 'T00:00:00').getTime()) /
      (1000 * 60 * 60 * 24),
  );

  if (daysUntil < 0) {
    return 'Overdue';
  }
  if (daysUntil === 0) {
    return 'Due Today';
  }
  if (daysUntil > 0 && daysUntil <= remindDaysBefore) {
    return 'Due Soon';
  }

  return null;
}
