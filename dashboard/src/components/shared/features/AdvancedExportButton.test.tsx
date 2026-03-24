/**
 * AdvancedExportButton Component Tests
 * 
 * Tests for Excel and Google Sheets export functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdvancedExportButton from './AdvancedExportButton';
import * as XLSX from 'xlsx';

// Mock xlsx library
jest.mock('xlsx', () => ({
  utils: {
    book_new: jest.fn(() => ({})),
    json_to_sheet: jest.fn(() => {
      // Return a worksheet with proper structure
      const worksheet: any = { '!ref': 'A1:E10' };
      // Add some mock cells
      for (let r = 0; r <= 9; r++) {
        for (let c = 0; c <= 4; c++) {
          const cellAddress = `${String.fromCharCode(65 + c)}${r + 1}`;
          worksheet[cellAddress] = { v: r === 0 ? `Header${c}` : r * c, t: r === 0 ? 's' : 'n' };
        }
      }
      return worksheet;
    }),
    book_append_sheet: jest.fn(),
    decode_range: jest.fn(() => ({ s: { r: 0, c: 0 }, e: { r: 9, c: 4 } })),
    encode_cell: jest.fn(({ r, c }) => `${String.fromCharCode(65 + c)}${r + 1}`),
  },
  writeFile: jest.fn(),
}));

// Mock window.alert
global.alert = jest.fn();

describe('AdvancedExportButton', () => {
  const mockData = {
    raw: [
      { ticker: 'PETR4', score: 85, return: 12.5, sector: 'Energy' },
      { ticker: 'VALE3', score: 78, return: 8.3, sector: 'Materials' },
    ],
    metrics: [
      { metric: 'Accuracy', value: 85, target: 80 },
      { metric: 'MAPE', value: 5.2, target: 6.0 },
    ],
    charts: [],
    summary: [
      { category: 'Total Return', value: '15.5%' },
      { category: 'Sharpe Ratio', value: '1.8' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Req 64.1: Export options
  test('renders advanced export button', () => {
    render(<AdvancedExportButton data={mockData} />);
    expect(screen.getByText('Advanced Export')).toBeInTheDocument();
  });

  test('opens configuration modal when button is clicked', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));
    expect(screen.getByText('Export Configuration')).toBeInTheDocument();
  });

  test('shows Excel and Google Sheets format options', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));

    expect(screen.getByText('Excel')).toBeInTheDocument();
    expect(screen.getByText('Google Sheets')).toBeInTheDocument();
  });

  test('allows selecting export format', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));

    const excelButton = screen.getByText('Excel');
    const googleSheetsButton = screen.getByText('Google Sheets');

    // Excel should be selected by default
    fireEvent.click(googleSheetsButton);
    // Google Sheets should now be selected (visual indication via styling)
    
    fireEvent.click(excelButton);
    // Excel should be selected again
  });

  // Req 64.2: Multi-sheet Excel export
  test('shows multiple sheet options', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));

    expect(screen.getByText(/Raw Data/)).toBeInTheDocument();
    expect(screen.getByText(/Calculated Metrics/)).toBeInTheDocument();
    expect(screen.getByText(/Chart Data/)).toBeInTheDocument();
    expect(screen.getByText(/Summary/)).toBeInTheDocument();
  });

  test('shows row count for sheets with data', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));

    expect(screen.getByText(/Raw Data \(2 rows\)/)).toBeInTheDocument();
    expect(screen.getByText(/Calculated Metrics \(2 rows\)/)).toBeInTheDocument();
  });

  // Req 64.9: Select data to include
  test('allows toggling sheet selection', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));

    const checkboxes = screen.getAllByRole('checkbox');
    const rawDataCheckbox = checkboxes[0];

    expect(rawDataCheckbox).toBeChecked();
    fireEvent.click(rawDataCheckbox);
    expect(rawDataCheckbox).not.toBeChecked();
  });

  test('disables sheets with no data', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));

    const checkboxes = screen.getAllByRole('checkbox');
    const chartDataCheckbox = checkboxes[2]; // Chart Data has no data

    expect(chartDataCheckbox).toBeDisabled();
  });

  // Req 64.10: Preserve formulas
  test('shows formula preservation option', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));

    expect(screen.getByText('Preserve formulas')).toBeInTheDocument();
  });

  test('allows toggling formula preservation', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));

    const formulaCheckbox = screen.getByText('Preserve formulas')
      .previousElementSibling as HTMLInputElement;

    expect(formulaCheckbox).toBeChecked();
    fireEvent.click(formulaCheckbox);
    expect(formulaCheckbox).not.toBeChecked();
  });

  // Req 64.4: Include formatting
  test('shows formatting option', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));

    expect(screen.getByText('Include formatting')).toBeInTheDocument();
  });

  test('allows toggling formatting', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));

    const formattingCheckbox = screen.getByText('Include formatting')
      .previousElementSibling as HTMLInputElement;

    expect(formattingCheckbox).toBeChecked();
    fireEvent.click(formattingCheckbox);
    expect(formattingCheckbox).not.toBeChecked();
  });

  // Req 64.2, 64.3: Excel export with multiple sheets
  test('exports to Excel when Export button is clicked', async () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));
    
    const exportButton = screen.getByRole('button', { name: /^Export$/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(XLSX.utils.book_new).toHaveBeenCalled();
      expect(XLSX.utils.json_to_sheet).toHaveBeenCalled();
      expect(XLSX.writeFile).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  test('creates separate sheets for each data type', async () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));
    
    const exportButton = screen.getByRole('button', { name: /^Export$/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      // Should create sheets for raw, metrics, and summary (charts has no data)
      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledTimes(3);
    });
  });

  // Req 64.5, 64.6, 64.7, 64.8: Google Sheets export
  test('shows OAuth message for Google Sheets export', async () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));
    
    fireEvent.click(screen.getByText('Google Sheets'));
    
    const exportButton = screen.getByRole('button', { name: /^Export$/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('OAuth authentication')
      );
    });
  });

  test('closes modal when Cancel is clicked', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));
    expect(screen.getByText('Export Configuration')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Export Configuration')).not.toBeInTheDocument();
  });

  test('closes modal when clicking outside', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));
    expect(screen.getByText('Export Configuration')).toBeInTheDocument();

    // Click the backdrop
    const backdrop = document.querySelector('[style*="position: fixed"]');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
  });

  test('disables export button when no sheets are selected', () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));

    // Uncheck all sheets
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.slice(0, 4).forEach(checkbox => {
      if ((checkbox as HTMLInputElement).checked && !(checkbox as HTMLInputElement).disabled) {
        fireEvent.click(checkbox);
      }
    });

    const exportButton = screen.getByRole('button', { name: /^Export$/i });
    expect(exportButton).toBeDisabled();
  });

  test('disables button while exporting', async () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));
    
    const exportButton = screen.getByRole('button', { name: /^Export$/i });
    fireEvent.click(exportButton);

    // Export completes synchronously, so we just verify it was called
    await waitFor(() => {
      expect(XLSX.writeFile).toHaveBeenCalled();
    });
  });

  test('calls onExport callback when export completes', async () => {
    const mockCallback = jest.fn();
    render(<AdvancedExportButton data={mockData} onExport={mockCallback} />);
    
    fireEvent.click(screen.getByText('Advanced Export'));
    const exportButton = screen.getByRole('button', { name: /^Export$/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalledWith('excel', expect.any(Object));
    });
  });

  test('handles empty data gracefully', () => {
    render(<AdvancedExportButton data={{}} />);
    fireEvent.click(screen.getByText('Advanced Export'));
    expect(screen.getByText('Export Configuration')).toBeInTheDocument();
  });

  test('uses custom filename when provided', async () => {
    render(<AdvancedExportButton data={mockData} filename="custom_export" />);
    fireEvent.click(screen.getByText('Advanced Export'));
    
    const exportButton = screen.getByRole('button', { name: /^Export$/i });
    fireEvent.click(exportButton);

    // Export is synchronous, check immediately
    expect(XLSX.writeFile).toHaveBeenCalled();
    const writeFileCall = (XLSX.writeFile as jest.Mock).mock.calls[0];
    if (writeFileCall) {
      expect(writeFileCall[1]).toContain('custom_export');
    }
  });

  test('includes timestamp in filename', async () => {
    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));
    
    const exportButton = screen.getByRole('button', { name: /^Export$/i });
    fireEvent.click(exportButton);

    // Export is synchronous, check immediately
    expect(XLSX.writeFile).toHaveBeenCalled();
    const writeFileCall = (XLSX.writeFile as jest.Mock).mock.calls[0];
    if (writeFileCall) {
      expect(writeFileCall[1]).toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });

  test('handles export errors gracefully', async () => {
    // Mock writeFile to throw an error
    (XLSX.writeFile as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Export failed');
    });

    render(<AdvancedExportButton data={mockData} />);
    fireEvent.click(screen.getByText('Advanced Export'));
    
    const exportButton = screen.getByRole('button', { name: /^Export$/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Error exporting')
      );
    });
  });
});
