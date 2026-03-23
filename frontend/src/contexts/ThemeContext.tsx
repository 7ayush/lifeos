import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import api from '../api/config';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'lifeos_theme';
const TRANSITION_CLASS = 'theme-transitioning';
const TRANSITION_DURATION = 200;

function isValidTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

function getSystemPreference(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isValidTheme(stored)) {
      return stored;
    }
    // Invalid value in localStorage — overwrite with fallback
    if (stored !== null) {
      localStorage.setItem(STORAGE_KEY, 'dark');
    }
  } catch {
    // localStorage unavailable (e.g. private browsing)
  }
  return getSystemPreference();
}

function applyThemeToDOM(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const prevUserIdRef = useRef<number | null>(null);

  // Apply theme to DOM on mount and whenever theme changes
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // On auth change (user logs in): fetch backend preference and apply
  useEffect(() => {
    const userId = user?.id ?? null;

    // Only fetch when a new user logs in (not on logout or same user)
    if (userId === null || userId === prevUserIdRef.current) {
      prevUserIdRef.current = userId;
      return;
    }
    prevUserIdRef.current = userId;

    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(`/users/${userId}/settings`);
        const backendTheme = res.data?.theme_preference;
        if (!cancelled && isValidTheme(backendTheme)) {
          setTheme(backendTheme);
          try {
            localStorage.setItem(STORAGE_KEY, backendTheme);
          } catch {
            // localStorage unavailable
          }
        }
      } catch (err) {
        console.error('Failed to fetch user theme settings:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';

      // Add transition class before changing theme
      document.documentElement.classList.add(TRANSITION_CLASS);

      // Apply new theme to DOM
      applyThemeToDOM(next);

      // Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage unavailable
      }

      // Remove transition class after duration
      setTimeout(() => {
        document.documentElement.classList.remove(TRANSITION_CLASS);
      }, TRANSITION_DURATION);

      // Fire-and-forget PATCH to backend
      if (user?.id) {
        api.patch(`/users/${user.id}/settings`, { theme_preference: next })
          .catch((err: unknown) => console.error('Failed to persist theme to backend:', err));
      }

      return next;
    });
  }, [user]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
