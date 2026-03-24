import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Target, CheckSquare, BookOpen, BarChart3, Activity, FolderOpen, CalendarDays, Download, Sun, Moon } from 'lucide-react';
import { cn } from '../lib/utils';
import { ProfileMenu } from './ProfileMenu';
import { useTheme } from '../contexts/ThemeContext';

export function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const routes = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Goals', icon: Target, path: '/goals' },
    { name: 'Tasks (Kanban)', icon: CheckSquare, path: '/tasks' },
    { name: 'Habits', icon: Activity, path: '/habits' },
    { name: 'Journal', icon: BookOpen, path: '/journal' },
    { name: 'Vault', icon: FolderOpen, path: '/vault' },
    { name: 'Weekly Review', icon: CalendarDays, path: '/weekly-review' },
    { name: 'Export Data', icon: Download, path: '/export' },
    { name: 'Leaderboard', icon: BarChart3, path: '/analytics' },
  ];

  return (
    <nav className="w-64 bg-card/60 backdrop-blur-xl border-r border-border flex flex-col pt-8 pb-6 px-4">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3 mb-10">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.3)]">
            <span className="text-xl font-bold text-foreground font-['Outfit']">L</span>
          </div>
          <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground font-['Outfit'] tracking-tight">Life OS</span>
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
                      ? 'bg-gradient-to-r from-primary/10 to-accent/5 text-primary shadow-[inset_0_1px_1px_var(--glass-rim-from)] border border-border/50' 
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground border border-transparent'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-gradient-to-b from-primary to-accent rounded-r-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                    )}
                    <Icon className={cn("w-5 h-5 transition-transform duration-300 group-hover:scale-110", isActive ? "text-primary" : "")} />
                    <span className="tracking-wide">{route.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Theme Toggle + Profile Menu */}
        <div className="mt-auto border-t border-border pt-4 space-y-2">
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-muted-foreground hover:bg-secondary/50 hover:text-foreground border border-transparent transition-all duration-300 cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-400" />
            )}
            <span className="tracking-wide font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <ProfileMenu />
        </div>
    </nav>
  );
}
