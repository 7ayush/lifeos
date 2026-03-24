import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WaterEntry, DailyProgress, WaterGoal } from '../../types';

// Mock the water API module
const mockCreateWaterEntry = vi.fn<(amount_ml: number) => Promise<WaterEntry>>();
const mockGetWaterEntries = vi.fn<(date: string) => Promise<WaterEntry[]>>();
const mockDeleteWaterEntry = vi.fn<(entryId: number) => Promise<void>>();
const mockGetDailyProgress = vi.fn<(start: string, end: string) => Promise<DailyProgress[]>>();
const mockGetWaterGoal = vi.fn<() => Promise<WaterGoal>>();
const mockUpdateWaterGoal = vi.fn<(amount_ml: number) => Promise<WaterGoal>>();

vi.mock('../../api/water', () => ({
  createWaterEntry: (...args: unknown[]) => mockCreateWaterEntry(...(args as [number])),
  getWaterEntries: (...args: unknown[]) => mockGetWaterEntries(...(args as [string])),
  deleteWaterEntry: (...args: unknown[]) => mockDeleteWaterEntry(...(args as [number])),
  getDailyProgress: (...args: unknown[]) => mockGetDailyProgress(...(args as [string, string])),
  getWaterGoal: (...args: unknown[]) => mockGetWaterGoal(...(args as [])),
  updateWaterGoal: (...args: unknown[]) => mockUpdateWaterGoal(...(args as [number])),
}));

import { HydrationPage } from '../HydrationPage';

const sampleEntries: WaterEntry[] = [
  { id: 1, user_id: 1, amount_ml: 250, timestamp: '2024-06-15T08:30:00' },
  { id: 2, user_id: 1, amount_ml: 500, timestamp: '2024-06-15T12:00:00' },
];

const sampleProgress: DailyProgress[] = [
  { date: new Date().toISOString().slice(0, 10), total_ml: 750, goal_ml: 2000, percentage: 37.5 },
];

function setupDefaultMocks(entries: WaterEntry[] = []) {
  mockGetWaterGoal.mockResolvedValue({ amount_ml: 2000 });
  mockGetWaterEntries.mockResolvedValue(entries);
  mockGetDailyProgress.mockResolvedValue(sampleProgress);
  mockCreateWaterEntry.mockImplementation(async (amount_ml: number) => {
    const newEntry: WaterEntry = {
      id: Date.now(),
      user_id: 1,
      amount_ml,
      timestamp: new Date().toISOString(),
    };
    return newEntry;
  });
  mockDeleteWaterEntry.mockResolvedValue(undefined);
  mockUpdateWaterGoal.mockImplementation(async (amount_ml: number) => ({ amount_ml }));
}

async function renderPage() {
  render(<HydrationPage />);
  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  // Ensure initial API calls have resolved
  await waitFor(() => {
    expect(mockGetWaterGoal).toHaveBeenCalled();
  });
}

