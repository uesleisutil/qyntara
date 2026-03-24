/**
 * Completeness Table Component
 * 
 * Implements Requirements:
 * - 21.2: Calculate completeness rate per ticker (present / expected * 100)
 * - 21.3: Display sortable table with completeness rates
 * - 21.4: Highlight tickers with completeness < 95%
 * - 21.5: Display overall completeness rate
 * - 21.6: Show completeness trends over time
 * - 21.7: Identify missing features per ticker
 * - 21.8: Display date range analyzed
 */

import React, { useState, useMemo } from 'react';
import { AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import Card from '../../shared/ui/Card';
import { Sparkline } from '../../shared/ui/Sparkline';

interface CompletenessData {
  overallCompleteness: number;
  dateRange: {
    start: string;
    end: string;
  };
  tickers: Array<{
    ticker: string;
    completenessRate: number;
    missingFeatures: string[];
    trend: number[];
    expectedDataPoints: number;
    presentDataPoints: number;
  }>;
  trends: Array<{
    date: string;
    completeness: number;
  }>;
}

interface CompletenessTableProps {
  data: CompletenessData;
  darkMode?: boolean;
  isMobile?: boolean;
}

type SortField = 'ticker' | 'completeness' | 'missing';
type SortDirection = 'asc' | 'desc';

export const CompletenessTable: React.FC<CompletenessTableProps> = ({ 
  data, 
  darkMode = false, 
  isMobile = false 
}) => {
  const [sortField, setSortField] = useState<SortField>('completeness');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const theme = {
    cardBg: darkMode ? '#1e1b40' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#b8b5d0' : '#64748b',
    border: darkMode ? '#363258' : '#e2e8f0',
    hover: darkMode ? '#363258' : '#f8fafc',
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedTickers = useMemo(() => {
    const sorted = [...data.tickers].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker);
          break;
        case 'completeness':
          comparison = a.completenessRate - b.completenessRate;
          break;
        case 'missing':
          comparison = a.missingFeatures.length - b.missingFeatures.length;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [data.tickers, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
  };

  const getCompletenessColor = (rate: number) => {
    if (rate >= 0.95) return '#10b981'; // green
    if (rate >= 0.85) return '#f59e0b'; // yellow
    return '#dc2626'; // red
  };

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
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
          gap: '1rem' 
        }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
              Overall Completeness
            </div>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              color: getCompletenessColor(data.overallCompleteness) 
            }}>
              {(data.overallCompleteness * 100).toFixed(1)}%
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
              Date Range
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
              {data.dateRange.start} to {data.dateRange.end}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
              Tickers Below 95%
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
              {data.tickers.filter(t => t.completenessRate < 0.95).length}
            </div>
          </div>
        </div>

        {/* Completeness Trend Chart */}
        {data.trends && data.trends.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>
              Completeness Trend (Last {data.trends.length} days)
            </div>
            <Sparkline
              data={data.trends.map(t => t.completeness * 100)}
              width={isMobile ? 300 : 600}
              height={60}
              color="#8b5cf6"
              showTooltip={true}
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: isMobile ? '0.8125rem' : '0.875rem'
        }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
              <th 
                onClick={() => handleSort('ticker')}
                style={{ 
                  padding: isMobile ? '0.75rem 0.5rem' : '1rem', 
                  textAlign: 'left', 
                  fontWeight: '600',
                  color: theme.text,
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Ticker
                  <SortIcon field="ticker" />
                </div>
              </th>
              <th 
                onClick={() => handleSort('completeness')}
                style={{ 
                  padding: isMobile ? '0.75rem 0.5rem' : '1rem', 
                  textAlign: 'right', 
                  fontWeight: '600',
                  color: theme.text,
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  Completeness
                  <SortIcon field="completeness" />
                </div>
              </th>
              <th 
                style={{ 
                  padding: isMobile ? '0.75rem 0.5rem' : '1rem', 
                  textAlign: 'right', 
                  fontWeight: '600',
                  color: theme.text
                }}
              >
                Data Points
              </th>
              <th 
                onClick={() => handleSort('missing')}
                style={{ 
                  padding: isMobile ? '0.75rem 0.5rem' : '1rem', 
                  textAlign: 'right', 
                  fontWeight: '600',
                  color: theme.text,
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  Missing Features
                  <SortIcon field="missing" />
                </div>
              </th>
              {!isMobile && (
                <th 
                  style={{ 
                    padding: '1rem', 
                    textAlign: 'center', 
                    fontWeight: '600',
                    color: theme.text
                  }}
                >
                  Trend
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedTickers.map((ticker) => {
              const isExpanded = expandedTicker === ticker.ticker;
              const isLowCompleteness = ticker.completenessRate < 0.95;
              
              return (
                <React.Fragment key={ticker.ticker}>
                  <tr 
                    onClick={() => setExpandedTicker(isExpanded ? null : ticker.ticker)}
                    style={{ 
                      borderBottom: `1px solid ${theme.border}`,
                      backgroundColor: isLowCompleteness ? (darkMode ? '#7f1d1d20' : '#fef2f2') : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isLowCompleteness ? (darkMode ? '#7f1d1d20' : '#fef2f2') : 'transparent'}
                  >
                    <td style={{ 
                      padding: isMobile ? '0.75rem 0.5rem' : '1rem',
                      fontWeight: '600',
                      color: theme.text
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {ticker.ticker}
                        {isLowCompleteness && <AlertTriangle size={16} color="#dc2626" />}
                      </div>
                    </td>
                    <td style={{ 
                      padding: isMobile ? '0.75rem 0.5rem' : '1rem',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: getCompletenessColor(ticker.completenessRate)
                    }}>
                      {(ticker.completenessRate * 100).toFixed(1)}%
                    </td>
                    <td style={{ 
                      padding: isMobile ? '0.75rem 0.5rem' : '1rem',
                      textAlign: 'right',
                      color: theme.textSecondary
                    }}>
                      {ticker.presentDataPoints} / {ticker.expectedDataPoints}
                    </td>
                    <td style={{ 
                      padding: isMobile ? '0.75rem 0.5rem' : '1rem',
                      textAlign: 'right',
                      color: ticker.missingFeatures.length > 0 ? '#dc2626' : theme.textSecondary
                    }}>
                      {ticker.missingFeatures.length}
                    </td>
                    {!isMobile && (
                      <td style={{ 
                        padding: '1rem',
                        textAlign: 'center'
                      }}>
                        {ticker.trend && ticker.trend.length > 0 && (
                          <Sparkline
                            data={ticker.trend}
                            width={80}
                            height={30}
                            color={getCompletenessColor(ticker.completenessRate)}
                            showTooltip={false}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                  
                  {/* Expanded Row - Missing Features */}
                  {isExpanded && ticker.missingFeatures.length > 0 && (
                    <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td 
                        colSpan={isMobile ? 4 : 5} 
                        style={{ 
                          padding: isMobile ? '0.75rem 0.5rem' : '1rem',
                          backgroundColor: darkMode ? '#0e0c1e' : '#f8fafc'
                        }}
                      >
                        <div style={{ fontSize: '0.8125rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>
                          Missing Features:
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: '0.5rem' 
                        }}>
                          {ticker.missingFeatures.map((feature, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '0.25rem 0.75rem',
                                backgroundColor: darkMode ? '#363258' : '#e2e8f0',
                                color: theme.text,
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '500'
                              }}
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
