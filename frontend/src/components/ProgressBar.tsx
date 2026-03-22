interface ProgressBarProps {
  progress: number; // 0-100
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function ProgressBar({ progress, showLabel = false, size = 'md' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const isComplete = clamped === 100;

  return (
    <div className="flex items-center gap-2 w-full">
      <div className={`flex-1 ${height} bg-white/5 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            isComplete
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500'
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-bold text-neutral-400 tabular-nums shrink-0">
          {clamped}%
        </span>
      )}
    </div>
  );
}
