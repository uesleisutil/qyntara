/**
 * FilterBar Component Tests
 * 
 * Tests for filter controls functionality:
 * - Sector filter (Req 1.2)
 * - Return range filter (Req 1.3)
 * - Minimum score filter (Req 1.4)
 * - Multiple filters intersection (Req 1.5)
 * - Clear filters (Req 1.6)
 * - Filtered count display (Req 1.8)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import FilterBar from './FilterBar';
import { FilterProvider } from '../../contexts/FilterContext';

// Mock recommendations data
const mockRecommendations = [
  { ticker: 'PETR4', sector: 'Energia', expected_return: 0.15, confidence_score: 85 },
  { ticker: 'VALE3', sector: 'Mineração', expected_return: 0.12, confidence_score: 78 },
  { ticker: 'ITUB4', sector: 'Financeiro', expected_return: 0.08, confidence_score: 92 },
  { ticker: 'BBDC4', sector: 'Financeiro', expected_return: 0.10, confidence_score: 88 },
  { ticker: 'ABEV3', sector: 'Consumo', expected_return: 0.05, confidence_score: 65 },
];

const renderWithProvider = (component) => {
  return render(
    <FilterProvider>
      {component}
    </FilterProvider>
  );
};

describe('FilterBar Component', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', window.location.pathname);
  });
  test('renders filter controls (Req 1.1)', () => {
    renderWithProvider(
      <FilterBar recommendations={mockRecommendations} />
    );

    expect(screen.getByText('Filtros')).toBeInTheDocument();
    expect(screen.getByText('Setor')).toBeInTheDocument();
    expect(screen.getByText('Retorno Mínimo (%)')).toBeInTheDocument();
    expect(screen.getByText('Retorno Máximo (%)')).toBeInTheDocument();
    expect(screen.getByText('Score Mínimo')).toBeInTheDocument();
  });

  test('displays total count initially (Req 1.8)', () => {
    renderWithProvider(
      <FilterBar recommendations={mockRecommendations} />
    );

    expect(screen.getByText(/5 de 5 resultados/)).toBeInTheDocument();
  });

  test('sector filter shows all unique sectors (Req 1.2)', () => {
    renderWithProvider(
      <FilterBar recommendations={mockRecommendations} />
    );

    const sectorSelect = screen.getByLabelText('Setor');
    expect(sectorSelect).toBeInTheDocument();
    
    // Check that all sectors are present
    const options = sectorSelect.querySelectorAll('option');
    const sectorTexts = Array.from(options).map(opt => opt.textContent);
    
    expect(sectorTexts).toContain('Todos os setores');
    expect(sectorTexts).toContain('Energia');
    expect(sectorTexts).toContain('Mineração');
    expect(sectorTexts).toContain('Financeiro');
    expect(sectorTexts).toContain('Consumo');
  });

  test('filters by sector correctly (Req 1.2)', () => {
    const onFilteredCountChange = jest.fn();
    
    renderWithProvider(
      <FilterBar 
        recommendations={mockRecommendations}
        onFilteredCountChange={onFilteredCountChange}
      />
    );

    const sectorSelect = screen.getByLabelText('Setor');
    fireEvent.change(sectorSelect, { target: { value: 'Financeiro' } });

    // Should filter to 2 financial sector stocks
    expect(onFilteredCountChange).toHaveBeenCalledWith(2);
  });

  test('filters by minimum return correctly (Req 1.3)', () => {
    const onFilteredCountChange = jest.fn();
    
    renderWithProvider(
      <FilterBar 
        recommendations={mockRecommendations}
        onFilteredCountChange={onFilteredCountChange}
      />
    );

    const minReturnSlider = screen.getAllByRole('slider')[0];
    fireEvent.change(minReturnSlider, { target: { value: '10' } });

    // Should filter to stocks with return >= 10%
    // PETR4 (15%), VALE3 (12%), BBDC4 (10%) = 3 stocks
    expect(onFilteredCountChange).toHaveBeenLastCalledWith(3);
  });

  test('filters by minimum score correctly (Req 1.4)', () => {
    const onFilteredCountChange = jest.fn();
    
    renderWithProvider(
      <FilterBar 
        recommendations={mockRecommendations}
        onFilteredCountChange={onFilteredCountChange}
      />
    );

    const minScoreSlider = screen.getAllByRole('slider')[2];
    fireEvent.change(minScoreSlider, { target: { value: '80' } });

    // Should filter to stocks with score >= 80
    // PETR4 (85), ITUB4 (92), BBDC4 (88) = 3 stocks
    expect(onFilteredCountChange).toHaveBeenLastCalledWith(3);
  });

  test('clear filters button appears when filters are active (Req 1.6)', () => {
    renderWithProvider(
      <FilterBar recommendations={mockRecommendations} />
    );

    // Initially no clear button
    expect(screen.queryByText('Limpar Filtros')).not.toBeInTheDocument();

    // Apply a filter
    const sectorSelect = screen.getByLabelText('Setor');
    fireEvent.change(sectorSelect, { target: { value: 'Energia' } });

    // Clear button should appear
    expect(screen.getByText('Limpar Filtros')).toBeInTheDocument();
  });

  test('clear filters button resets all filters (Req 1.6)', () => {
    const onFilteredCountChange = jest.fn();
    
    renderWithProvider(
      <FilterBar 
        recommendations={mockRecommendations}
        onFilteredCountChange={onFilteredCountChange}
      />
    );

    // Apply filters
    const sectorSelect = screen.getByLabelText('Setor');
    fireEvent.change(sectorSelect, { target: { value: 'Energia' } });

    // Clear filters
    const clearButton = screen.getByText('Limpar Filtros');
    fireEvent.click(clearButton);

    // Should reset to all recommendations
    expect(onFilteredCountChange).toHaveBeenCalledWith(5);
    expect(screen.queryByText('Limpar Filtros')).not.toBeInTheDocument();
  });

  test('displays active filters summary', () => {
    renderWithProvider(
      <FilterBar recommendations={mockRecommendations} />
    );

    // Apply sector filter
    const sectorSelect = screen.getByLabelText('Setor');
    fireEvent.change(sectorSelect, { target: { value: 'Financeiro' } });

    // Should show active filters summary
    expect(screen.getByText('Filtros Ativos:')).toBeInTheDocument();
    expect(screen.getByText('Setor: Financeiro')).toBeInTheDocument();
  });

  test('multiple filters work together (intersection) (Req 1.5)', () => {
    const onFilteredCountChange = jest.fn();
    
    renderWithProvider(
      <FilterBar 
        recommendations={mockRecommendations}
        onFilteredCountChange={onFilteredCountChange}
      />
    );

    // Apply sector filter (Financeiro: ITUB4, BBDC4)
    const sectorSelect = screen.getByLabelText('Setor');
    fireEvent.change(sectorSelect, { target: { value: 'Financeiro' } });

    // Apply minimum score filter (>= 90: only ITUB4)
    const minScoreSlider = screen.getAllByRole('slider')[2];
    fireEvent.change(minScoreSlider, { target: { value: '90' } });

    // Should filter to only ITUB4 (Financeiro sector AND score >= 90)
    expect(onFilteredCountChange).toHaveBeenCalledWith(1);
  });
});

describe('FilterBar - URL Sharing (Req 1.7)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', window.location.pathname);
    // Reset clipboard mock
    navigator.clipboard.writeText = jest.fn(() => Promise.resolve());
    jest.clearAllMocks();
  });

  test('should show share button when filters are active', () => {
    renderWithProvider(
      <FilterBar recommendations={mockRecommendations} />
    );

    // No share button initially
    expect(screen.queryByText('Compartilhar')).not.toBeInTheDocument();

    // Apply filter
    const sectorSelect = screen.getByLabelText('Setor');
    fireEvent.change(sectorSelect, { target: { value: 'Financeiro' } });

    // Share button should appear
    expect(screen.getByText('Compartilhar')).toBeInTheDocument();
  });

  test('should copy URL to clipboard when share button clicked', async () => {
    renderWithProvider(
      <FilterBar recommendations={mockRecommendations} />
    );

    // Apply filter
    const sectorSelect = screen.getByLabelText('Setor');
    fireEvent.change(sectorSelect, { target: { value: 'Financeiro' } });

    // Click share button
    const shareButton = screen.getByText('Compartilhar');
    await act(async () => {
      fireEvent.click(shareButton);
    });

    // Should call clipboard API
    expect(navigator.clipboard.writeText).toHaveBeenCalled();

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText('Copiado!')).toBeInTheDocument();
    });
  });

  test('should show success message after copying URL', async () => {
    renderWithProvider(
      <FilterBar recommendations={mockRecommendations} />
    );

    // Apply filter
    const sectorSelect = screen.getByLabelText('Setor');
    fireEvent.change(sectorSelect, { target: { value: 'Energia' } });

    // Click share button
    const shareButton = screen.getByText('Compartilhar');
    await act(async () => {
      fireEvent.click(shareButton);
    });

    // Should show "Copiado!" message
    await waitFor(() => {
      expect(screen.getByText('Copiado!')).toBeInTheDocument();
    });
  });
});
