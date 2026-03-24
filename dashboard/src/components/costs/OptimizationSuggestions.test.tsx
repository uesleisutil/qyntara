/**
 * OptimizationSuggestions Component Tests
 * 
 * Tests for cost optimization suggestions component.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import OptimizationSuggestions from './OptimizationSuggestions';

// Mock chart config
jest.mock('../../lib/chartConfig', () => ({
  useChartColors: () => ({
    primary: '#5a9e87',
    success: '#4ead8a',
    warning: '#d4a84b',
    error: '#e07070',
    info: '#5ab0a0',
    neutral: '#5a7268',
    text: '#1a2e26',
    background: '#ffffff',
    grid: '#d4e5dc',
    secondary: '#5a9e87',
  }),
  formatters: {
    currency: (value: number) => `R$ ${value.toFixed(2)}`,
  },
}));

describe('OptimizationSuggestions', () => {
  const mockSuggestions = {
    cost_optimization: {
      suggestions: [
        {
          id: 'lambda-memory-opt',
          category: 'lambda' as const,
          title: 'Otimizar Memória do Lambda',
          description: 'Tempo médio de execução alto indica memória insuficiente.',
          estimatedSavings: 150.50,
          priority: 'high' as const,
          implemented: false,
          implementationGuide: [
            'Analise as métricas de memória',
            'Teste com incrementos de 128MB',
          ],
          detectedPattern: 'Tempo de execução médio: 6.5s',
        },
        {
          id: 's3-lifecycle',
          category: 's3' as const,
          title: 'Implementar Políticas de Lifecycle',
          description: 'Crescimento de armazenamento detectado.',
          estimatedSavings: 200.00,
          priority: 'high' as const,
          implemented: false,
          implementationGuide: [
            'Configure transição para S3 Intelligent-Tiering',
            'Mova para Glacier após 90 dias',
          ],
          detectedPattern: 'Taxa de crescimento: 15%/mês',
        },
        {
          id: 'apigateway-cache',
          category: 'apiGateway' as const,
          title: 'Ativar Cache no API Gateway',
          description: 'Alto volume de requisições sem cache.',
          estimatedSavings: 300.00,
          priority: 'medium' as const,
          implemented: true,
          implementationGuide: [
            'Habilite cache com TTL de 300 segundos',
            'Configure cache keys',
          ],
          detectedPattern: 'Requisições: 150k/mês, Cache hit rate: 20%',
        },
      ],
    },
  };

  const mockMetrics = {
    cost_optimization: {
      metrics: {
        lambda: {
          avgExecutionTime: 6500,
          avgMemory: 512,
          totalCost: 450,
        },
        s3: {
          storageGrowthRate: 0.15,
          totalCost: 600,
          avgObjectAge: 75,
        },
        apiGateway: {
          requestCount: 150000,
          cacheHitRate: 0.2,
          totalCost: 350,
        },
      },
    },
  };

  it('renders loading state', () => {
    render(<OptimizationSuggestions data={null} isLoading={true} />);
    expect(screen.getByText(/Analisando padrões de custo/i)).toBeInTheDocument();
  });

  it('renders optimized state when no suggestions', () => {
    const emptyData = { cost_optimization: { suggestions: [] } };
    render(<OptimizationSuggestions data={emptyData} />);
    expect(screen.getByText(/Custos Otimizados/i)).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma oportunidade de otimização detectada/i)).toBeInTheDocument();
  });

  it('renders suggestions list with correct data', () => {
    render(<OptimizationSuggestions data={mockSuggestions} />);
    
    expect(screen.getByText('Otimizar Memória do Lambda')).toBeInTheDocument();
    expect(screen.getByText('Implementar Políticas de Lifecycle')).toBeInTheDocument();
    expect(screen.getByText('Ativar Cache no API Gateway')).toBeInTheDocument();
  });

  it('displays total potential savings', () => {
    render(<OptimizationSuggestions data={mockSuggestions} />);
    
    // Total savings = 150.50 + 200.00 (excluding implemented suggestion)
    expect(screen.getByText(/Economia potencial: R\$ 350\.50\/mês/i)).toBeInTheDocument();
  });

  it('displays implemented count', () => {
    render(<OptimizationSuggestions data={mockSuggestions} />);
    
    expect(screen.getByText(/1 implementada/i)).toBeInTheDocument();
  });

  it('shows priority badges correctly', () => {
    render(<OptimizationSuggestions data={mockSuggestions} />);
    
    const highPriorityBadges = screen.getAllByText(/Prioridade Alta/i);
    expect(highPriorityBadges).toHaveLength(2);
    
    expect(screen.getByText(/Prioridade Média/i)).toBeInTheDocument();
  });

  it('expands and collapses implementation guide', () => {
    render(<OptimizationSuggestions data={mockSuggestions} />);
    
    const guideButtons = screen.getAllByText(/Guia de Implementação/i);
    const firstButton = guideButtons[0];
    
    // Initially collapsed - check for s3-lifecycle guide (first after sorting)
    expect(screen.queryByText('Configure transição para S3 Intelligent-Tiering')).not.toBeInTheDocument();
    
    // Click to expand
    fireEvent.click(firstButton);
    expect(screen.getByText('Configure transição para S3 Intelligent-Tiering')).toBeInTheDocument();
    
    // Click to collapse
    fireEvent.click(firstButton);
    expect(screen.queryByText('Configure transição para S3 Intelligent-Tiering')).not.toBeInTheDocument();
  });

  it('calls onImplement when implement button clicked', () => {
    const mockOnImplement = jest.fn();
    render(<OptimizationSuggestions data={mockSuggestions} onImplement={mockOnImplement} />);
    
    const implementButtons = screen.getAllByText(/Marcar como Implementada/i);
    fireEvent.click(implementButtons[0]);
    
    expect(mockOnImplement).toHaveBeenCalledWith('s3-lifecycle');
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const mockOnDismiss = jest.fn();
    render(<OptimizationSuggestions data={mockSuggestions} onDismiss={mockOnDismiss} />);
    
    const dismissButtons = screen.getAllByText(/Dispensar/i);
    fireEvent.click(dismissButtons[0]);
    
    expect(mockOnDismiss).toHaveBeenCalledWith('s3-lifecycle');
  });

  it('does not show action buttons for implemented suggestions', () => {
    render(<OptimizationSuggestions data={mockSuggestions} onImplement={jest.fn()} />);
    
    // Should have 2 implement buttons (for non-implemented suggestions)
    const implementButtons = screen.getAllByText(/Marcar como Implementada/i);
    expect(implementButtons).toHaveLength(2);
  });

  it('generates suggestions from metrics when not provided', () => {
    render(<OptimizationSuggestions data={mockMetrics} />);
    
    // Should generate Lambda optimization suggestion
    expect(screen.getByText(/Otimizar Memória do Lambda/i)).toBeInTheDocument();
    
    // Should generate S3 lifecycle suggestion
    expect(screen.getByText(/Implementar Políticas de Lifecycle no S3/i)).toBeInTheDocument();
    
    // Should generate API Gateway caching suggestion
    expect(screen.getByText(/Ativar Cache no API Gateway/i)).toBeInTheDocument();
  });

  it('sorts suggestions by priority and savings', () => {
    render(<OptimizationSuggestions data={mockSuggestions} />);
    
    const titles = screen.getAllByRole('heading', { level: 4 });
    
    // High priority suggestions should come first
    // Within same priority, higher savings first
    expect(titles[0]).toHaveTextContent('Implementar Políticas de Lifecycle'); // high, 200
    expect(titles[1]).toHaveTextContent('Otimizar Memória do Lambda'); // high, 150.50
    expect(titles[2]).toHaveTextContent('Ativar Cache no API Gateway'); // medium, 300
  });

  it('displays category icons and labels', () => {
    render(<OptimizationSuggestions data={mockSuggestions} />);
    
    expect(screen.getByText('λ')).toBeInTheDocument(); // Lambda icon
    expect(screen.getByText('📦')).toBeInTheDocument(); // S3 icon
    expect(screen.getByText('🌐')).toBeInTheDocument(); // API Gateway icon
  });

  it('displays detected patterns', () => {
    render(<OptimizationSuggestions data={mockSuggestions} />);
    
    expect(screen.getByText(/Tempo de execução médio: 6\.5s/i)).toBeInTheDocument();
    expect(screen.getByText(/Taxa de crescimento: 15%\/mês/i)).toBeInTheDocument();
    expect(screen.getByText(/Requisições: 150k\/mês, Cache hit rate: 20%/i)).toBeInTheDocument();
  });

  it('displays estimated savings for each suggestion', () => {
    render(<OptimizationSuggestions data={mockSuggestions} />);
    
    expect(screen.getByText('R$ 150.50')).toBeInTheDocument();
    expect(screen.getByText('R$ 200.00')).toBeInTheDocument();
    expect(screen.getByText('R$ 300.00')).toBeInTheDocument();
  });

  it('handles null data gracefully', () => {
    render(<OptimizationSuggestions data={null} />);
    
    expect(screen.getByText(/Custos Otimizados/i)).toBeInTheDocument();
  });

  it('handles empty metrics gracefully', () => {
    const emptyMetrics = { cost_optimization: { metrics: {} } };
    render(<OptimizationSuggestions data={emptyMetrics} />);
    
    expect(screen.getByText(/Custos Otimizados/i)).toBeInTheDocument();
  });
});
