import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTasks } from '../api';
import {
  getWeeklyReview,
  saveReflection,
  addFocusTask,
  removeFocusTask,
  createFocusTask,
} from '../api/weeklyReview';
import type { WeeklyReviewData, Task } from '../types';
import { WeekNavigator } from '../components/weekly-review/WeekNavigator';
import { StatisticsSection } from '../components/weekly-review/StatisticsSection';
import { TaskSummarySection } from '../components/weekly-review/TaskSummarySection';
import { HabitSummarySection } from '../components/weekly-review/HabitSummarySection';
import { GoalProgressSection } from '../components/weekly-review/GoalProgressSection';
import { JournalSummarySection } from '../components/weekly-review/JournalSummarySection';
import { ReflectionSection } from '../components/weekly-review/ReflectionSection';
import { FocusTasksSection } from '../components/weekly-review/FocusTasksSection';
import { RefreshCw } from 'lucide-react';

// ---- Week identifier helpers ----

export function getCurrentWeekIdentifier(): string {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000
  );
  // ISO week: week 1 contains Jan 4
  const dayOfWeek = now.getDay() || 7; // Mon=1 .. Sun=7
  const weekNumber = Math.floor((dayOfYear - dayOfWeek + 10) / 7);

  if (weekNumber < 1) {
    // Belongs to last week of previous year
    return getLastWeekOfYear(now.getFullYear() - 1);
  }
  const maxWeek = getISOWeeksInYear(now.getFullYear());
  if (weekNumber > maxWeek) {
    return `${now.getFullYear() + 1}-W01`;
  }
  return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

function getISOWeeksInYear(year: number): number {
  // A year has 53 ISO weeks if Jan 1 is Thursday, or Dec 31 is Thursday
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  return jan1.getDay() === 4 || dec31.getDay() === 4 ? 53 : 52;
}

function getLastWeekOfYear(year: number): string {
  const weeks = getISOWeeksInYear(year);
  return `${year}-W${String(weeks).padStart(2, '0')}`;
}

function parseWeekIdentifier(weekId: string): { year: number; week: number } {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return { year: 2025, week: 1 };
  return { year: parseInt(match[1], 10), week: parseInt(match[2], 10) };
}

export function getPreviousWeek(weekId: string): string {
  const { year, week } = parseWeekIdentifier(weekId);
  if (week <= 1) {
    return getLastWeekOfYear(year - 1);
  }
  return `${year}-W${String(week - 1).padStart(2, '0')}`;
}

export function getNextWeek(weekId: string): string {
  const { year, week } = parseWeekIdentifier(weekId);
  const maxWeek = getISOWeeksInYear(year);
  if (week >= maxWeek) {
    return `${year + 1}-W01`;
  }
  return `${year}-W${String(week + 1).padStart(2, '0')}`;
}

// ---- Page Component ----

export function WeeklyReviewPage() {
  const { user } = useAuth();
  const [weekId, setWeekId] = useState(getCurrentWeekIdentifier);
  const [reviewData, setReviewData] = useState<WeeklyReviewData | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentWeek = getCurrentWeekIdentifier();
  const isCurrentWeek = weekId === currentWeek;

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const [review, tasks] = await Promise.all([
        getWeeklyReview(user.id, weekId),
        getTasks(user.id),
      ]);
      setReviewData(review);
      setAllTasks(tasks);
    } catch (err) {
      console.error('Failed to load weekly review', err);
      setError('Failed to load weekly review data.');
    } finally {
      setLoading(false);
    }
  }, [user, weekId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrevious = () => setWeekId(getPreviousWeek(weekId));
  const handleNext = () => {
    if (!isCurrentWeek) setWeekId(getNextWeek(weekId));
  };

  const handleSaveReflection = useCallback(
    async (content: string) => {
      if (!user) return;
      try {
        const updated = await saveReflection(user.id, weekId, content);
        setReviewData((prev) =>
          prev ? { ...prev, reflection: updated } : prev
        );
      } catch (err) {
        console.error('Failed to save reflection', err);
      }
    },
    [user, weekId]
  );

  const handleAddFocusTask = useCallback(
    async (taskId: number) => {
      if (!user) return;
      try {
        const ft = await addFocusTask(user.id, weekId, taskId);
        setReviewData((prev) =>
          prev ? { ...prev, focus_tasks: [...prev.focus_tasks, ft] } : prev
        );
      } catch (err) {
        console.error('Failed to add focus task', err);
      }
    },
    [user, weekId]
  );

  const handleRemoveFocusTask = useCallback(
    async (taskId: number) => {
      if (!user) return;
      try {
        await removeFocusTask(user.id, weekId, taskId);
        setReviewData((prev) =>
          prev
            ? {
                ...prev,
                focus_tasks: prev.focus_tasks.filter(
                  (ft) => ft.task_id !== taskId
                ),
              }
            : prev
        );
      } catch (err) {
        console.error('Failed to remove focus task', err);
      }
    },
    [user, weekId]
  );

  const handleCreateFocusTask = useCallback(
    async (title: string) => {
      if (!user) return;
      try {
        const ft = await createFocusTask(user.id, weekId, {
          title,
          priority: 'Medium',
        });
        setReviewData((prev) =>
          prev ? { ...prev, focus_tasks: [...prev.focus_tasks, ft] } : prev
        );
        // Refresh all tasks so the new task appears in the selector
        const tasks = await getTasks(user.id);
        setAllTasks(tasks);
      } catch (err) {
        console.error('Failed to create focus task', err);
      }
    },
    [user, weekId]
  );

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50 text-foreground hover:bg-secondary/50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!reviewData) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-amber-400 via-orange-400 to-primary font-['Outfit'] tracking-tight">
        Weekly Review
      </h1>

      <WeekNavigator
        weekIdentifier={reviewData.week_identifier}
        weekStart={reviewData.week_start}
        weekEnd={reviewData.week_end}
        onPrevious={handlePrevious}
        onNext={handleNext}
        isCurrentWeek={isCurrentWeek}
      />

      <StatisticsSection
        dailyTaskCounts={reviewData.daily_task_counts}
        comparison={reviewData.comparison}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <TaskSummarySection
          completedTasks={reviewData.completed_tasks}
          completedTaskCount={reviewData.completed_task_count}
          totalTasks={reviewData.total_tasks}
          completionRate={reviewData.completion_rate}
        />
        <HabitSummarySection
          habits={reviewData.habits}
          overallAdherence={reviewData.overall_habit_adherence}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <GoalProgressSection goals={reviewData.goals} />
        <JournalSummarySection
          journalEntries={reviewData.journal_entries}
          averageMood={reviewData.average_mood}
        />
      </div>

      <ReflectionSection
        content={reviewData.reflection?.content ?? ''}
        onSave={handleSaveReflection}
      />

      <FocusTasksSection
        focusTasks={reviewData.focus_tasks}
        allTasks={allTasks}
        onAdd={handleAddFocusTask}
        onRemove={handleRemoveFocusTask}
        onCreate={handleCreateFocusTask}
      />
    </div>
  );
}
