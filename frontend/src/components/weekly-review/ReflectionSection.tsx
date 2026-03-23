import { useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { MarkdownEditor } from '../MarkdownEditor';

interface ReflectionSectionProps {
  content: string;
  onSave: (content: string) => void;
}

const GUIDED_PROMPTS = [
  'What went well this week?',
  'What could be improved?',
  'What are you grateful for?',
];

export function ReflectionSection({ content, onSave }: ReflectionSectionProps) {
  const [draft, setDraft] = useState(content);
  const [showSaved, setShowSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync draft when external content changes (e.g. week navigation)
  useEffect(() => {
    setDraft(content);
  }, [content]);

  const handleBlur = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (draft !== content) {
        onSave(draft);
        setShowSaved(true);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000);
      }
    }, 500);
  }, [draft, content, onSave]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  return (
    <div className="bg-secondary/50 border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-fuchsia-400" />
          <h2 className="text-foreground font-semibold">Weekly Reflection</h2>
        </div>
        {showSaved && (
          <span className="flex items-center gap-1 text-emerald-400 text-sm font-medium">
            <Check className="w-3.5 h-3.5" />
            Saved
          </span>
        )}
      </div>

      <div className="mb-4 space-y-1.5">
        {GUIDED_PROMPTS.map((prompt) => (
          <p key={prompt} className="text-sm text-muted-foreground italic">
            • {prompt}
          </p>
        ))}
      </div>

      <div
        className="rounded-lg border border-border overflow-hidden bg-secondary/50 min-h-[200px] flex flex-col"
        onBlur={handleBlur}
      >
        <MarkdownEditor
          value={draft}
          onChange={setDraft}
          placeholder="Write your weekly reflection here..."
          className="flex-1 min-h-[200px]"
        />
      </div>
    </div>
  );
}
