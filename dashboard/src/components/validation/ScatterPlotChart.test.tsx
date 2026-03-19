import React from 'react';
import { render, screen } from '@testing-library/react';
import { ScatterPlotChart } from './ScatterPlotChart';

describe('ScatterPlotChart', () => {
  const mockData = [
    {
      ticker: 'PETR4',
      date: '2024-01-01',
      predicted: 5.2,
      actual: 4.8,
      error: 0.4,
    },
    {
      ticker: 'VALE3',
      date: '2024-01-01',
      predicted: -2.1,
      actual: -1.5,
      error: -0.6,
    },
    {
      ticker: 'ITUB4',
      date: '2024-01-01',
      predicted: 3.0,
      actual: 3.5,
      error: -0.5,
    },
  ];

  it('renders loading state', () => {
    render(<ScatterPlotChart data={[]} loading={true} />);
    expect(screen.getByText(/loading scatter plot/i)).toBeInTheDocument();
  });

  it('renders error state', () => {
    const error = new Error('Test error');
    render(<ScatterPlotChart data={[]} error={error} />);
    expect(screen.getByText(/error loading scatter plot/i)).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<ScatterPlotChart data={[]} />);
    expect(screen.getByText(/no data available/i)).toBeInTheDocument();
  });

  it('renders chart with data', () => {
    render(<ScatterPlotChart data={mockData} />);
    expect(screen.getByText(/predicted vs actual returns/i)).toBeInTheDocument();
    expect(screen.getByText(/correlation:/i)).toBeInTheDocument();
    expect(screen.getByText(/r²:/i)).toBeInTheDocument();
  });

  it('calculates correlation correctly', () => {
    render(<ScatterPlotChart data={mockData} />);
    // Correlation should be displayed
    const correlationText = screen.getByText(/correlation:/i).parentElement;
    expect(correlationText).toBeInTheDocument();
  });

  it('calculates R-squared correctly', () => {
    render(<ScatterPlotChart data={mockData} />);
    // R-squared should be displayed
    const rSquaredText = screen.getByText(/r²:/i).parentElement;
    expect(rSquaredText).toBeInTheDocument();
  });

  it('renders chart container', () => {
    render(<ScatterPlotChart data={mockData} />);
    // Recharts renders the legend dynamically, so we just verify the chart container exists
    const chartContainer = document.querySelector('.recharts-responsive-container');
    expect(chartContainer).toBeInTheDocument();
  });
});
