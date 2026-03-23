import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ThemeProvider, useTheme } from '../ThemeContext';

// Mock AuthContext — ThemeProvider depends on useAuth
vi.mock('../AuthContext', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, isLoading: false, login: vi.fn(), logout: vi.fn() }),
}));

// Mock the api config module used by ThemeProvider for backend calls
vi.mock('../../api/config', () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error('no backend')),
    patch: vi.fn().mockRejectedValue(new Error('no backend')),
    interceptors: { request: { use: vi.fn() } },
  },
}));

// Provide a mock localStorage that works reliably in jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock matchMedia so getSystemPreference works
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

/** Helper component that exposes theme value and toggle for testing */
function ThemeConsumer({ onRender }: { onRender: (ctx: { theme: string; toggleTheme: () => void }) => void }) {
  const ctx = useTheme();
  onRender(ctx);
  return <div data-testid="theme">{ctx.theme}</div>;
}

describe('Property 1: Dark class synchronization', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    localStorageMock.clear();
  });

  afterEach(() => {
    document.documentElement.className = '';
    localStorageMock.clear();
  });

  /**
   * **Validates: Requirements 1.4, 1.5**
   *
   * For any theme value ("dark" or "light"), the `dark` CSS class on the
   * <html> element should be present if and only if the current theme is "dark".
   * When the theme is "light", the `dark` class must be absent.
   */
  it('dark class on <html> is present iff theme is "dark" (100+ iterations)', () => {
    fc.assert(
      fc.property(fc.constantFrom('dark' as const, 'light' as const), (theme) => {
        // Clean state
        document.documentElement.className = '';
        localStorageMock.clear();

        // Seed localStorage so ThemeProvider initializes to the generated theme
        localStorageMock.setItem('lifeos_theme', theme);

        let captured: { theme: string; toggleTheme: () => void } | null = null;

        const { unmount } = render(
          <ThemeProvider>
            <ThemeConsumer onRender={(ctx) => { captured = ctx; }} />
          </ThemeProvider>,
        );

        // Verify the provider picked up the seeded theme
        expect(captured).not.toBeNull();
        expect(captured!.theme).toBe(theme);

        // Core property: dark class ↔ theme === 'dark'
        if (theme === 'dark') {
          expect(document.documentElement.classList.contains('dark')).toBe(true);
        } else {
          expect(document.documentElement.classList.contains('dark')).toBe(false);
        }

        unmount();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.4, 1.5**
   *
   * After toggling, the dark class should update to match the new theme.
   */
  it('dark class updates correctly after toggle (100+ iterations)', () => {
    fc.assert(
      fc.property(fc.constantFrom('dark' as const, 'light' as const), (initialTheme) => {
        // Clean state
        document.documentElement.className = '';
        localStorageMock.clear();
        localStorageMock.setItem('lifeos_theme', initialTheme);

        let captured: { theme: string; toggleTheme: () => void } | null = null;

        const { unmount } = render(
          <ThemeProvider>
            <ThemeConsumer onRender={(ctx) => { captured = ctx; }} />
          </ThemeProvider>,
        );

        expect(captured).not.toBeNull();

        // Toggle the theme
        act(() => {
          captured!.toggleTheme();
        });

        const expectedAfterToggle = initialTheme === 'dark' ? 'light' : 'dark';
        expect(captured!.theme).toBe(expectedAfterToggle);

        // Verify dark class matches the new theme
        if (expectedAfterToggle === 'dark') {
          expect(document.documentElement.classList.contains('dark')).toBe(true);
        } else {
          expect(document.documentElement.classList.contains('dark')).toBe(false);
        }

        unmount();
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 2: Toggle is self-inverse', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    localStorageMock.clear();
  });

  afterEach(() => {
    document.documentElement.className = '';
    localStorageMock.clear();
  });

  /**
   * **Validates: Requirements 2.2**
   *
   * For any initial theme value, toggling the theme twice should return
   * the theme to its original value. That is, toggle(toggle(theme)) === theme.
   */
  it('toggling twice returns to the original theme (100+ iterations)', () => {
    fc.assert(
      fc.property(fc.constantFrom('dark' as const, 'light' as const), (initialTheme) => {
        // Clean state
        document.documentElement.className = '';
        localStorageMock.clear();

        // Seed localStorage so ThemeProvider initializes to the generated theme
        localStorageMock.setItem('lifeos_theme', initialTheme);

        let captured: { theme: string; toggleTheme: () => void } | null = null;

        const { unmount } = render(
          <ThemeProvider>
            <ThemeConsumer onRender={(ctx) => { captured = ctx; }} />
          </ThemeProvider>,
        );

        expect(captured).not.toBeNull();
        expect(captured!.theme).toBe(initialTheme);

        // First toggle — should flip to the opposite theme
        act(() => {
          captured!.toggleTheme();
        });

        const oppositeTheme = initialTheme === 'dark' ? 'light' : 'dark';
        expect(captured!.theme).toBe(oppositeTheme);

        // Second toggle — should return to the original theme
        act(() => {
          captured!.toggleTheme();
        });

        // Core property: toggle(toggle(theme)) === theme
        expect(captured!.theme).toBe(initialTheme);

        // Also verify DOM and localStorage are consistent
        if (initialTheme === 'dark') {
          expect(document.documentElement.classList.contains('dark')).toBe(true);
        } else {
          expect(document.documentElement.classList.contains('dark')).toBe(false);
        }
        expect(localStorageMock.getItem('lifeos_theme')).toBe(initialTheme);

        unmount();
      }),
      { numRuns: 100 },
    );
  });
});


describe('Property 4: Theme preference localStorage round-trip', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    localStorageMock.clear();
  });

  afterEach(() => {
    document.documentElement.className = '';
    localStorageMock.clear();
  });

  /**
   * **Validates: Requirements 1.2, 3.1, 3.2**
   *
   * For any valid theme value, after toggling to that theme,
   * reading localStorage.getItem("lifeos_theme") should return that same theme value.
   */
  it('after toggling to a theme, localStorage contains that theme (100+ iterations)', () => {
    fc.assert(
      fc.property(fc.constantFrom('dark' as const, 'light' as const), (targetTheme) => {
        // Clean state
        document.documentElement.className = '';
        localStorageMock.clear();

        // Start from the opposite theme so we always toggle TO the target
        const startTheme = targetTheme === 'dark' ? 'light' : 'dark';
        localStorageMock.setItem('lifeos_theme', startTheme);

        let captured: { theme: string; toggleTheme: () => void } | null = null;

        const { unmount } = render(
          <ThemeProvider>
            <ThemeConsumer onRender={(ctx) => { captured = ctx; }} />
          </ThemeProvider>,
        );

        expect(captured).not.toBeNull();
        expect(captured!.theme).toBe(startTheme);

        // Toggle to the target theme
        act(() => {
          captured!.toggleTheme();
        });

        expect(captured!.theme).toBe(targetTheme);

        // Core property: localStorage matches the toggled theme
        expect(localStorageMock.getItem('lifeos_theme')).toBe(targetTheme);

        unmount();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.2, 3.1, 3.2**
   *
   * For any valid theme value, setting localStorage to that value and mounting
   * ThemeProvider should initialize the theme to that value.
   */
  it('mounting with a valid localStorage value initializes to that theme (100+ iterations)', () => {
    fc.assert(
      fc.property(fc.constantFrom('dark' as const, 'light' as const), (theme) => {
        // Clean state
        document.documentElement.className = '';
        localStorageMock.clear();

        // Seed localStorage with the generated theme
        localStorageMock.setItem('lifeos_theme', theme);

        let captured: { theme: string; toggleTheme: () => void } | null = null;

        const { unmount } = render(
          <ThemeProvider>
            <ThemeConsumer onRender={(ctx) => { captured = ctx; }} />
          </ThemeProvider>,
        );

        expect(captured).not.toBeNull();

        // Core property: ThemeProvider initializes to the localStorage value
        expect(captured!.theme).toBe(theme);

        // localStorage should still hold the same value
        expect(localStorageMock.getItem('lifeos_theme')).toBe(theme);

        unmount();
      }),
      { numRuns: 100 },
    );
  });
});



describe('Property 5: Invalid localStorage fallback', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    localStorageMock.clear();
    // Ensure system preference returns "dark" so fallback is deterministic
    (window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    document.documentElement.className = '';
    localStorageMock.clear();
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * For any string that is not "dark" or "light", if localStorage contains
   * that string under the key "lifeos_theme", the ThemeProvider should
   * initialize the theme to "dark" and overwrite localStorage with "dark".
   */
  it('falls back to "dark" and overwrites localStorage for any invalid value (100+ iterations)', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s !== 'dark' && s !== 'light'),
        (invalidValue) => {
          // Clean state
          document.documentElement.className = '';
          localStorageMock.clear();

          // Seed localStorage with the invalid value
          localStorageMock.setItem('lifeos_theme', invalidValue);

          let captured: { theme: string; toggleTheme: () => void } | null = null;

          const { unmount } = render(
            <ThemeProvider>
              <ThemeConsumer onRender={(ctx) => { captured = ctx; }} />
            </ThemeProvider>,
          );

          expect(captured).not.toBeNull();

          // Core property: theme falls back to "dark"
          expect(captured!.theme).toBe('dark');

          // Core property: localStorage is overwritten with "dark"
          expect(localStorageMock.getItem('lifeos_theme')).toBe('dark');

          // Also verify DOM is consistent
          expect(document.documentElement.classList.contains('dark')).toBe(true);

          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 8: System preference detection fallback', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    localStorageMock.clear();
  });

  afterEach(() => {
    document.documentElement.className = '';
    localStorageMock.clear();
  });

  /**
   * **Validates: Requirements 8.1, 8.2, 8.3**
   *
   * For any system color scheme preference ("light" or "dark"), when no
   * lifeos_theme key exists in localStorage and no backend preference is
   * available, the ThemeProvider should initialize the theme to match the
   * system preference.
   */
  it('initializes theme from system preference when localStorage is empty (100+ iterations)', () => {
    fc.assert(
      fc.property(fc.boolean(), (prefersLight) => {
        // Clean state — no lifeos_theme in localStorage
        document.documentElement.className = '';
        localStorageMock.clear();

        // Mock matchMedia to return the generated system preference
        (window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
          matches: query === '(prefers-color-scheme: light)' ? prefersLight : false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        let captured: { theme: string; toggleTheme: () => void } | null = null;

        const { unmount } = render(
          <ThemeProvider>
            <ThemeConsumer onRender={(ctx) => { captured = ctx; }} />
          </ThemeProvider>,
        );

        expect(captured).not.toBeNull();

        const expectedTheme = prefersLight ? 'light' : 'dark';

        // Core property: theme matches system preference
        expect(captured!.theme).toBe(expectedTheme);

        // Verify DOM is consistent
        if (expectedTheme === 'dark') {
          expect(document.documentElement.classList.contains('dark')).toBe(true);
        } else {
          expect(document.documentElement.classList.contains('dark')).toBe(false);
        }

        unmount();
      }),
      { numRuns: 100 },
    );
  });
});

