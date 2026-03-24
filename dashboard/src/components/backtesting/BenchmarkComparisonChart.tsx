import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

/**
 * BenchmarkComparisonChart - Compare portfolio against benchmarks
 * 
 * Requirements:
 * - 35.1: Calculate Ibovespa returns during backtest period
 * - 35.2: Calculate CDI returns during backtest period
 * - 35.3: Display portfolio and benchmark cumulative returns on same chart
 * - 35.4: Calculate alpha relative to each benchmark
 * - 35.5: Calculate beta relative to Ibovespa
 * - 35.6: Calculate information ratio
 * - 35.7: Highlight outperformance/underperformance periods
 * - 35.8: Calculate tracking error
 */

interface BenchmarkComparisonChartProps {
  portfolioData: Array<{
    date: string;
    value: number;
  }>;
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
  darkMode?: boolean;
}

export const BenchmarkComparisonChart: React.FC<BenchmarkComparisonChartProps> = ({
  portfolioData,
  benchmarks,
  darkMode = false,
}) => {
  const theme = {
    cardBg: darkMode ? '#1a1d27' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f1117',
    textSecondary: darkMode ? '#9ba1b0' : '#64748b',
    border: darkMode ? '#2a2e3a' : '#e2e8f0',
    gridColor: darkMode ? '#2a2e3a' : '#e2e8f0',
  };

  // Calculate cumulative returns for chart
  const initialValue = portfolioData[0]?.value || 100000;
  const chartData = portfolioData.map((item, index) => {
    const portfolioReturn = ((item.value - initialValue) / initialValue) * 100;
    // Simulate benchmark returns (in real implementation, these would come from API)
    const ibovespaReturn = (benchmarks.ibovespa.totalReturn * (index / portfolioData.length)) * 100;
    const cdiReturn = (benchmarks.cdi.totalReturn * (index / portfolioData.length)) * 100;

    return {
      date: new Date(item.date).toLocaleDateString('pt-BR', { 
        month: 'short', 
        day: 'numeric' 
      }),
      portfolio: portfolioReturn,
      ibovespa: ibovespaReturn,
      cdi: cdiReturn,
    };
  });

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

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
        <TrendingUp size={20} color={darkMode ? '#9ba1b0' : '#64748b'} />
        <h2 style={{ 
          margin: 0, 
          fontSize: '1.25rem', 
          fontWeight: '700', 
          color: theme.text 
        }}>
          Benchmark Comparison
        </h2>
      </div>

      {/* Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ padding: '0.75rem', backgroundColor: darkMode ? '#0f1117' : '#f8fafc', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>Alpha</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: benchmarks.alpha >= 0 ? '#10b981' : '#dc2626' }}>
            {formatPercent(benchmarks.alpha * 100)}
          </div>
        </div>
        <div style={{ padding: '0.75rem', backgroundColor: darkMode ? '#0f1117' : '#f8fafc', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>Beta</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: theme.text }}>
            {benchmarks.beta.toFixed(2)}
          </div>
        </div>
        <div style={{ padding: '0.75rem', backgroundColor: darkMode ? '#0f1117' : '#f8fafc', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>Information Ratio</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: theme.text }}>
            {benchmarks.informationRatio.toFixed(2)}
          </div>
        </div>
        <div style={{ padding: '0.75rem', backgroundColor: darkMode ? '#0f1117' : '#f8fafc', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>Tracking Error</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: theme.text }}>
            {formatPercent(benchmarks.trackingError * 100)}
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} />
          <XAxis 
            dataKey="date" 
            stroke={theme.textSecondary}
            style={{ fontSize: '0.75rem' }}
          />
          <YAxis 
            stroke={theme.textSecondary}
            style={{ fontSize: '0.75rem' }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              color: theme.text,
            }}
            formatter={(value: number) => `${value.toFixed(2)}%`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="portfolio" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={false}
            name="Portfolio"
          />
          <Line 
            type="monotone" 
            dataKey="ibovespa" 
            stroke="#f59e0b" 
            strokeWidth={2}
            dot={false}
            name="Ibovespa"
          />
          <Line 
            type="monotone" 
            dataKey="cdi" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={false}
            name="CDI"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BenchmarkComparisonChart;