describe('HydrationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Requirement 2.1: Quick-add buttons rendered and create entries on click ---

  describe('quick-add buttons', () => {
    it('renders 250, 500, and 750 ml quick-add buttons', async () => {
      setupDefaultMocks();
      await renderPage();

      expect(screen.getByRole('button', { name: /250 ml/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /500 ml/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /750 ml/i })).toBeInTheDocument();
    });

    it('calls createWaterEntry with 250 when 250 ml button is clicked', async () => {
      setupDefaultMocks();
      await renderPage();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /250 ml/i }));

      await waitFor(() => {
        expect(mockCreateWaterEntry).toHaveBeenCalledWith(250);
      });
    });

    it('calls createWaterEntry with 500 when 500 ml button is clicked', async () => {
      setupDefaultMocks();
      await renderPage();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /500 ml/i }));

      await waitFor(() => {
        expect(mockCreateWaterEntry).toHaveBeenCalledWith(500);
      });
    });

    it('calls createWaterEntry with 750 when 750 ml button is clicked', async () => {
      setupDefaultMocks();
      await renderPage();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /750 ml/i }));

      await waitFor(() => {
        expect(mockCreateWaterEntry).toHaveBeenCalledWith(750);
      });
    });
  });

  // --- Requirement 2.2, 2.3: Custom amount input ---

  describe('custom amount input', () => {
    it('accepts a valid custom amount and creates an entry', async () => {
      setupDefaultMocks();
      await renderPage();
      const user = userEvent.setup();

      const input = screen.getByPlaceholderText('Custom ml');
      await user.type(input, '300');
      await user.click(screen.getByRole('button', { name: /^Add$/i }));

      await waitFor(() => {
        expect(mockCreateWaterEntry).toHaveBeenCalledWith(300);
      });
    });

    it('shows error for invalid custom amount (0)', async () => {
      setupDefaultMocks();
      await renderPage();
      const user = userEvent.setup();

      const input = screen.getByPlaceholderText('Custom ml');
      await user.type(input, '0');
      await user.click(screen.getByRole('button', { name: /^Add$/i }));

      expect(screen.getByText(/Enter a value between 1 and 5000 ml/i)).toBeInTheDocument();
      expect(mockCreateWaterEntry).not.toHaveBeenCalled();
    });

    it('shows error for invalid custom amount (5001)', async () => {
      setupDefaultMocks();
      await renderPage();
      const user = userEvent.setup();

      const input = screen.getByPlaceholderText('Custom ml');
      await user.type(input, '5001');
      await user.click(screen.getByRole('button', { name: /^Add$/i }));

      expect(screen.getByText(/Enter a value between 1 and 5000 ml/i)).toBeInTheDocument();
      expect(mockCreateWaterEntry).not.toHaveBeenCalled();
    });

    it('shows error for empty custom amount', async () => {
      setupDefaultMocks();
      await renderPage();
      const user = userEvent.setup();

      // Click Add without typing anything
      await user.click(screen.getByRole('button', { name: /^Add$/i }));

      expect(screen.getByText(/Enter a value between 1 and 5000 ml/i)).toBeInTheDocument();
      expect(mockCreateWaterEntry).not.toHaveBeenCalled();
    });
  });

  // --- Requirement 5.4: Entry list renders with amount and timestamp ---

  describe('entry list', () => {
    it('renders entries with amount and timestamp', async () => {
      setupDefaultMocks(sampleEntries);
      await renderPage();

      // The entry list section contains entries with amount and timestamp.
      // Use getAllByText since "250 ml" also appears in the quick-add button.
      const amount250 = screen.getAllByText('250 ml');
      expect(amount250.length).toBeGreaterThanOrEqual(2); // quick-add button + entry

      const amount500 = screen.getAllByText('500 ml');
      expect(amount500.length).toBeGreaterThanOrEqual(2); // quick-add button + entry

      // Timestamps formatted as "h:mm a" are unique to entries
      expect(screen.getByText('8:30 AM')).toBeInTheDocument();
      expect(screen.getByText('12:00 PM')).toBeInTheDocument();
    });

    it('shows empty state when no entries exist', async () => {
      setupDefaultMocks([]);
      await renderPage();

      expect(screen.getByText(/No entries yet/i)).toBeInTheDocument();
    });
  });

  // --- Requirement 3.2 (implied): Delete button removes entry ---

  describe('delete entry', () => {
    it('opens confirm modal and calls deleteWaterEntry on confirm', async () => {
      setupDefaultMocks(sampleEntries);
      await renderPage();
      const user = userEvent.setup();

      // Click the delete button on the first entry
      const deleteButtons = screen.getAllByTitle('Delete entry');
      expect(deleteButtons.length).toBe(2);

      await user.click(deleteButtons[0]);

      // Confirm modal should appear
      expect(screen.getByText('Delete Entry')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete this water entry/i)).toBeInTheDocument();

      // Click the confirm "Delete" button in the modal
      const confirmButton = screen.getByRole('button', { name: /^Delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteWaterEntry).toHaveBeenCalledWith(1);
      });
    });
  });
});
