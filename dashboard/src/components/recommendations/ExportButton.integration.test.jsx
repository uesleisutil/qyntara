/**
 * @jest-environment jsdom
 * 
 * ExportButton Integration Tests
 * 
 * Integration tests verifying export functionality works with filtered data
 * from RecommendationsPage
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RecommendationsPage from './RecommendationsPage';
import { FilterProvider } from '../../contexts/FilterContext';

// Mock data
const mockRecommendations = [
  {
    ticker: 'PETR4',
    sector: 'Energy',
    confidence_score: 85.5,
    expected_return: 0.12,
  },
  {
    ticker: 'VALE3',
    sector: 'Materials',
    score: 78.2,
    exp_return_20: 0.08,
  },
  {
    ticker: 'ITUB4',
    sector: 'Finance',
    confidence_score: 92.1,
    expected_return: 0.15,
  },
  {
    ticker: 'BBDC4',
    sector: 'Finance',
    confidence_score: 88.0,
    expected_return: 0.10,
  },
];

// Mock URL methods
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock window.location to prevent URL param issues
delete window.location;
window.location = { 
  href: 'http://localhost/',
  pathname: '/',
  search: '',
  hash: ''
};

// Mock window.history
window.history.replaceState = jest.fn();

// Mock Blob constructor
global.Blob = jest.fn((content, options) => ({
  content,
  options,
  size: content[0].length,
  type: options?.type || ''
}));

// Mock document.createElement
let mockLink;
beforeEach(() => {
  // Clear sessionStorage to ensure clean filter state
  sessionStorage.clear();
  
  // Clear Blob mock calls
  if (global.Blob.mock) {
    global.Blob.mock.calls = [];
  }
  
  mockLink = {
    href: '',
    download: '',
    click: jest.fn(),
  };
  const originalCreateElement = document.createElement.bind(document);
  jest.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'a') {
      return mockLink;
    }
    return originalCreateElement(tag);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
});

describe('ExportButton Integration with RecommendationsPage', () => {
  it('should export filtered data when sector filter is active', () => {
    render(
      <FilterProvider>
        <RecommendationsPage recommendations={mockRecommendations} />
      </FilterProvider>
    );

    // Apply sector filter
    const sectorSelect = screen.getByLabelText(/setor/i);
    fireEvent.change(sectorSelect, { target: { value: 'Finance' } });

    // Open export menu
    const exportButton = screen.getByRole('button', { name: /exportar/i });
    fireEvent.click(exportButton);

    // Export to CSV
    const csvOption = screen.getByText(/exportar como csv/i);
    fireEvent.click(csvOption);

    // Verify only Finance sector data is exported
    const blobContent = global.Blob.mock.calls[0][0][0];
    expect(blobContent).toContain('ITUB4');
    expect(blobContent).toContain('BBDC4');
    expect(blobContent).not.toContain('PETR4');
    expect(blobContent).not.toContain('VALE3');
  });

  it('should export filtered data when score filter is active', () => {
    render(
      <FilterProvider>
        <RecommendationsPage recommendations={mockRecommendations} />
      </FilterProvider>
    );

    // Apply minimum score filter
    const scoreInput = screen.getByLabelText(/score mínimo/i);
    fireEvent.change(scoreInput, { target: { value: '85' } });

    // Open export menu
    const exportButton = screen.getByRole('button', { name: /exportar/i });
    fireEvent.click(exportButton);

    // Export to CSV
    const csvOption = screen.getByText(/exportar como csv/i);
    fireEvent.click(csvOption);

    // Verify only high-score data is exported
    const blobContent = global.Blob.mock.calls[0][0][0];
    expect(blobContent).toContain('PETR4'); // 85.5
    expect(blobContent).toContain('ITUB4'); // 92.1
    expect(blobContent).toContain('BBDC4'); // 88.0
    expect(blobContent).not.toContain('VALE3'); // 78.2
  });

  it('should export filtered data when multiple filters are active', () => {
    render(
      <FilterProvider>
        <RecommendationsPage recommendations={mockRecommendations} />
      </FilterProvider>
    );

    // Apply sector filter
    const sectorSelect = screen.getByLabelText(/setor/i);
    fireEvent.change(sectorSelect, { target: { value: 'Finance' } });

    // Apply minimum score filter
    const scoreInput = screen.getByLabelText(/score mínimo/i);
    fireEvent.change(scoreInput, { target: { value: '90' } });

    // Open export menu
    const exportButton = screen.getByRole('button', { name: /exportar/i });
    fireEvent.click(exportButton);

    // Export to CSV
    const csvOption = screen.getByText(/exportar como csv/i);
    fireEvent.click(csvOption);

    // Verify only data matching both filters is exported
    const blobContent = global.Blob.mock.calls[0][0][0];
    expect(blobContent).toContain('ITUB4'); // Finance sector AND score >= 90
    expect(blobContent).not.toContain('BBDC4'); // Finance but score < 90
    expect(blobContent).not.toContain('PETR4'); // Score >= 90 but not Finance
    expect(blobContent).not.toContain('VALE3'); // Neither condition
  });

  it('should export all data when no filters are active', () => {
    // Ensure clean state
    sessionStorage.clear();
    
    render(
      <FilterProvider>
        <RecommendationsPage recommendations={mockRecommendations} />
      </FilterProvider>
    );

    // Open export menu without applying filters
    const exportButton = screen.getByRole('button', { name: /exportar/i });
    fireEvent.click(exportButton);

    // Export to CSV
    const csvOption = screen.getByText(/exportar como csv/i);
    fireEvent.click(csvOption);

    // Verify all data is exported
    const blobContent = global.Blob.mock.calls[0][0][0];
    expect(blobContent).toContain('PETR4');
    expect(blobContent).toContain('VALE3');
    expect(blobContent).toContain('ITUB4');
    expect(blobContent).toContain('BBDC4');
  });

  it('should update exported data when filters change', () => {
    render(
      <FilterProvider>
        <RecommendationsPage recommendations={mockRecommendations} />
      </FilterProvider>
    );

    // First export with no filters
    const exportButton = screen.getByRole('button', { name: /exportar/i });
    fireEvent.click(exportButton);
    const csvOption1 = screen.getByText(/exportar como csv/i);
    fireEvent.click(csvOption1);

    const firstExport = global.Blob.mock.calls[0][0][0];
    expect(firstExport).toContain('PETR4');
    expect(firstExport).toContain('VALE3');

    // Apply filter
    const sectorSelect = screen.getByLabelText(/setor/i);
    fireEvent.change(sectorSelect, { target: { value: 'Energy' } });

    // Second export with filter
    fireEvent.click(exportButton);
    const csvOption2 = screen.getByText(/exportar como csv/i);
    fireEvent.click(csvOption2);

    const secondExport = global.Blob.mock.calls[1][0][0];
    expect(secondExport).toContain('PETR4');
    expect(secondExport).not.toContain('VALE3');
  });
});
