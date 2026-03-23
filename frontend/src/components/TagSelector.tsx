import { useState, useRef, useEffect } from 'react';
import { createTag } from '../api';
import type { Tag } from '../types';
import { TagChip } from './TagChip';

interface TagSelectorProps {
  allTags: Tag[];
  selectedTagIds: number[];
  onSelectionChange: (tagIds: number[]) => void;
  onTagCreated: (tag: Tag) => void;
  userId: number;
}

export function TagSelector({
  allTags,
  selectedTagIds,
  onSelectionChange,
  onTagCreated,
  userId,
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmed = search.trim();
  const filtered = allTags.filter((t) =>
    t.name.toLowerCase().includes(trimmed.toLowerCase())
  );
  const exactMatch = allTags.some(
    (t) => t.name.toLowerCase() === trimmed.toLowerCase()
  );
  const showCreate = trimmed.length > 0 && !exactMatch;

  const toggleTag = (tagId: number) => {
    setError(null);
    if (selectedTagIds.includes(tagId)) {
      onSelectionChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onSelectionChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreate = async () => {
    setError(null);
    try {
      const newTag = await createTag(userId, { name: trimmed });
      onTagCreated(newTag);
      onSelectionChange([...selectedTagIds, newTag.id]);
      setSearch('');
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 409
      ) {
        setError(`Tag "${trimmed}" already exists`);
      } else {
        setError('Failed to create tag');
      }
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1.5 flex-wrap px-2.5 py-1.5 bg-secondary/50 hover:bg-secondary/80 border border-border rounded-lg text-sm text-foreground transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-h-[34px]"
      >
        {selectedTagIds.length === 0 && (
          <span className="text-muted-foreground">Select tags…</span>
        )}
        {allTags
          .filter((t) => selectedTagIds.includes(t.id))
          .map((t) => (
            <TagChip key={t.id} tag={t} size="sm" />
          ))}
      </button>

      {isOpen && (
        <div className="absolute z-100 left-0 w-full mt-1.5 bg-popover/95 backdrop-blur-3xl rounded-xl border border-border shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200 origin-top overflow-hidden">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setError(null);
              }}
              placeholder="Search or create tag…"
              className="w-full px-2.5 py-1.5 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              autoFocus
            />
          </div>

          {error && (
            <div className="px-3 pb-1 text-xs text-red-400">{error}</div>
          )}

          <div className="max-h-48 overflow-y-auto custom-scrollbar py-1">
            {filtered.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between ${
                    selected
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-foreground hover:bg-secondary/50 hover:text-foreground'
                  }`}
                >
                  <TagChip tag={tag} size="sm" />
                  {selected && (
                    <span className="text-cyan-400 text-xs">✓</span>
                  )}
                </button>
              );
            })}

            {showCreate && (
              <button
                type="button"
                onClick={handleCreate}
                className="w-full text-left px-3 py-1.5 text-sm text-cyan-400 hover:bg-secondary/50 transition-colors"
              >
                Create "{trimmed}"
              </button>
            )}

            {filtered.length === 0 && !showCreate && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No tags found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
