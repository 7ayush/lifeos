import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getReminderConfig, updateReminderConfig } from '../api';
import type { ReminderConfig } from '../types';
import { User, Mail, Calendar, Shield, LogOut, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [reminderConfig, setReminderConfig] = useState<ReminderConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSuccess, setConfigSuccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    getReminderConfig(user.id)
      .then(setReminderConfig)
      .catch(err => console.error('Failed to load reminder config', err))
      .finally(() => setConfigLoading(false));
  }, [user]);

  const handleConfigChange = async (updates: Partial<ReminderConfig>) => {
    if (!user) return;
    try {
      const updated = await updateReminderConfig(user.id, updates);
      setReminderConfig(updated);
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to update reminder config', err);
    }
  };

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white font-['Outfit'] tracking-tight">Profile</h1>
        <p className="text-neutral-500 mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile Card */}
      <div className="glass-panel rounded-2xl p-8">
        <div className="flex items-center gap-6">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.username}
              className="w-20 h-20 rounded-2xl object-cover ring-2 ring-white/10 shadow-lg"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center ring-2 ring-white/10 shadow-lg">
              <span className="text-3xl font-bold text-white font-['Outfit']">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-white">{user.username}</h2>
            <p className="text-neutral-400 text-sm">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              <span className="text-emerald-400 text-xs font-medium">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="glass-panel rounded-2xl divide-y divide-white/5">
        <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider px-6 pt-6 pb-4">
          Account Details
        </h3>

        <div className="flex items-center gap-4 px-6 py-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <User className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-neutral-500 font-medium">Display Name</p>
            <p className="text-sm text-white">{user.username}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 px-6 py-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Mail className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-neutral-500 font-medium">Email</p>
            <p className="text-sm text-white">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 px-6 py-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-neutral-500 font-medium">Member Since</p>
            <p className="text-sm text-white">{memberSince}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 px-6 py-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Shield className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-neutral-500 font-medium">Authentication</p>
            <p className="text-sm text-white">Google Account</p>
          </div>
        </div>
      </div>

      {/* Reminder Settings */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
              Reminder Settings
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">Configure when you receive deadline reminders</p>
          </div>
          {configSuccess && (
            <span className="ml-auto text-xs font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Saved
            </span>
          )}
        </div>

        {configLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : reminderConfig ? (
          <div className="space-y-5">
            {/* Remind Days Before */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Advance Notice</p>
                <p className="text-xs text-neutral-500 mt-0.5">How many days before a deadline to remind you</p>
              </div>
              <select
                value={reminderConfig.remind_days_before}
                onChange={(e) => handleConfigChange({ remind_days_before: parseInt(e.target.value) })}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none cursor-pointer"
              >
                <option value="0" className="bg-neutral-900">None</option>
                <option value="1" className="bg-neutral-900">1 day</option>
                <option value="2" className="bg-neutral-900">2 days</option>
                <option value="3" className="bg-neutral-900">3 days</option>
                <option value="5" className="bg-neutral-900">5 days</option>
                <option value="7" className="bg-neutral-900">7 days</option>
              </select>
            </div>

            {/* Remind on Due Date */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Due Date Reminder</p>
                <p className="text-xs text-neutral-500 mt-0.5">Get notified on the day a task is due</p>
              </div>
              <button
                onClick={() => handleConfigChange({ remind_on_due_date: !reminderConfig.remind_on_due_date })}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                  reminderConfig.remind_on_due_date ? 'bg-amber-500' : 'bg-white/10'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  reminderConfig.remind_on_due_date ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>

            {/* Remind When Overdue */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Overdue Reminder</p>
                <p className="text-xs text-neutral-500 mt-0.5">Get notified when a task is past its deadline</p>
              </div>
              <button
                onClick={() => handleConfigChange({ remind_when_overdue: !reminderConfig.remind_when_overdue })}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                  reminderConfig.remind_when_overdue ? 'bg-amber-500' : 'bg-white/10'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  reminderConfig.remind_when_overdue ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-neutral-500 text-sm">Unable to load reminder settings.</p>
        )}
      </div>

      {/* Danger Zone */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-red-400/80 uppercase tracking-wider mb-4">
          Session
        </h3>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-5 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-xl transition-all duration-300 font-medium text-sm cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
