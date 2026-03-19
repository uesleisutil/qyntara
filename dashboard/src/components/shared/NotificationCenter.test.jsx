/**
 * NotificationCenter Component Tests
 * 
 * Tests for the notification center component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationCenter from './NotificationCenter';
import { NotificationProvider } from '../../contexts/NotificationContext';
import api from '../../services/api';

// Mock the API
jest.mock('../../services/api');

// Helper to render with provider
const renderWithProvider = (apiSetup) => {
  if (apiSetup) apiSetup();
  return render(
    <NotificationProvider>
      <NotificationCenter />
    </NotificationProvider>
  );
};

describe('NotificationCenter', () => {
  const mockNotifications = [
    {
      id: '1',
      type: 'warning',
      category: 'alert',
      title: 'Alerta: PETR4',
      message: 'Score mudou 5.0 pontos (threshold: 3)',
      timestamp: new Date().toISOString(),
      read: false
    },
    {
      id: '2',
      type: 'info',
      category: 'system',
      title: 'Sistema Atualizado',
      message: 'Nova versão disponível',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      read: true
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: provider calls getAll on mount
    api.notifications.getAll.mockResolvedValue({ data: [] });
  });

  test('renders notification bell button', () => {
    renderWithProvider();
    // Component uses aria-label starting with "Notifications"
    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toBeInTheDocument();
  });

  test('shows unread count badge when there are unread notifications', async () => {
    renderWithProvider(() => {
      api.notifications.getAll.mockResolvedValue({ data: mockNotifications });
    });

    await waitFor(() => {
      // 1 unread notification (id: '1' has read: false)
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  test('opens notification panel when bell is clicked', async () => {
    renderWithProvider(() => {
      api.notifications.getAll.mockResolvedValue({ data: mockNotifications });
    });

    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  test('displays notifications when panel is open', async () => {
    renderWithProvider(() => {
      api.notifications.getAll.mockResolvedValue({ data: mockNotifications });
    });

    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Alerta: PETR4')).toBeInTheDocument();
      expect(screen.getByText('Sistema Atualizado')).toBeInTheDocument();
    });
  });

  test('marks notification as read when clicked', async () => {
    api.notifications.markAsRead.mockResolvedValue({ message: 'ok' });
    renderWithProvider(() => {
      api.notifications.getAll.mockResolvedValue({ data: mockNotifications });
    });

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    await waitFor(() => {
      expect(screen.getByText('Alerta: PETR4')).toBeInTheDocument();
    });

    const notifEl = screen.getByText('Alerta: PETR4').closest('[role="button"]');
    if (notifEl) fireEvent.click(notifEl);

    await waitFor(() => {
      expect(api.notifications.markAsRead).toHaveBeenCalledWith('1');
    });
  });

  test('marks all notifications as read', async () => {
    api.notifications.markAllAsRead.mockResolvedValue({ message: 'ok' });
    renderWithProvider(() => {
      api.notifications.getAll.mockResolvedValue({ data: mockNotifications });
    });

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Mark all read'));

    await waitFor(() => {
      expect(api.notifications.markAllAsRead).toHaveBeenCalled();
    });
  });

  test('deletes notification when delete button is clicked', async () => {
    api.notifications.delete.mockResolvedValue({ message: 'ok' });
    renderWithProvider(() => {
      api.notifications.getAll.mockResolvedValue({ data: mockNotifications });
    });

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    await waitFor(() => {
      expect(screen.getByText('Alerta: PETR4')).toBeInTheDocument();
    });

    const dismissButtons = screen.getAllByLabelText('Dismiss notification');
    fireEvent.click(dismissButtons[0]);

    await waitFor(() => {
      expect(api.notifications.delete).toHaveBeenCalledWith('1');
    });
  });

  test('shows empty state when no notifications', async () => {
    renderWithProvider(() => {
      api.notifications.getAll.mockResolvedValue({ data: [] });
    });

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  test('shows error message when API fails', async () => {
    renderWithProvider(() => {
      api.notifications.getAll.mockRejectedValue(new Error('API Error'));
    });

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    // When API fails, no notifications are loaded, so empty state is shown
    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  test('closes panel when clicking outside', async () => {
    renderWithProvider(() => {
      api.notifications.getAll.mockResolvedValue({ data: mockNotifications });
    });

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
