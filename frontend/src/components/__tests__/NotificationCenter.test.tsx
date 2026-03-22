import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NotificationCenter } from '../NotificationCenter';
import type { Notification } from '../../types';

// Mock the auth context
const mockUser = { id: 1, username: 'test', email: 'test@test.com', avatar_url: null, created_at: '2024-01-01' };

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Mock the API module
const mockGetNotifications = vi.fn<() => Promise<Notification[]>>();
const mockGetUnreadCount = vi.fn<() => Promise<number>>();
const mockMarkNotificationRead = vi.fn();
const mockMarkAllNotificationsRead = vi.fn();
const mockDismissNotification = vi.fn();

vi.mock('../../api', () => ({
  getNotifications: (...args: unknown[]) => mockGetNotifications(...(args as [])),
  getUnreadCount: (...args: unknown[]) => mockGetUnreadCount(...(args as [])),
  markNotificationRead: (...args: unknown[]) => mockMarkNotificationRead(...(args as [])),
  markAllNotificationsRead: (...args: unknown[]) => mockMarkAllNotificationsRead(...(args as [])),
  dismissNotification: (...args: unknown[]) => mockDismissNotification(...(args as [])),
}));

const sampleNotifications: Notification[] = [
  {
    id: 1,
    user_id: 1,
    task_id: 10,
    type: 'overdue',
    message: "'Weekly Report' is 3 days overdue",
    is_read: false,
    dismissed: false,
    created_at: '2024-06-01T10:00:00',
  },
  {
    id: 2,
    user_id: 1,
    task_id: 11,
    type: 'due_today',
    message: "'Design Review' is due today",
    is_read: true,
    dismissed: false,
    created_at: '2024-06-01T09:00:00',
  },
];

function renderComponent() {
  return render(
    <MemoryRouter>
      <NotificationCenter />
    </MemoryRouter>,
  );
}

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNotifications.mockResolvedValue([]);
    mockGetUnreadCount.mockResolvedValue(0);
    mockMarkNotificationRead.mockResolvedValue({});
    mockMarkAllNotificationsRead.mockResolvedValue(undefined);
    mockDismissNotification.mockResolvedValue({});
  });

  it('renders the bell icon', async () => {
    renderComponent();
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    expect(bellButton).toBeInTheDocument();
  });

  it('shows unread count badge when count > 0', async () => {
    mockGetUnreadCount.mockResolvedValue(5);
    mockGetNotifications.mockResolvedValue(sampleNotifications);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('does not show badge when unread count is 0', async () => {
    mockGetUnreadCount.mockResolvedValue(0);
    mockGetNotifications.mockResolvedValue([]);

    renderComponent();

    // Wait for the component to settle
    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalled();
    });

    // No badge number should be visible
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('opens dropdown on bell click', async () => {
    mockGetNotifications.mockResolvedValue(sampleNotifications);
    mockGetUnreadCount.mockResolvedValue(1);

    renderComponent();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockGetNotifications).toHaveBeenCalled();
    });

    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);

    // The dropdown should now show the "Notifications" header
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    // And the notification messages
    expect(screen.getByText("'Weekly Report' is 3 days overdue")).toBeInTheDocument();
    expect(screen.getByText("'Design Review' is due today")).toBeInTheDocument();
  });

  it('shows empty state message when no notifications', async () => {
    mockGetNotifications.mockResolvedValue([]);
    mockGetUnreadCount.mockResolvedValue(0);

    renderComponent();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockGetNotifications).toHaveBeenCalled();
    });

    const bellButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(bellButton);

    expect(screen.getByText('No pending reminders')).toBeInTheDocument();
  });
});
