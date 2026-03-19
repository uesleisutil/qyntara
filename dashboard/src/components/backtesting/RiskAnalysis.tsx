import React from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { AlertTriangle } from 'lucide-react';

/**
 * RiskAnalysis - Analyze portfolio risk metrics
 * 
 * Requirements:
 * - 36.1: Calculate VaR at 95% and 99% confidence levels
 * - 36.2: Calculate CVaR at 95% and 99% confidence levels
 * - 36.3: Display drawdown chart showing decline from peaks
 * - 36.4: Identify worst drawdown with start and end dates
 * - 36.5: Calculate downside deviation
 * - 36.6: Display rolling volatility over time
 * - 36.7: Calculate maximum consecutive losing days
 * - 36.8: Compare risk metrics against benchmarks
 */

interface RiskAnalysisProps {
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
  darkMode?: boolean;
}

export const RiskAnalysis: React.FC<RiskAnalysisProps> = ({
  riskMetrics,
  drawdowns,
  darkMode = false,
}) => {
  const theme = {
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    gridColor: darkMode ? '#334155' : '#e2e8f0',
    tableBg: darkMode ? '#0f172a' : '#f8fafc',
  };

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const worstDrawdown = drawdowns.reduce((worst, current) => 
    current.depth < worst.depth ? current : worst
  , drawdowns[0] || { start: '', end: '', depth: 0, duration: 0 });

  const volatilityData = riskMetrics.rollingVolatility.map(item => ({
    date: new Date(item.date).toLocaleDateString('pt-BR', { 
      month: 'short', 
      day: 'numeric' 
    }),
    volatility: item.volatility * 100,
  }));

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
        <AlertTriangle size={20} color={darkMode ? '#94a3b8' : '#64748b'} />
        <h2 style={{ 
          margin: 0, 
          fontSize: '1.25rem', 
          fontWeight: '700', 
          color: theme.text 
        }}>
          Risk Analysis
        </h2>
      </div>

      {/* Risk Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ padding: '1rem', backgroundColor: theme.tableBg, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, marginBottom: '0.5rem' }}>
            VaR (95%)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
            {formatPercent(riskMetrics.var95)}
          </div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: theme.tableBg, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, marginBottom: '0.5rem' }}>
            VaR (99%)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
            {formatPercent(riskMetrics.var99)}
          </div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: theme.tableBg, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, marginBottom: '0.5rem' }}>
            CVaR (95%)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
            {formatPercent(riskMetrics.cvar95)}
          </div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: theme.tableBg, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, marginBottom: '0.5rem' }}>
            CVaR (99%)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
            {formatPercent(riskMetrics.cvar99)}
          </div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: theme.tableBg, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, marginBottom: '0.5rem' }}>
            Downside Deviation
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: theme.text }}>
            {formatPercent(riskMetrics.downsideDeviation)}
          </div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: theme.tableBg, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, marginBottom: '0.5rem' }}>
            Max Consecutive Losses
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: theme.text }}>
            {riskMetrics.maxConsecutiveLosses} days
          </div>
        </div>
      </div>

      {/* Worst Drawdown */}
      <div style={{
        padding: '1rem',
        backgroundColor: theme.tableBg,
        borderRadius: '8px',
        border: `1px solid ${theme.border}`,
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: '700', color: theme.text }}>
          Worst Drawdown
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>Start Date</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: theme.text }}>
              {new Date(worstDrawdown.start).toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>End Date</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: theme.text }}>
              {new Date(worstDrawdown.end).toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>Depth</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: '#dc2626' }}>
              {formatPercent(worstDrawdown.depth)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>Duration</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: theme.text }}>
              {worstDrawdown.duration} days
            </div>
          </div>
        </div>
      </div>

      {/* Rolling Volatility Chart */}
      <div>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: theme.text }}>
          Rolling Volatility (30-day)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={volatilityData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} />
            <XAxis 
              dataKey="date" 
              stroke={theme.textSecondary}
              style={{ fontSize: '0.75rem' }}
            />
            <YAxis 
              stroke={theme.textSecondary}
              style={{ fontSize: '0.75rem' }}
              tickFormatter={(value) => `${value.toFixed(1)}%`}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: theme.cardBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                color: theme.text,
              }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Volatility']}
            />
            <Area 
              type="monotone" 
              dataKey="volatility" 
              stroke="#f59e0b" 
              fill="#fef3c7"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RiskAnalysis;
