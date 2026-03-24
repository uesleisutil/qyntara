import React, { useState } from 'react';
import { Sliders, Play } from 'lucide-react';

/**
 * ScenarioAnalysis - What-if scenario analysis tool
 * 
 * Requirements:
 * - 61.1: Provide scenario analysis tool on Backtesting tab
 * - 61.2: Allow users to create scenarios with modified parameters
 * - 61.3: Support adjusting expected returns for tickers/sectors
 * - 61.4: Support adjusting volatility assumptions
 * - 61.5: Support adjusting correlation assumptions
 * - 61.6: Recalculate portfolio metrics for scenarios
 * - 61.7: Display scenario results alongside baseline
 * - 61.8: Support comparing multiple scenarios
 * - 61.9: Allow saving scenarios
 * - 61.10: Display sensitivity of results to parameters
 */

interface ScenarioAnalysisProps {
  baselineResult: any;
  darkMode?: boolean;
}

interface Scenario {
  id: string;
  name: string;
  returnAdjustment: number;
  volatilityAdjustment: number;
  correlationAdjustment: number;
  results?: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
}

export const ScenarioAnalysis: React.FC<ScenarioAnalysisProps> = ({
  baselineResult,
  darkMode = false,
}) => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [newScenario, setNewScenario] = useState<Omit<Scenario, 'id' | 'results'>>({
    name: '',
    returnAdjustment: 0,
    volatilityAdjustment: 0,
    correlationAdjustment: 0,
  });
  const [loading, setLoading] = useState(false);

  const theme = {
    cardBg: darkMode ? '#1e1b40' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#b8b5d0' : '#64748b',
    border: darkMode ? '#363258' : '#e2e8f0',
    inputBg: darkMode ? '#0e0c1e' : '#f8fafc',
    tableBg: darkMode ? '#0e0c1e' : '#f8fafc',
  };

  const handleRunScenario = async () => {
    if (!newScenario.name) return;

    setLoading(true);
    try {
      // In real implementation, this would call the API
      const response = await fetch('/api/backtesting/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baselineConfig: baselineResult.config,
          adjustments: newScenario,
        }),
      });

      if (response.ok) {
        const results = await response.json();
        const scenario: Scenario = {
          id: Date.now().toString(),
          ...newScenario,
          results,
        };
        setScenarios([...scenarios, scenario]);
        setNewScenario({
          name: '',
          returnAdjustment: 0,
          volatilityAdjustment: 0,
          correlationAdjustment: 0,
        });
      }
    } catch (error) {
      console.error('Failed to run scenario:', error);
    } finally {
      setLoading(false);
    }
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
        <Sliders size={20} color={darkMode ? '#b8b5d0' : '#64748b'} />
        <h2 style={{ 
          margin: 0, 
          fontSize: '1.25rem', 
          fontWeight: '700', 
          color: theme.text 
        }}>
          Scenario Analysis
        </h2>
      </div>

      {/* Scenario Configuration */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: theme.tableBg,
        borderRadius: '8px',
        marginBottom: '1.5rem',
        border: `1px solid ${theme.border}`,
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: theme.text }}>
          Create New Scenario
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
              Scenario Name
            </label>
            <input
              type="text"
              value={newScenario.name}
              onChange={(e) => setNewScenario({ ...newScenario, name: e.target.value })}
              placeholder="e.g., Bull Market"
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

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
              Return Adjustment (%)
            </label>
            <input
              type="number"
              value={newScenario.returnAdjustment}
              onChange={(e) => setNewScenario({ ...newScenario, returnAdjustment: parseFloat(e.target.value) })}
              step="0.1"
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

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
              Volatility Adjustment (%)
            </label>
            <input
              type="number"
              value={newScenario.volatilityAdjustment}
              onChange={(e) => setNewScenario({ ...newScenario, volatilityAdjustment: parseFloat(e.target.value) })}
              step="0.1"
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

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
              Correlation Adjustment (%)
            </label>
            <input
              type="number"
              value={newScenario.correlationAdjustment}
              onChange={(e) => setNewScenario({ ...newScenario, correlationAdjustment: parseFloat(e.target.value) })}
              step="0.1"
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

        <button
          onClick={handleRunScenario}
          disabled={loading || !newScenario.name}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: loading || !newScenario.name ? '#9895b0' : '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.9375rem',
            fontWeight: '600',
            cursor: loading || !newScenario.name ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Play size={18} />
          {loading ? 'Running...' : 'Run Scenario'}
        </button>
      </div>

      {/* Scenario Results */}
      {scenarios.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: theme.text }}>
            Scenario Comparison
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: theme.tableBg, borderBottom: `2px solid ${theme.border}` }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
                    Scenario
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
                    Total Return
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
                    Sharpe Ratio
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
                    Max Drawdown
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.tableBg }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
                    Baseline
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: theme.text }}>
                    {formatPercent(baselineResult.metrics.totalReturn)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: theme.text }}>
                    {baselineResult.metrics.sharpeRatio.toFixed(2)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: theme.text }}>
                    {formatPercent(baselineResult.metrics.maxDrawdown)}
                  </td>
                </tr>
                {scenarios.map((scenario) => (
                  <tr key={scenario.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: theme.text }}>
                      {scenario.name}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: theme.text }}>
                      {scenario.results ? formatPercent(scenario.results.totalReturn) : '-'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: theme.text }}>
                      {scenario.results ? scenario.results.sharpeRatio.toFixed(2) : '-'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: theme.text }}>
                      {scenario.results ? formatPercent(scenario.results.maxDrawdown) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {scenarios.length === 0 && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: theme.textSecondary,
          backgroundColor: theme.tableBg,
          borderRadius: '8px',
        }}>
          No scenarios created yet. Create a scenario to compare against the baseline.
        </div>
      )}
    </div>
  );
};

export default ScenarioAnalysis;
