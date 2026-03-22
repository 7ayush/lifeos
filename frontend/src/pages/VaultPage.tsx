import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getNotes, createNote, updateNote, deleteNote } from '../api';
import type { Note, NoteCreate, NoteUpdate } from '../types';
import { FolderOpen, Plus, FileText, Trash2, Save, X, Archive, Briefcase, Compass, Layers, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ConfirmModal } from '../components/ConfirmModal';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { stripMarkdown } from '../utils/stripMarkdown';

const PARA_FOLDERS = [
  { key: 'all', label: 'All Notes', icon: Layers, color: 'text-white', bg: 'bg-white/10' },
  { key: 'Project', label: 'Projects', icon: Briefcase, color: 'text-sky-400', bg: 'bg-sky-500/10' },
  { key: 'Area', label: 'Areas', icon: Compass, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { key: 'Resource', label: 'Resources', icon: FolderOpen, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { key: 'Archive', label: 'Archive', icon: Archive, color: 'text-neutral-400', bg: 'bg-neutral-500/10' },
];

export function VaultPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editFolder, setEditFolder] = useState('Resource');
  const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Delete State
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<number | null>(null);

  const loadNotes = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const folder = activeFolder === 'all' ? undefined : activeFolder;
      const data = await getNotes(user.id, folder);
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes', err);
    } finally {
      setLoading(false);
    }
  }, [user, activeFolder]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleCreateNote = async () => {
    if (!user) return;
    const payload: NoteCreate = {
      title: 'Untitled Note',
      content: '',
      folder: activeFolder === 'all' ? 'Resource' : activeFolder,
    };
    try {
      const newNote = await createNote(user.id, payload);
      setNotes(prev => [newNote, ...prev]);
      openEditor(newNote);
    } catch (err) {
      console.error('Failed to create note', err);
    }
  };

  const openEditor = (note: Note) => {
    setIsEditing(true);
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditFolder(note.folder);
  };

  const handleSave = async () => {
    if (!user || !editingNote) return;
    const payload: NoteUpdate = {
      title: editTitle.trim() || 'Untitled Note',
      content: editContent,
      folder: editFolder,
    };
    try {
      const updated = await updateNote(user.id, editingNote.id, payload);
      setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
      setEditingNote(updated);
    } catch (err) {
      console.error('Failed to save note', err);
    }
  };

  // Auto-save on content change with debounce
  const handleContentChange = (value: string) => {
    setEditContent(value);
    if (saveTimeout) clearTimeout(saveTimeout);
    const timeout = setTimeout(() => {
      if (editingNote && user) {
        const payload: NoteUpdate = {
          title: editTitle.trim() || 'Untitled Note',
          content: value,
          folder: editFolder,
        };
        updateNote(user.id, editingNote.id, payload).then(updated => {
          setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
          setEditingNote(updated);
        });
      }
    }, 1500);
    setSaveTimeout(timeout);
  };

  const closeEditor = () => {
    handleSave();
    setIsEditing(false);
    setEditingNote(null);
  };

  const handleDeleteNote = (noteId: number) => {
    setNoteToDelete(noteId);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!user || noteToDelete === null) return;
    try {
      await deleteNote(user.id, noteToDelete);
      setNotes(prev => prev.filter(n => n.id !== noteToDelete));
      if (editingNote?.id === noteToDelete) {
        setIsEditing(false);
        setEditingNote(null);
      }
    } catch (err) {
      console.error('Failed to delete note', err);
    }
  };

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const folderCounts = notes.reduce((acc, n) => {
    acc[n.folder] = (acc[n.folder] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500 overflow-hidden">

      {/* Sidebar: P.A.R.A. Folders + Note List */}
      <div className="w-full md:w-1/3 lg:w-1/4 h-1/2 md:h-full flex flex-col glass-panel rounded-3xl border border-white/10 overflow-hidden shrink-0">
        {/* Folder Tabs */}
        <div className="p-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <FolderOpen className="w-4 h-4 text-amber-400" />
              </div>
              <h1 className="text-xl font-bold text-white font-['Outfit'] tracking-tight">Vault</h1>
            </div>
            <button
              onClick={handleCreateNote}
              className="w-8 h-8 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 flex items-center justify-center transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* P.A.R.A. Folder Row */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {PARA_FOLDERS.map(f => {
              const Icon = f.icon;
              const count = f.key === 'all' ? notes.length : (folderCounts[f.key] || 0);
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFolder(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                    activeFolder === f.key
                      ? `${f.bg} ${f.color} border-current/20`
                      : 'bg-transparent border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {f.label}
                  {count > 0 && <span className="opacity-60">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="mt-3 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/30"
            />
          </div>
        </div>

        {/* Note List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <p className="text-center text-neutral-500 text-sm mt-8 p-4">
              {searchQuery ? 'No notes match your search.' : 'No notes yet. Create your first note!'}
            </p>
          ) : (
            filteredNotes.map(note => {
              const isActive = editingNote?.id === note.id;
              const folderInfo = PARA_FOLDERS.find(f => f.key === note.folder);
              return (
                <div
                  key={note.id}
                  onClick={() => openEditor(note)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 border relative overflow-hidden group ${
                    isActive
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-white/[0.015] border-transparent hover:bg-white/[0.04] hover:-translate-y-0.5'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-gradient-to-b from-amber-400 to-transparent rounded-r-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className={`w-3.5 h-3.5 shrink-0 ${folderInfo?.color || 'text-neutral-500'}`} />
                        <p className={`font-bold text-sm truncate ${isActive ? 'text-amber-400' : 'text-neutral-300'}`}>
                          {note.title}
                        </p>
                      </div>
                      <p className="text-xs text-neutral-600 line-clamp-1 pl-5.5">
                        {stripMarkdown(note.content) || 'Empty note'}
                      </p>
                      <p className="text-[10px] text-neutral-700 mt-1 pl-5.5">
                        {format(parseISO(note.updated_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                      className="p-1.5 bg-white/5 hover:bg-red-500/10 text-neutral-600 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Area: Note Editor */}
      <div className="w-full md:w-2/3 lg:w-3/4 h-1/2 md:h-full flex flex-col glass-panel rounded-3xl border border-white/10 overflow-hidden relative">
        {isEditing && editingNote ? (
          <div className="flex flex-col h-full">
            {/* Editor Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={handleSave}
                  placeholder="Note title..."
                  className="flex-1 bg-transparent text-2xl font-bold text-white focus:outline-none placeholder:text-neutral-700 font-['Outfit']"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={editFolder}
                  onChange={e => { setEditFolder(e.target.value); }}
                  onBlur={handleSave}
                  className="bg-white/5 border border-white/10 text-neutral-300 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="Project">📦 Project</option>
                  <option value="Area">🧭 Area</option>
                  <option value="Resource">📂 Resource</option>
                  <option value="Archive">🗃️ Archive</option>
                </select>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  onClick={closeEditor}
                  className="p-1.5 text-neutral-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Editor */}
            <MarkdownEditor
              value={editContent}
              onChange={handleContentChange}
              placeholder="Start writing..."
              autoFocus
              className="flex-1"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50 select-none">
            <FolderOpen className="w-16 h-16 text-neutral-700 mb-6" />
            <h2 className="text-2xl font-bold text-neutral-500 mb-2 font-['Outfit']">Knowledge Vault</h2>
            <p className="text-neutral-600 max-w-sm mb-8">Organize your notes using the P.A.R.A. method — Projects, Areas, Resources, and Archive.</p>
            <button
              onClick={handleCreateNote}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-colors border border-white/10"
            >
              <Plus className="w-5 h-5" />
              New Note
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete Note"
      />
    </div>
  );
}
