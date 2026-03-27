import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getGoals, createGoal, updateGoal, deleteGoal, getGoalDetail } from '../api';
import type { Goal, GoalCreate, GoalDetail } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { Target, Plus, Pencil, Trash2, ChevronRight, Calendar, Flame, CheckCircle2, Circle, Activity, CheckSquare, X, TrendingUp, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { ProgressBar } from '../components/ProgressBar';

const CATEGORIES = ['Project', 'Area', 'Resource', 'Archive'] as const;
const PRIORITIES = ['High', 'Medium', 'Low'] as const;
const STATUSES = ['Active', 'Completed', 'Archived'] as const;

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Project: { bg: 'bg-indigo-100 dark:bg-indigo-500/10', text: 'text-indigo-950 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-500/20' },
  Area: { bg: 'bg-emerald-100 dark:bg-emerald-500/10', text: 'text-emerald-950 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/20' },
  Resource: { bg: 'bg-amber-100 dark:bg-amber-500/10', text: 'text-amber-950 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-500/20' },
  Archive: { bg: 'bg-neutral-100 dark:bg-neutral-500/10', text: 'text-neutral-950 dark:text-muted-foreground', border: 'border-neutral-200 dark:border-neutral-500/20' },
};

const PARA_DESCRIPTIONS: Record<string, string> = {
  Project: 'A goal with a clear deadline and deliverable outcome',
  Area: 'An ongoing area of responsibility to maintain over time',
  Resource: 'A topic or interest for future reference and learning',
  Archive: 'Completed or paused items no longer active',
};

const PRIORITY_COLORS: Record<string, string> = {
  High: 'text-rose-600 dark:text-rose-400',
  Medium: 'text-amber-600 dark:text-amber-400',
  Low: 'text-emerald-600 dark:text-emerald-400',
};

