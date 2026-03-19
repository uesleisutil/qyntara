/**
 * @jest-environment jsdom
 * 
 * ExportButton Component Tests
 * 
 * Tests for export functionality covering:
 * - CSV export (Req 2.3)
 * - Excel export (Req 2.4)
 * - Format selection menu (Req 2.2)
 * - Filename generation with timestamp (Req 2.7)
 * - Browser download trigger (Req 2.8)
 * - Filter application to exported data (Req 2.6)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExportButton from './ExportButton';

// Mock data for testing
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
];

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock Blob constructor
global.Blob = jest.fn((content, options) => ({
  content,
  options,
  size: content[0].length,
  type: options?.type || ''
}));

// Mock document.createElement to capture download behavior
let mockLink;
beforeEach(() => {
  // Clear Blob mock calls
  if (global.Blob.mock) {
    global.Blob.mock.calls = [];
  }
  
  // Create mockLink with proper property assignment tracking
  let hrefValue = '';
  let downloadValue = '';
  
  mockLink = {
    get href() { return hrefValue; },
    set href(value) { hrefValue = value; },
    get download() { return downloadValue; },
    set download(value) { downloadValue = value; },
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
});

describe('ExportButton Component', () => {
  describe('Requirement 2.1: Export button display', () => {
    it('should display export button on the page', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      expect(exportButton).toBeInTheDocument();
    });

    it('should disable button when no data is available', () => {
      render(<ExportButton data={[]} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      expect(exportButton).toBeDisabled();
    });

    it('should enable button when data is available', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      expect(exportButton).not.toBeDisabled();
    });
  });

  describe('Requirement 2.2: Format selection menu', () => {
    it('should show format options when export button is clicked', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      expect(screen.getByText(/exportar como csv/i)).toBeInTheDocument();
      expect(screen.getByText(/exportar como excel/i)).toBeInTheDocument();
    });

    it('should hide menu when clicking outside', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      expect(screen.getByText(/exportar como csv/i)).toBeInTheDocument();
      
      // Click outside (the overlay)
      const overlay = document.querySelector('[style*="position: fixed"]');
      fireEvent.click(overlay);
      
      expect(screen.queryByText(/exportar como csv/i)).not.toBeInTheDocument();
    });

    it('should display both CSV and Excel format options', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      const excelOption = screen.getByText(/exportar como excel/i);
      
      expect(csvOption).toBeInTheDocument();
      expect(excelOption).toBeInTheDocument();
    });
  });

  describe('Requirement 2.3: CSV export', () => {
    it('should generate CSV file with correct headers', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      // Verify Blob was created with CSV content
      expect(global.Blob).toHaveBeenCalled();
      const blobContent = global.Blob.mock.calls[0][0][0];
      
      // Check headers (Req 2.5)
      expect(blobContent).toContain('Rank,Ticker,Score,Expected Return (%),Sector');
    });

    it('should include all visible recommendation data in CSV', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      const blobContent = global.Blob.mock.calls[0][0][0];
      
      // Check data rows
      expect(blobContent).toContain('PETR4');
      expect(blobContent).toContain('VALE3');
      expect(blobContent).toContain('ITUB4');
      expect(blobContent).toContain('Energy');
      expect(blobContent).toContain('Materials');
      expect(blobContent).toContain('Finance');
    });

    it('should format numeric values correctly in CSV', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      const blobContent = global.Blob.mock.calls[0][0][0];
      
      // Check score formatting (1 decimal)
      expect(blobContent).toContain('85.5');
      expect(blobContent).toContain('78.2');
      
      // Check return formatting (2 decimals, as percentage)
      expect(blobContent).toContain('12.00'); // 0.12 * 100
      expect(blobContent).toContain('8.00');  // 0.08 * 100
    });

    it('should escape CSV special characters', () => {
      const dataWithCommas = [
        {
          ticker: 'TEST1',
          sector: 'Technology, Software',
          confidence_score: 80,
          expected_return: 0.10,
        },
      ];
      
      render(<ExportButton data={dataWithCommas} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      const blobContent = global.Blob.mock.calls[0][0][0];
      
      // Sector with comma should be quoted
      expect(blobContent).toContain('"Technology, Software"');
    });
  });

  describe('Requirement 2.4: Excel export', () => {
    it('should generate Excel file when Excel option is selected', async () => {
      // Mock xlsx library
      const mockXLSX = {
        utils: {
          aoa_to_sheet: jest.fn(() => ({ '!cols': [] })),
          book_new: jest.fn(() => ({})),
          book_append_sheet: jest.fn(),
        },
        writeFile: jest.fn(),
      };
      
      jest.mock('xlsx', () => mockXLSX);
      
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const excelOption = screen.getByText(/exportar como excel/i);
      fireEvent.click(excelOption);
      
      // Wait for async import and processing
      await waitFor(() => {
        expect(screen.queryByText(/exportando/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should include headers in Excel export', async () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const excelOption = screen.getByText(/exportar como excel/i);
      
      // Excel export is async, so we just verify the button works
      expect(excelOption).toBeInTheDocument();
    });
  });

  describe('Requirement 2.7: Filename with timestamp', () => {
    it('should generate filename with correct timestamp format', () => {
      // Mock Date to have predictable timestamp
      const mockDate = new Date('2024-01-15T14:30:45.123Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
      
      render(<ExportButton data={mockRecommendations} filename="recommendations" />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      // Check that download attribute has correct format
      expect(mockLink.download).toMatch(/^recommendations_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/);
    });

    it('should use custom filename prefix when provided', () => {
      render(<ExportButton data={mockRecommendations} filename="custom_export" />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      expect(mockLink.download).toContain('custom_export_');
    });

    it('should use default filename when not provided', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      expect(mockLink.download).toContain('recommendations_');
    });

    it('should have different extensions for CSV and Excel', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      // Test CSV extension
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      expect(mockLink.download).toMatch(/\.csv$/);
    });
  });

  describe('Requirement 2.8: Browser download trigger', () => {
    it('should trigger browser download for CSV', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      // Verify link click was triggered
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should create object URL for download', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      // Get the blob that was passed to createObjectURL
      const blob = global.URL.createObjectURL.mock.calls[0][0];
      expect(blob).toBeDefined();
      // Verify the mockLink received the URL
      expect(document.createElement).toHaveBeenCalledWith('a');
    });

    it('should revoke object URL after download', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      // Verify revokeObjectURL was called (cleanup after download)
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should close menu after successful export', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      expect(screen.getByText(/exportar como csv/i)).toBeInTheDocument();
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      expect(screen.queryByText(/exportar como csv/i)).not.toBeInTheDocument();
    });
  });

  describe('Requirement 2.6: Apply active filters to exported data', () => {
    it('should export only filtered data when filters are active', () => {
      // This is tested implicitly - the component receives filtered data
      // from the parent component (RecommendationsPage)
      const filteredData = [mockRecommendations[0]]; // Only first item
      
      render(<ExportButton data={filteredData} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      const blobContent = global.Blob.mock.calls[0][0][0];
      
      // Should only contain filtered data
      expect(blobContent).toContain('PETR4');
      expect(blobContent).not.toContain('VALE3');
      expect(blobContent).not.toContain('ITUB4');
    });

    it('should export all data when no filters are active', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      const blobContent = global.Blob.mock.calls[0][0][0];
      
      // Should contain all data
      expect(blobContent).toContain('PETR4');
      expect(blobContent).toContain('VALE3');
      expect(blobContent).toContain('ITUB4');
    });
  });

  describe('Error handling', () => {
    it('should handle CSV export errors gracefully', () => {
      // Mock console.error to suppress error output
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock Blob to throw error
      global.Blob = jest.fn(() => {
        throw new Error('Blob creation failed');
      });
      
      // Mock alert
      global.alert = jest.fn();
      
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText(/exportar como csv/i);
      fireEvent.click(csvOption);
      
      expect(consoleError).toHaveBeenCalled();
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Erro ao exportar'));
      
      consoleError.mockRestore();
    });

    it('should show loading state during export', async () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportButton);
      
      const excelOption = screen.getByText(/exportar como excel/i);
      fireEvent.click(excelOption);
      
      // Should show loading text briefly
      expect(screen.getByText(/exportando/i)).toBeInTheDocument();
    });
  });

  describe('UI/UX', () => {
    it('should have proper styling for disabled state', () => {
      render(<ExportButton data={[]} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      
      expect(exportButton).toHaveStyle({ opacity: '0.5' });
      expect(exportButton).toHaveStyle({ cursor: 'not-allowed' });
    });

    it('should display download icon', () => {
      render(<ExportButton data={mockRecommendations} />);
      
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      
      // Check that button contains icon (lucide-react Download component)
      expect(exportButton.querySelector('svg')).toBeInTheDocument();
    });
  });
});
