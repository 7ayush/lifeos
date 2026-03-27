import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Target, CheckSquare, BookOpen, BarChart3, Activity, FolderOpen, CalendarDays, Download, Droplets, Sun, Moon } from 'lucide-react';
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
    { name: 'Hydration', icon: Droplets, path: '/hydration' },
    { name: 'Leaderboard', icon: BarChart3, path: '/analytics' },
  ];

  return (
    <nav className="w-64 m-3 mr-0 rounded-2xl glass-panel flex flex-col pt-8 pb-6 px-4 relative overflow-hidden">
      {/* Ambient glow inside sidebar */}
      <div className="absolute -top-16 -left-16 w-48 h-48 bg-primary/6 rounded-full blur-[60px] pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3 mb-10 relative z-10">
          <div className="w-10 h-10 bg-linear-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-[0_0_24px_rgba(245,158,11,0.25)]">
            <span className="text-xl font-bold text-foreground font-['Outfit'] italic">L</span>
          </div>
          <span className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-foreground to-muted-foreground font-['Outfit'] tracking-tight">Life OS</span>
        </div>

        {/* Route Links */}
        <div className="flex flex-col gap-1.5 flex-1 relative z-10">
          {routes.map((route) => {
            const Icon = route.icon;
            return (
              <NavLink
                key={route.path}
                to={route.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all duration-250 group relative overflow-hidden cursor-pointer',
                    isActive 
                      ? 'bg-primary/8 text-primary border border-primary/15 shadow-[inset_0_1px_1px_var(--glass-rim-from)]' 
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-linear-to-b from-amber-400 to-orange-500 rounded-r-full shadow-[0_0_12px_rgba(245,158,11,0.4)]" />
                    )}
                    <Icon className={cn("w-[18px] h-[18px] transition-all duration-250", isActive ? "text-primary" : "group-hover:text-foreground")} />
                    <span className="text-sm tracking-wide">{route.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Theme Toggle + Profile Menu */}
        <div className="mt-auto border-t border-border pt-4 space-y-1.5 relative z-10">
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent transition-all duration-250 cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-[18px] h-[18px] text-amber-400" />
            ) : (
              <Moon className="w-[18px] h-[18px] text-indigo-400" />
            )}
            <span className="tracking-wide text-sm font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <ProfileMenu />
        </div>
    </nav>
  );
}
