import React from 'react';
import {
  ScatterPlotChart,
  TemporalAccuracyChart,
  SegmentationChart,
  OutlierTable,
  BacktestSimulator,
} from './index';

/**
 * ValidationPage - Example page demonstrating all validation components
 * 
 * This is a reference implementation showing how to integrate all 5 validation
 * components together. In a real application, you would:
 * 1. Fetch data from your API
 * 2. Handle loading and error states
 * 3. Integrate with your routing system
 * 4. Add proper authentication
 */
export const ValidationPage: React.FC = () => {
  // Mock data for demonstration
  const mockScatterData = [
    { ticker: 'PETR4', date: '2024-01-01', predicted: 5.2, actual: 4.8, error: 0.4 },
    { ticker: 'VALE3', date: '2024-01-01', predicted: -2.1, actual: -1.5, error: -0.6 },
    { ticker: 'ITUB4', date: '2024-01-01', predicted: 3.0, actual: 3.5, error: -0.5 },
    { ticker: 'BBDC4', date: '2024-01-02', predicted: 2.5, actual: 2.8, error: -0.3 },
    { ticker: 'ABEV3', date: '2024-01-02', predicted: 1.2, actual: 0.9, error: 0.3 },
  ];

  const mockTemporalData = [
    { date: '2024-01-01', accuracy: 0.65, mape: 0.15, correlation: 0.72 },
    { date: '2024-01-08', accuracy: 0.68, mape: 0.14, correlation: 0.75 },
    { date: '2024-01-15', accuracy: 0.62, mape: 0.18, correlation: 0.68 },
    { date: '2024-01-22', accuracy: 0.70, mape: 0.12, correlation: 0.78 },
    { date: '2024-01-29', accuracy: 0.67, mape: 0.16, correlation: 0.73 },
  ];

  const mockSegmentData = [
    {
      range: 'Large Negative (<-5%)',
      accuracy: 0.45,
      mape: 0.25,
      count: 15,
      minReturn: -15,
      maxReturn: -5,
    },
    {
      range: 'Small Negative (-5% to 0%)',
      accuracy: 0.62,
      mape: 0.18,
      count: 45,
      minReturn: -5,
      maxReturn: 0,
    },
    {
      range: 'Neutral (0% to 2%)',
      accuracy: 0.70,
      mape: 0.12,
      count: 80,
      minReturn: 0,
      maxReturn: 2,
    },
    {
      range: 'Small Positive (2% to 5%)',
      accuracy: 0.65,
      mape: 0.15,
      count: 50,
      minReturn: 2,
      maxReturn: 5,
    },
    {
      range: 'Large Positive (>5%)',
      accuracy: 0.48,
      mape: 0.22,
      count: 20,
      minReturn: 5,
      maxReturn: 20,
    },
  ];

  const mockOutlierData = [
    {
      ticker: 'PETR4',
      date: '2024-01-15',
      predicted: 8.5,
      actual: 2.1,
      error: 6.4,
      errorPercentage: 75.3,
      sector: 'Energy',
    },
    {
      ticker: 'VALE3',
      date: '2024-01-20',
      predicted: -3.2,
      actual: 4.5,
      error: -7.7,
      errorPercentage: 240.6,
      sector: 'Materials',
    },
  ];

  const handleRunBacktest = async (_config: any) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Return mock backtest results
    return {
      portfolioValues: [
        {
          date: '2024-01-01',
          value: 100000,
          returns: 0,
          positions: [
            { ticker: 'PETR4', shares: 100, value: 10000, weight: 0.1 },
            { ticker: 'VALE3', shares: 200, value: 10000, weight: 0.1 },
          ],
        },
        {
          date: '2024-02-01',
          value: 105000,
          returns: 0.05,
          positions: [
            { ticker: 'PETR4', shares: 100, value: 10500, weight: 0.1 },
            { ticker: 'VALE3', shares: 200, value: 10500, weight: 0.1 },
          ],
        },
        {
          date: '2024-03-01',
          value: 108000,
          returns: 0.08,
          positions: [
            { ticker: 'PETR4', shares: 100, value: 10800, weight: 0.1 },
            { ticker: 'VALE3', shares: 200, value: 10800, weight: 0.1 },
          ],
        },
      ],
      metrics: {
        totalReturn: 0.08,
        annualizedReturn: 0.32,
        volatility: 0.15,
        sharpeRatio: 1.8,
        maxDrawdown: -0.05,
        recoveryTime: 15,
        winRate: 0.65,
        averageGain: 0.025,
        averageLoss: -0.015,
      },
      benchmarks: {
        ibovespa: {
          totalReturn: 0.06,
          annualizedReturn: 0.24,
          volatility: 0.18,
          sharpeRatio: 1.2,
          maxDrawdown: -0.08,
          recoveryTime: 20,
          winRate: 0.58,
          averageGain: 0.02,
          averageLoss: -0.018,
        },
        cdi: {
          totalReturn: 0.04,
          annualizedReturn: 0.16,
          volatility: 0.02,
          sharpeRatio: 0.8,
          maxDrawdown: 0,
          recoveryTime: 0,
          winRate: 1.0,
          averageGain: 0.013,
          averageLoss: 0,
        },
      },
    };
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
        Validation Analysis
      </h1>

      {/* Scatter Plot */}
      <div style={{ marginBottom: '2rem' }}>
        <ScatterPlotChart data={mockScatterData} />
      </div>

      {/* Temporal Accuracy */}
      <div style={{ marginBottom: '2rem' }}>
        <TemporalAccuracyChart data={mockTemporalData} />
      </div>

      {/* Segmentation */}
      <div style={{ marginBottom: '2rem' }}>
        <SegmentationChart
          data={mockSegmentData}
          onCustomRanges={(ranges) => {
            console.log('Custom ranges:', ranges);
            // In a real app, you would refetch data with new ranges
          }}
        />
      </div>

      {/* Outlier Table */}
      <div style={{ marginBottom: '2rem' }}>
        <OutlierTable
          data={mockOutlierData}
          onOutlierClick={(outlier) => {
            console.log('Outlier clicked:', outlier);
            // In a real app, you would show a detail modal
          }}
        />
      </div>

      {/* Backtest Simulator */}
      <div style={{ marginBottom: '2rem' }}>
        <BacktestSimulator onRunBacktest={handleRunBacktest} />
      </div>
    </div>
  );
};

export default ValidationPage;
