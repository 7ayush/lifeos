import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getJournalEntries, createJournalEntry, deleteJournalEntry, updateJournalEntry } from '../api';
import type { JournalEntry, JournalEntryCreate } from '../types';
import { BookOpen, Plus, Calendar, Trash2, Edit2, Save, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function JournalPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor State
  const [isComposing, setIsComposing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentContent, setCurrentContent] = useState('');
  const [currentDate, setCurrentDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const loadEntries = async () => {
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
  };

  useEffect(() => {
    loadEntries();
  }, [user]);

  const handleSave = async () => {
    if (!user || !currentContent.trim()) return;

    try {
      const payload: JournalEntryCreate = {
        content: currentContent,
        entry_date: currentDate,
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
    if (!user || !confirm('Are you sure you want to delete this entry?')) return;
    try {
      await deleteJournalEntry(user.id, entryId);
      setEntries(prev => prev.filter(e => e.id !== entryId));
    } catch (err) {
      console.error('Failed to delete journal entry', err);
    }
  };

  const startEditing = (entry: JournalEntry) => {
    setIsComposing(true);
    setEditingId(entry.id);
    setCurrentContent(entry.content);
    setCurrentDate(entry.entry_date);
  };

  const startNew = () => {
    setIsComposing(true);
    setEditingId(null);
    setCurrentContent('');
    setCurrentDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const resetEditor = () => {
    setIsComposing(false);
    setEditingId(null);
    setCurrentContent('');
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
      <div className="w-full md:w-1/3 lg:w-1/4 h-1/2 md:h-full flex flex-col glass-panel rounded-3xl border border-white/10 overflow-hidden shrink-0">
        <div className="p-6 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-fuchsia-400" />
              </div>
              <h1 className="text-xl font-bold text-white font-['Outfit'] tracking-tight">Timeline</h1>
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
            <p className="text-center text-neutral-500 text-sm mt-8 p-4">Your journal is empty. Start writing your thoughts.</p>
          ) : (
            entries.map(entry => {
              const dateObj = parseISO(entry.entry_date);
              const isActive = editingId === entry.id;
              return (
                <div 
                  key={entry.id}
                  onClick={() => startEditing(entry)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 border relative overflow-hidden group ${
                    isActive 
                      ? 'bg-fuchsia-500/10 border-fuchsia-500/30' 
                      : 'bg-white/[0.015] border-transparent hover:bg-white/[0.04] hover:-translate-y-0.5'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-gradient-to-b from-fuchsia-400 to-transparent rounded-r-full shadow-[0_0_10px_rgba(217,70,239,0.5)]" />
                  )}
                  <p className={`font-bold text-sm mb-1 ${isActive ? 'text-fuchsia-400' : 'text-neutral-300'}`}>
                    {format(dateObj, 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-neutral-500 line-clamp-2">
                    {entry.content}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Area: Editor / Detail View */}
      <div className="w-full md:w-2/3 lg:w-3/4 h-1/2 md:h-full flex flex-col glass-panel rounded-3xl border border-white/10 overflow-hidden relative">
        {isComposing ? (
          <div className="flex flex-col h-full bg-black/40 p-6 md:p-8 relative z-10 custom-scrollbar overflow-y-auto">
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
              <div className="flex items-center gap-4">
                <Calendar className="w-5 h-5 text-neutral-500" />
                <input 
                  type="date" 
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                  className="bg-transparent border-none text-xl font-bold text-white focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={resetEditor}
                  className="px-4 py-2 text-sm font-semibold text-neutral-400 hover:text-white transition-colors"
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
            <textarea
              value={currentContent}
              onChange={(e) => setCurrentContent(e.target.value)}
              placeholder="What's on your mind today?"
              className="flex-1 w-full bg-transparent resize-none border-none text-neutral-200 text-lg leading-relaxed focus:outline-none focus:ring-0 placeholder:text-neutral-700"
              autoFocus
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50 select-none">
            <BookOpen className="w-16 h-16 text-neutral-700 mb-6" />
            <h2 className="text-2xl font-bold text-neutral-500 mb-2 font-['Outfit']">Reflect on your day</h2>
            <p className="text-neutral-600 max-w-sm mb-8">Select an entry from the timeline to read or edit, or create a new one to capture your current thoughts.</p>
            <button 
              onClick={startNew}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-colors border border-white/10"
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
      
    </div>
  );
}
