import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BacktestConfig } from './BacktestConfig';

describe('BacktestConfig', () => {
  const mockOnRunBacktest = jest.fn();

  beforeEach(() => {
    mockOnRunBacktest.mockClear();
  });

  it('renders without crashing', () => {
    render(<BacktestConfig onRunBacktest={mockOnRunBacktest} />);
    expect(screen.getByText(/Backtest Configuration/i)).toBeInTheDocument();
  });

  it('displays all configuration fields', () => {
    render(<BacktestConfig onRunBacktest={mockOnRunBacktest} />);
    expect(screen.getByText(/Start Date/i)).toBeInTheDocument();
    expect(screen.getByText(/End Date/i)).toBeInTheDocument();
    expect(screen.getByText(/Initial Capital/i)).toBeInTheDocument();
  });

  it('calls onRunBacktest when run button is clicked', () => {
    render(<BacktestConfig onRunBacktest={mockOnRunBacktest} loading={false} />);
    const runButton = screen.getByText(/Run Backtest/i);
    fireEvent.click(runButton);
    expect(mockOnRunBacktest).toHaveBeenCalledTimes(1);
  });

  it('disables run button when loading', () => {
    render(<BacktestConfig onRunBacktest={mockOnRunBacktest} loading={true} />);
    const runButton = screen.getByText(/Running/i);
    expect(runButton).toBeDisabled();
  });
});
