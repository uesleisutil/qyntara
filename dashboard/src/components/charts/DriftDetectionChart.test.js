import React from 'react';
import { render } from '@testing-library/react';
import DriftDetectionChart from './DriftDetectionChart';

describe('DriftDetectionChart', () => {
  const mockData = [
    {
      date: '2024-01-01',
      feature: 'rsi_14',
      pValue: 0.08,
      ksStatistic: 0.12,
      driftDetected: false
    },
    {
      date: '2024-01-01',
      feature: 'volume_ratio',
      pValue: 0.02,
      ksStatistic: 0.25,
      driftDetected: true
    },
    {
      date: '2024-02-01',
      feature: 'rsi_14',
      pValue: 0.15,
      ksStatistic: 0.08,
      driftDetected: false
    }
  ];

  it('renders without crashing', () => {
    render(<DriftDetectionChart driftData={mockData} />);
  });

  it('renders with empty data', () => {
    render(<DriftDetectionChart driftData={[]} />);
  });

  it('renders with custom threshold', () => {
    render(<DriftDetectionChart driftData={mockData} threshold={0.01} />);
  });
});
