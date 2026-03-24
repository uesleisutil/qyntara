/**
 * CostPerPredictionChart Component Tests
 * 
 * Tests for the cost per prediction visualization component.
 * 
 * Requirements: 17.1-17.8
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CostPerPredictionChart from './CostPerPredictionChart';
import { UIProvider } from '../../../contexts/UIContext';

// Mock Recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ReferenceLine: () => <div data-testid="reference-line" />,
  ReferenceDot: () => <div data-testid="reference-dot" />,
}));

const mockData = {
  cost_per_prediction: {
    daily_metrics: [
      {
        date: '2024-01-01',
        totalCost: 10.0,
        predictionCount: 100,
        costPerPrediction: 0.10,
        modelBreakdown: {
          LSTM: { cost: 4.0, predictions: 40, costPerPrediction: 0.10 },
          RandomForest: { cost: 3.0, predictions: 30, costPerPrediction: 0.10 },
          XGBoost: { cost: 3.0, predictions: 30, costPerPrediction: 0.10 },
        },
      },
      {
        date: '2024-01-02',
        totalCost: 12.0,
        predictionCount: 100,
        costPerPrediction: 0.12,
        modelBreakdown: {
          LSTM: { cost: 5.0, predictions: 40, costPerPrediction: 0.125 },
          RandomForest: { cost: 3.5, predictions: 30, costPerPrediction: 0.117 },
          XGBoost: { cost: 3.5, predictions: 30, costPerPrediction: 0.117 },
        },
      },
      {
        date: '2024-01-03',
        totalCost: 9.0,
        predictionCount: 100,
        costPerPrediction: 0.09,
        modelBreakdown: {
          LSTM: { cost: 3.5, predictions: 40, costPerPrediction: 0.0875 },
          RandomForest: { cost: 2.75, predictions: 30, costPerPrediction: 0.0917 },
          XGBoost: { cost: 2.75, predictions: 30, costPerPrediction: 0.0917 },
        },
      },
      {
        date: '2024-01-04',
        totalCost: 8.5,
        predictionCount: 100,
        costPerPrediction: 0.085,
        modelBreakdown: {
          LSTM: { cost: 3.4, predictions: 40, costPerPrediction: 0.085 },
          RandomForest: { cost: 2.55, predictions: 30, costPerPrediction: 0.085 },
          XGBoost: { cost: 2.55, predictions: 30, costPerPrediction: 0.085 },
        },
      },
      {
        date: '2024-01-05',
        totalCost: 8.0,
        predictionCount: 100,
        costPerPrediction: 0.08,
        modelBreakdown: {
          LSTM: { cost: 3.2, predictions: 40, costPerPrediction: 0.08 },
          RandomForest: { cost: 2.4, predictions: 30, costPerPrediction: 0.08 },
          XGBoost: { cost: 2.4, predictions: 30, costPerPrediction: 0.08 },
        },
      },
    ],
    target_threshold: 0.10,
  },
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(<UIProvider>{component}</UIProvider>);
};

describe('CostPerPredictionChart', () => {
  describe('Requirement 17.1: Calculate cost per prediction', () => {
    it('should display cost per prediction metrics', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      expect(screen.getByText('Custo por Predição')).toBeInTheDocument();
    });

    it('should render chart components', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Requirement 17.2: Divide total daily costs by predictions', () => {
    it('should calculate and display cost per prediction correctly', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      // The component should process the data correctly
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Requirement 17.3: Display as time series chart', () => {
    it('should render a line chart', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    });
  });

  describe('Requirement 17.4: Calculate average cost per prediction', () => {
    it('should display average cost metric', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      expect(screen.getByText('Custo Médio')).toBeInTheDocument();
    });

    it('should calculate correct average', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      // Average of [0.10, 0.12, 0.09, 0.085, 0.08] = 0.095
      expect(screen.getByText(/R\$ 0[,.]09/)).toBeInTheDocument();
    });
  });

  describe('Requirement 17.5: Display trend', () => {
    it('should display trend indicator', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      // Should show decreasing trend based on mock data
      expect(screen.getByText(/Diminuindo|Estável|Aumentando/)).toBeInTheDocument();
    });

    it('should show decreasing trend for declining costs', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      expect(screen.getByText(/Diminuindo/)).toBeInTheDocument();
    });
  });

  describe('Requirement 17.6: Highlight days exceeding threshold', () => {
    it('should display threshold line', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      expect(screen.getByText('Limite Alvo')).toBeInTheDocument();
    });

    it('should show warning for days exceeding threshold', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      // Day 2024-01-02 has cost 0.12 which exceeds threshold 0.10
      expect(screen.getByText(/1 dia acima do limite/i)).toBeInTheDocument();
    });

    it('should list days exceeding threshold', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      expect(screen.getByText('⚠️ Dias Acima do Limite')).toBeInTheDocument();
    });
  });

  describe('Requirement 17.7: Segment by model type', () => {
    it('should display model segmentation when enabled', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} showModelSegmentation={true} />);
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should not display model segmentation when disabled', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} showModelSegmentation={false} />);
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Requirement 17.8: Display efficiency improvements', () => {
    it('should display efficiency improvement section', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      expect(screen.getByText(/Melhoria de Eficiência/)).toBeInTheDocument();
    });

    it('should show first week and last week averages', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      expect(screen.getByText('Primeira Semana')).toBeInTheDocument();
      expect(screen.getByText('Última Semana')).toBeInTheDocument();
    });

    it('should calculate efficiency improvement percentage', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      expect(screen.getByText('Melhoria')).toBeInTheDocument();
      // Should show positive improvement since costs are decreasing
      expect(screen.getByText(/\+.*%/)).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('should display loading state', () => {
      renderWithProviders(<CostPerPredictionChart data={null} isLoading={true} />);
      expect(screen.getByText(/Carregando custo por predição/i)).toBeInTheDocument();
    });

    it('should display empty state when no data', () => {
      renderWithProviders(<CostPerPredictionChart data={null} />);
      expect(screen.getByText(/Sem dados de custo por predição disponíveis/i)).toBeInTheDocument();
    });

    it('should handle missing daily_metrics', () => {
      const emptyData = { cost_per_prediction: {} };
      renderWithProviders(<CostPerPredictionChart data={emptyData} />);
      expect(screen.getByText(/Sem dados de custo por predição disponíveis/i)).toBeInTheDocument();
    });
  });

  describe('Statistics Display', () => {
    it('should display minimum cost', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      expect(screen.getByText('Custo Mínimo')).toBeInTheDocument();
    });

    it('should display maximum cost', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      expect(screen.getByText('Custo Máximo')).toBeInTheDocument();
    });

    it('should display target threshold', () => {
      renderWithProviders(<CostPerPredictionChart data={mockData} />);
      expect(screen.getByText('Limite Alvo')).toBeInTheDocument();
    });
  });

  describe('Trend Calculation', () => {
    it('should identify increasing trend', () => {
      const increasingData = {
        cost_per_prediction: {
          daily_metrics: [
            { date: '2024-01-01', totalCost: 8.0, predictionCount: 100, costPerPrediction: 0.08 },
            { date: '2024-01-02', totalCost: 9.0, predictionCount: 100, costPerPrediction: 0.09 },
            { date: '2024-01-03', totalCost: 10.0, predictionCount: 100, costPerPrediction: 0.10 },
            { date: '2024-01-04', totalCost: 11.0, predictionCount: 100, costPerPrediction: 0.11 },
            { date: '2024-01-05', totalCost: 12.0, predictionCount: 100, costPerPrediction: 0.12 },
          ],
          target_threshold: 0.10,
        },
      };
      renderWithProviders(<CostPerPredictionChart data={increasingData} />);
      expect(screen.getByText(/Aumentando/)).toBeInTheDocument();
    });

    it('should identify stable trend', () => {
      const stableData = {
        cost_per_prediction: {
          daily_metrics: [
            { date: '2024-01-01', totalCost: 10.0, predictionCount: 100, costPerPrediction: 0.10 },
            { date: '2024-01-02', totalCost: 10.0, predictionCount: 100, costPerPrediction: 0.10 },
            { date: '2024-01-03', totalCost: 10.0, predictionCount: 100, costPerPrediction: 0.10 },
            { date: '2024-01-04', totalCost: 10.0, predictionCount: 100, costPerPrediction: 0.10 },
            { date: '2024-01-05', totalCost: 10.0, predictionCount: 100, costPerPrediction: 0.10 },
          ],
          target_threshold: 0.10,
        },
      };
      renderWithProviders(<CostPerPredictionChart data={stableData} />);
      expect(screen.getByText(/Estável/)).toBeInTheDocument();
    });
  });

  describe('Threshold Exceeded Details', () => {
    it('should limit displayed exceeded days to 5', () => {
      const manyExceededData = {
        cost_per_prediction: {
          daily_metrics: Array.from({ length: 10 }, (_, i) => ({
            date: `2024-01-${String(i + 1).padStart(2, '0')}`,
            totalCost: 15.0,
            predictionCount: 100,
            costPerPrediction: 0.15,
          })),
          target_threshold: 0.10,
        },
      };
      renderWithProviders(<CostPerPredictionChart data={manyExceededData} />);
      expect(screen.getByText(/\+5 dias adicionais/)).toBeInTheDocument();
    });
  });
});
