/**
 * DataDriftChart Component
 * 
 * Implements Requirements:
 * - 25.1: Display Drift Detection tab
 * - 25.2: Calculate distribution statistics over rolling 30-day windows
 * - 25.3: Compare current vs baseline distributions
 * - 25.4: Calculate Kolmogorov-Smirnov test statistics
 * - 25.5: Flag features with p-value < 0.05 as drifted
 * - 25.6: Display list of drifted features with magnitude
 * - 25.7: Visualize distribution changes with overlaid histograms
 * - 25.8: Display drift results for past 90 days
 * 
 * Features:
 * - Table of drifted features with KS statistics and p-values
 * - Distribution comparison charts (overlaid histograms) for selected features
 * - Visual indicators for features flagged as drifted (p-value < 0.05)
 */

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { AlertTriangle, TrendingUp, Info } from 'lucide-react';
import Card from '../shared/Card';

interface FeatureDriftData {
  feature: string;
  ksStatistic: number;
  pValue: number;
  drifted: boolean;
  magnitude: number;
  currentDistribution: number[];
  baselineDistribution: number[];
}

interface DataDriftChartProps {
  driftData: FeatureDriftData[];
  darkMode?: boolean;
  isMobile?: boolean;
}

export const DataDriftChart: React.FC<DataDriftChartProps> = ({
  driftData = [],
  darkMode = false,
  isMobile = false
}) => {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'feature' | 'ksStatistic' | 'pValue' | 'magnitude'>('pValue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
  };

  // Filter and sort drifted features (Req 25.5, 25.6)
  const driftedFeatures = driftData.filter(f => f.drifted);
  
  const sortedFeatures = [...driftedFeatures].sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return multiplier * aVal.localeCompare(bVal);
    }
    return multiplier * ((aVal as number) - (bVal as number));
  });

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleFeatureClick = (feature: string) => {
    setSelectedFeature(selectedFeature === feature ? null : feature);
  };

  // Prepare histogram data for selected feature (Req 25.7)
  const getHistogramData = (feature: FeatureDriftData) => {
    const bins = feature.currentDistribution.length;
    return Array.from({ length: bins }, (_, i) => ({
      bin: i,
      current: feature.currentDistribution[i] || 0,
      baseline: feature.baselineDistribution[i] || 0,
    }));
  };

  const selectedFeatureData = selectedFeature 
    ? driftData.find(f => f.feature === selectedFeature)
    : null;

  const SortIcon = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) return null;
    return (
      <span style={{ marginLeft: '0.25rem' }}>
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Summary Card */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem',
        padding: '1rem',
        backgroundColor: driftedFeatures.length > 0 ? '#fef3c7' : '#d1fae5',
        borderRadius: '8px',
        border: `1px solid ${theme.border}`
      }}>
        {driftedFeatures.length > 0 ? (
          <AlertTriangle size={24} color="#f59e0b" />
        ) : (
          <Info size={24} color="#10b981" />
        )}
        <div>
          <p style={{ 
            margin: 0, 
            fontWeight: '600', 
            fontSize: '1rem',
            color: theme.text 
          }}>
            {driftedFeatures.length} of {driftData.length} features showing drift
          </p>
          <p style={{ 
            margin: '0.25rem 0 0 0', 
            fontSize: '0.875rem',
            color: theme.textSecondary 
          }}>
            Features with p-value &lt; 0.05 are flagged as drifted (Kolmogorov-Smirnov test)
          </p>
        </div>
      </div>

      {/* Drifted Features Table (Req 25.6) */}
      <Card 
        title="Drifted Features" 
        subtitle="Features flagged with significant distribution changes"
        icon={null}
        actions={null}
      >
        {driftedFeatures.length === 0 ? (
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center', 
            color: theme.textSecondary 
          }}>
            <TrendingUp size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '1rem' }}>
              No drift detected in any features
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
              All feature distributions are stable
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: isMobile ? '0.875rem' : '0.9375rem'
            }}>
              <thead>
                <tr style={{ 
                  borderBottom: `2px solid ${theme.border}`,
                  backgroundColor: darkMode ? '#1e293b' : '#f8fafc'
                }}>
                  <th 
                    onClick={() => handleSort('feature')}
                    style={{ 
                      padding: '0.75rem', 
                      textAlign: 'left',
                      fontWeight: '600',
                      color: theme.text,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Feature <SortIcon column="feature" />
                  </th>
                  <th 
                    onClick={() => handleSort('ksStatistic')}
                    style={{ 
                      padding: '0.75rem', 
                      textAlign: 'right',
                      fontWeight: '600',
                      color: theme.text,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    KS Statistic <SortIcon column="ksStatistic" />
                  </th>
                  <th 
                    onClick={() => handleSort('pValue')}
                    style={{ 
                      padding: '0.75rem', 
                      textAlign: 'right',
                      fontWeight: '600',
                      color: theme.text,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    P-Value <SortIcon column="pValue" />
                  </th>
                  <th 
                    onClick={() => handleSort('magnitude')}
                    style={{ 
                      padding: '0.75rem', 
                      textAlign: 'right',
                      fontWeight: '600',
                      color: theme.text,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Magnitude <SortIcon column="magnitude" />
                  </th>
                  <th style={{ 
                    padding: '0.75rem', 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: theme.text
                  }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedFeatures.map((feature) => (
                  <tr 
                    key={feature.feature}
                    onClick={() => handleFeatureClick(feature.feature)}
                    style={{ 
                      borderBottom: `1px solid ${theme.border}`,
                      backgroundColor: selectedFeature === feature.feature 
                        ? (darkMode ? '#334155' : '#f1f5f9')
                        : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedFeature !== feature.feature) {
                        e.currentTarget.style.backgroundColor = darkMode ? '#1e293b' : '#f8fafc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedFeature !== feature.feature) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <td style={{ 
                      padding: '0.75rem',
                      color: theme.text,
                      fontWeight: '500'
                    }}>
                      {feature.feature}
                    </td>
                    <td style={{ 
                      padding: '0.75rem', 
                      textAlign: 'right',
                      color: theme.text,
                      fontFamily: 'monospace'
                    }}>
                      {feature.ksStatistic.toFixed(4)}
                    </td>
                    <td style={{ 
                      padding: '0.75rem', 
                      textAlign: 'right',
                      color: theme.text,
                      fontFamily: 'monospace'
                    }}>
                      {feature.pValue.toFixed(4)}
                    </td>
                    <td style={{ 
                      padding: '0.75rem', 
                      textAlign: 'right',
                      color: theme.text,
                      fontFamily: 'monospace'
                    }}>
                      {feature.magnitude.toFixed(2)}
                    </td>
                    <td style={{ 
                      padding: '0.75rem', 
                      textAlign: 'center'
                    }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: feature.pValue < 0.01 ? '#fee2e2' : '#fef3c7',
                        color: feature.pValue < 0.01 ? '#991b1b' : '#92400e'
                      }}>
                        <AlertTriangle size={12} />
                        {feature.pValue < 0.01 ? 'High' : 'Moderate'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Distribution Comparison Chart (Req 25.7) */}
      {selectedFeatureData && (
        <Card 
          title={`Distribution Comparison: ${selectedFeatureData.feature}`}
          subtitle="Overlaid histograms showing current vs baseline distributions"
          icon={null}
          actions={null}
        >
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: '1rem',
              padding: '1rem',
              backgroundColor: darkMode ? '#1e293b' : '#f8fafc',
              borderRadius: '8px'
            }}>
              <div>
                <p style={{ 
                  margin: 0, 
                  fontSize: '0.75rem', 
                  color: theme.textSecondary,
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}>
                  KS Statistic
                </p>
                <p style={{ 
                  margin: '0.25rem 0 0 0', 
                  fontSize: '1.25rem', 
                  fontWeight: '700',
                  color: theme.text,
                  fontFamily: 'monospace'
                }}>
                  {selectedFeatureData.ksStatistic.toFixed(4)}
                </p>
              </div>
              <div>
                <p style={{ 
                  margin: 0, 
                  fontSize: '0.75rem', 
                  color: theme.textSecondary,
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}>
                  P-Value
                </p>
                <p style={{ 
                  margin: '0.25rem 0 0 0', 
                  fontSize: '1.25rem', 
                  fontWeight: '700',
                  color: selectedFeatureData.pValue < 0.05 ? theme.error : theme.success,
                  fontFamily: 'monospace'
                }}>
                  {selectedFeatureData.pValue.toFixed(4)}
                </p>
              </div>
              <div>
                <p style={{ 
                  margin: 0, 
                  fontSize: '0.75rem', 
                  color: theme.textSecondary,
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}>
                  Drift Magnitude
                </p>
                <p style={{ 
                  margin: '0.25rem 0 0 0', 
                  fontSize: '1.25rem', 
                  fontWeight: '700',
                  color: theme.text,
                  fontFamily: 'monospace'
                }}>
                  {selectedFeatureData.magnitude.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
            <BarChart
              data={getHistogramData(selectedFeatureData)}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis 
                dataKey="bin" 
                stroke={theme.textSecondary}
                label={{ 
                  value: 'Distribution Bins', 
                  position: 'insideBottom', 
                  offset: -10,
                  style: { fill: theme.textSecondary }
                }}
              />
              <YAxis 
                stroke={theme.textSecondary}
                label={{ 
                  value: 'Frequency', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fill: theme.textSecondary }
                }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: theme.cardBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                  color: theme.text
                }}
                formatter={(value: number) => value.toFixed(4)}
              />
              <Legend 
                wrapperStyle={{ color: theme.text }}
              />
              <Bar 
                dataKey="baseline" 
                fill="#3b82f6" 
                fillOpacity={0.6}
                name="Baseline Distribution"
              />
              <Bar 
                dataKey="current" 
                fill="#ef4444" 
                fillOpacity={0.6}
                name="Current Distribution"
              />
            </BarChart>
          </ResponsiveContainer>

          <div style={{ 
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: darkMode ? '#1e293b' : '#f8fafc',
            borderRadius: '8px',
            fontSize: '0.875rem',
            color: theme.textSecondary
          }}>
            <p style={{ margin: 0 }}>
              <strong>Interpretation:</strong> The Kolmogorov-Smirnov test measures the maximum distance 
              between the cumulative distribution functions. A p-value &lt; 0.05 indicates significant 
              drift, suggesting the feature's distribution has changed meaningfully from the baseline.
            </p>
          </div>
        </Card>
      )}

      {/* Instructions when no feature selected */}
      {!selectedFeatureData && driftedFeatures.length > 0 && (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          color: theme.textSecondary,
          backgroundColor: theme.cardBg,
          borderRadius: '8px',
          border: `1px solid ${theme.border}`
        }}>
          <Info size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: '1rem' }}>
            Click on a feature in the table above to view its distribution comparison
          </p>
        </div>
      )}
    </div>
  );
};

export default DataDriftChart;
