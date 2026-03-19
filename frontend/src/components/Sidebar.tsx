import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, BookOpen, BarChart3, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { ProfileMenu } from './ProfileMenu';

export function Sidebar() {
  const routes = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Tasks (Kanban)', icon: CheckSquare, path: '/tasks' },
    { name: 'Habits', icon: Activity, path: '/habits' },
    { name: 'Journal', icon: BookOpen, path: '/journal' },
    { name: 'Leaderboard', icon: BarChart3, path: '/analytics' },
  ];

  return (
    <nav className="w-64 bg-black/60 backdrop-blur-xl border-r border-white/10 flex flex-col pt-8 pb-6 px-4">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3 mb-10">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.3)]">
            <span className="text-xl font-bold text-white font-['Outfit']">L</span>
          </div>
          <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-400 font-['Outfit'] tracking-tight">Life OS</span>
        </div>

        {/* Route Links */}
        <div className="flex flex-col gap-2 flex-1 relative z-10">
          {routes.map((route) => {
            const Icon = route.icon;
            return (
              <NavLink
                key={route.path}
                to={route.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 group relative overflow-hidden',
                    isActive 
                      ? 'bg-gradient-to-r from-emerald-500/10 to-cyan-500/5 text-emerald-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/5' 
                      : 'text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200 border border-transparent'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-gradient-to-b from-emerald-400 to-cyan-400 rounded-r-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                    )}
                    <Icon className={cn("w-5 h-5 transition-transform duration-300 group-hover:scale-110", isActive ? "text-emerald-400" : "")} />
                    <span className="tracking-wide">{route.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Profile Menu (replaced Settings) */}
        <div className="mt-auto border-t border-white/10 pt-4">
          <ProfileMenu />
        </div>
    </nav>
  );
}
