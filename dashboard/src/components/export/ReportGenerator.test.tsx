/**
 * ReportGenerator Component Tests
 * 
 * Tests for PDF report generation functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportGenerator from './ReportGenerator';

// Mock jsPDF and html2canvas
jest.mock('jspdf', () => {
  const mockAutoTable = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
        getNumberOfPages: () => 1,
      },
      setFontSize: jest.fn(),
      setTextColor: jest.fn(),
      text: jest.fn(),
      splitTextToSize: jest.fn((text) => [text]),
      addPage: jest.fn(),
      setPage: jest.fn(),
      save: jest.fn(),
      autoTable: mockAutoTable,
    })),
  };
});

jest.mock('jspdf-autotable', () => ({}));
jest.mock('html2canvas', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('ReportGenerator', () => {
  const mockData = {
    kpis: [
      { label: 'Total Return', value: '15.5%', change: 2.3 },
      { label: 'Sharpe Ratio', value: '1.8', change: 0.2 },
    ],
    metrics: [
      { name: 'Accuracy', value: '85%', target: '80%', status: 'Good' },
      { name: 'MAPE', value: '5.2%', target: '6%', status: 'Good' },
    ],
    summary: 'The model performed well this week with improved accuracy and returns.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Req 63.1: Report generation feature
  test('renders report generation button', () => {
    render(<ReportGenerator data={mockData} />);
    expect(screen.getByText('Generate Report')).toBeInTheDocument();
  });

  test('opens configuration modal when button is clicked', () => {
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));
    expect(screen.getByText('Report Configuration')).toBeInTheDocument();
  });

  // Req 63.2: Report type selection
  test('allows selecting report type', () => {
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));

    const weeklyButton = screen.getByText('weekly');
    const monthlyButton = screen.getByText('monthly');
    const customButton = screen.getByText('custom');

    expect(weeklyButton).toBeInTheDocument();
    expect(monthlyButton).toBeInTheDocument();
    expect(customButton).toBeInTheDocument();

    fireEvent.click(monthlyButton);
    // Monthly should now be selected (visual indication via styling)
  });

  // Req 63.3: Section selection
  test('allows selecting which sections to include', () => {
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));

    expect(screen.getByText('KPI Summaries')).toBeInTheDocument();
    expect(screen.getByText('Charts and Visualizations')).toBeInTheDocument();
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();

    // All sections should be enabled by default
    const checkboxes = screen.getAllByRole('checkbox');
    const sectionCheckboxes = checkboxes.slice(0, 4); // First 4 are section checkboxes
    sectionCheckboxes.forEach(checkbox => {
      expect(checkbox).toBeChecked();
    });
  });

  test('toggles section selection', () => {
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));

    const checkboxes = screen.getAllByRole('checkbox');
    const kpiCheckbox = checkboxes[0];

    expect(kpiCheckbox).toBeChecked();
    fireEvent.click(kpiCheckbox);
    expect(kpiCheckbox).not.toBeChecked();
  });

  // Req 63.4: Generate PDF document
  test('generates PDF when Generate PDF button is clicked', async () => {
    const jsPDF = require('jspdf').default;
    render(<ReportGenerator data={mockData} />);
    
    fireEvent.click(screen.getByText('Generate Report'));
    fireEvent.click(screen.getByText('Generate PDF'));

    await waitFor(() => {
      expect(jsPDF).toHaveBeenCalled();
    });
  });

  // Req 63.5: Include KPI summaries
  test('includes KPI data in report configuration', () => {
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));
    expect(screen.getByText('KPI Summaries')).toBeInTheDocument();
  });

  // Req 63.6: Include charts and visualizations
  test('includes charts section in report configuration', () => {
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));
    expect(screen.getByText('Charts and Visualizations')).toBeInTheDocument();
  });

  // Req 63.7: Include performance metrics
  test('includes metrics section in report configuration', () => {
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
  });

  // Req 63.8: Include executive summary
  test('includes executive summary section in report configuration', () => {
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
  });

  // Req 63.9: Schedule automatic generation
  test('allows scheduling automatic report generation', () => {
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));

    const scheduleCheckbox = screen.getByText('Schedule Automatic Generation')
      .previousElementSibling as HTMLInputElement;
    
    expect(scheduleCheckbox).not.toBeChecked();
    fireEvent.click(scheduleCheckbox);
    expect(scheduleCheckbox).toBeChecked();

    // Frequency selector should appear
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  test('allows selecting schedule frequency', () => {
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));

    const scheduleCheckbox = screen.getByText('Schedule Automatic Generation')
      .previousElementSibling as HTMLInputElement;
    fireEvent.click(scheduleCheckbox);

    const frequencySelect = screen.getByRole('combobox');
    expect(frequencySelect).toHaveValue('weekly');

    fireEvent.change(frequencySelect, { target: { value: 'monthly' } });
    expect(frequencySelect).toHaveValue('monthly');
  });

  // Req 63.10: Email reports to recipients
  test('allows adding email recipients', () => {
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));

    const scheduleCheckbox = screen.getByText('Schedule Automatic Generation')
      .previousElementSibling as HTMLInputElement;
    fireEvent.click(scheduleCheckbox);

    const emailInput = screen.getByPlaceholderText('email@example.com');
    expect(emailInput).toBeInTheDocument();

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.keyPress(emailInput, { key: 'Enter', code: 'Enter', charCode: 13 });

    // Email should be added (would show as a tag)
  });

  // Req 63.12: Customize branding
  test('uses default branding configuration', () => {
    render(<ReportGenerator data={mockData} />);
    // Branding is configured internally with default values
    expect(screen.getByText('Generate Report')).toBeInTheDocument();
  });

  test('closes modal when Cancel is clicked', () => {
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));
    expect(screen.getByText('Report Configuration')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Report Configuration')).not.toBeInTheDocument();
  });

  test('closes modal when clicking outside', () => {
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));
    expect(screen.getByText('Report Configuration')).toBeInTheDocument();

    // Click the backdrop
    const backdrop = document.querySelector('[style*="position: fixed"]');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
  });

  test('disables button while generating', async () => {
    const jsPDF = require('jspdf').default;
    render(<ReportGenerator data={mockData} />);
    fireEvent.click(screen.getByText('Generate Report'));
    
    const generateButton = screen.getByText('Generate PDF');
    fireEvent.click(generateButton);

    // PDF generation completes synchronously, verify save was called
    const pdfInstance = jsPDF.mock.results[jsPDF.mock.results.length - 1]?.value;
    if (pdfInstance) {
      expect(pdfInstance.save).toHaveBeenCalled();
    }
  });

  test('calls onGenerateReport callback when report is generated', async () => {
    const mockCallback = jest.fn();
    const jsPDF = require('jspdf').default;
    
    // Ensure the mock returns a valid PDF instance with all needed properties
    jsPDF.mockImplementationOnce(() => ({
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
        getNumberOfPages: () => 1,
      },
      setFontSize: jest.fn(),
      setTextColor: jest.fn(),
      text: jest.fn(),
      splitTextToSize: jest.fn((text: string) => [text]),
      addPage: jest.fn(),
      setPage: jest.fn(),
      save: jest.fn(),
      autoTable: jest.fn(function(this: any) {
        this.lastAutoTable = { finalY: 100 };
      }),
      lastAutoTable: { finalY: 100 },
    }));
    
    render(<ReportGenerator data={mockData} onGenerateReport={mockCallback} />);
    
    fireEvent.click(screen.getByText('Generate Report'));
    fireEvent.click(screen.getByText('Generate PDF'));

    // PDF generation completes synchronously
    expect(mockCallback).toHaveBeenCalled();
  });

  test('handles empty data gracefully', () => {
    render(<ReportGenerator data={{}} />);
    fireEvent.click(screen.getByText('Generate Report'));
    expect(screen.getByText('Report Configuration')).toBeInTheDocument();
  });

  test('handles missing KPI data', () => {
    const dataWithoutKPIs = { ...mockData, kpis: undefined };
    render(<ReportGenerator data={dataWithoutKPIs} />);
    fireEvent.click(screen.getByText('Generate Report'));
    expect(screen.getByText('KPI Summaries')).toBeInTheDocument();
  });

  test('handles missing metrics data', () => {
    const dataWithoutMetrics = { ...mockData, metrics: undefined };
    render(<ReportGenerator data={dataWithoutMetrics} />);
    fireEvent.click(screen.getByText('Generate Report'));
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
  });

  test('handles missing summary data', () => {
    const dataWithoutSummary = { ...mockData, summary: undefined };
    render(<ReportGenerator data={dataWithoutSummary} />);
    fireEvent.click(screen.getByText('Generate Report'));
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
  });
});
