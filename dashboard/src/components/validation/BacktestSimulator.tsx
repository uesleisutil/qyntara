import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Card } from './Card';

interface BacktestConfig {
  startDate: string;
  endDate: string;
  initialCapital: number;
  topN: number;
  positionSize: 'equal' | 'weighted';
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly';
  commissionRate: number;
}

interface PortfolioValue {
  date: string;
  value: number;
  returns: number;
  positions: Position[];
}

interface Position {
  ticker: string;
  shares: number;
  value: number;
  weight: number;
}

interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  recoveryTime: number;
  winRate: number;
  averageGain: number;
  averageLoss: number;
}

interface BenchmarkMetrics {
  ibovespa: PerformanceMetrics;
  cdi: PerformanceMetrics;
}

interface BacktestResult {
  portfolioValues: PortfolioValue[];
  metrics: PerformanceMetrics;
  benchmarks: BenchmarkMetrics;
}

interface BacktestSimulatorProps {
  onRunBacktest: (config: BacktestConfig) => Promise<BacktestResult>;
  loading?: boolean;
  error?: Error;
}

/**
 * BacktestSimulator - Portfolio backtesting simulation interface
 * 
 * Requirements:
 * - 15.1: Provide backtesting simulation interface on Validation tab
 * - 15.2: Require start date, end date, and initial capital inputs
 * - 15.3: Simulate portfolio construction using top N recommendations
 * - 15.4: Calculate portfolio returns based on actual historical returns
 * - 15.5: Display cumulative portfolio value over time
 * - 15.6: Calculate total return, annualized return, and volatility
 * - 15.7: Calculate maximum drawdown and recovery time
 * - 15.8: Display portfolio composition changes over time
 * - 15.9: Allow configuration of portfolio parameters (position size, rebalancing frequency)
 * - 15.10: Compare backtesting results against benchmark strategies
 */