export function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Project');
  const [formPriority, setFormPriority] = useState<string>('Medium');
  const [formTargetDate, setFormTargetDate] = useState('');

  // Delete State
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<number | null>(null);

  // Detail State
  const [selectedGoal, setSelectedGoal] = useState<GoalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadGoals = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getGoals(user.id);
      setGoals(data);
    } catch (err) {
      console.error('Failed to load goals', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadGoals();
  }, [user, loadGoals]);

  const openCreateModal = () => {
    setEditingGoal(null);
    setFormTitle('');
    setFormDesc('');
    setFormCategory('Project');
    setFormPriority('Medium');
    setFormTargetDate('');
    setIsModalOpen(true);
  };

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setFormTitle(goal.title);
    setFormDesc(goal.description || '');
    setFormCategory(goal.category || 'Project');
    setFormPriority(goal.priority || 'Medium');
    setFormTargetDate(goal.target_date || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !formTitle.trim()) return;
    try {
      if (editingGoal) {
        await updateGoal(user.id, editingGoal.id, {
          title: formTitle,
          description: formDesc || undefined,
          category: formCategory,
          priority: formPriority,
          target_date: formTargetDate || undefined,
        });
      } else {
        const payload: GoalCreate = {
          title: formTitle,
          description: formDesc || undefined,
          category: formCategory,
          priority: formPriority,
          target_date: formTargetDate || undefined,
        };
        await createGoal(user.id, payload);
      }
      setIsModalOpen(false);
      loadGoals();
    } catch (err) {
      console.error('Failed to save goal', err);
    }
  };

  const handleDelete = async (goalId: number) => {
    setGoalToDelete(goalId);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!user || goalToDelete === null) return;
    try {
      await deleteGoal(user.id, goalToDelete);
      setSelectedGoal(null);
      loadGoals();
    } catch (err) {
      console.error('Failed to delete goal', err);
    }
  };

  const handleStatusChange = async (goal: Goal, newStatus: string) => {
    if (!user) return;
    try {
      await updateGoal(user.id, goal.id, { status: newStatus });
      loadGoals();
      if (selectedGoal && selectedGoal.id === goal.id) {
        loadGoalDetail(goal.id);
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const loadGoalDetail = async (goalId: number) => {
    if (!user) return;
    try {
      setDetailLoading(true);
      const detail = await getGoalDetail(user.id, goalId);
      setSelectedGoal(detail);
    } catch (err) {
      console.error('Failed to load goal detail', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredGoals = filter === 'All' ? goals : goals.filter(g => g.category === filter);

  if (loading && goals.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 overflow-hidden">
      
      {/* Left Panel: Goal List */}
      <div className={`${selectedGoal ? 'w-full md:w-1/3 lg:w-2/5' : 'w-full'} h-full flex flex-col`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
              <Target className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground font-['Outfit'] tracking-tight">Goals</h1>
              <p className="text-xs text-muted-foreground font-medium">{goals.length} total · {goals.filter(g => g.status === 'Active').length} active</p>
            </div>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-900 border-indigo-900 text-indigo-50 hover:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:text-white border dark:border-transparent rounded-xl font-bold transition-all shadow-md dark:shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Goal</span>
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-4 shrink-0 overflow-x-auto pb-1">
          {['All', ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              title={PARA_DESCRIPTIONS[cat] || 'Show all goals'}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                filter === cat
                  ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-950 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30'
                  : 'bg-secondary/50 text-muted-foreground hover:text-foreground border border-transparent hover:border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Goal Cards Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
          {filteredGoals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 border border-dashed border-border rounded-2xl">
              <Target className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-medium">No goals yet</p>
              <p className="text-muted-foreground text-sm mt-1">Create your first goal to start mapping your journey.</p>
            </div>
          ) : (
            filteredGoals.map(goal => {
              const catColor = CATEGORY_COLORS[goal.category] || CATEGORY_COLORS.Project;
              const isSelected = selectedGoal?.id === goal.id;
              return (
                <div
                  key={goal.id}
                  onClick={() => loadGoalDetail(goal.id)}
                  className={`p-5 rounded-2xl cursor-pointer transition-all duration-300 border relative overflow-hidden group ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30' /* removed manual shadow for light mode focus state */
                      : 'bg-secondary/50 border-border hover:bg-secondary/50 hover:border-border hover:-translate-y-0.5'
                  }`}
                >
                  {/* Active Indicator */}
                  {isSelected && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-linear-to-b from-indigo-400 to-purple-400 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${catColor.bg} ${catColor.text} border ${catColor.border}`}>
                          {goal.category}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${PRIORITY_COLORS[goal.priority] || 'text-muted-foreground'}`}>
                          {goal.priority}
                        </span>
                        {goal.status === 'Completed' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <h3 className={`font-bold text-base truncate ${goal.status === 'Completed' ? 'text-muted-foreground line-through decoration-emerald-200 dark:decoration-emerald-500/30' : 'text-foreground'}`}>
                        {goal.title}
                      </h3>
                      {goal.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{goal.description}</p>
                      )}
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 mt-1 transition-transform ${isSelected ? 'text-indigo-600 dark:text-indigo-400 translate-x-0' : 'text-muted-foreground -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <ProgressBar progress={goal.progress ?? 0} showLabel size="sm" />
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
                    {goal.target_date && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span className="text-[11px] font-medium">{format(new Date(goal.target_date), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(goal); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(goal.id); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel: Goal Detail View */}
      {selectedGoal && (
        <div className="w-full md:w-2/3 lg:w-3/5 h-full flex flex-col glass-panel rounded-3xl border border-border overflow-hidden animate-in slide-in-from-right-4 duration-300">
          {detailLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="p-6 border-b border-border bg-secondary/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {(() => {
                        const catColor = CATEGORY_COLORS[selectedGoal.category] || CATEGORY_COLORS.Project;
                        return (
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${catColor.bg} ${catColor.text} border ${catColor.border}`}>
                            {selectedGoal.category}
                          </span>
                        );
                      })()}
                      <span className={`text-xs font-bold uppercase tracking-wider ${PRIORITY_COLORS[selectedGoal.priority]}`}>
                        ● {selectedGoal.priority} Priority
                      </span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-foreground font-['Outfit'] tracking-tight">{selectedGoal.title}</h2>
                    {selectedGoal.description && (
                      <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{selectedGoal.description}</p>
                    )}
                  </div>
                  <button onClick={() => setSelectedGoal(null)} className="p-2 rounded-xl hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Overall Progress</span>
                    <span className="text-sm font-bold text-foreground font-['Outfit']">{Math.round(selectedGoal.progress)}%</span>
                  </div>
                  <div className="h-2.5 bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 bg-linear-to-r from-indigo-500 via-purple-500 to-emerald-500"
                      style={{ width: `${Math.min(selectedGoal.progress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Status Toggle */}
                <div className="flex items-center gap-2 mt-4">
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(selectedGoal, s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        selectedGoal.status === s
                          ? s === 'Active' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-950 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30'
                          : s === 'Completed' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-neutral-100 dark:bg-neutral-500/20 text-neutral-950 dark:text-muted-foreground border border-neutral-200 dark:border-neutral-500/30'
                          : 'bg-secondary/50 text-muted-foreground border border-transparent hover:text-foreground hover:border-border'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Linked Entities */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {/* Linked Habits */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Linked Habits</h3>
                    <span className="text-xs text-muted-foreground font-medium">({selectedGoal.habits.length})</span>
                  </div>
                  {selectedGoal.habits.length === 0 ? (
                    <p className="text-muted-foreground text-xs italic pl-6">No habits linked to this goal yet. Link habits from the Habits page.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedGoal.habits.map(habit => (
                        <div key={habit.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border hover:bg-secondary/50 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center">
                              <Flame className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{habit.title}</p>
                              <p className="text-[11px] text-muted-foreground">{habit.target_x}/{habit.target_y_days} days · {habit.current_streak} streak</p>
                            </div>
                          </div>
                          <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Linked Tasks */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckSquare className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Linked Tasks</h3>
                    <span className="text-xs text-muted-foreground font-medium">({selectedGoal.tasks.length})</span>
                  </div>
                  {selectedGoal.tasks.length === 0 ? (
                    <p className="text-muted-foreground text-xs italic pl-6">No tasks linked to this goal yet. Link tasks from the Kanban board.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedGoal.tasks.map(task => (
                        <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border hover:bg-secondary/50 transition-all">
                          <div className="flex items-center gap-3">
                            {task.status === 'Done' ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-muted-foreground" />
                            )}
                            <div>
                              <p className={`text-sm font-semibold ${task.status === 'Done' ? 'text-muted-foreground line-through decoration-emerald-200 dark:decoration-emerald-500/30' : 'text-foreground'}`}>
                                {task.title}
                              </p>
                              {task.target_date && (
                                <p className="text-[11px] text-muted-foreground">Due {format(new Date(task.target_date), 'MMM d')}</p>
                              )}
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            task.status === 'Done' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-950 dark:text-emerald-400' :
                            task.status === 'InProgress' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-950 dark:text-amber-400' :
                            'bg-secondary/50 text-muted-foreground'
                          }`}>
                            {task.status === 'InProgress' ? 'In Progress' : task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Milestones */}
                {selectedGoal.milestones && selectedGoal.milestones.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Milestones</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedGoal.milestones.map(m => (
                        <div key={m.threshold} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/10">
                          <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{m.threshold}%</span>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(m.achieved_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress History */}
                {selectedGoal.progress_history && selectedGoal.progress_history.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Progress History</h3>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {selectedGoal.progress_history.map(snap => (
                        <div key={snap.date} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border">
                          <span className="text-xs text-muted-foreground font-medium">
                            {format(new Date(snap.date), 'MMM d, yyyy')}
                          </span>
                          <span className="text-sm font-bold text-foreground">{snap.progress}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deadline Info */}
                {selectedGoal.target_date && (
                  <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Target Deadline</span>
                    </div>
                    <p className="text-lg font-bold text-foreground font-['Outfit'] pl-6">
                      {format(new Date(selectedGoal.target_date), 'MMMM d, yyyy')}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-popover/70 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg glass-panel rounded-3xl border border-border p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-extrabold text-foreground font-['Outfit']">
              {editingGoal ? 'Edit Goal' : 'Create New Goal'}
            </h2>

            {/* Title */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Complete Marathon Training"
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50 transition-colors"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Description</label>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="What does success look like?"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
              />
            </div>

            {/* Category & Priority Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Category (P.A.R.A.)</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:border-indigo-500/50 transition-colors appearance-none"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c} className="bg-popover" title={PARA_DESCRIPTIONS[c]}>{c}</option>
                  ))}
                </select>
                {formCategory && PARA_DESCRIPTIONS[formCategory] && (
                  <p className="text-[10px] text-muted-foreground mt-1 italic">{PARA_DESCRIPTIONS[formCategory]}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Priority</label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:border-indigo-500/50 transition-colors appearance-none"
                >
                  {PRIORITIES.map(p => (
                    <option key={p} value={p} className="bg-popover">{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Target Date */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Target Date</label>
              <input
                type="date"
                value={formTargetDate}
                onChange={(e) => setFormTargetDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:border-indigo-500/50 transition-colors dark:[&::-webkit-calendar-picker-indicator]:filter dark:[&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-muted-foreground hover:text-foreground font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formTitle.trim()}
                className="px-6 py-2.5 bg-indigo-900 border-indigo-900 text-indigo-50 hover:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-400 disabled:opacity-50 dark:text-white border dark:border-transparent rounded-xl font-bold transition-all shadow-md dark:shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-95"
              >
                {editingGoal ? 'Save Changes' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Goal"
        message="Are you sure you want to delete this goal? Linked habits and tasks will be unlinked."
        confirmText="Delete Goal"
      />
    </div>
  );
}
