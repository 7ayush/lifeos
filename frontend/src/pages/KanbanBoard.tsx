import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTasks, updateTask, createTask, deleteTask, getGoals, createSubTask, toggleSubTask, deleteSubTask } from '../api';
import type { Task, Goal } from '../types';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Plus, Trash2, Calendar, GripVertical, ChevronLeft, ChevronRight, CalendarDays, LayoutTemplate, Archive, Check, Target, Zap, Clock, ListChecks, X as XIcon, CheckCircle2, Pencil } from 'lucide-react';
import { CustomDropdown } from '../components/CustomDropdown';
import { ConfirmModal } from '../components/ConfirmModal';

import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, getDaysInMonth, addDays, addMonths, addYears } from 'date-fns';

const ALL_COLUMNS = ['Todo', 'InProgress', 'Done', 'Archived'] as const;
type TimeframeView = 'Daily' | 'Weekly' | 'Monthly' | 'Annual' | 'All';

const getNormalizedDateRange = (date: Date, view: TimeframeView): { start?: string, end?: string } => {
  const d = new Date(date);
  if (view === 'All') return {};
  if (view === 'Annual') {
    return { start: format(startOfYear(d), 'yyyy-MM-dd'), end: format(endOfYear(d), 'yyyy-MM-dd') };
  }
  if (view === 'Monthly') {
    return { start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') };
  }
  if (view === 'Weekly') {
    return { start: format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
  }
  return { start: format(d, 'yyyy-MM-dd'), end: format(d, 'yyyy-MM-dd') };
};

export function KanbanBoard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<TimeframeView>('Daily');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['Todo', 'InProgress', 'Done']);
  const [isColMenuOpen, setIsColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskType, setNewTaskType] = useState<TimeframeView>('Daily');
  const [newTaskDate, setNewTaskDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [newTaskGoalId, setNewTaskGoalId] = useState<number | undefined>(undefined);
  const [newTaskEnergy, setNewTaskEnergy] = useState<string>('');
  const [newTaskEstMins, setNewTaskEstMins] = useState<string>('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [energyFilter, setEnergyFilter] = useState<string>('All');

  // Subtask inline state
  const [subtaskInput, setSubtaskInput] = useState<Record<number, string>>({});

  // Delete State
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<number | null>(null);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { start, end } = getNormalizedDateRange(selectedDate, view);
      const data = await getTasks(user.id, start, end);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoading(false);
    }
  }, [user, selectedDate, view]);

  useEffect(() => {
    loadTasks();
    if (view !== 'All') {
      setNewTaskType(view);
      const { end } = getNormalizedDateRange(selectedDate, view);
      if (end) setNewTaskDate(end);
    }
    if (user) {
      getGoals(user.id).then(setGoals).catch(console.error);
    }
  }, [user, view, selectedDate, loadTasks]);

  // Handle outside click for column menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(event.target as Node)) {
        setIsColMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTaskTypeChange = (type: TimeframeView) => {
    setNewTaskType(type);
    const { end } = getNormalizedDateRange(selectedDate, type);
    if (end) setNewTaskDate(end);
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !user) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const taskId = parseInt(draggableId);
    const newStatus = destination.droppableId as string;

    setTasks(prev => {
      const updated = [...prev];
      const taskIndex = updated.findIndex(t => t.id === taskId);
      if (taskIndex > -1) {
        updated[taskIndex] = { ...updated[taskIndex], status: newStatus };
      }
      return updated;
    });

    try {
      await updateTask(user.id, taskId, { status: newStatus });
    } catch (err) {
      console.error('Failed to update task', err);
      loadTasks();
    }
  };

  const handleOpenCreateModal = () => {
    setEditingTask(null);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskEnergy('');
    setNewTaskEstMins('');
    setNewTaskGoalId(undefined);
    setNewTaskDate(format(new Date(), 'yyyy-MM-dd'));
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task: Task) => {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskDesc(task.description || '');
    setNewTaskEnergy(task.energy_level || '');
    setNewTaskEstMins(task.estimated_minutes?.toString() || '');
    setNewTaskGoalId(task.goal_id);
    setNewTaskDate(task.target_date || format(new Date(), 'yyyy-MM-dd'));
    setIsModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTaskTitle.trim()) return;

    try {
      const taskData: Partial<Task> = {
        title: newTaskTitle,
        description: newTaskDesc,
        target_date: newTaskDate,
        goal_id: newTaskGoalId,
        energy_level: newTaskEnergy || undefined,
        estimated_minutes: newTaskEstMins ? parseInt(newTaskEstMins) : undefined,
      };

      if (editingTask) {
        await updateTask(user.id, editingTask.id, taskData);
      } else {
        await createTask(user.id, taskData as any);
      }

      setNewTaskTitle('');
      setNewTaskDesc('');
      setIsModalOpen(false);
      setEditingTask(null);
      loadTasks();
    } catch (err) {
      console.error('Failed to save task', err);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    setTaskToDelete(taskId);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteTask = async () => {
    if (!user || taskToDelete === null) return;
    try {
      await deleteTask(user.id, taskToDelete);
      setTasks(prev => prev.filter(t => t.id !== taskToDelete));
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  };

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => 
      prev.includes(col) 
        ? prev.filter(c => c !== col) 
        : [...prev, col]
    );
  };

  const getTasksByStatus = (status: string) => tasks
    .filter(t => t.status === status)
    .filter(t => energyFilter === 'All' || t.energy_level === energyFilter);

  const updateDate = (fields: { year?: number; month?: number; date?: number }) => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      if (fields.year !== undefined) d.setFullYear(fields.year);
      if (fields.month !== undefined) d.setMonth(fields.month);
      if (fields.date !== undefined) d.setDate(fields.date);
      return d;
    });
  };

  const setWeekOfMonth = (weekIndex: number) => {
    const startOfMo = startOfMonth(selectedDate);
    const newDate = addDays(startOfMo, weekIndex * 7);
    setSelectedDate(newDate);
  };

  const navigatePeriod = (direction: -1 | 1) => {
    setSelectedDate(prev => {
      if (view === 'Daily') return addDays(prev, direction);
      if (view === 'Weekly') return addDays(prev, direction * 7);
      if (view === 'Monthly') return addMonths(prev, direction);
      if (view === 'Annual') return addYears(prev, direction);
      return prev;
    });
  };

  const currentWeekIndex = Math.floor((selectedDate.getDate() - 1) / 7);

  const colStyles: Record<string, { bg: string; border: string; glow: string; text: string; topGlare: string }> = {
    Todo: { bg: 'bg-neutral-900/40', border: 'border-white/10 hover:border-white/20', glow: 'shadow-[0_0_40px_rgba(255,255,255,0.02)]', text: 'text-white', topGlare: 'via-white/30' },
    InProgress: { bg: 'bg-cyan-950/20', border: 'border-cyan-500/20 hover:border-cyan-500/40', glow: 'shadow-[0_0_40px_rgba(34,211,238,0.05)]', text: 'text-cyan-400', topGlare: 'via-cyan-500/40' },
    Done: { bg: 'bg-emerald-950/20', border: 'border-emerald-500/20 hover:border-emerald-500/40', glow: 'shadow-[0_0_40px_rgba(16,185,129,0.05)]', text: 'text-emerald-400', topGlare: 'via-emerald-500/40' },
    Archived: { bg: 'bg-neutral-900/20', border: 'border-white/5 hover:border-white/15', glow: 'shadow-[0_0_30px_rgba(255,255,255,0.01)]', text: 'text-neutral-500', topGlare: 'via-neutral-500/20' },
  };

  const statusStyles: Record<string, { bg: string; border: string; accent: string; text: string; line: string }> = {
    Todo: { bg: 'bg-[#111111]/80', border: 'border-white/10', accent: 'border-l-white/30', text: 'text-neutral-100', line: '' },
    InProgress: { bg: 'bg-[#0a151a]/80', border: 'border-cyan-500/20', accent: 'border-l-cyan-500', text: 'text-cyan-50', line: '' },
    Done: { bg: 'bg-[#0a1a12]/80', border: 'border-emerald-500/20', accent: 'border-l-emerald-500/50', text: 'text-neutral-500', line: 'line-through' },
    Archived: { bg: 'bg-neutral-950/40', border: 'border-white/5', accent: 'border-l-neutral-700', text: 'text-neutral-600', line: '' },
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-in fade-in duration-500 relative z-10">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 relative z-30">

        <div>
          <h1 className="text-3xl font-extrabold text-white font-['Outfit'] tracking-tight">Tasks</h1>
          <p className="text-neutral-500 font-medium mt-1">Organize priorities by timeframe.</p>
        </div>

        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-3">
          <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 glass-panel overflow-visible! p-2 rounded-2xl border border-white/10 shadow-xl w-full sm:w-max relative z-40">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
              <CalendarDays className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider font-['Outfit']">Timeline</span>
            </div>

            <div className={`flex items-center gap-1.5 transition-all duration-300 ${view === 'All' ? 'opacity-30 pointer-events-none scale-95 grayscale' : 'opacity-100'}`}>
              <CustomDropdown
                value={selectedDate.getFullYear()}
                onChange={(y) => updateDate({ year: y as number })}
                options={[2023, 2024, 2025, 2026, 2027].map(y => ({ value: y, label: y }))}
                width="w-[88px]"
              />

              {['Monthly', 'Weekly', 'Daily'].includes(view) && (
                <CustomDropdown
                  value={selectedDate.getMonth()}
                  onChange={(m) => updateDate({ month: m as number })}
                  options={Array.from({ length: 12 }).map((_, i) => ({
                    value: i,
                    label: format(new Date(2000, i, 1), 'MMM')
                  }))}
                  width="w-[80px]"
                />
              )}

              {view === 'Weekly' && (
                <CustomDropdown
                  value={currentWeekIndex}
                  onChange={(w) => setWeekOfMonth(w as number)}
                  options={[0, 1, 2, 3, 4].map((wIndex) => ({
                    value: wIndex,
                    label: `W${wIndex + 1}`
                  }))}
                  width="w-[72px]"
                />
              )}

              {view === 'Daily' && (
                <CustomDropdown
                  value={selectedDate.getDate()}
                  onChange={(d) => updateDate({ date: d as number })}
                  options={Array.from({ length: getDaysInMonth(selectedDate) }).map((_, i) => ({
                    value: i + 1,
                    label: i + 1
                  }))}
                  width="w-[60px]"
                />
              )}
            </div>
            
            <div className="h-4 w-px bg-white/10 mx-0.5 hidden md:block" />

            <div className={`flex items-center gap-2 bg-white/3 px-2 py-1.5 rounded-xl border border-white/5 transition-all duration-300 ${view === 'All' ? 'opacity-30' : 'opacity-100'}`}>
              <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest font-['Outfit']">Target:</span>
              <div className="flex items-center gap-1 font-mono text-[9px]">
                {view === 'All' ? (
                  <span className="text-cyan-400/70">ALL TASKS</span>
                ) : (
                  <>
                    <span className="text-cyan-400/90">{getNormalizedDateRange(selectedDate, view).start}</span>
                    <span className="text-neutral-600">→</span>
                    <span className="text-cyan-400/90">{getNormalizedDateRange(selectedDate, view).end}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between glass-panel overflow-visible! p-1.5 rounded-2xl border border-white/10 shadow-lg w-full sm:w-max relative z-40">
            <button
              onClick={() => navigatePeriod(-1)}
              className={`p-1.5 text-neutral-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-xl transition-all active:scale-95 ${view === 'All' ? 'opacity-20 pointer-events-none' : ''}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 mx-1">
              {(['Daily', 'Weekly', 'Monthly', 'Annual', 'All'] as TimeframeView[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setView(t)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tighter sm:tracking-wider transition-all duration-300 ${
                    view === t 
                      ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.4)] scale-105 z-10' 
                      : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/5'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={() => navigatePeriod(1)}
              className={`p-1.5 text-neutral-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-xl transition-all active:scale-95 ${view === 'All' ? 'opacity-20 pointer-events-none' : ''}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 relative z-20">
        <button
          onClick={handleOpenCreateModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-linear-to-r from-cyan-600/20 to-teal-600/20 text-cyan-300 hover:from-cyan-500/30 hover:to-teal-500/30 border border-cyan-500/30 rounded-2xl transition-all font-bold shadow-[0_0_20px_rgba(34,211,238,0.15)] hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          New Task
        </button>

        <div className="relative shrink-0" ref={colMenuRef}>
          <button
            onClick={() => setIsColMenuOpen(!isColMenuOpen)}
            className={`flex items-center gap-2 px-4 py-3 bg-white/3 hover:bg-white/8 border border-white/10 rounded-2xl text-sm font-bold transition-all ${isColMenuOpen ? 'text-cyan-400 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'text-neutral-400'}`}
          >
            <LayoutTemplate className="w-4 h-4" />
            <span>View</span>
            <span className="ml-1 px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-neutral-500">{visibleColumns.length}</span>
          </button>

          {isColMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 glass-panel bg-[#0a0a0a]/95! backdrop-blur-3xl! rounded-2xl border border-white/10 shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200 origin-top z-50">
              <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-3 py-2 mb-1 border-b border-white/5">Visible Columns</div>
              {ALL_COLUMNS.map(col => {
                const isVisible = visibleColumns.includes(col);
                const isLast = visibleColumns.length === 1 && isVisible;
                return (
                  <button
                    key={col}
                    onClick={() => !isLast && toggleColumn(col)}
                    disabled={isLast}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all mb-1 last:mb-0 ${
                      isVisible 
                        ? 'bg-cyan-500/10 text-cyan-50' 
                        : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-300'
                    } ${isLast ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                       {col === 'Archived' ? <Archive className="w-3.5 h-3.5" /> : null}
                       <span>{col === 'InProgress' ? 'In Progress' : col}</span>
                    </div>
                    {isVisible && <Check className="w-3.5 h-3.5 text-cyan-400 animate-in zoom-in" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Energy Filter */}
        <div className="flex items-center gap-1 bg-white/3 p-1 rounded-xl border border-white/5">
          <Zap className="w-3.5 h-3.5 text-neutral-500 ml-2" />
          {['All', 'High', 'Medium', 'Low'].map(e => {
            const eColors: Record<string, string> = { High: 'text-rose-400 bg-rose-500/15', Medium: 'text-amber-400 bg-amber-500/15', Low: 'text-emerald-400 bg-emerald-500/15', All: '' };
            return (
              <button
                key={e}
                onClick={() => setEnergyFilter(e)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
                  energyFilter === e
                    ? (e === 'All' ? 'bg-cyan-500 text-black' : eColors[e] || 'bg-cyan-500 text-black')
                    : 'text-neutral-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {e}
              </button>
            );
          })}
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className={`flex-1 grid grid-cols-1 ${
          visibleColumns.length === 1 ? 'md:grid-cols-1 max-w-2xl mx-auto w-full' : 
          visibleColumns.length === 2 ? 'md:grid-cols-2' : 
          visibleColumns.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'
        } gap-6 min-h-0 pb-6`}>
          {visibleColumns.map((colConfig) => {
            const columnTasks = getTasksByStatus(colConfig);
            const colTitle = colConfig === 'InProgress' ? 'In Progress' : colConfig;
            const cStyle = colStyles[colConfig] || colStyles['Todo'];

            return (
              <div key={colConfig} className={`flex flex-col h-full max-h-full ${cStyle.bg} backdrop-blur-3xl border ${cStyle.border} rounded-[2rem] p-5 pb-2 ${cStyle.glow} relative overflow-hidden transition-all duration-500`}>
                <div className={`absolute top-0 inset-x-0 h-[2px] bg-linear-to-r from-transparent ${cStyle.topGlare} to-transparent opacity-60`} />
                <div className="flex items-center justify-between mb-6 relative z-10 px-1 shrink-0">
                  <div className="flex items-center gap-2">
                    {colConfig === 'Archived' && <Archive className="w-4 h-4 text-neutral-500" />}
                    <h3 className={`font-bold tracking-widest uppercase text-sm ${cStyle.text}`}>{colTitle}</h3>
                  </div>
                  <span className="bg-black/40 border border-white/5 text-neutral-300 text-xs py-1 px-3 rounded-full font-bold shadow-inner">
                    {columnTasks.length}
                  </span>
                </div>

                <Droppable droppableId={colConfig}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar min-h-0 transition-colors rounded-xl p-1 ${
                        snapshot.isDraggingOver ? 'bg-white/[0.03]' : ''
                      }`}
                    >
                      <div className="space-y-4">
                        {columnTasks.map((task, index) => {
                          const style = statusStyles[task.status] || statusStyles['Todo'];
                          return (
                            <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`p-4 rounded-2xl group relative select-none transition-all duration-300 border backdrop-blur-md border-l-4 ${style.bg} ${style.border} ${style.accent} ${
                                    snapshot.isDragging ? 'shadow-2xl shadow-cyan-500/20 opacity-90 ring-1 ring-cyan-500/50 scale-[1.04] z-50' : 'hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)] hover:brightness-110'
                                  }`}
                                >
                                  <div className="flex gap-3">
                                    <div
                                      {...provided.dragHandleProps}
                                      className="pt-1.5 text-neutral-600 hover:text-white transition-colors cursor-grab active:cursor-grabbing"
                                    >
                                      <GripVertical className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={`font-semibold text-sm ${style.text} ${style.line}`}>
                                        {task.title}
                                      </p>
                                      {task.description && (
                                        <p className="text-xs text-neutral-400/80 mt-1.5 line-clamp-2 leading-relaxed">
                                          {task.description}
                                        </p>
                                      )}
                                      {(() => {
                                        const linkedGoal = task.goal_id ? goals.find(g => g.id === task.goal_id) : null;
                                        return linkedGoal ? (
                                          <div className="flex items-center gap-1.5 mt-2">
                                            <Target className="w-3 h-3 text-indigo-400/70" />
                                            <span className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-wider truncate">{linkedGoal.title}</span>
                                          </div>
                                        ) : null;
                                      })()}

                                      {/* Energy + Time Badges */}
                                      {(task.energy_level || task.estimated_minutes) && (
                                        <div className="flex items-center gap-2 mt-2">
                                          {task.energy_level && (() => {
                                            const ec: Record<string, { text: string; bg: string }> = {
                                              High: { text: 'text-rose-400', bg: 'bg-rose-500/10' },
                                              Medium: { text: 'text-amber-400', bg: 'bg-amber-500/10' },
                                              Low: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                                            };
                                            const c = ec[task.energy_level!] || ec.Medium;
                                            return (
                                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${c.text} ${c.bg}`}>
                                                <Zap className="w-2.5 h-2.5" />
                                                {task.energy_level}
                                              </span>
                                            );
                                          })()}
                                          {task.estimated_minutes && (
                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold text-cyan-400/70 bg-cyan-500/10 tracking-wider">
                                              <Clock className="w-2.5 h-2.5" />
                                              {task.estimated_minutes}m
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {/* Subtask Progress Bar */}
                                      {task.subtasks && task.subtasks.length > 0 && (() => {
                                        const done = task.subtasks!.filter(s => s.is_complete).length;
                                        const total = task.subtasks!.length;
                                        const pct = Math.round((done / total) * 100);
                                        return (
                                          <div className="mt-2">
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="flex items-center gap-1 text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
                                                <ListChecks className="w-3 h-3" />
                                                Subtasks
                                              </span>
                                              <span className="text-[9px] font-bold text-neutral-400">{done}/{total}</span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                              <div className="h-full rounded-full bg-linear-to-r from-cyan-500 to-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                                            </div>
                                          </div>
                                        );
                                      })()}

                                      {/* Inline Subtask Management */}
                                      <div className="mt-2 space-y-1 max-h-0 group-hover:max-h-40 overflow-hidden transition-all duration-300">
                                        {task.subtasks?.map(st => (
                                          <div key={st.id} className="flex items-center gap-2 text-[10px]">
                                            <button
                                              onClick={() => toggleSubTask(user!.id, task.id, st.id).then(loadTasks)}
                                              className="shrink-0 transition-transform active:scale-90"
                                            >
                                              {st.is_complete ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                              ) : (
                                                <div className="w-3.5 h-3.5 rounded-full border border-neutral-600" />
                                              )}
                                            </button>
                                            <span className={`flex-1 ${st.is_complete ? 'line-through text-neutral-600' : 'text-neutral-400'}`}>{st.title}</span>
                                            <button
                                              onClick={() => deleteSubTask(user!.id, task.id, st.id).then(loadTasks)}
                                              className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-rose-400 transition-all"
                                            >
                                              <XIcon className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ))}
                                        <form
                                          className="flex items-center gap-2"
                                          onSubmit={async (e) => {
                                            e.preventDefault();
                                            const val = subtaskInput[task.id];
                                            if (!val?.trim()) return;
                                            await createSubTask(user!.id, task.id, val.trim());
                                            setSubtaskInput(prev => ({ ...prev, [task.id]: '' }));
                                            loadTasks();
                                          }}
                                        >
                                          <Plus className="w-3 h-3 text-neutral-600" />
                                          <input
                                            type="text"
                                            value={subtaskInput[task.id] || ''}
                                            onChange={(e) => setSubtaskInput(prev => ({ ...prev, [task.id]: e.target.value }))}
                                            placeholder="Add subtask..."
                                            className="flex-1 bg-transparent text-[10px] text-neutral-400 placeholder:text-neutral-700 focus:outline-none border-b border-transparent focus:border-white/10"
                                          />
                                        </form>
                                      </div>
                                      <div className="mt-4 flex items-center justify-between">
                                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 font-medium bg-black/30 px-2 py-1 rounded-md border border-white/5">
                                          {task.target_date && (
                                            <span className="flex items-center gap-1.5">
                                              <Calendar className="w-3 h-3 text-cyan-500/70" />
                                              {format(new Date(task.target_date), 'MMM d, yyyy')}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => handleOpenEditModal(task)}
                                            className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-cyan-400 transition-all p-1.5 hover:bg-cyan-500/10 rounded-lg"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteTask(task.id)}
                                            className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-rose-400 transition-all p-1.5 hover:bg-rose-500/10 rounded-lg"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                      </div>
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => { setIsModalOpen(false); setEditingTask(null); }}>
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-6 font-['Outfit']">{editingTask ? 'Edit Task' : 'Create New Task'}</h2>
            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="What needs to be done?"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Type</label>
                  <CustomDropdown
                    value={newTaskType}
                    onChange={(val) => handleTaskTypeChange(val as TimeframeView)}
                    options={[
                      { value: 'Daily', label: 'Daily' },
                      { value: 'Weekly', label: 'Weekly' },
                      { value: 'Monthly', label: 'Monthly' },
                      { value: 'Annual', label: 'Annual' }
                    ]}
                    width="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 scheme-dark shrink-0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Description (Optional)</label>
                <textarea
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 min-h-[100px] resize-none"
                  placeholder="Add details..."
                />
              </div>

              {/* Goal Selector */}
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Link to Goal (optional)</label>
                <select
                  value={newTaskGoalId || ''}
                  onChange={(e) => setNewTaskGoalId(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none"
                >
                  <option value="" className="bg-neutral-900">No goal linked</option>
                  {goals.filter(g => g.status === 'Active').map(g => (
                    <option key={g.id} value={g.id} className="bg-neutral-900">{g.title}</option>
                  ))}
                </select>
              </div>

              {/* Energy & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Energy Level</label>
                  <select
                    value={newTaskEnergy}
                    onChange={(e) => setNewTaskEnergy(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none"
                  >
                    <option value="" className="bg-neutral-900">None</option>
                    <option value="High" className="bg-neutral-900">⚡ High</option>
                    <option value="Medium" className="bg-neutral-900">🔶 Medium</option>
                    <option value="Low" className="bg-neutral-900">🟢 Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Est. Minutes</label>
                  <input
                    type="number"
                    min="1"
                    value={newTaskEstMins}
                    onChange={(e) => setNewTaskEstMins(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder="e.g. 30"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingTask(null); }}
                  className="px-5 py-2.5 rounded-xl font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim() || loading}
                  className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(34,211,238,0.4)] flex items-center gap-2"
                >
                  {loading ? <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" /> : (editingTask ? "Save Changes" : "Create Task")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteTask}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete Task"
      />
    </div>
  );
}