export const BacktestSimulator: React.FC<BacktestSimulatorProps> = ({
  onRunBacktest,
  loading = false,
  error,
}) => {
  const [config, setConfig] = useState<BacktestConfig>({
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 100000,
    topN: 10,
    positionSize: 'equal',
    rebalanceFrequency: 'monthly',
    commissionRate: 0.001,
  });

  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showComposition, setShowComposition] = useState(false);

  const handleRunBacktest = async () => {
    setIsRunning(true);
    try {
      const backtestResult = await onRunBacktest(config);
      setResult(backtestResult);
    } catch (err) {
      console.error('Backtest failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  // Calculate drawdown data
  const drawdownData = useMemo(() => {
    if (!result) return [];

    let peak = result.portfolioValues[0]?.value || 0;
    return result.portfolioValues.map((pv) => {
      if (pv.value > peak) peak = pv.value;
      const drawdown = ((pv.value - peak) / peak) * 100;
      return {
        date: pv.date,
        drawdown,
      };
    });
  }, [result]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  // Custom tooltip for portfolio value chart
  const PortfolioTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#1f2937' }}>
            {new Date(data.date).toLocaleDateString()}
          </p>
          <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#10b981' }}>
            Portfolio: {formatCurrency(data.value)}
          </p>
          <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Return: {formatPercent(data.returns)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Configuration Panel */}
      <Card>
        <div style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600' }}>
            Backtest Configuration
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* Start Date */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}
              >
                Start Date
              </label>
              <input
                type="date"
                value={config.startDate}
                onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
              />
            </div>

            {/* End Date */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}
              >
                End Date
              </label>
              <input
                type="date"
                value={config.endDate}
                onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
              />
            </div>

            {/* Initial Capital */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}
              >
                Initial Capital (R$)
              </label>
              <input
                type="number"
                value={config.initialCapital}
                onChange={(e) =>
                  setConfig({ ...config, initialCapital: parseFloat(e.target.value) })
                }
                min="1000"
                step="1000"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
              />
            </div>

            {/* Top N */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}
              >
                Top N Stocks
              </label>
              <input
                type="number"
                value={config.topN}
                onChange={(e) => setConfig({ ...config, topN: parseInt(e.target.value) })}
                min="1"
                max="50"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
              />
            </div>

            {/* Position Size */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}
              >
                Position Sizing
              </label>
              <select
                value={config.positionSize}
                onChange={(e) =>
                  setConfig({ ...config, positionSize: e.target.value as 'equal' | 'weighted' })
                }
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                }}
              >
                <option value="equal">Equal Weight</option>
                <option value="weighted">Score Weighted</option>
              </select>
            </div>

            {/* Rebalance Frequency */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}
              >
                Rebalance Frequency
              </label>
              <select
                value={config.rebalanceFrequency}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    rebalanceFrequency: e.target.value as 'daily' | 'weekly' | 'monthly',
                  })
                }
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Commission Rate */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                }}
              >
                Commission Rate (%)
              </label>
              <input
                type="number"
                value={config.commissionRate * 100}
                onChange={(e) =>
                  setConfig({ ...config, commissionRate: parseFloat(e.target.value) / 100 })
                }
                min="0"
                max="5"
                step="0.01"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
              />
            </div>
          </div>

          <button
            onClick={handleRunBacktest}
            disabled={isRunning || loading}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 2rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: isRunning || loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              cursor: isRunning || loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isRunning || loading ? 'Running Backtest...' : 'Run Backtest'}
          </button>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card>
          <div style={{ padding: '1.5rem', color: '#dc2626', textAlign: 'center' }}>
            <p>Error: {error.message}</p>
          </div>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Performance Metrics */}
          <Card>
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600' }}>
                Performance Metrics
              </h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Total Return
                  </div>
                  <div
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: result.metrics.totalReturn >= 0 ? '#10b981' : '#dc2626',
                    }}
                  >
                    {formatPercent(result.metrics.totalReturn)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Annualized Return
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>
                    {formatPercent(result.metrics.annualizedReturn)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Volatility
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>
                    {formatPercent(result.metrics.volatility)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Sharpe Ratio
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>
                    {result.metrics.sharpeRatio.toFixed(2)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Max Drawdown
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>
                    {formatPercent(result.metrics.maxDrawdown)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Win Rate
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>
                    {formatPercent(result.metrics.winRate)}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Portfolio Value Chart */}
          <Card>
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600' }}>
                Cumulative Portfolio Value
              </h3>

              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={result.portfolioValues}
                  margin={{ top: 20, right: 30, bottom: 20, left: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: '0.75rem', fill: '#6b7280' }}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })
                    }
                  />
                  <YAxis
                    tick={{ fontSize: '0.75rem', fill: '#6b7280' }}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip content={<PortfolioTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.875rem' }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Portfolio Value"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Drawdown Chart */}
          <Card>
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600' }}>
                Drawdown Analysis
              </h3>

              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={drawdownData}
                  margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: '0.75rem', fill: '#6b7280' }}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })
                    }
                  />
                  <YAxis
                    tick={{ fontSize: '0.75rem', fill: '#6b7280' }}
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                  />
                  <Tooltip
                    formatter={(value: any) => `${value.toFixed(2)}%`}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="drawdown"
                    name="Drawdown"
                    stroke="#dc2626"
                    fill="#fecaca"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Portfolio Composition */}
          <Card>
            <div style={{ padding: '1.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                  Portfolio Composition
                </h3>
                <button
                  onClick={() => setShowComposition(!showComposition)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    color: '#6b7280',
                    cursor: 'pointer',
                  }}
                >
                  {showComposition ? 'Hide' : 'Show'} Details
                </button>
              </div>

              {showComposition && result.portfolioValues.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.875rem',
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        <th
                          style={{
                            padding: '0.75rem',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#374151',
                          }}
                        >
                          Ticker
                        </th>
                        <th
                          style={{
                            padding: '0.75rem',
                            textAlign: 'right',
                            fontWeight: '600',
                            color: '#374151',
                          }}
                        >
                          Weight
                        </th>
                        <th
                          style={{
                            padding: '0.75rem',
                            textAlign: 'right',
                            fontWeight: '600',
                            color: '#374151',
                          }}
                        >
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.portfolioValues[result.portfolioValues.length - 1].positions.map(
                        (position, index) => (
                          <tr
                            key={index}
                            style={{ borderBottom: '1px solid #e5e7eb' }}
                          >
                            <td style={{ padding: '0.75rem', fontWeight: '500', color: '#1f2937' }}>
                              {position.ticker}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>
                              {formatPercent(position.weight)}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>
                              {formatCurrency(position.value)}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default BacktestSimulator;
