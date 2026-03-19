/**
 * TickerDetailModal Tests
 * 
 * Tests for the enhanced TickerDetailModal component
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TickerDetailModal from './TickerDetailModal';
import api from '../../services/api';

// Mock the API module
jest.mock('../../services/api');

describe('TickerDetailModal', () => {
  const mockTicker = {
    ticker: 'PETR4',
    sector: 'Energia',
    expected_return: 0.15,
    confidence_score: 85.5,
    model_weights: {
      xgboost: 0.3,
      lstm: 0.25,
      prophet: 0.25,
      deepar: 0.2
    },
    predictions: {
      xgboost: 0.16,
      lstm: 0.14,
      prophet: 0.15,
      deepar: 0.15
    }
  };

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Requirement 3.1: Modal displays when ticker is clicked
  test('renders modal with ticker information', async () => {
    // Mock API responses
    api.get.mockImplementation((endpoint) => {
      if (endpoint.includes('/history')) {
        return Promise.resolve({
          data: [
            { date: '2024-01-01', score: 85, return: 0.12 },
            { date: '2024-01-08', score: 87, return: 0.15 }
          ]
        });
      }
      if (endpoint.includes('/fundamentals')) {
        return Promise.resolve({
          data: {
            'P/L': '15.50',
            'P/VP': '2.30',
            'Div. Yield': '5.2%',
            'ROE': '18.5%',
            'Dív/PL': '0.85'
          }
        });
      }
      if (endpoint.includes('/news')) {
        return Promise.resolve({
          data: [
            { title: 'PETR4 anuncia resultados', source: 'InfoMoney', date: 'Há 2 dias' }
          ]
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<TickerDetailModal ticker={mockTicker} onClose={mockOnClose} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Carregando detalhes...')).not.toBeInTheDocument();
    });

    // Check if ticker name is displayed
    expect(screen.getByText('PETR4')).toBeInTheDocument();
  });

  // Requirement 3.2: Display recommendation history
  test('displays recommendation history', async () => {
    const mockHistory = [
      { date: '2024-01-01', score: 85, return: 0.12 },
      { date: '2024-01-08', score: 87, return: 0.15 },
      { date: '2024-01-15', score: 83, return: 0.10 }
    ];

    api.get.mockImplementation((endpoint) => {
      if (endpoint.includes('/history')) {
        return Promise.resolve({ data: mockHistory });
      }
      return Promise.resolve({ data: {} });
    });

    render(<TickerDetailModal ticker={mockTicker} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Histórico de Recomendações')).toBeInTheDocument();
    });

    // Check if history data is displayed
    await waitFor(() => {
      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
      expect(screen.getByText('85.0')).toBeInTheDocument();
    });
  });

  // Requirement 3.3: Display fundamental metrics
  test('displays fundamental metrics', async () => {
    const mockFundamentals = {
      'P/L': '15.50',
      'P/VP': '2.30',
      'Div. Yield': '5.2%',
      'ROE': '18.5%',
      'Dív/PL': '0.85'
    };

    api.get.mockImplementation((endpoint) => {
      if (endpoint.includes('/fundamentals')) {
        return Promise.resolve({ data: mockFundamentals });
      }
      return Promise.resolve({ data: [] });
    });

    render(<TickerDetailModal ticker={mockTicker} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Métricas Fundamentalistas')).toBeInTheDocument();
    });

    // Check if fundamental metrics are displayed
    await waitFor(() => {
      expect(screen.getByText('P/L')).toBeInTheDocument();
      expect(screen.getByText('15.50')).toBeInTheDocument();
      expect(screen.getByText('ROE')).toBeInTheDocument();
      expect(screen.getByText('18.5%')).toBeInTheDocument();
    });
  });

  // Requirement 3.4: Display recent news articles
  test('displays recent news articles', async () => {
    const mockNews = [
      { title: 'PETR4 anuncia resultados', source: 'InfoMoney', date: 'Há 2 dias' },
      { title: 'Analistas recomendam PETR4', source: 'Valor', date: 'Há 5 dias' }
    ];

    api.get.mockImplementation((endpoint) => {
      if (endpoint.includes('/news')) {
        return Promise.resolve({ data: mockNews });
      }
      return Promise.resolve({ data: [] });
    });

    render(<TickerDetailModal ticker={mockTicker} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Notícias Recentes')).toBeInTheDocument();
    });

    // Check if news articles are displayed
    await waitFor(() => {
      expect(screen.getByText('PETR4 anuncia resultados')).toBeInTheDocument();
      expect(screen.getByText(/InfoMoney/)).toBeInTheDocument();
    });
  });

  // Requirement 3.5: Display close button
  test('displays close button', async () => {
    api.get.mockResolvedValue({ data: [] });

    render(<TickerDetailModal ticker={mockTicker} onClose={mockOnClose} />);

    await waitFor(() => {
      const closeButton = screen.getByLabelText('Fechar modal');
      expect(closeButton).toBeInTheDocument();
    });
  });

  // Requirement 3.6: Close on Escape key
  test('closes modal when Escape key is pressed', async () => {
    api.get.mockResolvedValue({ data: [] });

    render(<TickerDetailModal ticker={mockTicker} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('PETR4')).toBeInTheDocument();
    });

    // Simulate Escape key press
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // Requirement 3.6: Close on overlay click
  test('closes modal when overlay is clicked', async () => {
    api.get.mockResolvedValue({ data: [] });

    const { container } = render(<TickerDetailModal ticker={mockTicker} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('PETR4')).toBeInTheDocument();
    });

    // Click on the overlay (the outermost div)
    const overlay = container.firstChild;
    fireEvent.click(overlay);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // Requirement 3.6: Close button click
  test('closes modal when close button is clicked', async () => {
    api.get.mockResolvedValue({ data: [] });

    render(<TickerDetailModal ticker={mockTicker} onClose={mockOnClose} />);

    await waitFor(() => {
      const closeButton = screen.getByLabelText('Fechar modal');
      fireEvent.click(closeButton);
    });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // Requirement 3.7: Display loading indicator
  test('displays loading indicator while fetching data', () => {
    api.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<TickerDetailModal ticker={mockTicker} onClose={mockOnClose} />);

    expect(screen.getByText('Carregando detalhes...')).toBeInTheDocument();
  });

  // Requirement 3.8: Display error message on failure
  test('displays error message when data fetch fails', async () => {
    api.get.mockRejectedValue(new Error('Network error'));

    render(<TickerDetailModal ticker={mockTicker} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText(/Falha ao carregar detalhes do ticker/)).toBeInTheDocument();
    });
  });

  // Test fallback to mock data when API is not available
  test('falls back to mock data when API endpoints are not available', async () => {
    api.get.mockRejectedValue(new Error('Endpoint not found'));

    render(<TickerDetailModal ticker={mockTicker} onClose={mockOnClose} />);

    // Should still display content with mock data
    await waitFor(() => {
      expect(screen.queryByText('Carregando detalhes...')).not.toBeInTheDocument();
    });

    // Mock data should be displayed
    await waitFor(() => {
      expect(screen.getByText('Histórico de Recomendações')).toBeInTheDocument();
      expect(screen.getByText('Métricas Fundamentalistas')).toBeInTheDocument();
      expect(screen.getByText('Notícias Recentes')).toBeInTheDocument();
    });
  });

  // Test that modal doesn't render when ticker is null
  test('does not render when ticker is null', () => {
    const { container } = render(<TickerDetailModal ticker={null} onClose={mockOnClose} />);
    expect(container.firstChild).toBeNull();
  });

  // Test ensemble model contributions display
  test('displays ensemble model contributions', async () => {
    api.get.mockResolvedValue({ data: [] });

    render(<TickerDetailModal ticker={mockTicker} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Contribuição dos Modelos do Ensemble')).toBeInTheDocument();
    });

    // Check if model names are displayed
    expect(screen.getByText('XGBoost')).toBeInTheDocument();
    expect(screen.getByText('LSTM')).toBeInTheDocument();
    expect(screen.getByText('Prophet')).toBeInTheDocument();
    expect(screen.getByText('DeepAR')).toBeInTheDocument();
  });
});
