/**
 * Export Components Demo
 * 
 * Example usage of ReportGenerator and AdvancedExportButton components
 */

import React from 'react';
import ReportGenerator from './ReportGenerator';
import AdvancedExportButton from './AdvancedExportButton';

// Sample data for demonstration
const sampleData = {
  kpis: [
    { label: 'Total Return', value: '15.5%', change: 2.3 },
    { label: 'Sharpe Ratio', value: '1.8', change: 0.2 },
    { label: 'Win Rate', value: '68%', change: -1.5 },
    { label: 'Max Drawdown', value: '-8.2%', change: 0.8 },
  ],
  metrics: [
    { name: 'Accuracy', value: '85%', target: '80%', status: 'Good' },
    { name: 'MAPE', value: '5.2%', target: '6%', status: 'Good' },
    { name: 'Correlation', value: '0.78', target: '0.70', status: 'Good' },
    { name: 'Coverage', value: '95%', target: '90%', status: 'Good' },
  ],
  summary: `
    The model demonstrated strong performance this period with improved accuracy 
    and returns. Key highlights include a 15.5% total return, exceeding our target 
    by 2.3 percentage points. The Sharpe ratio of 1.8 indicates excellent 
    risk-adjusted returns. Model accuracy reached 85%, surpassing the 80% target, 
    while MAPE remained low at 5.2%. Overall, the system continues to deliver 
    reliable predictions and profitable recommendations.
  `,
  raw: [
    { ticker: 'PETR4', score: 85, expectedReturn: 12.5, sector: 'Energy', rank: 1 },
    { ticker: 'VALE3', score: 78, expectedReturn: 8.3, sector: 'Materials', rank: 2 },
    { ticker: 'ITUB4', score: 72, expectedReturn: 6.8, sector: 'Financials', rank: 3 },
    { ticker: 'BBDC4', score: 68, expectedReturn: 5.2, sector: 'Financials', rank: 4 },
    { ticker: 'ABEV3', score: 65, expectedReturn: 4.1, sector: 'Consumer Staples', rank: 5 },
  ],
  charts: [],
};

const ExportDemo: React.FC = () => {
  const handleReportGenerated = (config: any) => {
    console.log('Report generated with configuration:', config);
    // In a real application, you might:
    // - Send analytics event
    // - Save report metadata to database
    // - Trigger backend scheduling if enabled
  };

  const handleExport = (format: string, config: any) => {
    console.log(`Data exported to ${format} with configuration:`, config);
    // In a real application, you might:
    // - Send analytics event
    // - Log export activity
    // - Trigger backend processing for Google Sheets
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>Export and Reporting Demo</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        This page demonstrates the export and reporting components with sample data.
      </p>

      {/* Export Controls */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          padding: '1rem',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
        }}
      >
        <ReportGenerator
          data={{
            kpis: sampleData.kpis,
            metrics: sampleData.metrics,
            summary: sampleData.summary,
          }}
          onGenerateReport={handleReportGenerated}
        />

        <AdvancedExportButton
          data={{
            raw: sampleData.raw,
            metrics: sampleData.metrics,
            summary: sampleData.kpis,
          }}
          filename="dashboard_demo"
          onExport={handleExport}
        />
      </div>

      {/* Sample Data Display */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Sample KPIs</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {sampleData.kpis.map((kpi, idx) => (
            <div
              key={idx}
              style={{
                padding: '1rem',
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                {kpi.value}
              </div>
              <div
                style={{
                  fontSize: '0.875rem',
                  color: kpi.change > 0 ? '#10b981' : '#ef4444',
                }}
              >
                {kpi.change > 0 ? '+' : ''}{kpi.change}%
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Sample Metrics</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                Metric
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                Current
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                Target
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sampleData.metrics.map((metric, idx) => (
              <tr key={idx}>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                  {metric.name}
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                  {metric.value}
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                  {metric.target}
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                  <span
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#d1fae5',
                      color: '#065f46',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                    }}
                  >
                    {metric.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 style={{ marginBottom: '1rem' }}>Sample Recommendations</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                Rank
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                Ticker
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                Score
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                Expected Return
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                Sector
              </th>
            </tr>
          </thead>
          <tbody>
            {sampleData.raw.map((rec, idx) => (
              <tr key={idx}>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                  {rec.rank}
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                  {rec.ticker}
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                  {rec.score}
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                  {rec.expectedReturn}%
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                  {rec.sector}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Usage Instructions */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '6px',
        }}
      >
        <h3 style={{ marginBottom: '0.5rem' }}>Usage Instructions</h3>
        <ul style={{ marginLeft: '1.5rem', color: '#1e40af' }}>
          <li>Click "Generate Report" to create a PDF with the data above</li>
          <li>Click "Advanced Export" to export data to Excel or Google Sheets</li>
          <li>Configure report sections, scheduling, and recipients in the modal</li>
          <li>Select which data sheets to include in exports</li>
          <li>Enable formula preservation and formatting options</li>
        </ul>
      </div>
    </div>
  );
};

export default ExportDemo;
