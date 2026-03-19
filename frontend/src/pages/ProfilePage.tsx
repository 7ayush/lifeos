import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Calendar, Shield, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
