import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, CheckCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead, dismissNotification } from '../api';
import type { Notification } from '../types';

const typeStyles: Record<Notification['type'], { bg: string; border: string; text: string; label: string }> = {
  upcoming: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', label: 'Upcoming' },
  due_today: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', label: 'Due Today' },
  overdue: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', label: 'Overdue' },
};

export function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [notifs, count] = await Promise.all([
        getNotifications(user.id),
        getUnreadCount(user.id),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: Notification) => {
    if (!user) return;
    try {
      await markNotificationRead(user.id, notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => (notif.is_read ? prev : Math.max(0, prev - 1)));
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
    setIsOpen(false);
    navigate('/tasks');
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await markAllNotificationsRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleDismiss = async (e: React.MouseEvent, notif: Notification) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await dismissNotification(user.id, notif.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      if (!notif.is_read) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to dismiss notification', err);
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-300 cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.4)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[28rem] bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-neutral-200">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                <Bell className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No pending reminders</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const style = typeStyles[notif.type];
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 transition-all duration-200 hover:bg-white/5 cursor-pointer group ${
                      notif.is_read ? 'bg-transparent' : 'bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${style.bg} ${style.border} ${style.text} shrink-0`}>
                        {style.label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${notif.is_read ? 'text-neutral-400' : 'text-neutral-200'}`}>
                          {notif.message}
                        </p>
                        <p className="text-[11px] text-neutral-600 mt-1">
                          {new Date(notif.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDismiss(e, notif)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-neutral-300 hover:bg-white/10 rounded-lg transition-all cursor-pointer shrink-0"
                        aria-label="Dismiss notification"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
