import React from 'react';
import { render } from '@testing-library/react';
import StockRankingChart from './StockRankingChart';

describe('StockRankingChart', () => {
  const mockData = [
    {
      date: '2024-01-01',
      PETR4: 1,
      VALE3: 2,
      ITUB4: 3,
      BBDC4: 4
    },
    {
      date: '2024-02-01',
      PETR4: 2,
      VALE3: 1,
      ITUB4: 4,
      BBDC4: 3
    }
  ];

  it('renders without crashing', () => {
    render(<StockRankingChart rankings={mockData} />);
  });

  it('renders with empty data', () => {
    render(<StockRankingChart rankings={[]} />);
  });

  it('renders with custom topN', () => {
    render(<StockRankingChart rankings={mockData} topN={10} />);
  });
});
