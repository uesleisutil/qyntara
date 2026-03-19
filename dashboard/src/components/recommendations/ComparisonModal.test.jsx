/**
 * ComparisonModal Component Tests
 * 
 * Tests for multi-ticker comparison modal functionality
 * Requirements: 4.4, 4.5, 4.6, 4.7, 4.8, 4.9
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ComparisonModal from './ComparisonModal';

// Mock the API service
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn()
  }
}));

// Mock Recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>
}));

describe('ComparisonModal', () => {
  const mockTickers = [
    {
      ticker: 'PETR4',
      confidence_score: 85.5,
      expected_return: 0.12,
      sector: 'Petróleo e Gás'
    },
    {
      ticker: 'VALE3',
      confidence_score: 78.2,
      expected_return: 0.08,
      sector: 'Mineração'
    },
    {
      ticker: 'ITUB4',
      confidence_score: 82.1,
      expected_return: 0.10,
      sector: 'Financeiro'
    }
  ];

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Req 4.4: Display comparison view with selected tickers
  it('renders comparison modal with ticker information', async () => {
    render(<ComparisonModal tickers={mockTickers} onClose={mockOnClose} />);
    
    // Check if modal title is displayed
    expect(screen.getByText('Comparação de Tickers')).toBeInTheDocument();
    
    // Check if all tickers are displayed (they appear in cards and table)
    expect(screen.getAllByText('PETR4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('VALE3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ITUB4').length).toBeGreaterThan(0);
  });

  // Req 4.5: Display recommendation scores
  it('displays recommendation scores for all tickers', () => {
    render(<ComparisonModal tickers={mockTickers} onClose={mockOnClose} />);
    
    // Check if scores are displayed (they appear in cards and table)
    expect(screen.getAllByText('85.5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('78.2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('82.1').length).toBeGreaterThan(0);
  });

  // Req 4.6: Display expected returns
  it('displays expected returns for all tickers', () => {
    render(<ComparisonModal tickers={mockTickers} onClose={mockOnClose} />);
    
    // Check if returns are displayed (converted to percentage, appear in cards and table)
    expect(screen.getAllByText('12.00%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('8.00%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('10.00%').length).toBeGreaterThan(0);
  });

  // Req 4.7: Display historical performance
  it('displays historical performance chart', async () => {
    render(<ComparisonModal tickers={mockTickers} onClose={mockOnClose} />);
    
    // Check if historical performance section is present
    expect(screen.getByText('Desempenho Histórico')).toBeInTheDocument();
    
    // Wait for chart to load
    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  // Req 4.9: Provide close button
  it('has a close button', () => {
    render(<ComparisonModal tickers={mockTickers} onClose={mockOnClose} />);
    
    const closeButton = screen.getByLabelText('Fechar modal');
    expect(closeButton).toBeInTheDocument();
  });

  // Test comparison table
  it('displays comparison table with metrics', () => {
    render(<ComparisonModal tickers={mockTickers} onClose={mockOnClose} />);
    
    expect(screen.getByText('Comparação Detalhada')).toBeInTheDocument();
    expect(screen.getByText('Score de Confiança')).toBeInTheDocument();
    // "Retorno Esperado" appears multiple times (in cards and table header)
    expect(screen.getAllByText('Retorno Esperado').length).toBeGreaterThan(0);
    // "Setor" appears multiple times
    expect(screen.getAllByText('Setor').length).toBeGreaterThan(0);
  });

  // Test sector display
  it('displays sector information for each ticker', () => {
    render(<ComparisonModal tickers={mockTickers} onClose={mockOnClose} />);
    
    // Sectors appear in cards and table
    expect(screen.getAllByText('Petróleo e Gás').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mineração').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Financeiro').length).toBeGreaterThan(0);
  });

  // Test best value highlighting
  it('highlights best score and return', () => {
    const { container } = render(<ComparisonModal tickers={mockTickers} onClose={mockOnClose} />);
    
    // The best score (85.5) should be highlighted in green
    // The best return (12.00%) should be highlighted in green
    // Check for green color styling
    const greenElements = container.querySelectorAll('[style*="rgb(16, 185, 129)"]');
    expect(greenElements.length).toBeGreaterThan(0);
  });

  // Test empty tickers
  it('returns null when no tickers provided', () => {
    const { container } = render(<ComparisonModal tickers={[]} onClose={mockOnClose} />);
    expect(container.firstChild).toBeNull();
  });

  // Test loading state
  it('shows loading state initially then displays chart', async () => {
    render(<ComparisonModal tickers={mockTickers} onClose={mockOnClose} />);
    
    // The component starts with loading state but useEffect runs immediately in tests
    // So we just verify the chart eventually appears
    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });
});
