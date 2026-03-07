import React from 'react';
import { render } from '@testing-library/react';
import FeatureImportanceChart from './FeatureImportanceChart';

describe('FeatureImportanceChart', () => {
  const mockData = [
    {
      feature: 'rsi_14',
      importance: 0.25,
      category: 'technical',
      description: 'Relative Strength Index'
    },
    {
      feature: 'volume_ratio',
      importance: 0.18,
      category: 'volume'
    },
    {
      feature: 'lag_1',
      importance: 0.15,
      category: 'lag'
    }
  ];

  it('renders without crashing', () => {
    render(<FeatureImportanceChart shapValues={mockData} />);
  });

  it('renders with empty data', () => {
    render(<FeatureImportanceChart shapValues={[]} />);
  });

  it('renders with custom topN', () => {
    render(<FeatureImportanceChart shapValues={mockData} topN={2} />);
  });
});
