import { useState, useEffect } from 'react';
import { api } from '../api/config';
import type { Task } from '../types';
import { cn } from '../lib/utils';

export function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentView, setCurrentView] = useState<'Daily' | 'Monthly' | 'Annual'>('Daily');

  useEffect(() => {
    // Mock user_id = 1 for now
    api.get('/users/1/tasks/')
       .then((res: any) => setTasks(res.data))
       .catch((err: any) => console.error(err));
  }, []);

  const tasksInView = tasks.filter(t => t.timeframe_view === currentView);
  
  const columns = ['Todo', 'InProgress', 'Done'];

  const moveTask = (taskId: number, newStatus: string) => {
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));
    
    // API Call
    api.put(`/users/1/tasks/${taskId}?status=${newStatus}`)
       .catch((err: any) => console.error("Reverting:", err));
  };

  // Placeholder for drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('taskId', taskId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allows drop
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = parseInt(e.dataTransfer.getData('taskId'), 10);
    moveTask(taskId, newStatus);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <header className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-400 mb-2 tracking-tight">Task Board</h1>
          <p className="text-neutral-400 font-medium">Manage your goals efficiently.</p>
        </div>
        
        {/* View Switcher */}
        <div className="flex bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg">
           {['Daily', 'Monthly', 'Annual'].map(view => (
             <button
               key={view}
               onClick={() => setCurrentView(view as any)}
               className={cn(
                  "px-6 py-2 rounded-lg font-semibold transition-all duration-300 text-sm",
                  currentView === view 
                    ? "bg-emerald-500/20 text-emerald-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]" 
                    : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                )}
             >
               {view}
             </button>
           ))}
        </div>
      </header>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-6 h-full min-w-max pb-4">
          {columns.map(status => {
            const columnTasks = tasksInView.filter(t => t.status === status);
            return (
            <div 
              key={status}
              className="flex flex-col w-80 bg-black/20 backdrop-blur-sm border border-white/5 rounded-2xl p-5 min-h-[500px] flex-shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="flex items-center justify-between mb-5 px-1">
                 <h2 className="text-lg font-bold text-neutral-200 tracking-wide">
                   {status === 'InProgress' ? 'In Progress' : status}
                 </h2>
                 <span className="bg-white/10 text-neutral-400 text-xs py-1 px-3 rounded-full font-mono font-medium border border-white/5">
                   {columnTasks.length}
                 </span>
              </div>
              
              <div className="flex-1 p-1 overflow-y-auto space-y-3">
                {columnTasks.map(task => (
                  <div 
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl cursor-grab active:cursor-grabbing hover:border-emerald-500/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-semibold text-neutral-100 flex-1 leading-snug">{task.title}</h4>
                      {/* Assuming task.is_urgent or similar property exists for the dot */}
                      <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    </div>
                    {task.description && (
                      <p className="text-sm text-neutral-400 mt-2 line-clamp-2 leading-relaxed">{task.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 mt-4 text-xs font-medium text-neutral-500 border-t border-white/5 pt-3">
                       <span className="flex items-center gap-1.5 transition-colors hover:text-neutral-300">
                         <span className="w-3.5 h-3.5 rounded bg-neutral-800 flex items-center justify-center">🎯</span>
                         {/* Assuming task.target_date exists */}
                         { (task as any).target_date || 'No Date'}
                       </span>
                    </div>
                    {/* Temporary action buttons to simulate drag-and-drop */}
                    {/* These buttons are now redundant with actual drag-and-drop, but kept for reference if needed */}
                    {/* <div className="mt-4 flex gap-2 pt-3 border-t border-neutral-700/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        {status !== 'Todo' && (
                           <button onClick={() => moveTask(task.id, 'Todo')} className="text-xs text-neutral-400 hover:text-white">← Todo</button>
                        )}
                        {status !== 'InProgress' && (
                           <button onClick={() => moveTask(task.id, 'InProgress')} className="text-xs text-indigo-400 hover:text-indigo-300">In Progress</button>
                        )}
                        {status !== 'Done' && (
                           <button onClick={() => moveTask(task.id, 'Done')} className="text-xs text-emerald-400 hover:text-emerald-300">Done →</button>
                        )}
                     </div> */}
                  </div>
                ))}
                
                {columnTasks.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 border-2 border-dashed border-white/5 rounded-xl m-2 bg-black/20">
                   <p className="text-sm font-medium">Drop tasks here</p>
                </div>
              )}
              </div>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}
