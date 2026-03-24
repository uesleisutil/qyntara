import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

/**
 * PortfolioValueChart - Display cumulative portfolio value over time
 * 
 * Requirements:
 * - 33.8: Display cumulative portfolio value as time series chart
 * - 33.6: Track portfolio composition changes over time
 */

interface PortfolioValueChartProps {
  data: Array<{
    date: string;
    value: number;
    positions: Array<{
      ticker: string;
      shares: number;
      value: number;
      weight: number;
    }>;
  }>;
  darkMode?: boolean;
}

export const PortfolioValueChart: React.FC<PortfolioValueChartProps> = ({
  data,
  darkMode = false,
}) => {
  const theme = {
    cardBg: darkMode ? '#1a1d27' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f1117',
    textSecondary: darkMode ? '#9ba1b0' : '#64748b',
    border: darkMode ? '#2a2e3a' : '#e2e8f0',
    gridColor: darkMode ? '#2a2e3a' : '#e2e8f0',
  };

  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('pt-BR', { 
      month: 'short', 
      day: 'numeric' 
    }),
    value: item.value,
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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
          Portfolio Value Over Time
        </h2>
      </div>

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
            tickFormatter={formatCurrency}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              color: theme.text,
            }}
            formatter={(value: number) => [formatCurrency(value), 'Portfolio Value']}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={false}
            name="Portfolio Value"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PortfolioValueChart;
