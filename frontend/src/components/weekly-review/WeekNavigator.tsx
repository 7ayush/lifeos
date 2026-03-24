import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface WeekNavigatorProps {
  weekIdentifier: string;
  weekStart: string;
  weekEnd: string;
  onPrevious: () => void;
  onNext: () => void;
  isCurrentWeek: boolean;
}

function formatDateRange(weekStart: string, weekEnd: string): string {
  const start = parseISO(weekStart);
  const end = parseISO(weekEnd);

  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth && sameYear) {
    return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`;
  }
  if (sameYear) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
}

export function WeekNavigator({
  weekIdentifier,
  weekStart,
  weekEnd,
  onPrevious,
  onNext,
  isCurrentWeek,
}: WeekNavigatorProps) {
  const dateRange = formatDateRange(weekStart, weekEnd);

  return (
    <div className="flex items-center justify-between bg-secondary/50 border border-border rounded-xl px-5 py-3">
      <button
        onClick={onPrevious}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        aria-label="Previous week"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="text-center">
        <span className="text-foreground font-semibold tracking-wide">
          {weekIdentifier}
        </span>
        <span className="text-muted-foreground mx-2">·</span>
        <span className="text-muted-foreground">{dateRange}</span>
      </div>

      <button
        onClick={onNext}
        disabled={isCurrentWeek}
        className={`p-2 rounded-lg transition-colors ${
          isCurrentWeek
            ? 'text-muted-foreground/50 cursor-not-allowed'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
        }`}
        aria-label="Next week"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
