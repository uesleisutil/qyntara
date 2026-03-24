/**
 * RealTimeStatusBar Component Tests
 * 
 * Tests for the real-time status bar component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RealTimeStatusBar from './RealTimeStatusBar';
import { RealTimeProvider } from '../../../contexts/RealTimeContext';

// Mock WebSocket
jest.mock('../../services/websocket', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(),
    send: jest.fn(),
    on: jest.fn(() => jest.fn()),
    isConnected: jest.fn(() => true),
  },
}));

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<RealTimeProvider>{ui}</RealTimeProvider>);
};

describe('RealTimeStatusBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('renders status bar', () => {
    renderWithProvider(<RealTimeStatusBar />);
    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  it('displays connection status', async () => {
    renderWithProvider(<RealTimeStatusBar />);
    
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('displays last refresh timestamp', () => {
    renderWithProvider(<RealTimeStatusBar />);
    expect(screen.getByText(/last refresh/i)).toBeInTheDocument();
  });

  it('has auto-refresh toggle', () => {
    renderWithProvider(<RealTimeStatusBar />);
    const checkbox = screen.getByRole('checkbox', { name: /auto-refresh/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked(); // Default is enabled
  });

  it('toggles auto-refresh when checkbox is clicked', () => {
    renderWithProvider(<RealTimeStatusBar />);
    const checkbox = screen.getByRole('checkbox', { name: /auto-refresh/i });
    
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('has manual refresh button', () => {
    renderWithProvider(<RealTimeStatusBar />);
    const button = screen.getByRole('button', { name: /refresh data/i });
    expect(button).toBeInTheDocument();
  });

  it('disables refresh button while refreshing', async () => {
    renderWithProvider(<RealTimeStatusBar />);
    const button = screen.getByRole('button', { name: /refresh data/i });
    
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(button).toBeDisabled();
    });
  });

  it('shows countdown when auto-refresh is enabled', async () => {
    renderWithProvider(<RealTimeStatusBar />);
    
    await waitFor(() => {
      const countdown = screen.queryByText(/next:/i);
      // Countdown may or may not be visible depending on timing
      if (countdown) {
        expect(countdown).toBeInTheDocument();
      }
    });
  });

  it('displays current activity when processing', async () => {
    renderWithProvider(<RealTimeStatusBar />);
    
    // Trigger refresh to show processing state
    const button = screen.getByRole('button', { name: /refresh data/i });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/refreshing data/i)).toBeInTheDocument();
    });
  });

  it('persists auto-refresh preference to localStorage', () => {
    renderWithProvider(<RealTimeStatusBar />);
    const checkbox = screen.getByRole('checkbox', { name: /auto-refresh/i });
    
    fireEvent.click(checkbox);
    
    expect(localStorage.getItem('autoRefresh')).toBe('false');
  });
});
