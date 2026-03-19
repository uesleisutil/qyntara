/**
 * NotificationCenter Component Tests
 * 
 * Tests for the notification center component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationCenter from './NotificationCenter';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { Notification } from '../../types/notifications';

// Mock API
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    notifications: {
      getAll: jest.fn(() => Promise.resolve({ data: [] })),
      markAsRead: jest.fn(() => Promise.resolve()),
      markAllAsRead: jest.fn(() => Promise.resolve()),
      delete: jest.fn(() => Promise.resolve()),
    },
  },
}));

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'critical',
    category: 'drift',
    title: 'Data Drift Detected',
    message: 'Feature distribution has changed significantly',
    timestamp: new Date().toISOString(),
    read: false,
  },
  {
    id: '2',
    type: 'warning',
    category: 'cost',
    title: 'Budget Warning',
    message: 'Monthly budget at 85%',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    read: false,
  },
  {
    id: '3',
    type: 'info',
    category: 'system',
    title: 'System Update',
    message: 'New features available',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    read: true,
  },
];

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
};

describe('NotificationCenter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders notification icon', () => {
    renderWithProvider(<NotificationCenter />);
    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toBeInTheDocument();
  });

  it('displays unread count badge when there are unread notifications', async () => {
    const api = require('../../services/api').default;
    api.notifications.getAll.mockResolvedValue({ data: mockNotifications });

    renderWithProvider(<NotificationCenter />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('opens notification panel when icon is clicked', async () => {
    renderWithProvider(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /notifications/i })).toBeInTheDocument();
    });
  });

  it('displays notifications sorted by timestamp (newest first)', async () => {
    const api = require('../../services/api').default;
    api.notifications.getAll.mockResolvedValue({ data: mockNotifications });

    renderWithProvider(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Data Drift Detected')).toBeInTheDocument();
      expect(screen.getByText('Budget Warning')).toBeInTheDocument();
      expect(screen.getByText('System Update')).toBeInTheDocument();
    });
  });

  it('shows category badges for notifications', async () => {
    const api = require('../../services/api').default;
    api.notifications.getAll.mockResolvedValue({ data: mockNotifications });

    renderWithProvider(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('drift')).toBeInTheDocument();
      expect(screen.getByText('cost')).toBeInTheDocument();
    });
  });

  it('marks notification as read when clicked', async () => {
    const api = require('../../services/api').default;
    api.notifications.getAll.mockResolvedValue({ data: mockNotifications });

    renderWithProvider(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      const notification = screen.getByText('Data Drift Detected');
      fireEvent.click(notification.closest('div[role="button"]')!);
    });

    await waitFor(() => {
      expect(api.notifications.markAsRead).toHaveBeenCalledWith('1');
    });
  });

  it('dismisses notification when dismiss button is clicked', async () => {
    const api = require('../../services/api').default;
    api.notifications.getAll.mockResolvedValue({ data: mockNotifications });

    renderWithProvider(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      const dismissButtons = screen.getAllByLabelText('Dismiss notification');
      fireEvent.click(dismissButtons[0]);
    });

    await waitFor(() => {
      expect(api.notifications.delete).toHaveBeenCalledWith('1');
    });
  });

  it('marks all notifications as read when button is clicked', async () => {
    const api = require('../../services/api').default;
    api.notifications.getAll.mockResolvedValue({ data: mockNotifications });

    renderWithProvider(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      const markAllButton = screen.getByText('Mark all read');
      fireEvent.click(markAllButton);
    });

    await waitFor(() => {
      expect(api.notifications.markAllAsRead).toHaveBeenCalled();
    });
  });

  it('closes panel when clicking outside', async () => {
    renderWithProvider(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes panel when Escape key is pressed', async () => {
    renderWithProvider(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no notifications', async () => {
    const api = require('../../services/api').default;
    api.notifications.getAll.mockResolvedValue({ data: [] });

    renderWithProvider(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });
});
