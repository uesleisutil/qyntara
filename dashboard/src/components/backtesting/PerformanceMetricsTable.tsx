import React from 'react';
import { BarChart3 } from 'lucide-react';

/**
 * PerformanceMetricsTable - Display comprehensive performance metrics
 * 
 * Requirements:
 * - 34.1: Calculate total return
 * - 34.2: Calculate annualized return
 * - 34.3: Calculate annualized volatility
 * - 34.4: Calculate Sharpe ratio
 * - 34.5: Calculate Sortino ratio
 * - 34.6: Calculate maximum drawdown
 * - 34.7: Calculate average drawdown duration
 * - 34.8: Calculate win rate
 * - 34.9: Calculate average gain and average loss
 * - 34.10: Display all metrics in summary table
 */

interface PerformanceMetricsTableProps {
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
  darkMode?: boolean;
}

export const PerformanceMetricsTable: React.FC<PerformanceMetricsTableProps> = ({
  metrics,
  darkMode = false,
}) => {
  const theme = {
    cardBg: darkMode ? '#1a2626' : 'white',
    text: darkMode ? '#e8f0ed' : '#121a1a',
    textSecondary: darkMode ? '#8fa89c' : '#5a7268',
    border: darkMode ? '#2a3d36' : '#d4e5dc',
    tableBg: darkMode ? '#121a1a' : '#f6faf8',
  };

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 2) => {
    return value.toFixed(decimals);
  };

  const metricsData = [
    { label: 'Total Return', value: formatPercent(metrics.totalReturn), tooltip: 'Total portfolio return over the period' },
    { label: 'Annualized Return', value: formatPercent(metrics.annualizedReturn), tooltip: 'Return annualized for comparison' },
    { label: 'Volatility (Annual)', value: formatPercent(metrics.volatility), tooltip: 'Standard deviation of returns' },
    { label: 'Sharpe Ratio', value: formatNumber(metrics.sharpeRatio), tooltip: 'Risk-adjusted return metric' },
    { label: 'Sortino Ratio', value: formatNumber(metrics.sortinoRatio), tooltip: 'Downside risk-adjusted return' },
    { label: 'Maximum Drawdown', value: formatPercent(metrics.maxDrawdown), tooltip: 'Largest peak-to-trough decline' },
    { label: 'Avg Drawdown Duration', value: `${formatNumber(metrics.averageDrawdownDuration, 0)} days`, tooltip: 'Average time to recover from drawdowns' },
    { label: 'Win Rate', value: formatPercent(metrics.winRate), tooltip: 'Percentage of profitable periods' },
    { label: 'Average Gain', value: formatPercent(metrics.averageGain), tooltip: 'Average return on winning periods' },
    { label: 'Average Loss', value: formatPercent(metrics.averageLoss), tooltip: 'Average return on losing periods' },
    { label: 'Turnover Rate', value: formatPercent(metrics.turnoverRate), tooltip: 'Portfolio turnover rate' },
  ];

  return (
    <div style={{
      backgroundColor: theme.cardBg,
      borderRadius: '12px',
      padding: '1.5rem',
      border: `1px solid ${theme.border}`,
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem', 
        marginBottom: '1.5rem' 
      }}>
        <BarChart3 size={20} color={darkMode ? '#8fa89c' : '#5a7268'} />
        <h2 style={{ 
          margin: 0, 
          fontSize: '1.25rem', 
          fontWeight: '700', 
          color: theme.text 
        }}>
          Performance Metrics
        </h2>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
      }}>
        {metricsData.map((metric, index) => (
          <div
            key={index}
            style={{
              padding: '1rem',
              backgroundColor: theme.tableBg,
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
            }}
            title={metric.tooltip}
          >
            <div style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: theme.textSecondary,
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {metric.label}
            </div>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: theme.text,
            }}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PerformanceMetricsTable;
