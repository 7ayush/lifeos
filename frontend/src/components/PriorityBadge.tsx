import type React from 'react';

interface PriorityBadgeProps {
  priority?: string | null;
}

const priorityConfig: Record<string, { bg: string; border: string; text: string; label: string; icon: React.ReactNode }> = {
  High: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    label: 'High',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
        <path fillRule="evenodd" d="M8 3.5a.5.5 0 0 1 .354.146l4 4a.5.5 0 0 1-.708.708L8 4.707 4.354 8.354a.5.5 0 1 1-.708-.708l4-4A.5.5 0 0 1 8 3.5z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M8 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5z" clipRule="evenodd" />
      </svg>
    ),
  },
  Medium: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    label: 'Medium',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
        <path fillRule="evenodd" d="M3 8a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 8z" clipRule="evenodd" />
      </svg>
    ),
  },
  Low: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    label: 'Low',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
        <path fillRule="evenodd" d="M8 12.5a.5.5 0 0 1-.354-.146l-4-4a.5.5 0 0 1 .708-.708L8 11.293l3.646-3.647a.5.5 0 0 1 .708.708l-4 4A.5.5 0 0 1 8 12.5z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M8 12.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 1 0v8a.5.5 0 0 1-.5.5z" clipRule="evenodd" />
      </svg>
    ),
  },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  if (!priority || priority === 'None') return null;

  const config = priorityConfig[priority];
  if (!config) return null;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border shadow-sm shrink-0 ${config.bg} ${config.border} ${config.text}`}>
      {config.icon}
      <span className="text-[8px] font-bold uppercase tracking-tighter">{config.label}</span>
    </span>
  );
}
