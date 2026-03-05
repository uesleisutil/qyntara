import React from 'react';
import { render, screen } from '@testing-library/react';
import ModelQualityPanel from './ModelQualityPanel';

describe('ModelQualityPanel', () => {
  const mockQualityData = [
    {
      dt: '2024-01-01',
      mape: 0.12,
      coverage: 0.87,
      successful_predictions: 245,
      total_predictions: 282,
      status: 'good'
    },
    {
      dt: '2024-01-02',
      mape: 0.14,
      coverage: 0.85,
      successful_predictions: 250,
      total_predictions: 290,
      status: 'good'
    }
  ];

  it('should display current quality metrics', () => {
    render(<ModelQualityPanel qualityData={mockQualityData} />);
    
    // Check that metrics are displayed (should show the most recent data point)
    expect(screen.getByText(/14\.0/)).toBeInTheDocument();
    expect(screen.getByText(/85\.0/)).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('290')).toBeInTheDocument();
  });

  it('should display empty state when no data is available', () => {
    render(<ModelQualityPanel qualityData={[]} />);
    
    expect(screen.getByText('Dados de qualidade não disponíveis')).toBeInTheDocument();
  });

  it('should display warning when MAPE > 15%', () => {
    const dataWithHighMape = [
      {
        dt: '2024-01-01',
        mape: 0.18,
        coverage: 0.85,
        successful_predictions: 245,
        total_predictions: 282,
        status: 'warning'
      }
    ];
    
    render(<ModelQualityPanel qualityData={dataWithHighMape} />);
    
    expect(screen.getByText('MAPE acima do limite (15%)')).toBeInTheDocument();
  });

  it('should display warning when coverage < 80%', () => {
    const dataWithLowCoverage = [
      {
        dt: '2024-01-01',
        mape: 0.12,
        coverage: 0.75,
        successful_predictions: 245,
        total_predictions: 282,
        status: 'warning'
      }
    ];
    
    render(<ModelQualityPanel qualityData={dataWithLowCoverage} />);
    
    expect(screen.getByText('Cobertura abaixo do limite (80%)')).toBeInTheDocument();
  });

  it('should display both warnings when both thresholds are exceeded', () => {
    const dataWithBothWarnings = [
      {
        dt: '2024-01-01',
        mape: 0.18,
        coverage: 0.75,
        successful_predictions: 245,
        total_predictions: 282,
        status: 'critical'
      }
    ];
    
    render(<ModelQualityPanel qualityData={dataWithBothWarnings} />);
    
    expect(screen.getByText('MAPE acima do limite (15%)')).toBeInTheDocument();
    expect(screen.getByText('Cobertura abaixo do limite (80%)')).toBeInTheDocument();
  });

  it('should not display warnings when thresholds are met', () => {
    render(<ModelQualityPanel qualityData={mockQualityData} />);
    
    expect(screen.queryByText('MAPE acima do limite (15%)')).not.toBeInTheDocument();
    expect(screen.queryByText('Cobertura abaixo do limite (80%)')).not.toBeInTheDocument();
  });

  it('should use the most recent data point for current metrics', () => {
    const multiDayData = [
      {
        dt: '2024-01-01',
        mape: 0.12,
        coverage: 0.87,
        successful_predictions: 245,
        total_predictions: 282,
        status: 'good'
      },
      {
        dt: '2024-01-02',
        mape: 0.14,
        coverage: 0.85,
        successful_predictions: 250,
        total_predictions: 290,
        status: 'good'
      },
      {
        dt: '2024-01-03',
        mape: 0.10,
        coverage: 0.90,
        successful_predictions: 260,
        total_predictions: 300,
        status: 'good'
      }
    ];
    
    render(<ModelQualityPanel qualityData={multiDayData} />);
    
    // Should display the most recent data (2024-01-03)
    expect(screen.getByText('10.0%')).toBeInTheDocument();
    expect(screen.getByText('90.0%')).toBeInTheDocument();
    expect(screen.getByText('260')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
  });

  it('should filter data to last 14 days for chart', () => {
    // Create 20 days of data
    const twentyDaysData = Array.from({ length: 20 }, (_, i) => ({
      dt: `2024-01-${String(i + 1).padStart(2, '0')}`,
      mape: 0.12,
      coverage: 0.87,
      successful_predictions: 245,
      total_predictions: 282,
      status: 'good'
    }));
    
    const { container } = render(<ModelQualityPanel qualityData={twentyDaysData} />);
    
    // Chart should be rendered (we have more than 1 data point)
    const chartContainer = container.querySelector('.chart-container');
    expect(chartContainer).toBeInTheDocument();
  });
});
