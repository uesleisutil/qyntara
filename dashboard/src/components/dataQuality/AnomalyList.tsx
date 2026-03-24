/**
 * Anomaly List Component
 * 
 * Implements Requirements:
 * - 22.1: Detect data gaps (missing consecutive trading days)
 * - 22.2: Detect outliers (> 5 std devs from mean)
 * - 22.3: Display list with ticker, date, anomaly type
 * - 22.4: Calculate anomaly rate (anomalies / total * 100)
 * - 22.5: Display anomaly trends over time
 * - 22.6: Allow marking false positives
 * - 22.7: Categorize by severity (low, medium, high)
 * - 22.8: Requirements validation
 */

import React, { useState, useMemo } from 'react';
import { AlertTriangle, AlertCircle, Info, X, Check } from 'lucide-react';
import Card from '../shared/Card';
import { LineChart } from '../charts/LineChart';

interface Anomaly {
  id: string;
  ticker: string;
  date: string;
  type: 'gap' | 'outlier' | 'inconsistency';
  severity: 'low' | 'medium' | 'high';
  description: string;
  value?: number;
  expectedValue?: number;
  falsePositive: boolean;
}

interface AnomaliesData {
  totalAnomalies: number;
  anomalyRate: number;
  anomalies: Anomaly[];
  trends: Array<{
    date: string;
    count: number;
    rate: number;
  }>;
  bySeverity: {
    low: number;
    medium: number;
    high: number;
  };
  byType: {
    gap: number;
    outlier: number;
    inconsistency: number;
  };
}

interface AnomalyListProps {
  data: AnomaliesData;
  darkMode?: boolean;
  isMobile?: boolean;
}

