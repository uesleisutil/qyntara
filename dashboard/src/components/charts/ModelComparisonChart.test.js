import React from 'react';
import { render } from '@testing-library/react';
import ModelComparisonChart from './ModelComparisonChart';

describe('ModelComparisonChart', () => {
  const mockData = [
    {
      metric: 'MAPE',
      deepar: 85,
      lstm: 88,
      prophet: 75,
      xgboost: 90
    },
    {
      metric: 'Coverage',
      deepar: 92,
      lstm: 91,
      prophet: 90,
      xgboost: 89
    },
    {
      metric: 'Speed',
      deepar: 70,
      lstm: 65,
      prophet: 95,
      xgboost: 98
    }
  ];

  it('renders without crashing', () => {
    render(<ModelComparisonChart data={mockData} />);
  });

  it('renders with empty data', () => {
    render(<ModelComparisonChart data={[]} />);
  });

  it('renders with highlighted model', () => {
    render(<ModelComparisonChart data={mockData} highlightedModel="lstm" />);
  });
});
