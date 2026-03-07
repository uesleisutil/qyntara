import React from 'react';
import { render } from '@testing-library/react';
import PredictionIntervalChart from './PredictionIntervalChart';

describe('PredictionIntervalChart', () => {
  const mockPredictions = [
    {
      date: '2024-01-01',
      forecast: 30.5,
      lower_50: 30.0,
      upper_50: 31.0,
      lower_80: 29.5,
      upper_80: 31.5,
      lower_95: 29.0,
      upper_95: 32.0
    },
    {
      date: '2024-01-02',
      forecast: 30.8,
      lower_50: 30.3,
      upper_50: 31.3,
      lower_80: 29.8,
      upper_80: 31.8,
      lower_95: 29.3,
      upper_95: 32.3
    }
  ];

  const mockActuals = [
    { date: '2024-01-01', value: 30.6 },
    { date: '2024-01-02', value: 31.0 }
  ];

  it('renders without crashing', () => {
    render(<PredictionIntervalChart predictions={mockPredictions} actuals={mockActuals} />);
  });

  it('renders with empty data', () => {
    render(<PredictionIntervalChart predictions={[]} actuals={[]} />);
  });

  it('renders with custom interval visibility', () => {
    render(
      <PredictionIntervalChart 
        predictions={mockPredictions} 
        actuals={mockActuals}
        showIntervals={{ p50: true, p80: false, p95: true }}
      />
    );
  });
});
