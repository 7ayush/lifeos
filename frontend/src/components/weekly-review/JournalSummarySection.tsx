import { BookOpen, Calendar } from 'lucide-react';
import type { JournalEntrySummary } from '../../types';

interface JournalSummarySectionProps {
  journalEntries: JournalEntrySummary[];
  averageMood: number | null;
}

const MOOD_EMOJIS: Record<number, string> = {
  1: '😢',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😊',
};

function MoodIndicator({ mood }: { mood: number | null }) {
  if (mood === null) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  const emoji = MOOD_EMOJIS[mood] ?? '😐';
  return (
    <span className="text-sm" title={`Mood: ${mood}/5`}>
      {emoji}
    </span>
  );
}

export function JournalSummarySection({
  journalEntries,
  averageMood,
}: JournalSummarySectionProps) {
  return (
    <div className="bg-secondary/50 border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <h2 className="text-foreground font-semibold">Journal Entries</h2>
        </div>
        {averageMood !== null && (
          <span className="text-amber-400 font-medium text-sm">
            Avg mood: {MOOD_EMOJIS[Math.round(averageMood)] ?? '😐'}{' '}
            {averageMood.toFixed(1)}
          </span>
        )}
      </div>

      {journalEntries.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4 text-center">
          No journal entries this week. Take a moment to reflect on your thoughts and feelings.
        </p>
      ) : (
        <div className="space-y-3">
          {journalEntries.map((entry) => (
            <div
              key={entry.id}
              className="px-3 py-3 rounded-lg bg-secondary/50 border border-border"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {entry.entry_date}
                  </span>
                </div>
                <MoodIndicator mood={entry.mood} />
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {entry.content_preview}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
