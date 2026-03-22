import type { Tag } from '../types';

interface TagChipProps {
  tag: Tag;
  size?: 'sm' | 'md';
}

const DEFAULT_COLOR = '#6b7280'; // neutral gray

export function TagChip({ tag, size = 'sm' }: TagChipProps) {
  const color = tag.color ?? DEFAULT_COLOR;

  const sizeClasses =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[10px]'
      : 'px-2 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium leading-none whitespace-nowrap ${sizeClasses}`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      {tag.name}
    </span>
  );
}
