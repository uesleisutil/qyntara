import React, { useState } from 'react';
import { Play, Settings } from 'lucide-react';

/**
 * BacktestConfig - Backtest configuration UI
 * 
 * Requirements:
 * - 33.1: Allow configuration of backtesting parameters
 * - 33.2: Require start date, end date, and initial capital inputs
 * - 33.4: Configure rebalancing intervals (daily, weekly, monthly)
 * - 33.5: Configure transaction costs based on commission rates
 * - 33.9: Configure position sizing (equal, weighted)
 */

interface BacktestConfigProps {
  onRunBacktest: (config: BacktestConfigData) => void;
  loading?: boolean;
  darkMode?: boolean;
}

export interface BacktestConfigData {
  startDate: string;
  endDate: string;
  initialCapital: number;
  positionSize: 'equal' | 'weighted';
  topN: number;
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly';
  commissionRate: number;
}

export const BacktestConfig: React.FC<BacktestConfigProps> = ({
  onRunBacktest,
  loading = false,
  darkMode = false,
}) => {
  const [config, setConfig] = useState<BacktestConfigData>({
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 100000,
    positionSize: 'equal',
    topN: 10,
    rebalanceFrequency: 'monthly',
    commissionRate: 0.0003, // 0.03% default commission
  });

  const theme = {
    cardBg: darkMode ? '#1a1836' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#9895b0' : '#64748b',
    border: darkMode ? '#2a2745' : '#e2e8f0',
    inputBg: darkMode ? '#0c0a1a' : '#f8fafc',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRunBacktest(config);
  };

  const handleChange = (field: keyof BacktestConfigData, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
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
        <Settings size={20} color={darkMode ? '#9895b0' : '#64748b'} />
        <h2 style={{ 
          margin: 0, 
          fontSize: '1.25rem', 
          fontWeight: '700', 
          color: theme.text 
        }}>
          Backtest Configuration
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          {/* Start Date */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: theme.text 
            }}>
              Start Date
            </label>
            <input
              type="date"
              value={config.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                color: theme.text,
                fontSize: '0.875rem',
              }}
            />
          </div>

          {/* End Date */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: theme.text 
            }}>
              End Date
            </label>
            <input
              type="date"
              value={config.endDate}
              onChange={(e) => handleChange('endDate', e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                color: theme.text,
                fontSize: '0.875rem',
              }}
            />
          </div>

          {/* Initial Capital */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: theme.text 
            }}>
              Initial Capital (R$)
            </label>
            <input
              type="number"
              value={config.initialCapital}
              onChange={(e) => handleChange('initialCapital', parseFloat(e.target.value))}
              required
              min="1000"
              step="1000"
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                color: theme.text,
                fontSize: '0.875rem',
              }}
            />
          </div>

          {/* Position Sizing */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: theme.text 
            }}>
              Position Sizing
            </label>
            <select
              value={config.positionSize}
              onChange={(e) => handleChange('positionSize', e.target.value as 'equal' | 'weighted')}
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                color: theme.text,
                fontSize: '0.875rem',
              }}
            >
              <option value="equal">Equal Weight</option>
              <option value="weighted">Score Weighted</option>
            </select>
          </div>

          {/* Top N */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: theme.text 
            }}>
              Top N Stocks
            </label>
            <input
              type="number"
              value={config.topN}
              onChange={(e) => handleChange('topN', parseInt(e.target.value))}
              required
              min="1"
              max="50"
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                color: theme.text,
                fontSize: '0.875rem',
              }}
            />
          </div>

          {/* Rebalancing Frequency */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: theme.text 
            }}>
              Rebalancing Frequency
            </label>
            <select
              value={config.rebalanceFrequency}
              onChange={(e) => handleChange('rebalanceFrequency', e.target.value as 'daily' | 'weekly' | 'monthly')}
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                color: theme.text,
                fontSize: '0.875rem',
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Commission Rate */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: theme.text 
            }}>
              Commission Rate (%)
            </label>
            <input
              type="number"
              value={config.commissionRate * 100}
              onChange={(e) => handleChange('commissionRate', parseFloat(e.target.value) / 100)}
              required
              min="0"
              max="1"
              step="0.01"
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                color: theme.text,
                fontSize: '0.875rem',
              }}
            />
          </div>
        </div>

        {/* Run Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: loading ? '#9895b0' : '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.9375rem',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s',
          }}
        >
          <Play size={18} />
          {loading ? 'Running Backtest...' : 'Run Backtest'}
        </button>
      </form>
    </div>
  );
};

export default BacktestConfig;
