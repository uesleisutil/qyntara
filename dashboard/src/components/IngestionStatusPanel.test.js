import React from 'react';
import { render, screen } from '@testing-library/react';
import IngestionStatusPanel from './IngestionStatusPanel';

describe('IngestionStatusPanel', () => {
  const mockIngestionData = [
    {
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      status: 'success',
      records_ingested: 150,
    },
    {
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
      status: 'success',
      records_ingested: 200,
    },
    {
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      status: 'error',
      records_ingested: 0,
    },
    {
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
      status: 'success',
      records_ingested: 180,
    },
  ];

  it('should render empty state when no data is available', () => {
    render(<IngestionStatusPanel ingestionData={[]} />);
    expect(screen.getByText(/Nenhum dado de ingestão disponível/i)).toBeInTheDocument();
  });

  it('should calculate and display success rate correctly', () => {
    render(<IngestionStatusPanel ingestionData={mockIngestionData} />);
    // 3 successes out of 4 total = 75%
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });

  it('should display total executions count', () => {
    render(<IngestionStatusPanel ingestionData={mockIngestionData} />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Execuções (24h)')).toBeInTheDocument();
  });

  it('should display successful executions count', () => {
    render(<IngestionStatusPanel ingestionData={mockIngestionData} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Sucessos')).toBeInTheDocument();
  });

  it('should display failed executions count', () => {
    render(<IngestionStatusPanel ingestionData={mockIngestionData} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Erros')).toBeInTheDocument();
  });

  it('should display healthy status indicator when success rate >= 90%', () => {
    const healthyData = [
      {
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        status: 'success',
        records_ingested: 100,
      },
      {
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'success',
        records_ingested: 100,
      },
      {
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        status: 'success',
        records_ingested: 100,
      },
      {
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        status: 'success',
        records_ingested: 100,
      },
      {
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        status: 'success',
        records_ingested: 100,
      },
      {
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        status: 'success',
        records_ingested: 100,
      },
      {
        timestamp: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
        status: 'success',
        records_ingested: 100,
      },
      {
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        status: 'success',
        records_ingested: 100,
      },
      {
        timestamp: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
        status: 'success',
        records_ingested: 100,
      },
      {
        timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
        status: 'error',
        records_ingested: 0,
      },
    ];
    render(<IngestionStatusPanel ingestionData={healthyData} />);
    expect(screen.getByText('Saudável')).toBeInTheDocument();
  });

  it('should display warning status indicator when 70% <= success rate < 90%', () => {
    render(<IngestionStatusPanel ingestionData={mockIngestionData} />);
    // 75% success rate
    expect(screen.getByText('Atenção')).toBeInTheDocument();
  });

  it('should display critical status indicator when success rate < 70%', () => {
    const criticalData = [
      {
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        status: 'error',
        records_ingested: 0,
      },
      {
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'error',
        records_ingested: 0,
      },
      {
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        status: 'success',
        records_ingested: 100,
      },
    ];
    render(<IngestionStatusPanel ingestionData={criticalData} />);
    // 1 success out of 3 = 33.3%
    expect(screen.getByText('Crítico')).toBeInTheDocument();
  });

  it('should filter data to last 24 hours only', () => {
    const dataWithOldEntries = [
      ...mockIngestionData,
      {
        timestamp: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), // 30 hours ago
        status: 'success',
        records_ingested: 100,
      },
      {
        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
        status: 'error',
        records_ingested: 0,
      },
    ];
    render(<IngestionStatusPanel ingestionData={dataWithOldEntries} />);
    // Should only count the 4 recent entries, not the old ones
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Execuções (24h)')).toBeInTheDocument();
  });
});
