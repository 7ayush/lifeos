import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getJournalEntries, createJournalEntry, deleteJournalEntry, updateJournalEntry } from '../api';
import type { JournalEntry, JournalEntryCreate } from '../types';
import { BookOpen, Plus, Calendar, Trash2, Save, X, Sparkles } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ConfirmModal } from '../components/ConfirmModal';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { stripMarkdown } from '../utils/stripMarkdown';

const MOOD_EMOJIS = [
  { value: 1, emoji: '😔', label: 'Rough', color: 'from-rose-600 to-rose-400' },
  { value: 2, emoji: '😕', label: 'Meh', color: 'from-orange-600 to-orange-400' },
  { value: 3, emoji: '😐', label: 'Okay', color: 'from-amber-600 to-amber-400' },
  { value: 4, emoji: '🙂', label: 'Good', color: 'from-emerald-600 to-emerald-400' },
  { value: 5, emoji: '🤩', label: 'Amazing', color: 'from-violet-600 to-violet-400' },
];

const SMART_PROMPTS = [
  "What was the highlight of my day?",
  "What's one thing I learned today?",
  "What am I grateful for right now?",
  "What challenge did I overcome today?",
  "How am I feeling and why?",
  "What's one thing I want to improve tomorrow?",
  "What made me smile today?",
  "What progress did I make toward my goals?",
  "What would I tell my future self about today?",
  "What's draining my energy and what can I do about it?",
];

