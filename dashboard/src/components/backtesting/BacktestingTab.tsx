import React, { useState } from 'react';
import { BacktestConfig } from './BacktestConfig';
import { PortfolioValueChart } from './PortfolioValueChart';
import { PerformanceMetricsTable } from './PerformanceMetricsTable';
import { BenchmarkComparisonChart } from './BenchmarkComparisonChart';
import { RiskAnalysis } from './RiskAnalysis';
import { WaterfallChart } from './WaterfallChart';
import { SankeyDiagram } from './SankeyDiagram';
import { ScenarioAnalysis } from './ScenarioAnalysis';
import { StressTesting } from './StressTesting';

/**
 * BacktestingTab - Comprehensive backtesting interface
 * 
 * Requirements:
 * - 33.1: Display Backtesting tab
 * - 33.2: Allow configuration of backtesting parameters
 * - 33.8: Display cumulative portfolio value as time series chart
 * - 34.1-34.10: Display comprehensive performance metrics
 * - 35.1-35.8: Compare backtest results against benchmarks
 * - 36.1-36.8: Analyze portfolio risk metrics
 * - 55.1-55.10: Display waterfall chart for return decomposition
 * - 56.1-56.10: Display Sankey diagram for sector flows
 * - 61.1-61.10: Provide scenario analysis tools
 * - 62.1-62.10: Provide stress testing tools
 */

interface BacktestResult {
  config: {
    startDate: string;
    endDate: string;
    initialCapital: number;
    positionSize: 'equal' | 'weighted';
    topN: number;
    rebalanceFrequency: 'daily' | 'weekly' | 'monthly';
    commissionRate: number;
  };
  portfolioValue: Array<{
    date: string;
    value: number;
    positions: Array<{
      ticker: string;
      shares: number;
      value: number;
      weight: number;
    }>;
  }>;
  metrics: {
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    averageDrawdownDuration: number;
    winRate: number;
    averageGain: number;
    averageLoss: number;
    turnoverRate: number;
  };
  benchmarks: {
    ibovespa: {
      totalReturn: number;
      annualizedReturn: number;
      volatility: number;
      sharpeRatio: number;
      maxDrawdown: number;
    };
    cdi: {
      totalReturn: number;
      annualizedReturn: number;
    };
    alpha: number;
    beta: number;
    informationRatio: number;
    trackingError: number;
  };
  riskMetrics: {
    var95: number;
    var99: number;
    cvar95: number;
    cvar99: number;
    maxConsecutiveLosses: number;
    downsideDeviation: number;
    rollingVolatility: Array<{ date: string; volatility: number }>;
  };
  drawdowns: Array<{
    start: string;
    end: string;
    depth: number;
    duration: number;
  }>;
  returnDecomposition: Array<{
    ticker: string;
    contribution: number;
  }>;
  sectorFlows: Array<{
    from: string;
    to: string;
    amount: number;
  }>;
}

interface BacktestingTabProps {
  darkMode?: boolean;
}

export const BacktestingTab: React.FC<BacktestingTabProps> = ({ darkMode = false }) => {
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };

  const handleRunBacktest = async (config: any) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/backtesting/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to run backtest');
      }

      const result = await response.json();
      setBacktestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ 
          margin: '0 0 0.5rem 0', 
          fontSize: '1.75rem', 
          fontWeight: '700', 
          color: theme.text 
        }}>
          Backtesting
        </h1>
        <p style={{ 
          margin: 0, 
          color: theme.textSecondary, 
          fontSize: '0.875rem' 
        }}>
          Simulate portfolio performance using historical recommendations
        </p>
      </div>

      {/* Configuration Panel */}
      <div style={{ marginBottom: '2rem' }}>
        <BacktestConfig 
          onRunBacktest={handleRunBacktest} 
          loading={loading}
          darkMode={darkMode}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '2rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#991b1b',
        }}>
          {error}
        </div>
      )}

      {/* Results Display */}
      {backtestResult && (
        <>
          {/* Portfolio Value Chart */}
          <div style={{ marginBottom: '2rem' }}>
            <PortfolioValueChart 
              data={backtestResult.portfolioValue}
              darkMode={darkMode}
            />
          </div>

          {/* Performance Metrics */}
          <div style={{ marginBottom: '2rem' }}>
            <PerformanceMetricsTable 
              metrics={backtestResult.metrics}
              darkMode={darkMode}
            />
          </div>

          {/* Benchmark Comparison */}
          <div style={{ marginBottom: '2rem' }}>
            <BenchmarkComparisonChart 
              portfolioData={backtestResult.portfolioValue}
              benchmarks={backtestResult.benchmarks}
              darkMode={darkMode}
            />
          </div>

          {/* Risk Analysis */}
          <div style={{ marginBottom: '2rem' }}>
            <RiskAnalysis 
              riskMetrics={backtestResult.riskMetrics}
              drawdowns={backtestResult.drawdowns}
              darkMode={darkMode}
            />
          </div>

          {/* Waterfall Chart */}
          <div style={{ marginBottom: '2rem' }}>
            <WaterfallChart 
              returnDecomposition={backtestResult.returnDecomposition}
              initialValue={backtestResult.config.initialCapital}
              finalValue={backtestResult.portfolioValue[backtestResult.portfolioValue.length - 1].value}
              darkMode={darkMode}
            />
          </div>

          {/* Sankey Diagram */}
          <div style={{ marginBottom: '2rem' }}>
            <SankeyDiagram 
              sectorFlows={backtestResult.sectorFlows}
              portfolioData={backtestResult.portfolioValue}
              darkMode={darkMode}
            />
          </div>

          {/* Scenario Analysis */}
          <div style={{ marginBottom: '2rem' }}>
            <ScenarioAnalysis 
              baselineResult={backtestResult}
              darkMode={darkMode}
            />
          </div>

          {/* Stress Testing */}
          <div style={{ marginBottom: '2rem' }}>
            <StressTesting 
              portfolioData={backtestResult.portfolioValue}
              darkMode={darkMode}
            />
          </div>
        </>
      )}

      {/* Empty State */}
      {!backtestResult && !loading && !error && (
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          backgroundColor: theme.cardBg,
          borderRadius: '12px',
          border: `1px solid ${theme.border}`,
        }}>
          <p style={{ 
            margin: 0, 
            color: theme.textSecondary, 
            fontSize: '0.9375rem' 
          }}>
            Configure and run a backtest to see results
          </p>
        </div>
      )}
    </div>
  );
};

export default BacktestingTab;
