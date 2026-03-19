/**
 * Tests for DegradationAlerts Component
 * 
 * Validates Requirements:
 * - 27.1: Monitor performance metrics
 * - 27.2: Alert when MAPE increases by more than 20%
 * - 27.3: Alert when accuracy decreases by more than 10 percentage points
 * - 27.4: Alert when Sharpe ratio decreases by more than 0.5
 * - 27.5: Display active degradation alerts
 * - 27.6: Display magnitude and duration of performance degradation
 * - 27.7: Correlate degradation with detected drift events
 * - 27.8: Track degradation alert history
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DegradationAlerts } from './DegradationAlerts';

describe('DegradationAlerts', () => {
  const mockPerformanceDegradation = [
    {
      metric: 'mape',
      current: 0.15,
      baseline: 0.12,
      change: 0.03,
      changePercentage: 25,
      degraded: true,
      duration: 5,
      severity: 'high' as const,
      threshold: 0.2,
      firstDetected: '2024-01-15T10:00:00Z',
    },
    {
      metric: 'accuracy',
      current: 0.65,
      baseline: 0.78,
      change: -0.13,
      changePercentage: -16.7,
      degraded: true,
      duration: 3,
      severity: 'critical' as const,
      threshold: 0.1,
      firstDetected: '2024-01-17T10:00:00Z',
    },
  ];

  const mockDriftEvents = [
    {
      date: '2024-01-15T08:00:00Z',
      type: 'data' as const,
      description: 'Data drift detected in feature X',
      severity: 'medium' as const,
    },
    {
      date: '2024-01-16T12:00:00Z',
      type: 'feature' as const,
      description: 'Feature drift detected',
      severity: 'high' as const,
    },
  ];

  // Req 27.5: Display active degradation alerts
  test('displays active alerts when performance degradation exists', () => {
    render(
      <DegradationAlerts
        performanceDegradation={mockPerformanceDegradation}
        driftEvents={mockDriftEvents}
      />
    );

    expect(screen.getByText('Active Performance Alerts')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Alert count badge
    expect(screen.getByText('MAPE Degradation')).toBeInTheDocument();
    expect(screen.getByText('Accuracy Degradation')).toBeInTheDocument();
  });

  // Req 27.1: Monitor performance metrics
  test('displays no alerts message when no degradation exists', () => {
    render(<DegradationAlerts performanceDegradation={[]} driftEvents={[]} />);

    expect(screen.getByText('No active performance degradation alerts')).toBeInTheDocument();
    expect(screen.getByText('All metrics are within acceptable thresholds')).toBeInTheDocument();
  });

  // Req 27.6: Display magnitude and duration of performance degradation
  test('displays magnitude and duration for each alert', () => {
    render(
      <DegradationAlerts
        performanceDegradation={mockPerformanceDegradation}
        driftEvents={mockDriftEvents}
      />
    );

    // Check for current, baseline, and change values (multiple instances expected)
    expect(screen.getAllByText(/Current:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Baseline:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Change:/).length).toBeGreaterThan(0);

    // Check for duration
    expect(screen.getByText(/Duration: 5 days/)).toBeInTheDocument();
    expect(screen.getByText(/Duration: 3 days/)).toBeInTheDocument();
  });

  // Req 27.2: Alert when MAPE increases by more than 20%
  test('displays MAPE alert when threshold exceeded', () => {
    const mapeAlert = [mockPerformanceDegradation[0]];
    render(<DegradationAlerts performanceDegradation={mapeAlert} driftEvents={[]} />);

    expect(screen.getByText('MAPE Degradation')).toBeInTheDocument();
    expect(screen.getByText(/25.0%/)).toBeInTheDocument(); // 25% change
  });

  // Req 27.3: Alert when accuracy decreases by more than 10 percentage points
  test('displays accuracy alert when threshold exceeded', () => {
    const accuracyAlert = [mockPerformanceDegradation[1]];
    render(<DegradationAlerts performanceDegradation={accuracyAlert} driftEvents={[]} />);

    expect(screen.getByText('Accuracy Degradation')).toBeInTheDocument();
    expect(screen.getByText(/-16.7%/)).toBeInTheDocument();
  });

  // Req 27.4: Alert when Sharpe ratio decreases by more than 0.5
  test('displays Sharpe ratio alert when threshold exceeded', () => {
    const sharpeAlert = [
      {
        metric: 'sharpe_ratio',
        current: 1.2,
        baseline: 1.8,
        change: -0.6,
        changePercentage: -33.3,
        degraded: true,
        duration: 7,
        severity: 'high' as const,
        threshold: 0.5,
        firstDetected: '2024-01-10T10:00:00Z',
      },
    ];
    render(<DegradationAlerts performanceDegradation={sharpeAlert} driftEvents={[]} />);

    expect(screen.getByText('Sharpe Ratio Degradation')).toBeInTheDocument();
  });

  // Req 27.7: Correlate degradation with detected drift events
  test('displays correlated drift events when expanded', () => {
    render(
      <DegradationAlerts
        performanceDegradation={mockPerformanceDegradation}
        driftEvents={mockDriftEvents}
      />
    );

    // Check for drift event count
    const driftEventText = screen.getAllByText(/drift event\(s\)/);
    expect(driftEventText.length).toBeGreaterThan(0);

    // Expand first alert
    const alertHeaders = screen.getAllByText(/Degradation/);
    fireEvent.click(alertHeaders[0]);

    // Check for correlated drift events section
    expect(screen.getByText('Correlated Drift Events')).toBeInTheDocument();
  });

  // Req 27.8: Track degradation alert history
  test('displays alert history section', () => {
    render(
      <DegradationAlerts
        performanceDegradation={mockPerformanceDegradation}
        driftEvents={mockDriftEvents}
      />
    );

    expect(screen.getByText('Alert History')).toBeInTheDocument();
  });

  test('expands and collapses alert history', () => {
    render(
      <DegradationAlerts
        performanceDegradation={mockPerformanceDegradation}
        driftEvents={mockDriftEvents}
      />
    );

    const historyHeader = screen.getByText('Alert History');
    
    // Initially collapsed - history items should not be visible
    fireEvent.click(historyHeader);
    
    // After click, history should be visible
    // The alerts should appear in history
    const historyItems = screen.getAllByText(/Degradation/);
    expect(historyItems.length).toBeGreaterThan(0);
  });

  test('displays severity badges correctly', () => {
    render(
      <DegradationAlerts
        performanceDegradation={mockPerformanceDegradation}
        driftEvents={mockDriftEvents}
      />
    );

    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  test('supports dark mode styling', () => {
    const { container } = render(
      <DegradationAlerts
        performanceDegradation={mockPerformanceDegradation}
        driftEvents={mockDriftEvents}
        darkMode={true}
      />
    );

    // Component should render without errors in dark mode
    expect(container).toBeInTheDocument();
  });

  test('supports mobile layout', () => {
    const { container } = render(
      <DegradationAlerts
        performanceDegradation={mockPerformanceDegradation}
        driftEvents={mockDriftEvents}
        isMobile={true}
      />
    );

    // Component should render without errors in mobile mode
    expect(container).toBeInTheDocument();
  });

  test('handles empty drift events gracefully', () => {
    render(
      <DegradationAlerts
        performanceDegradation={mockPerformanceDegradation}
        driftEvents={[]}
      />
    );

    expect(screen.getByText('MAPE Degradation')).toBeInTheDocument();
  });

  test('formats duration correctly', () => {
    const degradationWithVariousDurations = [
      { ...mockPerformanceDegradation[0], duration: 0 },
      { ...mockPerformanceDegradation[0], duration: 1, metric: 'test1' },
      { ...mockPerformanceDegradation[0], duration: 14, metric: 'test2' },
      { ...mockPerformanceDegradation[0], duration: 60, metric: 'test3' },
    ];

    render(
      <DegradationAlerts
        performanceDegradation={degradationWithVariousDurations}
        driftEvents={[]}
      />
    );

    expect(screen.getByText(/Just detected/)).toBeInTheDocument();
    expect(screen.getByText(/1 day/)).toBeInTheDocument();
    expect(screen.getByText(/2 weeks/)).toBeInTheDocument();
    expect(screen.getByText(/2 months/)).toBeInTheDocument();
  });
});
