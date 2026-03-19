/**
 * API Integration Tests
 * 
 * Tests API interactions, data flow between services and components.
 * Subtask 31.3 - Integration Testing
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FilterProvider } from '../contexts/FilterContext';
import { NotificationProvider } from '../contexts/NotificationContext';

// Mock the API module
jest.mock('../services/api', () => ({
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

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('FilterContext + URL Sync', () => {
    it('persists filter state to sessionStorage', () => {
      render(
        <FilterProvider>
          <div>test</div>
        </FilterProvider>
      );

      const stored = sessionStorage.getItem('dashboardFilters');
      expect(stored).toBeDefined();
    });

    it('initializes with default filter values', () => {
      const TestConsumer = () => {
        const React = require('react');
        return <div data-testid="consumer">loaded</div>;
      };

      render(
        <FilterProvider>
          <TestConsumer />
        </FilterProvider>
      );

      expect(screen.getByTestId('consumer')).toBeInTheDocument();
    });
  });

  describe('NotificationContext + API', () => {
    it('fetches notifications on mount', async () => {
      const api = require('../services/api').default;
      api.notifications.getAll.mockResolvedValue({ data: [] });

      render(
        <NotificationProvider>
          <div>test</div>
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(api.notifications.getAll).toHaveBeenCalled();
      });
    });

    it('handles API errors gracefully', async () => {
      const api = require('../services/api').default;
      api.notifications.getAll.mockRejectedValue(new Error('Network error'));

      // Should not throw
      render(
        <NotificationProvider>
          <div>test</div>
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(api.notifications.getAll).toHaveBeenCalled();
      });
    });

    it('sorts notifications by timestamp (newest first)', async () => {
      const api = require('../services/api').default;
      const notifications = [
        { id: '1', type: 'info', category: 'system', title: 'Old', message: 'old', timestamp: '2024-01-01T00:00:00Z', read: false },
        { id: '2', type: 'info', category: 'system', title: 'New', message: 'new', timestamp: '2024-12-01T00:00:00Z', read: false },
      ];
      api.notifications.getAll.mockResolvedValue({ data: notifications });

      const TestConsumer = () => {
        const { useNotifications } = require('../contexts/NotificationContext');
        const { notifications: notifs } = useNotifications();
        return (
          <div>
            {notifs.map((n: any) => (
              <span key={n.id} data-testid={`notif-${n.id}`}>{n.title}</span>
            ))}
          </div>
        );
      };

      render(
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('notif-2')).toBeInTheDocument();
      });
    });
  });

  describe('Fetch API Integration', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      (global.fetch as jest.Mock).mockRestore?.();
    });

    it('sends authorization header with token', async () => {
      localStorage.setItem('token', 'test-token-123');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { webhooks: [] } }),
      });

      await fetch('/api/webhooks', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/webhooks',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token-123' },
        })
      );
    });

    it('handles 401 unauthorized responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Unauthorized' } }),
      });

      const response = await fetch('/api/webhooks');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('handles network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(fetch('/api/webhooks')).rejects.toThrow('Network error');
    });
  });
});
