import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock the API module
vi.mock('../../api', () => ({
  getReminderConfig: vi.fn().mockResolvedValue({
    remind_days_before: 1,
    remind_on_due_date: true,
    remind_when_overdue: false,
  }),
  updateReminderConfig: vi.fn(),
}));

// Mock api config
vi.mock('../../api/config', () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error('no backend')),
    patch: vi.fn().mockRejectedValue(new Error('no backend')),
    interceptors: { request: { use: vi.fn() } },
  },
}));

// Variable to control the mocked theme value
let mockTheme: 'dark' | 'light' = 'dark';

// Mock ThemeContext
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme, toggleTheme: vi.fn() }),
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      created_at: '2024-01-01T00:00:00Z',
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

import { ProfilePage } from '../ProfilePage';

describe('Property 3: Toggle renders correct icon and accessible label', () => {
  beforeEach(() => {
    mockTheme = 'dark';
  });

  /**
   * **Validates: Requirements 2.3, 2.4**
   *
   * For any theme value, the Theme_Toggle should display a sun icon when
   * the theme is "dark" and a moon icon when the theme is "light".
   * The aria-label should describe switching to the opposite theme.
   */
  it('renders correct icon and aria-label for any theme value (100+ iterations)', () => {
    fc.assert(
      fc.property(fc.constantFrom('dark' as const, 'light' as const), (theme) => {
        // Set the mocked theme value
        mockTheme = theme;

        const { unmount } = render(<ProfilePage />);

        // Find the toggle button by its aria-label
        const expectedAriaLabel =
          theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

        const toggleButton = screen.getByRole('button', { name: expectedAriaLabel });
        expect(toggleButton).toBeTruthy();

        // Verify the correct icon is rendered:
        // Sun icon (lucide-react) renders an <svg> with class containing "lucide-sun"
        // Moon icon renders an <svg> with class containing "lucide-moon"
        const svg = toggleButton.querySelector('svg');
        expect(svg).not.toBeNull();

        if (theme === 'dark') {
          // Sun icon should be present
          expect(svg!.classList.toString()).toContain('lucide-sun');
        } else {
          // Moon icon should be present
          expect(svg!.classList.toString()).toContain('lucide-moon');
        }

        unmount();
      }),
      { numRuns: 100 },
    );
  });
});
