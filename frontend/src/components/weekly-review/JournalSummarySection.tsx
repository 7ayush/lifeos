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
    return <span className="text-neutral-600 text-sm">—</span>;
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
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <h2 className="text-white font-semibold">Journal Entries</h2>
        </div>
        {averageMood !== null && (
          <span className="text-amber-400 font-medium text-sm">
            Avg mood: {MOOD_EMOJIS[Math.round(averageMood)] ?? '😐'}{' '}
            {averageMood.toFixed(1)}
          </span>
        )}
      </div>

      {journalEntries.length === 0 ? (
        <p className="text-neutral-500 text-sm py-4 text-center">
          No journal entries this week. Take a moment to reflect on your thoughts and feelings.
        </p>
      ) : (
        <div className="space-y-3">
          {journalEntries.map((entry) => (
            <div
              key={entry.id}
              className="px-3 py-3 rounded-lg bg-white/[0.02] border border-white/5"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="text-xs text-neutral-400">
                    {entry.entry_date}
                  </span>
                </div>
                <MoodIndicator mood={entry.mood} />
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed">
                {entry.content_preview}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
