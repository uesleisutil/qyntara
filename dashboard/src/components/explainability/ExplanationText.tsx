/**
 * ExplanationText Component
 * 
 * Generates natural language explanations for predictions
 * - Identify top 3 positive contributing features
 * - Identify top 3 negative contributing features
 * - Describe magnitude of each contribution
 * - Compare ticker features against typical values
 * - Explain confidence level
 * - Use clear, non-technical language
 * 
 * Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7, 32.8
 */

import React, { useState, useEffect } from 'react';
import { MessageSquare, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface ExplanationTextProps {
  ticker: string;
  darkMode?: boolean;
}

interface FeatureContribution {
  feature: string;
  value: number;
  shapValue: number;
  typicalValue: number;
  comparison: 'higher' | 'lower' | 'typical';
}

interface ExplanationData {
  prediction: number;
  confidence: number;
  topPositive: FeatureContribution[];
  topNegative: FeatureContribution[];
}

const ExplanationText: React.FC<ExplanationTextProps> = ({ ticker, darkMode = false }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExplanationData | null>(null);

  const theme = {
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };

  useEffect(() => {
    const fetchExplanation = async () => {
      setLoading(true);
      setError(null);

      try {
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock explanation data
        const mockData: ExplanationData = {
          prediction: 28.75,
          confidence: 0.82,
          topPositive: [
            {
              feature: 'RSI (Relative Strength Index)',
              value: 65.2,
              shapValue: 0.85,
              typicalValue: 50.0,
              comparison: 'higher'
            },
            {
              feature: 'Trading Volume',
              value: 1250000,
              shapValue: 0.62,
              typicalValue: 800000,
              comparison: 'higher'
            },
            {
              feature: 'Earnings Growth',
              value: 0.12,
              shapValue: 0.42,
              typicalValue: 0.05,
              comparison: 'higher'
            }
          ],
          topNegative: [
            {
              feature: 'Price-to-Earnings Ratio',
              value: 18.5,
              shapValue: -0.32,
              typicalValue: 12.0,
              comparison: 'higher'
            },
            {
              feature: 'Debt-to-Equity Ratio',
              value: 0.65,
              shapValue: -0.28,
              typicalValue: 0.40,
              comparison: 'higher'
            },
            {
              feature: 'Beta (Market Volatility)',
              value: 1.25,
              shapValue: -0.18,
              typicalValue: 1.00,
              comparison: 'higher'
            }
          ]
        };

        setData(mockData);
      } catch (err) {
        setError('Failed to generate explanation');
      } finally {
        setLoading(false);
      }
    };

    fetchExplanation();
  }, [ticker]);

  const getConfidenceDescription = (confidence: number): string => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'moderate';
    return 'low';
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#10b981';
    if (confidence >= 0.6) return '#f59e0b';
    return '#ef4444';
  };

  const formatFeatureValue = (feature: string, value: number): string => {
    if (feature.includes('Ratio') || feature.includes('Growth')) {
      return (value * 100).toFixed(1) + '%';
    }
    if (feature.includes('Volume')) {
      return (value / 1000000).toFixed(2) + 'M';
    }
    return value.toFixed(2);
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: theme.cardBg,
        padding: '2rem',
        borderRadius: '12px',
        textAlign: 'center',
        boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <p style={{ color: theme.textSecondary, margin: 0 }}>Generating explanation...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        backgroundColor: theme.cardBg,
        padding: '2rem',
        borderRadius: '12px',
        textAlign: 'center',
        boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <AlertCircle size={24} color="#ef4444" style={{ margin: '0 auto 0.5rem' }} />
        <p style={{ color: theme.textSecondary, margin: 0 }}>{error || 'No data available'}</p>
      </div>
    );
  }

  const confidenceDesc = getConfidenceDescription(data.confidence);
  const confidenceColor = getConfidenceColor(data.confidence);

  return (
    <div style={{
      backgroundColor: theme.cardBg,
      padding: '1.5rem',
      borderRadius: '12px',
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <MessageSquare size={20} color="#3b82f6" />
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: theme.text }}>
          Prediction Explanation - {ticker}
        </h3>
      </div>

      {/* Main Explanation */}
      <div style={{
        padding: '1.25rem',
        backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        borderRadius: '8px',
        marginBottom: '1.5rem',
        lineHeight: '1.6'
      }}>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', color: theme.text }}>
          Our model predicts that <strong>{ticker}</strong> will reach <strong style={{ color: '#3b82f6' }}>R$ {data.prediction.toFixed(2)}</strong> in the next 20 trading days. 
          This prediction has <strong style={{ color: confidenceColor }}>{confidenceDesc} confidence</strong> ({(data.confidence * 100).toFixed(0)}%).
        </p>

        <p style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', color: theme.text }}>
          The model's recommendation is primarily driven by several key factors:
        </p>

        {/* Positive Factors */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <TrendingUp size={18} color="#10b981" />
            <strong style={{ fontSize: '0.9375rem', color: '#10b981' }}>Positive Factors</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', color: theme.text, fontSize: '0.875rem' }}>
            {data.topPositive.map((feature, index) => (
              <li key={index} style={{ marginBottom: '0.5rem' }}>
                <strong>{feature.feature}</strong> is {formatFeatureValue(feature.feature, feature.value)}, 
                which is {feature.comparison} than the typical value of {formatFeatureValue(feature.feature, feature.typicalValue)}. 
                This {feature.comparison === 'higher' ? 'increases' : 'decreases'} the prediction by approximately{' '}
                <strong style={{ color: '#10b981' }}>+{(feature.shapValue * 100 / data.prediction).toFixed(1)}%</strong>.
              </li>
            ))}
          </ul>
        </div>

        {/* Negative Factors */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <TrendingDown size={18} color="#ef4444" />
            <strong style={{ fontSize: '0.9375rem', color: '#ef4444' }}>Negative Factors</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', color: theme.text, fontSize: '0.875rem' }}>
            {data.topNegative.map((feature, index) => (
              <li key={index} style={{ marginBottom: '0.5rem' }}>
                <strong>{feature.feature}</strong> is {formatFeatureValue(feature.feature, feature.value)}, 
                which is {feature.comparison} than the typical value of {formatFeatureValue(feature.feature, feature.typicalValue)}. 
                This reduces the prediction by approximately{' '}
                <strong style={{ color: '#ef4444' }}>{(feature.shapValue * 100 / data.prediction).toFixed(1)}%</strong>.
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Confidence Explanation */}
      <div style={{
        padding: '1rem',
        backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        borderRadius: '8px',
        borderLeft: `4px solid ${confidenceColor}`
      }}>
        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: theme.text, marginBottom: '0.5rem' }}>
          About the Confidence Level
        </div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: theme.textSecondary, lineHeight: '1.5' }}>
          {data.confidence >= 0.8 && (
            <>
              The model has <strong>high confidence</strong> in this prediction because the stock's characteristics 
              closely match patterns the model has seen in similar successful predictions. The key indicators are 
              showing strong and consistent signals.
            </>
          )}
          {data.confidence >= 0.6 && data.confidence < 0.8 && (
            <>
              The model has <strong>moderate confidence</strong> in this prediction. While several indicators are 
              positive, there are some mixed signals that introduce uncertainty. Consider this prediction as one 
              factor among others in your decision-making.
            </>
          )}
          {data.confidence < 0.6 && (
            <>
              The model has <strong>low confidence</strong> in this prediction due to conflicting signals or 
              unusual market conditions. This prediction should be treated with caution and verified with 
              additional analysis.
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default ExplanationText;
