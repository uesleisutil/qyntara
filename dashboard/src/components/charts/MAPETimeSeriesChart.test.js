import React from 'react';
import { render, screen } from '@testing-library/react';
import MAPETimeSeriesChart from './MAPETimeSeriesChart';

describe('MAPETimeSeriesChart', () => {
  const mockData = [
    {
      date: '2024-01-01',
      ensemble: 6.5,
      deepar: 7.2,
      lstm: 6.8,
      prophet: 8.1,
      xgboost: 6.3,
      ensemble_upper: 7.0,
      ensemble_lower: 6.0
    },
    {
      date: '2024-02-01',
      ensemble: 6.2,
      deepar: 6.9,
      lstm: 6.5,
      prophet: 7.8,
      xgboost: 6.0
    }
  ];

  it('renders without crashing', () => {
    render(<MAPETimeSeriesChart data={mockData} />);
  });

  it('renders with empty data', () => {
    render(<MAPETimeSeriesChart data={[]} />);
  });

  it('renders with confidence bands', () => {
    render(<MAPETimeSeriesChart data={mockData} showConfidenceBands={true} />);
  });

  it('renders with selected models', () => {
    render(
      <MAPETimeSeriesChart 
        data={mockData} 
        selectedModels={['ensemble', 'lstm']} 
      />
    );
  });
});
