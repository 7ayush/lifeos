import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import type { WaterEntry, DailyProgress, WaterGoal } from '../../types';

// Mock the water API module
const mockCreateWaterEntry = vi.fn<(amount_ml: number) => Promise<WaterEntry>>();
const mockGetDailyProgress = vi.fn<(start: string, end: string) => Promise<DailyProgress[]>>();
const mockGetWaterGoal = vi.fn<() => Promise<WaterGoal>>();

vi.mock('../../api/water', () => ({
  createWaterEntry: (...args: unknown[]) => mockCreateWaterEntry(...(args as [number])),
  getDailyProgress: (...args: unknown[]) => mockGetDailyProgress(...(args as [string, string])),
  getWaterGoal: (...args: unknown[]) => mockGetWaterGoal(...(args as [])),
}));

import { HydrationWidget } from '../HydrationWidget';

const today = new Date().toISOString().slice(0, 10);

function setupMocks(totalMl = 750, goalMl = 2000) {
  const percentage = goalMl > 0 ? (totalMl / goalMl) * 100 : 0;
  mockGetDailyProgress.mockResolvedValue([
    { date: today, total_ml: totalMl, goal_ml: goalMl, percentage },
  ]);
  mockGetWaterGoal.mockResolvedValue({ amount_ml: goalMl });
  mockCreateWaterEntry.mockImplementation(async (amount_ml: number) => ({
    id: Date.now(),
    user_id: 1,
    amount_ml,
    timestamp: new Date().toISOString(),
  }));
}

function renderWidget() {
  return render(
    <BrowserRouter>
      <HydrationWidget />
    </BrowserRouter>,
  );
}

describe('HydrationWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Requirement 9.1: displays today's total consumed and daily goal
  it('displays total consumed and goal (e.g. "750 / 2000 ml")', async () => {
    setupMocks(750, 2000);
    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('750 / 2000 ml')).toBeInTheDocument();
    });
  });

  // Requirement 9.2: displays a progress bar
  it('displays a progress bar', async () => {
    setupMocks(750, 2000);
    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('750 / 2000 ml')).toBeInTheDocument();
    });

    // ProgressBar renders a percentage label when showLabel is true
    expect(screen.getByText('38%')).toBeInTheDocument();
  });

  // Requirement 9.3: quick-add 250 ml button calls createWaterEntry(250)
  it('has a quick-add 250 ml button that calls createWaterEntry(250)', async () => {
    setupMocks(750, 2000);
    renderWidget();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('750 / 2000 ml')).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /250 ml/i });
    expect(addButton).toBeInTheDocument();

    await user.click(addButton);

    await waitFor(() => {
      expect(mockCreateWaterEntry).toHaveBeenCalledWith(250);
    });
  });

  // Requirement 9.4: "View Details" link navigates to /hydration
  it('has a "View Details" link pointing to /hydration', async () => {
    setupMocks(750, 2000);
    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('750 / 2000 ml')).toBeInTheDocument();
    });

    const link = screen.getByText(/View Details/i);
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/hydration');
  });
});
