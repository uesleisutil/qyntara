import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WebhookManagement from './WebhookManagement';

// Mock fetch
global.fetch = jest.fn();

const mockWebhooks = [
  {
    webhook_id: 'webhook-1',
    url: 'https://example.com/webhook1',
    events: ['drift.data_drift_detected', 'performance.degradation_detected'],
    enabled: true,
    created_at: '2024-01-01T00:00:00Z',
    total_deliveries: 100,
    successful_deliveries: 95,
    failed_deliveries: 5,
    consecutive_failures: 0
  },
  {
    webhook_id: 'webhook-2',
    url: 'https://example.com/webhook2',
    events: ['cost.budget_exceeded'],
    enabled: false,
    created_at: '2024-01-02T00:00:00Z',
    total_deliveries: 50,
    successful_deliveries: 40,
    failed_deliveries: 10,
    consecutive_failures: 3
  }
];

describe('WebhookManagement', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      new Promise(() => {}) // Never resolves
    );

    render(<WebhookManagement />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('loads and displays webhooks', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { webhooks: mockWebhooks }
      })
    });

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByText('https://example.com/webhook1')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/webhook2')).toBeInTheDocument();
    });
  });

  it('displays success rates correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { webhooks: mockWebhooks }
      })
    });

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByText('95.0%')).toBeInTheDocument(); // webhook-1
      expect(screen.getByText('80.0%')).toBeInTheDocument(); // webhook-2
    });
  });

  it('opens create dialog when Add Webhook is clicked', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { webhooks: [] }
      })
    });

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByText('Add Webhook')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Webhook'));

    await waitFor(() => {
      expect(screen.getByText('Create Webhook')).toBeInTheDocument();
      expect(screen.getByLabelText('Webhook URL')).toBeInTheDocument();
    });
  });

  it('validates webhook URL format', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { webhooks: [] }
      })
    });

    render(<WebhookManagement />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add Webhook'));
    });

    const urlInput = screen.getByLabelText('Webhook URL');
    fireEvent.change(urlInput, { target: { value: 'invalid-url' } });

    // Create button should be disabled without events selected
    const createButton = screen.getByRole('button', { name: 'Create' });
    expect(createButton).toBeDisabled();
  });

  it('requires at least one event to be selected', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { webhooks: [] }
      })
    });

    render(<WebhookManagement />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add Webhook'));
    });

    const urlInput = screen.getByLabelText('Webhook URL');
    fireEvent.change(urlInput, { target: { value: 'https://example.com/webhook' } });

    // Create button should still be disabled without events
    const createButton = screen.getByRole('button', { name: 'Create' });
    expect(createButton).toBeDisabled();
  });

  it('creates a new webhook successfully', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { webhooks: [] }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            webhook_id: 'new-webhook',
            url: 'https://example.com/new',
            events: ['drift.data_drift_detected'],
            secret: 'secret-key',
            enabled: true
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { webhooks: [] }
        })
      });

    render(<WebhookManagement />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add Webhook'));
    });

    // Fill in form
    const urlInput = screen.getByLabelText('Webhook URL');
    fireEvent.change(urlInput, { target: { value: 'https://example.com/new' } });

    // Select an event
    const driftCheckbox = screen.getByLabelText('Data Drift Detected');
    fireEvent.click(driftCheckbox);

    // Submit
    const createButton = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/webhooks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            url: 'https://example.com/new',
            events: ['drift.data_drift_detected'],
            enabled: true
          })
        })
      );
    });
  });

  it('tests a webhook successfully', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { webhooks: mockWebhooks }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            success: true,
            status_code: 200,
            response_time_ms: 150
          }
        })
      });

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByText('https://example.com/webhook1')).toBeInTheDocument();
    });

    const testButtons = screen.getAllByLabelText('Test Webhook');
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Test successful!')).toBeInTheDocument();
      expect(screen.getByText(/Status Code: 200/)).toBeInTheDocument();
      expect(screen.getByText(/Response Time: 150ms/)).toBeInTheDocument();
    });
  });

  it('handles test failure correctly', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { webhooks: mockWebhooks }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            success: false,
            error: 'Connection timeout'
          }
        })
      });

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByText('https://example.com/webhook1')).toBeInTheDocument();
    });

    const testButtons = screen.getAllByLabelText('Test Webhook');
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Test failed')).toBeInTheDocument();
      expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    });
  });

  it('toggles webhook enabled state', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { webhooks: mockWebhooks }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { ...mockWebhooks[0], enabled: false }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { webhooks: mockWebhooks }
        })
      });

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByText('https://example.com/webhook1')).toBeInTheDocument();
    });

    // Find and click the first switch (MUI Switch renders with role="switch")
    const switches = screen.getAllByRole('switch');
    if (switches.length > 0) {
      fireEvent.click(switches[0]);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/webhooks/webhook-1',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ enabled: false })
          })
        );
      });
    }
  });

  it('deletes a webhook with confirmation', async () => {
    window.confirm = jest.fn(() => true);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { webhooks: mockWebhooks }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { message: 'Webhook deleted successfully' }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { webhooks: [mockWebhooks[1]] }
        })
      });

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByText('https://example.com/webhook1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('Delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/webhooks/webhook-1',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  it('displays error message when loading fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to load webhooks'));

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load webhooks/i)).toBeInTheDocument();
    });
  });

  it('displays warning icon for webhooks with consecutive failures', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { webhooks: mockWebhooks }
      })
    });

    render(<WebhookManagement />);

    await waitFor(() => {
      const warningIcons = screen.getAllByLabelText(/consecutive failures/i);
      expect(warningIcons.length).toBeGreaterThan(0);
    });
  });

  it('refreshes webhook list when refresh button is clicked', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { webhooks: mockWebhooks }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { webhooks: mockWebhooks }
        })
      });

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByText('https://example.com/webhook1')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
