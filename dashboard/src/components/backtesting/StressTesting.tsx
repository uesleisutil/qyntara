import React, { useState } from 'react';
import { AlertTriangle, Play } from 'lucide-react';

/**
 * StressTesting - Portfolio stress testing tool
 * 
 * Requirements:
 * - 62.1: Provide stress testing tools on Backtesting tab
 * - 62.2: Include predefined stress scenarios
 * - 62.3: Allow custom stress scenario definition
 * - 62.4: Apply scenario shocks to portfolio positions
 * - 62.5: Calculate portfolio value under stress
 * - 62.6: Calculate maximum loss under each scenario
 * - 62.7: Identify positions contributing most to stress losses
 * - 62.8: Display stress test results in summary table
 * - 62.9: Compare results across portfolio configurations
 * - 62.10: Recommend portfolio adjustments for resilience
 */

interface StressTestingProps {
  portfolioData: Array<{
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

interface StressScenario {
  id: string;
  name: string;
  description: string;
  marketShock: number;
  sectorShocks: Record<string, number>;
  volatilityMultiplier: number;
}

interface StressTestResult {
  scenarioId: string;
  scenarioName: string;
  portfolioValue: number;
  maxLoss: number;
  maxLossPercent: number;
  topLosers: Array<{
    ticker: string;
    loss: number;
    lossPercent: number;
  }>;
}

export const StressTesting: React.FC<StressTestingProps> = ({
  portfolioData,
  darkMode = false,
}) => {
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [results, setResults] = useState<StressTestResult[]>([]);
  const [loading, setLoading] = useState(false);

  const theme = {
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    tableBg: darkMode ? '#0f172a' : '#f8fafc',
  };

  const predefinedScenarios: StressScenario[] = [
    {
      id: 'market-crash',
      name: 'Market Crash',
      description: 'Severe market downturn (-30%)',
      marketShock: -0.30,
      sectorShocks: {},
      volatilityMultiplier: 2.5,
    },
    {
      id: 'sector-crisis',
      name: 'Financial Sector Crisis',
      description: 'Financial sector collapse (-50%)',
      marketShock: -0.15,
      sectorShocks: { 'Financials': -0.50 },
      volatilityMultiplier: 2.0,
    },
    {
      id: 'volatility-spike',
      name: 'Volatility Spike',
      description: 'Extreme volatility increase',
      marketShock: -0.10,
      sectorShocks: {},
      volatilityMultiplier: 3.0,
    },
    {
      id: 'commodity-shock',
      name: 'Commodity Shock',
      description: 'Energy and materials crisis (-40%)',
      marketShock: -0.10,
      sectorShocks: { 'Energy': -0.40, 'Materials': -0.40 },
      volatilityMultiplier: 1.8,
    },
  ];

  const handleRunStressTests = async () => {
    if (selectedScenarios.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch('/api/backtesting/stress-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioData: portfolioData[portfolioData.length - 1],
          scenarios: selectedScenarios,
        }),
      });

      if (response.ok) {
        const testResults = await response.json();
        setResults(testResults);
      }
    } catch (error) {
      console.error('Failed to run stress tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios(prev =>
      prev.includes(scenarioId)
        ? prev.filter(id => id !== scenarioId)
        : [...prev, scenarioId]
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
        <AlertTriangle size={20} color={darkMode ? '#94a3b8' : '#64748b'} />
        <h2 style={{ 
          margin: 0, 
          fontSize: '1.25rem', 
          fontWeight: '700', 
          color: theme.text 
        }}>
          Stress Testing
        </h2>
      </div>

      {/* Scenario Selection */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: theme.tableBg,
        borderRadius: '8px',
        marginBottom: '1.5rem',
        border: `1px solid ${theme.border}`,
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: theme.text }}>
          Select Stress Scenarios
        </h3>

        <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
          {predefinedScenarios.map((scenario) => (
            <label
              key={scenario.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '1rem',
                backgroundColor: theme.cardBg,
                borderRadius: '8px',
                border: `2px solid ${selectedScenarios.includes(scenario.id) ? '#3b82f6' : theme.border}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={selectedScenarios.includes(scenario.id)}
                onChange={() => toggleScenario(scenario.id)}
                style={{ marginTop: '0.25rem' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: theme.text, marginBottom: '0.25rem' }}>
                  {scenario.name}
                </div>
                <div style={{ fontSize: '0.8125rem', color: theme.textSecondary }}>
                  {scenario.description}
                </div>
              </div>
            </label>
          ))}
        </div>

        <button
          onClick={handleRunStressTests}
          disabled={loading || selectedScenarios.length === 0}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: loading || selectedScenarios.length === 0 ? '#94a3b8' : '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.9375rem',
            fontWeight: '600',
            cursor: loading || selectedScenarios.length === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Play size={18} />
          {loading ? 'Running Tests...' : 'Run Stress Tests'}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: theme.text }}>
            Stress Test Results
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: theme.tableBg, borderBottom: `2px solid ${theme.border}` }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
                    Scenario
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
                    Portfolio Value
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
                    Max Loss
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
                    Loss %
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.scenarioId} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
                      {result.scenarioName}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: theme.text }}>
                      {formatCurrency(result.portfolioValue)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#dc2626', fontWeight: '600' }}>
                      {formatCurrency(result.maxLoss)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#dc2626', fontWeight: '600' }}>
                      {formatPercent(result.maxLossPercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recommendations */}
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            border: '1px solid #fbbf24',
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem', fontWeight: '700', color: '#92400e' }}>
              Recommendations
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#92400e', fontSize: '0.875rem' }}>
              <li>Consider diversifying across sectors to reduce concentration risk</li>
              <li>Increase allocation to defensive sectors during high volatility</li>
              <li>Implement stop-loss orders to limit downside exposure</li>
              <li>Review position sizes for high-risk assets</li>
            </ul>
          </div>
        </div>
      )}

      {results.length === 0 && !loading && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: theme.textSecondary,
          backgroundColor: theme.tableBg,
          borderRadius: '8px',
        }}>
          Select stress scenarios and run tests to see results
        </div>
      )}
    </div>
  );
};

export default StressTesting;