export const AnomalyList: React.FC<AnomalyListProps> = ({ 
  data, 
  darkMode = false, 
  isMobile = false 
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [showFalsePositives, setShowFalsePositives] = useState(false);
  const [markedFalsePositives, setMarkedFalsePositives] = useState<Set<string>>(new Set());

  const theme = {
    cardBg: darkMode ? '#1a1836' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#9895b0' : '#64748b',
    border: darkMode ? '#2a2745' : '#e2e8f0',
    hover: darkMode ? '#2a2745' : '#f8fafc',
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#dc2626';
      case 'medium': return '#f59e0b';
      case 'low': return '#8b5cf6';
      default: return theme.textSecondary;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertTriangle size={16} />;
      case 'medium': return <AlertCircle size={16} />;
      case 'low': return <Info size={16} />;
      default: return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'gap': return 'Data Gap';
      case 'outlier': return 'Outlier';
      case 'inconsistency': return 'Inconsistency';
      default: return type;
    }
  };

  const handleMarkFalsePositive = (anomalyId: string) => {
    const newSet = new Set(markedFalsePositives);
    if (newSet.has(anomalyId)) {
      newSet.delete(anomalyId);
    } else {
      newSet.add(anomalyId);
    }
    setMarkedFalsePositives(newSet);
  };

  const filteredAnomalies = useMemo(() => {
    return data.anomalies.filter(anomaly => {
      const isFalsePositive = anomaly.falsePositive || markedFalsePositives.has(anomaly.id);
      
      if (!showFalsePositives && isFalsePositive) return false;
      if (filterSeverity !== 'all' && anomaly.severity !== filterSeverity) return false;
      if (filterType !== 'all' && anomaly.type !== filterType) return false;
      
      return true;
    });
  }, [data.anomalies, filterSeverity, filterType, showFalsePositives, markedFalsePositives]);

  return (
    <Card title={null} subtitle={null} icon={null} actions={null}>
      {/* Summary Section */}
      <div style={{ 
        marginBottom: '1.5rem', 
        paddingBottom: '1rem', 
        borderBottom: `1px solid ${theme.border}` 
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', 
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
              Total Anomalies
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: theme.text }}>
              {data.totalAnomalies}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
              Anomaly Rate
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: getSeverityColor(data.anomalyRate > 0.05 ? 'high' : 'low') }}>
              {(data.anomalyRate * 100).toFixed(2)}%
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
              High Severity
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
              {data.bySeverity.high}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
              By Type
            </div>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
              Gaps: {data.byType.gap} | Outliers: {data.byType.outlier} | Other: {data.byType.inconsistency}
            </div>
          </div>
        </div>

        {/* Anomaly Trend Chart */}
        {data.trends && data.trends.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>
              Anomaly Trend (Last {data.trends.length} days)
            </div>
            <LineChart
              data={data.trends.map(t => ({ date: t.date, count: t.count }))}
              xKey="date"
              yKeys={['count']}
              height={150}
              colors={['#dc2626']}
              showLegend={false}
              showGrid={true}
            />
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.875rem', color: theme.textSecondary }}>
            Severity:
          </label>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            style={{
              padding: '0.5rem',
              borderRadius: '6px',
              border: `1px solid ${theme.border}`,
              backgroundColor: theme.cardBg,
              color: theme.text,
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.875rem', color: theme.textSecondary }}>
            Type:
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: '0.5rem',
              borderRadius: '6px',
              border: `1px solid ${theme.border}`,
              backgroundColor: theme.cardBg,
              color: theme.text,
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            <option value="all">All</option>
            <option value="gap">Data Gaps</option>
            <option value="outlier">Outliers</option>
            <option value="inconsistency">Inconsistencies</option>
          </select>
        </div>

        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          fontSize: '0.875rem',
          color: theme.text,
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={showFalsePositives}
            onChange={(e) => setShowFalsePositives(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Show False Positives
        </label>

        <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: theme.textSecondary }}>
          Showing {filteredAnomalies.length} of {data.totalAnomalies} anomalies
        </div>
      </div>

      {/* Anomaly List */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '0.75rem',
        maxHeight: '600px',
        overflowY: 'auto'
      }}>
        {filteredAnomalies.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '2rem', 
            color: theme.textSecondary 
          }}>
            No anomalies found matching the current filters
          </div>
        ) : (
          filteredAnomalies.map((anomaly) => {
            const isFalsePositive = anomaly.falsePositive || markedFalsePositives.has(anomaly.id);
            
            return (
              <div
                key={anomaly.id}
                style={{
                  padding: isMobile ? '0.75rem' : '1rem',
                  border: `1px solid ${theme.border}`,
                  borderLeft: `4px solid ${getSeverityColor(anomaly.severity)}`,
                  borderRadius: '8px',
                  backgroundColor: isFalsePositive ? (darkMode ? '#1a183680' : '#f8f7fc') : theme.cardBg,
                  opacity: isFalsePositive ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  gap: '1rem'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{ color: getSeverityColor(anomaly.severity) }}>
                        {getSeverityIcon(anomaly.severity)}
                      </span>
                      <span style={{ 
                        fontWeight: '600', 
                        color: theme.text,
                        fontSize: isMobile ? '0.875rem' : '1rem'
                      }}>
                        {anomaly.ticker}
                      </span>
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        backgroundColor: getSeverityColor(anomaly.severity) + '20',
                        color: getSeverityColor(anomaly.severity),
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        {anomaly.severity.toUpperCase()}
                      </span>
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        backgroundColor: darkMode ? '#2a2745' : '#e2e8f0',
                        color: theme.text,
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {getTypeLabel(anomaly.type)}
                      </span>
                      {isFalsePositive && (
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          backgroundColor: '#10b98120',
                          color: '#10b981',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          FALSE POSITIVE
                        </span>
                      )}
                    </div>
                    
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: theme.textSecondary,
                      marginBottom: '0.5rem'
                    }}>
                      Date: {new Date(anomaly.date).toLocaleDateString()}
                    </div>
                    
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: theme.text 
                    }}>
                      {anomaly.description}
                    </div>
                    
                    {anomaly.value !== undefined && anomaly.expectedValue !== undefined && (
                      <div style={{ 
                        fontSize: '0.8125rem', 
                        color: theme.textSecondary,
                        marginTop: '0.5rem'
                      }}>
                        Value: {anomaly.value.toFixed(2)} (Expected: {anomaly.expectedValue.toFixed(2)})
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleMarkFalsePositive(anomaly.id)}
                    style={{
                      padding: '0.5rem',
                      backgroundColor: isFalsePositive ? '#10b981' : 'transparent',
                      border: `1px solid ${isFalsePositive ? '#10b981' : theme.border}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      color: isFalsePositive ? 'white' : theme.text
                    }}
                    title={isFalsePositive ? 'Unmark as false positive' : 'Mark as false positive'}
                  >
                    {isFalsePositive ? <Check size={16} /> : <X size={16} />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};
