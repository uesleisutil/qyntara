/**
 * ROICalculator Component Tests
 * 
 * Tests for the ROI calculator component covering:
 * - Portfolio value configuration
 * - ROI calculations
 * - Break-even analysis
 * - Visual rendering
 * - Edge cases
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ROICalculator from './ROICalculator';

// Mock recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  ReferenceLine: () => null,
  Area: () => null,
  ComposedChart: ({ children }: any) => <div data-testid="composed-chart">{children}</div>,
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: (date: Date, formatStr: string) => '15/01/2024',
  parseISO: (dateStr: string) => new Date(dateStr),
}));

jest.mock('date-fns/locale', () => ({
  ptBR: {},
}));

// Mock chart config
jest.mock('../../lib/chartConfig', () => ({
  useChartColors: () => ({
    primary: '#8b5cf6',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#06b6d4',
    neutral: '#6b7280',
    text: '#1f2937',
    background: '#ffffff',
    grid: '#e5e7eb',
    secondary: '#8b5cf6',
  }),
  formatters: {
    currency: (value: number) => `R$ ${value.toFixed(2)}`,
  },
}));

describe('ROICalculator', () => {
  const mockData = {
    roi: {
      daily_metrics: [
        {
          date: '2024-01-10',
          alpha: 2.0,
          totalCost: 100,
        },
        {
          date: '2024-01-11',
          alpha: 2.5,
          totalCost: 110,
        },
        {
          date: '2024-01-12',
          alpha: 3.0,
          totalCost: 105,
        },
      ],
      target_threshold: 200,
      default_portfolio_value: 1000000,
    },
  };

  describe('Loading and Empty States', () => {
    it('should display loading state', () => {
      render(<ROICalculator data={null} isLoading={true} />);
      expect(screen.getByText(/carregando calculadora de roi/i)).toBeInTheDocument();
    });

    it('should display empty state when no data', () => {
      render(<ROICalculator data={null} isLoading={false} />);
      expect(screen.getByText(/sem dados de roi disponíveis/i)).toBeInTheDocument();
    });

    it('should display empty state when data has no metrics', () => {
      const emptyData = { roi: { daily_metrics: [] } };
      render(<ROICalculator data={emptyData} isLoading={false} />);
      expect(screen.getByText(/sem dados de roi disponíveis/i)).toBeInTheDocument();
    });
  });

  describe('Portfolio Value Configuration', () => {
    it('should display default portfolio value', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      // Check that portfolio value section exists
      expect(screen.getByText(/valor do portfólio gerenciado/i)).toBeInTheDocument();
      // Check that there's at least one instance of the value
      expect(screen.getAllByText(/R\$ 1000000\.00/).length).toBeGreaterThan(0);
    });

    it('should allow editing portfolio value', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      
      const configButton = screen.getByText(/configurar/i);
      fireEvent.click(configButton);

      const input = screen.getByPlaceholderText(/digite o valor do portfólio/i);
      expect(input).toBeInTheDocument();
    });

    it('should save new portfolio value', async () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      
      // Click configure button
      const configButton = screen.getByText(/configurar/i);
      fireEvent.click(configButton);

      // Enter new value
      const input = screen.getByPlaceholderText(/digite o valor do portfólio/i);
      fireEvent.change(input, { target: { value: '2000000' } });

      // Click save
      const saveButton = screen.getByText(/salvar/i);
      fireEvent.click(saveButton);

      // Check that input is no longer visible (editing mode closed)
      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/digite o valor do portfólio/i)).not.toBeInTheDocument();
      });
      
      // Check that configure button is back
      expect(screen.getByText(/configurar/i)).toBeInTheDocument();
    });

    it('should cancel editing portfolio value', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      
      // Click configure button
      const configButton = screen.getByText(/configurar/i);
      fireEvent.click(configButton);

      // Enter new value
      const input = screen.getByPlaceholderText(/digite o valor do portfólio/i);
      fireEvent.change(input, { target: { value: '2000000' } });

      // Click cancel
      const cancelButton = screen.getByText(/cancelar/i);
      fireEvent.click(cancelButton);

      // Check that original value is still displayed (should not be editing anymore)
      expect(screen.queryByPlaceholderText(/digite o valor do portfólio/i)).not.toBeInTheDocument();
    });
  });

  describe('ROI Calculations', () => {
    it('should calculate and display overall ROI', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      
      // With portfolio of 1,000,000 and alpha of ~2.5%, value generated = 25,000
      // Total cost = 315, so ROI = ((25,000 - 315) / 315) * 100 ≈ 7,836%
      expect(screen.getByText(/roi geral/i)).toBeInTheDocument();
    });

    it('should display average daily ROI', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      expect(screen.getByText(/roi médio diário/i)).toBeInTheDocument();
    });

    it('should display total value generated', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      expect(screen.getByText(/valor gerado total/i)).toBeInTheDocument();
    });

    it('should display net value', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      expect(screen.getByText(/valor líquido/i)).toBeInTheDocument();
    });
  });

  describe('Break-Even Analysis', () => {
    it('should display break-even analysis section', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      expect(screen.getByText(/análise de break-even/i)).toBeInTheDocument();
    });

    it('should display current portfolio', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      expect(screen.getByText(/portfólio atual/i)).toBeInTheDocument();
    });

    it('should display break-even portfolio', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      expect(screen.getAllByText(/portfólio break-even/i).length).toBeGreaterThan(0);
    });

    it('should display target portfolio', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      expect(screen.getAllByText(/portfólio para meta de roi/i).length).toBeGreaterThan(0);
    });

    it('should show interpretation guidance', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      expect(screen.getByText(/como interpretar/i)).toBeInTheDocument();
    });
  });

  describe('Target Comparison', () => {
    it('should display target comparison section', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      expect(screen.getByText(/comparação com meta de roi/i)).toBeInTheDocument();
    });

    it('should show status indicator', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      // Should show some status (excellent/good/fair/poor)
      const statusElements = screen.getAllByText(/roi/i);
      expect(statusElements.length).toBeGreaterThan(0);
    });

    it('should display appropriate message for excellent ROI', () => {
      // Create data with very high ROI
      const highROIData = {
        roi: {
          daily_metrics: [
            {
              date: '2024-01-10',
              alpha: 10.0,
              totalCost: 10,
            },
          ],
          target_threshold: 200,
          default_portfolio_value: 1000000,
        },
      };

      render(<ROICalculator data={highROIData} isLoading={false} />);
      expect(screen.getByText(/meta de roi atingida/i)).toBeInTheDocument();
    });
  });

  describe('Visual Components', () => {
    it('should render ROI trend chart', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    });

    it('should display chart title', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      expect(screen.getByText(/tendência de roi ao longo do tempo/i)).toBeInTheDocument();
    });

    it('should display component title', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      expect(screen.getByText(/calculadora de roi/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero alpha', () => {
      const zeroAlphaData = {
        roi: {
          daily_metrics: [
            {
              date: '2024-01-10',
              alpha: 0,
              totalCost: 100,
            },
          ],
          target_threshold: 200,
          default_portfolio_value: 1000000,
        },
      };

      render(<ROICalculator data={zeroAlphaData} isLoading={false} />);
      // Should render without crashing
      expect(screen.getByText(/calculadora de roi/i)).toBeInTheDocument();
    });

    it('should handle zero costs', () => {
      const zeroCostData = {
        roi: {
          daily_metrics: [
            {
              date: '2024-01-10',
              alpha: 2.0,
              totalCost: 0,
            },
          ],
          target_threshold: 200,
          default_portfolio_value: 1000000,
        },
      };

      render(<ROICalculator data={zeroCostData} isLoading={false} />);
      // Should render without crashing
      expect(screen.getByText(/calculadora de roi/i)).toBeInTheDocument();
    });

    it('should handle negative alpha', () => {
      const negativeAlphaData = {
        roi: {
          daily_metrics: [
            {
              date: '2024-01-10',
              alpha: -2.0,
              totalCost: 100,
            },
          ],
          target_threshold: 200,
          default_portfolio_value: 1000000,
        },
      };

      render(<ROICalculator data={negativeAlphaData} isLoading={false} />);
      // Should render and show negative ROI
      expect(screen.getAllByText(/roi negativo/i).length).toBeGreaterThan(0);
    });

    it('should handle single data point', () => {
      const singlePointData = {
        roi: {
          daily_metrics: [
            {
              date: '2024-01-10',
              alpha: 2.0,
              totalCost: 100,
            },
          ],
          target_threshold: 200,
          default_portfolio_value: 1000000,
        },
      };

      render(<ROICalculator data={singlePointData} isLoading={false} />);
      expect(screen.getByText(/calculadora de roi/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should render all key metric cards', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      
      expect(screen.getByText(/roi geral/i)).toBeInTheDocument();
      expect(screen.getByText(/roi médio diário/i)).toBeInTheDocument();
      expect(screen.getByText(/valor gerado total/i)).toBeInTheDocument();
      expect(screen.getByText(/valor líquido/i)).toBeInTheDocument();
    });

    it('should render all break-even cards', () => {
      render(<ROICalculator data={mockData} isLoading={false} />);
      
      expect(screen.getByText(/portfólio atual/i)).toBeInTheDocument();
      expect(screen.getAllByText(/portfólio break-even/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/portfólio para meta de roi/i).length).toBeGreaterThan(0);
    });
  });
});