function getRandomPrompts(count: number): string[] {
  const shuffled = [...SMART_PROMPTS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export function JournalPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor State
  const [isComposing, setIsComposing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentContent, setCurrentContent] = useState('');
  const [currentDate, setCurrentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currentMood, setCurrentMood] = useState<number | undefined>(undefined);
  const [showPrompts, setShowPrompts] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);

  // Delete State
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);

  const loadEntries = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getJournalEntries(user.id);
      setEntries(data);
    } catch (err) {
      console.error('Failed to load journal entries', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleSave = async () => {
    if (!user || !currentContent.trim()) return;

    try {
      const payload: JournalEntryCreate = {
        content: currentContent,
        entry_date: currentDate,
        mood: currentMood,
      };

      if (editingId) {
        await updateJournalEntry(user.id, editingId, payload);
      } else {
        await createJournalEntry(user.id, payload);
      }
      
      resetEditor();
      loadEntries();
    } catch (err) {
      console.error('Failed to save journal entry', err);
    }
  };

  const handleDelete = async (entryId: number) => {
    setEntryToDelete(entryId);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!user || entryToDelete === null) return;
    try {
      await deleteJournalEntry(user.id, entryToDelete);
      setEntries(prev => prev.filter(e => e.id !== entryToDelete));
      setIsDeleteConfirmOpen(false);
      setEntryToDelete(null);
      resetEditor();
    } catch (err) {
      console.error('Failed to delete journal entry', err);
    }
  };

  const startEditing = (entry: JournalEntry) => {
    setIsComposing(true);
    setEditingId(entry.id);
    setCurrentContent(entry.content);
    setCurrentDate(entry.entry_date);
    setCurrentMood(entry.mood ?? undefined);
    setShowPrompts(false);
  };

  const startNew = () => {
    setIsComposing(true);
    setEditingId(null);
    setCurrentContent('');
    setCurrentDate(format(new Date(), 'yyyy-MM-dd'));
    setCurrentMood(undefined);
    setPrompts(getRandomPrompts(3));
    setShowPrompts(false);
  };

  const resetEditor = () => {
    setIsComposing(false);
    setEditingId(null);
    setCurrentContent('');
    setCurrentMood(undefined);
    setShowPrompts(false);
  };

  const applyPrompt = (prompt: string) => {
    setCurrentContent(prev => prev ? `${prev}\n\n${prompt}\n` : `${prompt}\n`);
    setShowPrompts(false);
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-8 h-8 border-2 border-fuchsia-400/30 border-t-fuchsia-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500 overflow-hidden">
      
      {/* Sidebar: Entry Timeline */}
      <div className="w-full md:w-1/3 lg:w-1/4 h-1/2 md:h-full flex flex-col glass-panel rounded-3xl border border-border overflow-hidden shrink-0">
        <div className="p-6 border-b border-border bg-secondary/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-fuchsia-400" />
              </div>
              <h1 className="text-xl font-bold text-foreground font-['Outfit'] tracking-tight">Timeline</h1>
            </div>
            {!isComposing && (
              <button 
                onClick={startNew}
                className="w-8 h-8 rounded-full bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {entries.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm mt-8 p-4">Your journal is empty. Start writing your thoughts.</p>
          ) : (
            entries.map(entry => {
              const dateObj = parseISO(entry.entry_date);
              const isActive = editingId === entry.id;
              const moodEmoji = entry.mood ? MOOD_EMOJIS.find(m => m.value === entry.mood) : null;
              return (
                <div 
                  key={entry.id}
                  onClick={() => startEditing(entry)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 border relative overflow-hidden group ${
                    isActive 
                      ? 'bg-fuchsia-500/10 border-fuchsia-500/30' 
                      : 'bg-secondary/50 border-transparent hover:bg-secondary/50 hover:-translate-y-0.5'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-gradient-to-b from-fuchsia-400 to-transparent rounded-r-full shadow-[0_0_10px_rgba(217,70,239,0.5)]" />
                  )}
                  <div className="flex items-center justify-between mb-1">
                    <p className={`font-bold text-sm ${isActive ? 'text-fuchsia-400' : 'text-foreground'}`}>
                      {format(dateObj, 'MMM d, yyyy')}
                    </p>
                    {moodEmoji && (
                      <span className="text-lg" title={moodEmoji.label}>{moodEmoji.emoji}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {stripMarkdown(entry.content)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Area: Editor / Detail View */}
      <div className="w-full md:w-2/3 lg:w-3/4 h-1/2 md:h-full flex flex-col glass-panel rounded-3xl border border-border overflow-hidden relative">
        {isComposing ? (
          <div className="flex flex-col h-full bg-card/60 p-6 md:p-8 relative z-10 custom-scrollbar overflow-y-auto">
            {/* Header Row */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
              <div className="flex items-center gap-4">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <input 
                  type="date" 
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                  className="bg-transparent border-none text-xl font-bold text-foreground focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={resetEditor}
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="hidden sm:inline">Cancel</span>
                  <X className="w-4 h-4 sm:hidden" />
                </button>
                <button 
                  onClick={handleSave}
                  disabled={!currentContent.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(217,70,239,0.3)]"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">Save Entry</span>
                </button>
              </div>
            </div>

            {/* Mood Selector */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider whitespace-nowrap">Mood</span>
              <div className="flex items-center gap-1.5">
                {MOOD_EMOJIS.map(mood => (
                  <button
                    key={mood.value}
                    onClick={() => setCurrentMood(currentMood === mood.value ? undefined : mood.value)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all duration-200 border ${
                      currentMood === mood.value
                        ? `bg-gradient-to-br ${mood.color} border-border scale-110 shadow-lg`
                        : 'bg-secondary/50 border-transparent hover:bg-secondary/50 hover:scale-105'
                    }`}
                    title={mood.label}
                  >
                    {mood.emoji}
                  </button>
                ))}
              </div>
              {currentMood && (
                <span className="text-xs text-muted-foreground font-medium">
                  {MOOD_EMOJIS.find(m => m.value === currentMood)?.label}
                </span>
              )}
            </div>

            {/* Smart Prompts Toggle  */}
            <div className="mb-4">
              <button
                onClick={() => {
                  setShowPrompts(!showPrompts);
                  if (!showPrompts) setPrompts(getRandomPrompts(3));
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border ${
                  showPrompts 
                    ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' 
                    : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Smart Prompts
              </button>

              {showPrompts && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {prompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => applyPrompt(prompt)}
                      className="px-3 py-2 rounded-xl bg-secondary/50 hover:bg-violet-500/10 text-muted-foreground hover:text-violet-300 text-sm font-medium border border-border hover:border-violet-500/20 transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                  <button
                    onClick={() => setPrompts(getRandomPrompts(3))}
                    className="px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    ↻ Refresh
                  </button>
                </div>
              )}
            </div>

            {/* Markdown Editor */}
            <MarkdownEditor
              value={currentContent}
              onChange={setCurrentContent}
              placeholder="What's on your mind today?"
              autoFocus
              className="flex-1"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50 select-none">
            <BookOpen className="w-16 h-16 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-bold text-muted-foreground mb-2 font-['Outfit']">Reflect on your day</h2>
            <p className="text-muted-foreground max-w-sm mb-8">Select an entry from the timeline to read or edit, or create a new one to capture your current thoughts.</p>
            <button 
              onClick={startNew}
              className="flex items-center gap-2 px-6 py-3 bg-secondary/50 hover:bg-secondary/50 text-foreground rounded-xl font-semibold transition-colors border border-border"
            >
              <Plus className="w-5 h-5" />
              Write Entry
            </button>
          </div>
        )}

        {/* Floating Delete Button if editing existing */}
        {isComposing && editingId && (
          <button
            onClick={() => handleDelete(editingId)}
            className="absolute bottom-6 right-6 lg:bottom-8 lg:right-8 w-12 h-12 rounded-full bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white flex items-center justify-center transition-all group border border-rose-500/20"
            title="Delete Entry"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>
      
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Entry"
        message="Are you sure you want to delete this journal entry? This action cannot be undone."
        confirmText="Delete Entry"
      />
    </div>
  );
}
