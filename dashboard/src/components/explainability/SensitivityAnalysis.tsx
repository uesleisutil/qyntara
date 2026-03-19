/**
 * SensitivityAnalysis Component
 * 
 * Allows users to analyze prediction sensitivity to feature changes
 * - Select ticker and feature
 * - Calculate prediction sensitivity
 * - Vary feature across observed range
 * - Display as line chart
 * - Show sensitivity score
 * - Support multi-feature analysis
 * 
 * Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7, 30.8
 */

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, AlertCircle } from 'lucide-react';

interface SensitivityAnalysisProps {
  ticker: string;
  darkMode?: boolean;
}

interface SensitivityData {
  featureValue: number;
  prediction: number;
}

interface FeatureInfo {
  name: string;
  currentValue: number;
  min: number;
  max: number;
  sensitivity: number;
}

const SensitivityAnalysis: React.FC<SensitivityAnalysisProps> = ({ ticker, darkMode = false }) => {
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['RSI_14']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sensitivityData, setSensitivityData] = useState<Record<string, SensitivityData[]>>({});
  const [featureInfo, setFeatureInfo] = useState<Record<string, FeatureInfo>>({});
  const [availableFeatures] = useState<string[]>([
    'RSI_14', 'Volume_MA_20', 'Price_MA_50', 'MACD', 'Bollinger_Width',
    'ATR_14', 'Stochastic', 'ROE', 'P/E_Ratio', 'Debt_to_Equity',
    'EPS_Growth', 'Dividend_Yield', 'Beta', 'Momentum_20'
  ]);

  const theme = {
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  useEffect(() => {
    const fetchSensitivityData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock sensitivity data
        const mockData: Record<string, SensitivityData[]> = {};
        const mockInfo: Record<string, FeatureInfo> = {};

        selectedFeatures.forEach(feature => {
          // Generate mock sensitivity curve
          const baseValue = 25.50;
          const points: SensitivityData[] = [];
          const numPoints = 20;
          
          // Feature-specific ranges
          const ranges: Record<string, { min: number; max: number; current: number }> = {
            'RSI_14': { min: 20, max: 80, current: 65.2 },
            'Volume_MA_20': { min: 500000, max: 2000000, current: 1250000 },
            'Price_MA_50': { min: 20, max: 35, current: 26.8 },
            'MACD': { min: -0.5, max: 1.0, current: 0.42 },
            'Bollinger_Width': { min: 0.05, max: 0.30, current: 0.15 },
            'ATR_14': { min: 0.5, max: 2.5, current: 1.2 },
            'Stochastic': { min: 10, max: 90, current: 72.5 },
            'ROE': { min: 0.05, max: 0.30, current: 0.18 },
            'P/E_Ratio': { min: 5, max: 30, current: 18.5 },
            'Debt_to_Equity': { min: 0.2, max: 1.5, current: 0.65 },
            'EPS_Growth': { min: -0.10, max: 0.30, current: 0.12 },
            'Dividend_Yield': { min: 0.01, max: 0.10, current: 0.045 },
            'Beta': { min: 0.5, max: 2.0, current: 1.25 },
            'Momentum_20': { min: -0.15, max: 0.20, current: 0.08 }
          };

          const range = ranges[feature] || { min: 0, max: 100, current: 50 };
          const step = (range.max - range.min) / (numPoints - 1);

          // Calculate sensitivity (random for demo)
          const sensitivity = (Math.random() - 0.5) * 2; // -1 to 1

          for (let i = 0; i < numPoints; i++) {
            const featureValue = range.min + (step * i);
            const normalizedValue = (featureValue - range.min) / (range.max - range.min);
            const prediction = baseValue + (normalizedValue - 0.5) * sensitivity * 5;
            
            points.push({
              featureValue: parseFloat(featureValue.toFixed(4)),
              prediction: parseFloat(prediction.toFixed(2))
            });
          }

          mockData[feature] = points;
          mockInfo[feature] = {
            name: feature,
            currentValue: range.current,
            min: range.min,
            max: range.max,
            sensitivity: parseFloat((sensitivity * 100).toFixed(2))
          };
        });

        setSensitivityData(mockData);
        setFeatureInfo(mockInfo);
      } catch (err) {
        setError('Failed to load sensitivity data');
      } finally {
        setLoading(false);
      }
    };

    fetchSensitivityData();
  }, [ticker, selectedFeatures]);

  const handleFeatureToggle = (feature: string) => {
    if (selectedFeatures.includes(feature)) {
      if (selectedFeatures.length > 1) {
        setSelectedFeatures(selectedFeatures.filter(f => f !== feature));
      }
    } else {
      if (selectedFeatures.length < 5) {
        setSelectedFeatures([...selectedFeatures, feature]);
      }
    }
  };

  // Prepare chart data
  const chartData = sensitivityData[selectedFeatures[0]]?.map((point, index) => {
    const dataPoint: any = {
      index,
      featureValue: point.featureValue
    };
    
    selectedFeatures.forEach(feature => {
      if (sensitivityData[feature] && sensitivityData[feature][index]) {
        dataPoint[feature] = sensitivityData[feature][index].prediction;
      }
    });
    
    return dataPoint;
  }) || [];

  if (loading) {
    return (
      <div style={{
        backgroundColor: theme.cardBg,
        padding: '2rem',
        borderRadius: '12px',
        textAlign: 'center',
        boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <p style={{ color: theme.textSecondary, margin: 0 }}>Loading sensitivity analysis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: theme.cardBg,
        padding: '2rem',
        borderRadius: '12px',
        textAlign: 'center',
        boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <AlertCircle size={24} color="#ef4444" style={{ margin: '0 auto 0.5rem' }} />
        <p style={{ color: theme.textSecondary, margin: 0 }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: theme.cardBg,
      padding: '1.5rem',
      borderRadius: '12px',
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <Activity size={20} color="#3b82f6" />
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: theme.text }}>
          Sensitivity Analysis - {ticker}
        </h3>
      </div>

      <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: theme.textSecondary }}>
        Analyze how predictions change when feature values vary across their observed range
      </p>

      {/* Feature Selection */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{
          display: 'block',
          marginBottom: '0.75rem',
          fontSize: '0.875rem',
          fontWeight: '600',
          color: theme.text
        }}>
          Select Features (up to 5)
        </label>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          padding: '0.75rem',
          backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
          borderRadius: '8px',
          maxHeight: '150px',
          overflowY: 'auto'
        }}>
          {availableFeatures.map((feature) => {
            const isSelected = selectedFeatures.includes(feature);
            return (
              <button
                key={feature}
                onClick={() => handleFeatureToggle(feature)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: isSelected ? colors[selectedFeatures.indexOf(feature)] : 'transparent',
                  color: isSelected ? 'white' : theme.text,
                  border: `1px solid ${isSelected ? colors[selectedFeatures.indexOf(feature)] : theme.border}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: isSelected ? '600' : '500',
                  transition: 'all 0.2s'
                }}
              >
                {feature}
              </button>
            );
          })}
        </div>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: theme.textSecondary }}>
          {selectedFeatures.length} of 5 selected
        </p>
      </div>

      {/* Sensitivity Scores */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {selectedFeatures.map((feature, index) => {
          const info = featureInfo[feature];
          if (!info) return null;

          return (
            <div
              key={feature}
              style={{
                padding: '1rem',
                backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
                borderRadius: '8px',
                borderLeft: `4px solid ${colors[index]}`
              }}
            >
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
                {feature}
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: '700', color: theme.text, marginBottom: '0.5rem' }}>
                {info.sensitivity > 0 ? '+' : ''}{info.sensitivity}%
              </div>
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                Current: {info.currentValue.toFixed(4)}
              </div>
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                Range: {info.min.toFixed(2)} - {info.max.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sensitivity Chart */}
      <div style={{ marginBottom: '1rem' }}>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
            <XAxis
              dataKey="featureValue"
              stroke={theme.textSecondary}
              style={{ fontSize: '11px' }}
              label={{ value: 'Feature Value', position: 'insideBottom', offset: -5, fill: theme.textSecondary }}
            />
            <YAxis
              stroke={theme.textSecondary}
              style={{ fontSize: '11px' }}
              label={{ value: 'Prediction (R$)', angle: -90, position: 'insideLeft', fill: theme.textSecondary }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme.cardBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelStyle={{ color: theme.text, fontWeight: '600' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              iconType="line"
            />
            {selectedFeatures.map((feature, index) => (
              <Line
                key={feature}
                type="monotone"
                dataKey={feature}
                stroke={colors[index]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{
        padding: '0.75rem',
        backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        borderRadius: '8px',
        fontSize: '0.8125rem',
        color: theme.textSecondary
      }}>
        <strong>How to read:</strong> The chart shows how the prediction changes as each feature varies across its observed range. 
        Steeper slopes indicate higher sensitivity. Positive sensitivity means the prediction increases as the feature increases.
      </div>
    </div>
  );
};

export default SensitivityAnalysis;
