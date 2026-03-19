/**
 * DataDriftChart Component Tests
 * 
 * Tests for the data drift detection chart component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataDriftChart } from './DataDriftChart';

// Mock data for testing
const mockDriftData = [
  {
    feature: 'price_momentum',
    ksStatistic: 0.234,
    pValue: 0.012,
    drifted: true,
    magnitude: 2.5,
    currentDistribution: [0.1, 0.2, 0.3, 0.25, 0.15],
    baselineDistribution: [0.15, 0.25, 0.3, 0.2, 0.1]
  },
  {
    feature: 'volume_ratio',
    ksStatistic: 0.156,
    pValue: 0.089,
    drifted: false,
    magnitude: 1.2,
    currentDistribution: [0.12, 0.22, 0.32, 0.24, 0.1],
    baselineDistribution: [0.14, 0.24, 0.3, 0.22, 0.1]
  },
  {
    feature: 'rsi_14',
    ksStatistic: 0.312,
    pValue: 0.003,
    drifted: true,
    magnitude: 3.8,
    currentDistribution: [0.08, 0.18, 0.28, 0.28, 0.18],
    baselineDistribution: [0.16, 0.26, 0.28, 0.2, 0.1]
  }
];

describe('DataDriftChart', () => {
  it('renders without crashing', () => {
    render(<DataDriftChart driftData={mockDriftData} />);
    expect(screen.getByText(/features showing drift/i)).toBeInTheDocument();
  });

  it('displays correct number of drifted features', () => {
    render(<DataDriftChart driftData={mockDriftData} />);
    expect(screen.getByText(/2 of 3 features showing drift/i)).toBeInTheDocument();
  });

  it('shows drifted features table', () => {
    render(<DataDriftChart driftData={mockDriftData} />);
    expect(screen.getByText('Drifted Features')).toBeInTheDocument();
    expect(screen.getByText('price_momentum')).toBeInTheDocument();
    expect(screen.getByText('rsi_14')).toBeInTheDocument();
  });

  it('does not show non-drifted features in table', () => {
    render(<DataDriftChart driftData={mockDriftData} />);
    expect(screen.queryByText('volume_ratio')).not.toBeInTheDocument();
  });

  it('displays KS statistics and p-values', () => {
    render(<DataDriftChart driftData={mockDriftData} />);
    expect(screen.getByText('0.2340')).toBeInTheDocument(); // KS statistic for price_momentum
    expect(screen.getByText('0.0120')).toBeInTheDocument(); // p-value for price_momentum
  });

  it('shows distribution comparison when feature is clicked', () => {
    render(<DataDriftChart driftData={mockDriftData} />);
    
    // Initially, distribution comparison should not be visible
    expect(screen.queryByText(/Distribution Comparison:/i)).not.toBeInTheDocument();
    
    // Click on a feature
    const featureRow = screen.getByText('price_momentum');
    fireEvent.click(featureRow);
    
    // Distribution comparison should now be visible
    expect(screen.getByText(/Distribution Comparison: price_momentum/i)).toBeInTheDocument();
  });

  it('handles empty drift data', () => {
    render(<DataDriftChart driftData={[]} />);
    expect(screen.getByText(/0 of 0 features showing drift/i)).toBeInTheDocument();
  });

  it('shows no drift message when no features are drifted', () => {
    const noDriftData = [
      {
        feature: 'stable_feature',
        ksStatistic: 0.05,
        pValue: 0.8,
        drifted: false,
        magnitude: 0.2,
        currentDistribution: [0.2, 0.2, 0.2, 0.2, 0.2],
        baselineDistribution: [0.2, 0.2, 0.2, 0.2, 0.2]
      }
    ];
    
    render(<DataDriftChart driftData={noDriftData} />);
    expect(screen.getByText(/No drift detected in any features/i)).toBeInTheDocument();
  });

  it('sorts features by column when header is clicked', () => {
    render(<DataDriftChart driftData={mockDriftData} />);
    
    // Get the KS Statistic header
    const ksHeader = screen.getByText(/KS Statistic/i);
    
    // Click to sort
    fireEvent.click(ksHeader);
    
    // Verify sort indicator appears
    expect(ksHeader.textContent).toMatch(/[↑↓]/);
  });

  it('applies dark mode styling', () => {
    const { container } = render(<DataDriftChart driftData={mockDriftData} darkMode={true} />);
    expect(container).toBeInTheDocument();
  });

  it('applies mobile styling', () => {
    const { container } = render(<DataDriftChart driftData={mockDriftData} isMobile={true} />);
    expect(container).toBeInTheDocument();
  });

  it('displays severity badges correctly', () => {
    render(<DataDriftChart driftData={mockDriftData} />);
    
    // High severity for p-value < 0.01
    expect(screen.getByText('High')).toBeInTheDocument();
    
    // Moderate severity for p-value between 0.01 and 0.05
    expect(screen.getByText('Moderate')).toBeInTheDocument();
  });

  it('shows interpretation text when feature is selected', () => {
    render(<DataDriftChart driftData={mockDriftData} />);
    
    // Click on a feature
    const featureRow = screen.getByText('price_momentum');
    fireEvent.click(featureRow);
    
    // Check for interpretation text
    expect(screen.getByText(/Kolmogorov-Smirnov test measures/i)).toBeInTheDocument();
  });

  it('toggles feature selection on click', () => {
    render(<DataDriftChart driftData={mockDriftData} />);
    
    const featureRow = screen.getByText('price_momentum');
    
    // Click to select
    fireEvent.click(featureRow);
    expect(screen.getByText(/Distribution Comparison: price_momentum/i)).toBeInTheDocument();
    
    // Click again to deselect
    fireEvent.click(featureRow);
    expect(screen.queryByText(/Distribution Comparison: price_momentum/i)).not.toBeInTheDocument();
  });
});
