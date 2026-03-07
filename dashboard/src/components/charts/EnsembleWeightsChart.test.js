import React from 'react';
import { render } from '@testing-library/react';
import EnsembleWeightsChart from './EnsembleWeightsChart';

describe('EnsembleWeightsChart', () => {
  const mockData = [
    {
      date: '2024-01-01',
      deepar: 0.25,
      lstm: 0.30,
      prophet: 0.20,
      xgboost: 0.25
    },
    {
      date: '2024-02-01',
      deepar: 0.22,
      lstm: 0.33,
      prophet: 0.18,
      xgboost: 0.27
    }
  ];

  it('renders without crashing', () => {
    render(<EnsembleWeightsChart weights={mockData} />);
  });

  it('renders with empty data', () => {
    render(<EnsembleWeightsChart weights={[]} />);
  });
});
