/**
 * CostTrendChart Component Tests
 * 
 * Tests for the CostTrendChart component including:
 * - Rendering with valid data
 * - Loading state
 * - Empty state
 * - Statistics calculation
 * - Spike detection
 * - Service segmentation
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CostTrendChart from './CostTrendChart';

// Mock recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  ReferenceDot: () => <div data-testid="reference-dot" />,
}));

// Mock date-fns to avoid locale issues
jest.mock('date-fns', () => ({
  format: (date: any, formatStr: string) => '01/01/2024',
  parseISO: (dateStr: string) => new Date(dateStr),
}));

// Mock chartConfig to avoid UIContext dependency
jest.mock('../../lib/chartConfig', () => ({
  useChartColors: () => ({
    primary: '#5a9e87',
    secondary: '#5a9e87',
    success: '#4ead8a',
    warning: '#d4a84b',
    error: '#e07070',
    info: '#2d7d9a',
    neutral: '#5a7268',
    gradient: ['#5a9e87', '#5a9e87', '#d4a84b', '#d4a84b', '#4ead8a'],
    positive: '#4ead8a',
    negative: '#e07070',
    grid: '#d4e5dc',
    text: '#1a2e26',
    background: '#ffffff',
  }),
}));

// Helper to wrap component with providers
const renderComponent = (component: React.ReactElement) => {
  return render(component);
};

describe('CostTrendChart', () => {
  const mockData = {
    time_series: {
      daily_costs: [
        {
          date: '2024-01-01',
          lambda: 10.5,
          s3: 5.2,
          apiGateway: 3.1,
          other: 2.0,
          total: 20.8,
        },
        {
          date: '2024-01-02',
          lambda: 11.0,
          s3: 5.5,
          apiGateway: 3.2,
          other: 2.1,
          total: 21.8,
        },
        {
          date: '2024-01-03',
          lambda: 10.8,
          s3: 5.3,
          apiGateway: 3.0,
          other: 1.9,
          total: 21.0,
        },
      ],
    },
  };

  const mockDataWithSpike = {
    time_series: {
      daily_costs: [
        { date: '2024-01-01', lambda: 10.0, s3: 5.0, apiGateway: 3.0, other: 2.0, total: 20.0 },
        { date: '2024-01-02', lambda: 10.0, s3: 5.0, apiGateway: 3.0, other: 2.0, total: 20.0 },
        { date: '2024-01-03', lambda: 10.0, s3: 5.0, apiGateway: 3.0, other: 2.0, total: 20.0 },
        { date: '2024-01-04', lambda: 10.0, s3: 5.0, apiGateway: 3.0, other: 2.0, total: 20.0 },
        { date: '2024-01-05', lambda: 10.0, s3: 5.0, apiGateway: 3.0, other: 2.0, total: 20.0 },
        { date: '2024-01-06', lambda: 200.0, s3: 100.0, apiGateway: 60.0, other: 40.0, total: 400.0 }, // Spike
        { date: '2024-01-07', lambda: 10.0, s3: 5.0, apiGateway: 3.0, other: 2.0, total: 20.0 },
      ],
    },
  };

  describe('Rendering', () => {
    it('should render loading state', () => {
      renderComponent(<CostTrendChart data={null} isLoading={true} />);
      expect(screen.getByText(/carregando tendências de custos/i)).toBeInTheDocument();
    });

    it('should render empty state when no data', () => {
      renderComponent(<CostTrendChart data={null} isLoading={false} />);
      expect(screen.getByText(/sem dados de tendências de custos disponíveis/i)).toBeInTheDocument();
    });

    it('should render empty state when data is empty', () => {
      const emptyData = { time_series: { daily_costs: [] } };
      renderComponent(<CostTrendChart data={emptyData} isLoading={false} />);
      expect(screen.getByText(/sem dados de tendências de custos disponíveis/i)).toBeInTheDocument();
    });

    it('should render chart with valid data', () => {
      renderComponent(<CostTrendChart data={mockData} isLoading={false} />);
      
      // Check title
      expect(screen.getByText(/tendência de custos aws/i)).toBeInTheDocument();
      
      // Check chart components
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('should render with custom days parameter', () => {
      renderComponent(<CostTrendChart data={mockData} isLoading={false} days={30} />);
      expect(screen.getByText(/últimos 30 dias/i)).toBeInTheDocument();
    });
  });

  describe('Statistics', () => {
    it('should display total cost', () => {
      renderComponent(<CostTrendChart data={mockData} isLoading={false} />);
      
      const totalCost = 20.8 + 21.8 + 21.0;
      expect(screen.getByText(/custo total/i)).toBeInTheDocument();
      expect(screen.getByText(`R$ ${totalCost.toFixed(2)}`)).toBeInTheDocument();
    });

    it('should display average daily cost', () => {
      renderComponent(<CostTrendChart data={mockData} isLoading={false} />);
      
      const avgCost = (20.8 + 21.8 + 21.0) / 3;
      expect(screen.getByText(/custo médio diário/i)).toBeInTheDocument();
      expect(screen.getByText(`R$ ${avgCost.toFixed(2)}`)).toBeInTheDocument();
    });

    it('should display minimum cost', () => {
      renderComponent(<CostTrendChart data={mockData} isLoading={false} />);
      
      expect(screen.getByText(/custo mínimo/i)).toBeInTheDocument();
      expect(screen.getByText('R$ 20.80')).toBeInTheDocument();
    });

    it('should display maximum cost', () => {
      renderComponent(<CostTrendChart data={mockData} isLoading={false} />);
      
      expect(screen.getByText(/custo máximo/i)).toBeInTheDocument();
      expect(screen.getByText('R$ 21.80')).toBeInTheDocument();
    });
  });

  describe('Spike Detection', () => {
    it('should detect and display cost spikes', () => {
      renderComponent(<CostTrendChart data={mockDataWithSpike} isLoading={false} />);
      
      // Should show spike indicator
      expect(screen.getByText(/1 pico detectado/i)).toBeInTheDocument();
      
      // Should show spike details section
      expect(screen.getByText(/picos de custo detectados/i)).toBeInTheDocument();
    });

    it('should not show spike section when no spikes', () => {
      renderComponent(<CostTrendChart data={mockData} isLoading={false} />);
      
      // Should not show spike indicator
      expect(screen.queryByText(/pico detectado/i)).not.toBeInTheDocument();
      
      // Should not show spike details section
      expect(screen.queryByText(/picos de custo detectados/i)).not.toBeInTheDocument();
    });

    it('should handle multiple spikes', () => {
      const multiSpikeData = {
        time_series: {
          daily_costs: [
            { date: '2024-01-01', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
            { date: '2024-01-02', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
            { date: '2024-01-03', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
            { date: '2024-01-04', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
            { date: '2024-01-05', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
            { date: '2024-01-06', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
            { date: '2024-01-07', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
            { date: '2024-01-08', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
            { date: '2024-01-09', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
            { date: '2024-01-10', lambda: 200, s3: 100, apiGateway: 60, other: 40, total: 400 }, // Spike 1
            { date: '2024-01-11', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
            { date: '2024-01-12', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
            { date: '2024-01-13', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
            { date: '2024-01-14', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
            { date: '2024-01-15', lambda: 220, s3: 110, apiGateway: 66, other: 44, total: 440 }, // Spike 2
          ],
        },
      };
      
      renderComponent(<CostTrendChart data={multiSpikeData} isLoading={false} />);
      expect(screen.getByText(/2 picos detectados/i)).toBeInTheDocument();
    });
  });

  describe('Service Segmentation', () => {
    it('should render all service areas', () => {
      renderComponent(<CostTrendChart data={mockData} isLoading={false} />);
      
      // Check that all 4 areas are rendered (Lambda, S3, API Gateway, Other)
      const areas = screen.getAllByTestId('area');
      expect(areas).toHaveLength(4);
    });

    it('should handle missing service data gracefully', () => {
      const partialData = {
        time_series: {
          daily_costs: [
            {
              date: '2024-01-01',
              lambda: 10.5,
              // Missing s3, apiGateway, other
              total: 10.5,
            },
          ],
        },
      };
      
      renderComponent(<CostTrendChart data={partialData} isLoading={false} />);
      
      // Should still render without errors
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });
  });

  describe('Data Transformation', () => {
    it('should handle null/undefined values in cost data', () => {
      const dataWithNulls = {
        time_series: {
          daily_costs: [
            {
              date: '2024-01-01',
              lambda: null,
              s3: undefined,
              apiGateway: 3.0,
              other: 2.0,
              total: 5.0,
            },
          ],
        },
      };
      
      renderComponent(<CostTrendChart data={dataWithNulls} isLoading={false} />);
      
      // Should render without errors
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      expect(screen.getAllByText('R$ 5.00')).toHaveLength(4); // total, avg, min, max
    });

    it('should calculate statistics correctly with edge cases', () => {
      const edgeCaseData = {
        time_series: {
          daily_costs: [
            { date: '2024-01-01', lambda: 0, s3: 0, apiGateway: 0, other: 0, total: 0 },
            { date: '2024-01-02', lambda: 100, s3: 50, apiGateway: 30, other: 20, total: 200 },
          ],
        },
      };
      
      renderComponent(<CostTrendChart data={edgeCaseData} isLoading={false} />);
      
      // Check that statistics section exists
      expect(screen.getByText(/custo total/i)).toBeInTheDocument();
      expect(screen.getByText(/custo médio diário/i)).toBeInTheDocument();
      expect(screen.getByText(/custo mínimo/i)).toBeInTheDocument();
      expect(screen.getByText(/custo máximo/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      renderComponent(<CostTrendChart data={mockData} isLoading={false} />);
      
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent(/tendência de custos aws/i);
    });

    it('should have descriptive text for statistics', () => {
      renderComponent(<CostTrendChart data={mockData} isLoading={false} />);
      
      expect(screen.getByText(/custo total/i)).toBeInTheDocument();
      expect(screen.getByText(/custo médio diário/i)).toBeInTheDocument();
      expect(screen.getByText(/custo mínimo/i)).toBeInTheDocument();
      expect(screen.getByText(/custo máximo/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single data point', () => {
      const singlePointData = {
        time_series: {
          daily_costs: [
            { date: '2024-01-01', lambda: 10, s3: 5, apiGateway: 3, other: 2, total: 20 },
          ],
        },
      };
      
      renderComponent(<CostTrendChart data={singlePointData} isLoading={false} />);
      
      // Should render without errors
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      
      // Min, max, and average should all be the same
      expect(screen.getAllByText('R$ 20.00')).toHaveLength(4); // total, avg, min, max
    });

    it('should handle very large numbers', () => {
      const largeNumberData = {
        time_series: {
          daily_costs: [
            { date: '2024-01-01', lambda: 10000, s3: 5000, apiGateway: 3000, other: 2000, total: 20000 },
          ],
        },
      };
      
      renderComponent(<CostTrendChart data={largeNumberData} isLoading={false} />);
      
      expect(screen.getAllByText('R$ 20000.00')).toHaveLength(4); // total, avg, min, max
    });

    it('should handle very small numbers', () => {
      const smallNumberData = {
        time_series: {
          daily_costs: [
            { date: '2024-01-01', lambda: 0.01, s3: 0.02, apiGateway: 0.03, other: 0.04, total: 0.10 },
          ],
        },
      };
      
      renderComponent(<CostTrendChart data={smallNumberData} isLoading={false} />);
      
      expect(screen.getAllByText('R$ 0.10')).toHaveLength(4); // total, avg, min, max
    });
  });
});
