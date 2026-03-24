import { useState, useEffect } from 'react';
import { Droplets, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { createWaterEntry, getDailyProgress, getWaterGoal } from '../api/water';
import { ProgressBar } from './ProgressBar';

export function HydrationWidget() {
  const [totalMl, setTotalMl] = useState(0);
  const [goalMl, setGoalMl] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const percentage = goalMl > 0 ? Math.round((totalMl / goalMl) * 100) : 0;

  const loadData = async () => {
    try {
      const [progressRes, goalRes] = await Promise.all([
        getDailyProgress(today, today),
        getWaterGoal(),
      ]);
      const todayProgress = progressRes.find((p) => p.date === today);
      setTotalMl(todayProgress?.total_ml ?? 0);
      setGoalMl(goalRes.amount_ml);
    } catch (err) {
      console.error('Failed to load hydration data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickAdd = async () => {
    if (adding) return;
    setAdding(true);
    try {
      await createWaterEntry(250);
      setTotalMl((prev) => prev + 250);
    } catch (err) {
      console.error('Failed to log water', err);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel rounded-2xl p-6 flex items-center justify-center min-h-[180px]">
        <div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <Droplets className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground font-['Outfit']">Hydration</h2>
        </div>
        <span className="text-xs font-bold text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full border border-border">
          {totalMl} / {goalMl} ml
        </span>
      </div>

      <div className="mb-4">
        <ProgressBar progress={percentage} showLabel />
      </div>

      <div className="flex items-center justify-between mt-auto">
        <button
          onClick={handleQuickAdd}
          disabled={adding}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-bold uppercase tracking-wider hover:bg-cyan-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          250 ml
        </button>
        <Link
          to="/hydration"
          className="text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
}
