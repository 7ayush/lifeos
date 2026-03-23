import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { createTask, createHabit, createGoal, createJournalEntry } from '../api';
import type { TaskCreate, HabitCreate, GoalCreate, JournalEntryCreate } from '../types';
import { Plus, X, CheckSquare, Activity, Target, BookOpen, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

type CaptureType = 'task' | 'habit' | 'goal' | 'journal';

const CAPTURE_OPTIONS: { type: CaptureType; label: string; icon: typeof CheckSquare; color: string; bg: string; glow: string }[] = [
  { type: 'task', label: 'Quick Task', icon: CheckSquare, color: 'text-cyan-400', bg: 'bg-cyan-500/15', glow: 'shadow-[0_0_20px_rgba(34,211,238,0.2)]' },
  { type: 'habit', label: 'Quick Habit', icon: Activity, color: 'text-indigo-400', bg: 'bg-indigo-500/15', glow: 'shadow-[0_0_20px_rgba(99,102,241,0.2)]' },
  { type: 'goal', label: 'Quick Goal', icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/15', glow: 'shadow-[0_0_20px_rgba(52,211,153,0.2)]' },
  { type: 'journal', label: 'Journal Entry', icon: BookOpen, color: 'text-amber-400', bg: 'bg-amber-500/15', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.2)]' },
];

export function QuickCaptureButton() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeCapture, setActiveCapture] = useState<CaptureType | null>(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveCapture(null);
        setTitle('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeCapture && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeCapture]);

  const handleQuickSave = async () => {
    if (!user || !title.trim() || !activeCapture) return;
    setSaving(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      switch (activeCapture) {
        case 'task': {
          const payload: TaskCreate = { title: title.trim(), target_date: todayStr };
          await createTask(user.id, payload);
          break;
        }
        case 'habit': {
          const payload: HabitCreate = { title: title.trim(), target_x: 3, target_y_days: 7, start_date: todayStr };
          await createHabit(user.id, payload);
          break;
        }
        case 'goal': {
          const payload: GoalCreate = { title: title.trim(), category: 'Project', priority: 'Medium' };
          await createGoal(user.id, payload);
          break;
        }
        case 'journal': {
          const payload: JournalEntryCreate = { content: title.trim(), entry_date: todayStr };
          await createJournalEntry(user.id, payload);
          break;
        }
      }
      setTitle('');
      setActiveCapture(null);
      setIsOpen(false);
      // Navigate to the relevant page after quick capture
      const routes: Record<CaptureType, string> = { task: '/tasks', habit: '/habits', goal: '/goals', journal: '/journal' };
      navigate(routes[activeCapture]);
    } catch (err) {
      console.error('Quick capture failed', err);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && title.trim()) {
      handleQuickSave();
    }
    if (e.key === 'Escape') {
      setActiveCapture(null);
      setTitle('');
    }
  };

  return (
    <div ref={menuRef} className="fixed bottom-8 right-8 z-50">
      {/* Radial Menu */}
      {isOpen && !activeCapture && (
        <div className="absolute bottom-20 right-0 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {CAPTURE_OPTIONS.map((opt, i) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.type}
                onClick={() => setActiveCapture(opt.type)}
                className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border border-border backdrop-blur-xl bg-popover/90 hover:bg-secondary/50 transition-all duration-300 group whitespace-nowrap ${opt.glow}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className={`w-9 h-9 rounded-xl ${opt.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <Icon className={`w-4.5 h-4.5 ${opt.color}`} />
                </div>
                <span className="text-sm font-bold text-foreground font-['Outfit'] tracking-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Quick Input Modal */}
      {activeCapture && (
        <div className="absolute bottom-20 right-0 w-80 animate-in fade-in zoom-in-95 duration-200">
          <div className="glass-panel rounded-2xl border border-border p-5 shadow-2xl backdrop-blur-xl bg-popover/95">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-foreground font-['Outfit'] uppercase tracking-wider">
                  {CAPTURE_OPTIONS.find(o => o.type === activeCapture)?.label}
                </h3>
              </div>
              <button
                onClick={() => { setActiveCapture(null); setTitle(''); }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeCapture === 'journal' ? 'Start writing...' : 'Enter title...'}
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
            />
            <div className="flex items-center justify-between mt-4">
              <p className="text-[10px] text-muted-foreground font-medium">Press <kbd className="px-1.5 py-0.5 bg-secondary/50 rounded text-muted-foreground border border-border text-[9px]">Enter</kbd> to save</p>
              <button
                onClick={handleQuickSave}
                disabled={!title.trim() || saving}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => { setIsOpen(!isOpen); setActiveCapture(null); setTitle(''); }}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-2xl active:scale-90 ${
          isOpen
            ? 'bg-secondary/50 border border-border rotate-45'
            : 'bg-linear-to-br from-emerald-500 to-cyan-500 border border-emerald-400/30 shadow-[0_0_40px_rgba(52,211,153,0.3)] hover:shadow-[0_0_50px_rgba(52,211,153,0.5)] hover:scale-105'
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-foreground -rotate-45" />
        ) : (
          <Plus className="w-6 h-6 text-white" />
        )}
      </button>
    </div>
  );
}
