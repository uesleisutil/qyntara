/**
 * BudgetIndicator Component Tests
 * 
 * Tests for budget monitoring with alerts and projections.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BudgetIndicator from './BudgetIndicator';

// Mock chart config
jest.mock('../../lib/chartConfig', () => ({
  useChartColors: () => ({
    primary: '#5a9e87',
    secondary: '#5a9e87',
    success: '#4ead8a',
    warning: '#d4a84b',
    error: '#e07070',
    info: '#5ab0a0',
    neutral: '#5a7268',
    grid: '#d4e5dc',
    text: '#1a2e26',
    background: '#ffffff',
  }),
  formatters: {
    currency: (value: number) => `R$ ${value.toFixed(2)}`,
  },
}));

describe('BudgetIndicator', () => {
  const mockOnBudgetChange = jest.fn();

  const onTrackData = {
    budget: {
      limit: 1000,
      current: 500,
      projected: 800,
      daysRemaining: 15,
      daysInMonth: 30,
    },
  };

  const warningData = {
    budget: {
      limit: 1000,
      current: 850,
      projected: 1050,
      daysRemaining: 10,
      daysInMonth: 30,
    },
  };

  const criticalData = {
    budget: {
      limit: 1000,
      current: 1100,
      projected: 1200,
      daysRemaining: 5,
      daysInMonth: 30,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading and Empty States', () => {
    it('should display loading state', () => {
      render(<BudgetIndicator data={null} isLoading={true} />);
      expect(screen.getByText(/carregando indicadores de orçamento/i)).toBeInTheDocument();
    });

    it('should display empty state when no data', () => {
      render(<BudgetIndicator data={null} isLoading={false} />);
      expect(screen.getByText(/sem dados de orçamento disponíveis/i)).toBeInTheDocument();
    });
  });

  describe('Budget Status - On Track', () => {
    it('should display on-track status when under 80%', () => {
      render(<BudgetIndicator data={onTrackData} />);
      expect(screen.getAllByText(/dentro do orçamento/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/orçamento sob controle/i)).toBeInTheDocument();
    });

    it('should display current spend percentage', () => {
      render(<BudgetIndicator data={onTrackData} />);
      expect(screen.getByText('50.0%')).toBeInTheDocument();
    });

    it('should display budget limit', () => {
      render(<BudgetIndicator data={onTrackData} />);
      expect(screen.getByText('R$ 1000.00')).toBeInTheDocument();
    });

    it('should display days remaining', () => {
      render(<BudgetIndicator data={onTrackData} />);
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText(/de 30 dias/i)).toBeInTheDocument();
    });

    it('should display projected end-of-month cost', () => {
      render(<BudgetIndicator data={onTrackData} />);
      expect(screen.getByText('R$ 800.00')).toBeInTheDocument();
    });
  });

  describe('Budget Status - Warning', () => {
    it('should display warning status when at 80-99%', () => {
      render(<BudgetIndicator data={warningData} />);
      expect(screen.getByText(/atenção: próximo ao limite/i)).toBeInTheDocument();
      expect(screen.getByText(/aviso: próximo ao limite do orçamento/i)).toBeInTheDocument();
    });

    it('should display warning percentage', () => {
      render(<BudgetIndicator data={warningData} />);
      expect(screen.getByText('85.0%')).toBeInTheDocument();
    });

    it('should show warning icon', () => {
      render(<BudgetIndicator data={warningData} />);
      expect(screen.getAllByText('⚠️').length).toBeGreaterThan(0);
    });
  });

  describe('Budget Status - Critical', () => {
    it('should display critical status when at or over 100%', () => {
      render(<BudgetIndicator data={criticalData} />);
      expect(screen.getAllByText(/orçamento excedido/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/alerta crítico: orçamento excedido/i)).toBeInTheDocument();
    });

    it('should display critical percentage', () => {
      render(<BudgetIndicator data={criticalData} />);
      expect(screen.getByText('110.0%')).toBeInTheDocument();
    });

    it('should show critical icon', () => {
      render(<BudgetIndicator data={criticalData} />);
      expect(screen.getAllByText('🚨').length).toBeGreaterThan(0);
    });
  });

  describe('Budget Configuration', () => {
    it('should display configure button when onBudgetChange provided', () => {
      render(<BudgetIndicator data={onTrackData} onBudgetChange={mockOnBudgetChange} />);
      expect(screen.getByText(/configurar/i)).toBeInTheDocument();
    });

    it('should not display configure button when onBudgetChange not provided', () => {
      render(<BudgetIndicator data={onTrackData} />);
      expect(screen.queryByText(/configurar/i)).not.toBeInTheDocument();
    });

    it('should show edit form when configure button clicked', () => {
      render(<BudgetIndicator data={onTrackData} onBudgetChange={mockOnBudgetChange} />);
      
      const configButton = screen.getByText(/configurar/i);
      fireEvent.click(configButton);

      expect(screen.getByPlaceholderText(/digite o limite/i)).toBeInTheDocument();
      expect(screen.getByText(/salvar/i)).toBeInTheDocument();
      expect(screen.getByText(/cancelar/i)).toBeInTheDocument();
    });

    it('should call onBudgetChange when saving new limit', () => {
      render(<BudgetIndicator data={onTrackData} onBudgetChange={mockOnBudgetChange} />);
      
      const configButton = screen.getByText(/configurar/i);
      fireEvent.click(configButton);

      const input = screen.getByPlaceholderText(/digite o limite/i);
      fireEvent.change(input, { target: { value: '2000' } });

      const saveButton = screen.getByText(/salvar/i);
      fireEvent.click(saveButton);

      expect(mockOnBudgetChange).toHaveBeenCalledWith(2000);
    });

    it('should cancel edit without calling onBudgetChange', () => {
      render(<BudgetIndicator data={onTrackData} onBudgetChange={mockOnBudgetChange} />);
      
      const configButton = screen.getByText(/configurar/i);
      fireEvent.click(configButton);

      const input = screen.getByPlaceholderText(/digite o limite/i);
      fireEvent.change(input, { target: { value: '2000' } });

      const cancelButton = screen.getByText(/cancelar/i);
      fireEvent.click(cancelButton);

      expect(mockOnBudgetChange).not.toHaveBeenCalled();
    });
  });

  describe('Calculated Metrics', () => {
    it('should calculate and display required daily spend', () => {
      render(<BudgetIndicator data={onTrackData} />);
      // (1000 - 500) / 15 = 33.33
      const elements = screen.getAllByText('R$ 33.33');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should calculate and display current daily average', () => {
      render(<BudgetIndicator data={onTrackData} />);
      // 500 / (30 - 15) = 33.33
      const elements = screen.getAllByText('R$ 33.33');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should display remaining budget', () => {
      render(<BudgetIndicator data={onTrackData} />);
      expect(screen.getByText(/R\$ 500\.00 restante/i)).toBeInTheDocument();
    });
  });

  describe('Projection Warnings', () => {
    it('should warn when projection exceeds budget', () => {
      render(<BudgetIndicator data={warningData} />);
      expect(screen.getByText(/a projeção atual indica que o orçamento será excedido/i)).toBeInTheDocument();
    });

    it('should not show projection warning when on track', () => {
      render(<BudgetIndicator data={onTrackData} />);
      expect(screen.queryByText(/a projeção atual indica que o orçamento será excedido/i)).not.toBeInTheDocument();
    });
  });
});
