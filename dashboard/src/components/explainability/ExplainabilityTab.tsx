/**
 * ExplainabilityTab Component
 * 
 * Main tab for model explainability features including:
 * - SHAP value visualization
 * - Sensitivity analysis
 * - Aggregate feature impact
 * - Natural language explanations
 * 
 * Requirements: 29.1, 30.1, 31.1, 32.1
 */

import React, { useState } from 'react';
import { Info } from 'lucide-react';
import SHAPWaterfallChart from './SHAPWaterfallChart';
import SensitivityAnalysis from './SensitivityAnalysis';
import FeatureImpactChart from './FeatureImpactChart';
import ExplanationText from './ExplanationText';

interface ExplainabilityTabProps {
  darkMode?: boolean;
}

const ExplainabilityTab: React.FC<ExplainabilityTabProps> = ({ darkMode = false }) => {
  const [selectedTicker, setSelectedTicker] = useState<string>('PETR4');
  const [availableTickers] = useState<string[]>([
    'PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3', 
    'WEGE3', 'RENT3', 'MGLU3', 'B3SA3', 'SUZB3'
  ]);

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };

  return (
    <div>
      {/* Header */}
      <div style={{
        backgroundColor: theme.cardBg,
        padding: '1.5rem',
        borderRadius: '12px',
        marginBottom: '1.5rem',
        boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Info size={24} color="#3b82f6" />
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: theme.text }}>
            Model Explainability
          </h2>
        </div>
        <p style={{ margin: 0, color: theme.textSecondary, fontSize: '0.875rem' }}>
          Understand how the model makes predictions through SHAP values, sensitivity analysis, and feature impacts
        </p>
      </div>

      {/* Ticker Selector */}
      <div style={{
        backgroundColor: theme.cardBg,
        padding: '1.25rem',
        borderRadius: '12px',
        marginBottom: '1.5rem',
        boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: '600',
          color: theme.text
        }}>
          Select Ticker
        </label>
        <select
          value={selectedTicker}
          onChange={(e) => setSelectedTicker(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '300px',
            padding: '0.625rem 0.875rem',
            fontSize: '0.9375rem',
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            backgroundColor: theme.cardBg,
            color: theme.text,
            cursor: 'pointer'
          }}
        >
          {availableTickers.map(ticker => (
            <option key={ticker} value={ticker}>{ticker}</option>
          ))}
        </select>
      </div>

      {/* SHAP Waterfall Chart Section */}
      <div style={{ marginBottom: '1.5rem' }}>
        <SHAPWaterfallChart ticker={selectedTicker} darkMode={darkMode} />
      </div>

      {/* Natural Language Explanation Section */}
      <div style={{ marginBottom: '1.5rem' }}>
        <ExplanationText ticker={selectedTicker} darkMode={darkMode} />
      </div>

      {/* Sensitivity Analysis Section */}
      <div style={{ marginBottom: '1.5rem' }}>
        <SensitivityAnalysis ticker={selectedTicker} darkMode={darkMode} />
      </div>

      {/* Aggregate Feature Impact Section */}
      <div style={{ marginBottom: '1.5rem' }}>
        <FeatureImpactChart darkMode={darkMode} />
      </div>
    </div>
  );
};

export default ExplainabilityTab;
