import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { exportData } from '../api';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';

const ALL_TYPES = ['tasks', 'goals', 'habits', 'journal', 'notes'] as const;
const TYPE_LABELS: Record<string, string> = {
  tasks: 'Tasks',
  goals: 'Goals',
  habits: 'Habits',
  journal: 'Journal',
  notes: 'Notes',
};

export function ExportPage() {
  const { user } = useAuth();
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(ALL_TYPES));
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateError = startDate && endDate && startDate > endDate
    ? 'Start date must be before end date'
    : null;

  const canExport = selectedTypes.size > 0 && !dateError && !loading;

  const allSelected = selectedTypes.size === ALL_TYPES.length;

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedTypes(new Set());
    } else {
      setSelectedTypes(new Set(ALL_TYPES));
    }
  };

  const handleToggleType = (type: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleExport = async () => {
    if (!user || !canExport) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await exportData(
        user.id,
        format,
        [...selectedTypes],
        startDate || undefined,
        endDate || undefined,
      );
      const ext = format === 'json' ? 'json' : (selectedTypes.size > 1 ? 'zip' : 'csv');
      const filename = `lifeos-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
      <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-emerald-400 to-cyan-500 font-['Outfit'] tracking-tight">
        Export Data
      </h1>

      {/* Data Types */}
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">Data Types</h2>
        <label className="flex items-center gap-3 mb-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleToggleAll}
            className="w-4 h-4 rounded border-neutral-600 bg-transparent text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
            {allSelected ? 'Deselect All' : 'Select All'}
          </span>
        </label>
        <div className="border-t border-white/5 pt-3 space-y-2">
          {ALL_TYPES.map(type => (
            <label key={type} className="flex items-center gap-3 cursor-pointer group py-1">
              <input
                type="checkbox"
                checked={selectedTypes.has(type)}
                onChange={() => handleToggleType(type)}
                className="w-4 h-4 rounded border-neutral-600 bg-transparent text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">
                {TYPE_LABELS[type]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Format Selector */}
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">Export Format</h2>
        <div className="flex gap-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name="format"
              value="json"
              checked={format === 'json'}
              onChange={() => setFormat('json')}
              className="w-4 h-4 border-neutral-600 bg-transparent text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 cursor-pointer"
            />
            <FileJson className="w-4 h-4 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
            <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">JSON</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name="format"
              value="csv"
              checked={format === 'csv'}
              onChange={() => setFormat('csv')}
              className="w-4 h-4 border-neutral-600 bg-transparent text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 cursor-pointer"
            />
            <FileSpreadsheet className="w-4 h-4 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
            <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">CSV</span>
          </label>
        </div>
      </div>

      {/* Date Range */}
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">Date Range (Optional)</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs text-neutral-500 mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-neutral-200 text-sm focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-neutral-500 mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-neutral-200 text-sm focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>
        </div>
        {dateError && (
          <p className="mt-3 text-sm text-rose-400">{dateError}</p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={!canExport}
        className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 hover:border-emerald-500/50 active:scale-[0.98]"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting…
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export
          </>
        )}
      </button>
    </div>
  );
}
