import React from 'react';
import { render } from '@testing-library/react';
import {
  ScatterPlotChart,
  TemporalAccuracyChart,
  SegmentationChart,
  OutlierTable,
  BacktestSimulator,
} from './index';

describe('Validation Components Integration', () => {
  it('should import all components without errors', () => {
    expect(ScatterPlotChart).toBeDefined();
    expect(TemporalAccuracyChart).toBeDefined();
    expect(SegmentationChart).toBeDefined();
    expect(OutlierTable).toBeDefined();
    expect(BacktestSimulator).toBeDefined();
  });

  it('should render ScatterPlotChart with empty data', () => {
    const { container } = render(<ScatterPlotChart data={[]} />);
    expect(container).toBeInTheDocument();
  });

  it('should render TemporalAccuracyChart with empty data', () => {
    const { container } = render(<TemporalAccuracyChart data={[]} />);
    expect(container).toBeInTheDocument();
  });

  it('should render SegmentationChart with empty data', () => {
    const { container } = render(<SegmentationChart data={[]} />);
    expect(container).toBeInTheDocument();
  });

  it('should render OutlierTable with empty data', () => {
    const { container } = render(<OutlierTable data={[]} />);
    expect(container).toBeInTheDocument();
  });

  it('should render BacktestSimulator', () => {
    const mockHandler = jest.fn();
    const { container } = render(<BacktestSimulator onRunBacktest={mockHandler} />);
    expect(container).toBeInTheDocument();
  });
});
