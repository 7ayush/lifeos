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
      <div className={`flex-1 ${height} bg-secondary/50 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-700 relative ${
            isComplete
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
              : 'bg-linear-to-r from-amber-500 via-primary to-accent'
          }`}
          style={{ width: `${clamped}%` }}
        >
          {/* Animated glow overlay */}
          {clamped > 0 && (
            <div className="absolute inset-0 rounded-full bg-linear-to-r from-transparent via-white/20 to-transparent opacity-60" 
                 style={{ backgroundSize: '200% 100%', animation: isComplete ? 'shimmer 2s ease-in-out infinite' : 'none' }} />
          )}
        </div>
      </div>
      {showLabel && (
        <span className="text-xs font-bold text-muted-foreground tabular-nums shrink-0">
          {clamped}%
        </span>
      )}
    </div>
  );
}
