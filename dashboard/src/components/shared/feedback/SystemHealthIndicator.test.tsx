/**
 * SystemHealthIndicator Component Tests
 * 
 * Tests for the system health indicator component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SystemHealthIndicator from './SystemHealthIndicator';
import { SystemHealthProvider } from '../../../contexts/SystemHealthContext';
import { SystemHealth } from '../../../types/notifications';

const mockHealthySystem: SystemHealth = {
  status: 'green',
  components: {
    apiGateway: { status: 'healthy', message: 'API Gateway operational' },
    lambda: { status: 'healthy', message: 'Lambda functions executing normally' },
    s3: { status: 'healthy', message: 'S3 buckets accessible' },
    dataFreshness: { status: 'healthy', message: 'Data is current' },
  },
  lastCheck: new Date().toISOString(),
};

const mockWarningSystem: SystemHealth = {
  status: 'yellow',
  components: {
    apiGateway: { status: 'healthy', message: 'API Gateway operational' },
    lambda: { status: 'healthy', message: 'Lambda functions executing normally' },
    s3: { status: 'healthy', message: 'S3 buckets accessible' },
    dataFreshness: { status: 'warning', message: 'Data is 30 hours old' },
  },
  lastCheck: new Date().toISOString(),
};

const mockFailingSystem: SystemHealth = {
  status: 'red',
  components: {
    apiGateway: { status: 'failing', message: 'API Gateway unreachable' },
    lambda: { status: 'healthy', message: 'Lambda functions executing normally' },
    s3: { status: 'healthy', message: 'S3 buckets accessible' },
    dataFreshness: { status: 'healthy', message: 'Data is current' },
  },
  lastCheck: new Date().toISOString(),
};

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<SystemHealthProvider>{ui}</SystemHealthProvider>);
};

describe('SystemHealthIndicator', () => {
  it('renders health indicator button', () => {
    renderWithProvider(<SystemHealthIndicator />);
    const button = screen.getByRole('button', { name: /system health/i });
    expect(button).toBeInTheDocument();
  });

  it('displays green indicator when all components are healthy', async () => {
    renderWithProvider(<SystemHealthIndicator />);
    
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /system health: green/i });
      expect(button).toBeInTheDocument();
    });
  });

  it('opens detail panel when clicked', async () => {
    renderWithProvider(<SystemHealthIndicator />);
    
    const button = screen.getByRole('button', { name: /system health/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /system health details/i })).toBeInTheDocument();
    });
  });

  it('displays all component statuses in detail panel', async () => {
    renderWithProvider(<SystemHealthIndicator />);
    
    const button = screen.getByRole('button', { name: /system health/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('API Gateway')).toBeInTheDocument();
      expect(screen.getByText('Lambda Functions')).toBeInTheDocument();
      expect(screen.getByText('S3 Storage')).toBeInTheDocument();
      expect(screen.getByText('Data Freshness')).toBeInTheDocument();
    });
  });

  it('shows component status messages', async () => {
    renderWithProvider(<SystemHealthIndicator />);
    
    const button = screen.getByRole('button', { name: /system health/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('API Gateway operational')).toBeInTheDocument();
      expect(screen.getByText('Lambda functions executing normally')).toBeInTheDocument();
    });
  });

  it('displays last check timestamp', async () => {
    renderWithProvider(<SystemHealthIndicator />);
    
    const button = screen.getByRole('button', { name: /system health/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/last checked/i)).toBeInTheDocument();
    });
  });

  it('has refresh button in detail panel', async () => {
    renderWithProvider(<SystemHealthIndicator />);
    
    const button = screen.getByRole('button', { name: /system health/i });
    fireEvent.click(button);

    await waitFor(() => {
      const refreshButton = screen.getByRole('button', { name: /refresh health status/i });
      expect(refreshButton).toBeInTheDocument();
    });
  });

  it('closes panel when clicking outside', async () => {
    renderWithProvider(<SystemHealthIndicator />);
    
    const button = screen.getByRole('button', { name: /system health/i });
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
    renderWithProvider(<SystemHealthIndicator />);
    
    const button = screen.getByRole('button', { name: /system health/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('displays overall status in panel footer', async () => {
    renderWithProvider(<SystemHealthIndicator />);
    
    const button = screen.getByRole('button', { name: /system health/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/overall status/i)).toBeInTheDocument();
      expect(screen.getByText('GREEN')).toBeInTheDocument();
    });
  });
});
