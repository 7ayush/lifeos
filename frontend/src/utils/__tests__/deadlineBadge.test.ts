import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getDeadlineBadge } from '../deadlineBadge';

// Feature: due-date-reminders, Property 14: Badge assignment correctness

/**
 * Helper: generate a date string in YYYY-MM-DD format.
 * We build from integer components to avoid invalid Date issues.
 */
const dateArb = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // 28 is safe for all months
  })
  .map(
    ({ year, month, day }) =>
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );

const remindDaysBeforeArb = fc.constantFrom(0, 1, 2, 3, 5, 7);

const nonDoneStatusArb = fc.constantFrom('Todo', 'InProgress');

describe('getDeadlineBadge — Property 14: Badge assignment correctness', () => {
  // **Validates: Requirements 6.2, 8.1, 8.2, 8.3, 8.4**

  it('overdue tasks (target_date < today, status != Done) get "Overdue" badge', () => {
    fc.assert(
      fc.property(
        dateArb,
        nonDoneStatusArb,
        fc.integer({ min: 1, max: 3650 }),
        (todayStr, status, daysAgo) => {
          const today = new Date(todayStr + 'T00:00:00');
          const target = new Date(today.getTime() - daysAgo * 86400000);
          const targetStr = target.toISOString().slice(0, 10);

          const badge = getDeadlineBadge(targetStr, status, todayStr);
          expect(badge).toBe('Overdue');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('due-today tasks (target_date == today, status != Done) get "Due Today" badge', () => {
    fc.assert(
      fc.property(dateArb, nonDoneStatusArb, (todayStr, status) => {
        const badge = getDeadlineBadge(todayStr, status, todayStr);
        expect(badge).toBe('Due Today');
      }),
      { numRuns: 200 },
    );
  });

  it('due-soon tasks (target_date within remind_days_before window, status != Done) get "Due Soon" badge', () => {
    fc.assert(
      fc.property(
        dateArb,
        nonDoneStatusArb,
        remindDaysBeforeArb.filter((d) => d > 0),
        (todayStr, status, remindDaysBefore) => {
          // Pick a random day within the window: 1..remindDaysBefore
          const daysAhead =
            1 + Math.floor(Math.random() * remindDaysBefore);
          if (daysAhead > remindDaysBefore) return; // skip edge

          const today = new Date(todayStr + 'T00:00:00');
          const target = new Date(
            today.getTime() + daysAhead * 86400000,
          );
          const targetStr = target.toISOString().slice(0, 10);

          const badge = getDeadlineBadge(
            targetStr,
            status,
            todayStr,
            remindDaysBefore,
          );
          expect(badge).toBe('Due Soon');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('done tasks get no badge regardless of date', () => {
    fc.assert(
      fc.property(
        dateArb,
        dateArb,
        remindDaysBeforeArb,
        (targetDate, todayStr, remindDaysBefore) => {
          const badge = getDeadlineBadge(
            targetDate,
            'Done',
            todayStr,
            remindDaysBefore,
          );
          expect(badge).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('tasks with no target_date get no badge', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(undefined, null, ''),
        fc.constantFrom('Todo', 'InProgress', 'Done'),
        dateArb,
        remindDaysBeforeArb,
        (targetDate, status, todayStr, remindDaysBefore) => {
          const badge = getDeadlineBadge(
            targetDate as string | undefined | null,
            status,
            todayStr,
            remindDaysBefore,
          );
          expect(badge).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('badge type is mutually exclusive — exactly one of Overdue, Due Today, Due Soon, or null', () => {
    fc.assert(
      fc.property(
        fc.option(dateArb, { nil: undefined }),
        fc.constantFrom('Todo', 'InProgress', 'Done'),
        dateArb,
        remindDaysBeforeArb,
        (targetDate, status, todayStr, remindDaysBefore) => {
          const badge = getDeadlineBadge(
            targetDate,
            status,
            todayStr,
            remindDaysBefore,
          );
          const validBadges = ['Overdue', 'Due Today', 'Due Soon', null];
          expect(validBadges).toContain(badge);
        },
      ),
      { numRuns: 200 },
    );
  });
});
