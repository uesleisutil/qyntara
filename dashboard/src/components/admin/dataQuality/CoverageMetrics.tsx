/**
 * Coverage Metrics Component
 * 
 * Implements Requirements:
 * - 24.1: Calculate coverage (covered tickers / universe size * 100)
 * - 24.2: Display total universe size
 * - 24.3: Display number of tickers with sufficient data
 * - 24.4: Display number of excluded tickers with reasons
 * - 24.5: List excluded tickers
 * - 24.6: Track coverage trends over time
 * - 24.7: Highlight when coverage < 90%
 * - 24.8: Requirements validation
 */

import React, { useState } from 'react';
import { TrendingDown, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import Card from '../../shared/ui/Card';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { LineChart } from '../../charts/LineChart';

interface ExcludedTicker {
  ticker: string;
  reason: string;
  excludedDate: string;
}

interface CoverageData {
  universeSize: number;
  coveredTickers: number;
  excludedTickers: ExcludedTicker[];
  coverageRate: number;
  trends: Array<{
    date: string;
    coverage: number;
  }>;
}

interface CoverageMetricsProps {
  data: CoverageData;
  darkMode?: boolean;
  isMobile?: boolean;
}

export const CoverageMetrics: React.FC<CoverageMetricsProps> = ({ 
  data, 
  darkMode = false, 
  isMobile = false 
}) => {
  const [showExcluded, setShowExcluded] = useState(false);

  const theme = {
    cardBg: darkMode ? '#1e1b40' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#b8b5d0' : '#64748b',
    border: darkMode ? '#363258' : '#e2e8f0',
    hover: darkMode ? '#363258' : '#f8fafc',
  };

  const isLowCoverage = data.coverageRate < 0.9;
  const coverageColor = data.coverageRate >= 0.9 ? '#10b981' : data.coverageRate >= 0.8 ? '#f59e0b' : '#dc2626';

  // Group excluded tickers by reason
  const excludedByReason = data.excludedTickers.reduce((acc, ticker) => {
    if (!acc[ticker.reason]) {
      acc[ticker.reason] = [];
    }
    acc[ticker.reason].push(ticker);
    return acc;
  }, {} as Record<string, ExcludedTicker[]>);

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
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
              Universe Size
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: theme.text }}>
              {data.universeSize}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
              Covered Tickers
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
              {data.coveredTickers}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
              Excluded Tickers
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
              {data.excludedTickers.length}
            </div>
          </div>
        </div>

        {/* Coverage Rate */}
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary }}>
              Coverage Rate
            </div>
            <div style={{ 
              fontSize: '1.25rem', 
              fontWeight: '700', 
              color: coverageColor 
            }}>
              {(data.coverageRate * 100).toFixed(1)}%
            </div>
          </div>
          
          <ProgressBar
            value={data.coverageRate * 100}
            max={100}
            color={data.coverageRate >= 0.9 ? 'green' : data.coverageRate >= 0.8 ? 'yellow' : 'red'}
            size="lg"
            showPercentage={false}
          />
          
          {isLowCoverage && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              marginTop: '0.5rem',
              padding: '0.75rem',
              backgroundColor: '#dc262620',
              borderRadius: '6px'
            }}>
              <AlertTriangle size={16} color="#dc2626" />
              <span style={{ fontSize: '0.875rem', color: '#dc2626', fontWeight: '500' }}>
                Coverage below 90% threshold
              </span>
            </div>
          )}
        </div>

        {/* Coverage Trend */}
        {data.trends && data.trends.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>
              Coverage Trend (Last {data.trends.length} days)
            </div>
            <LineChart
              data={data.trends.map(t => ({ date: t.date, coverage: t.coverage * 100 }))}
              xKey="date"
              yKeys={['coverage']}
              height={150}
              colors={[coverageColor]}
              showLegend={false}
              showGrid={true}
            />
          </div>
        )}
      </div>

      {/* Excluded Tickers Section */}
      <div>
        <button
          onClick={() => setShowExcluded(!showExcluded)}
          style={{
            width: '100%',
            padding: '1rem',
            backgroundColor: darkMode ? '#0e0c1e' : '#f8fafc',
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem',
            fontSize: isMobile ? '0.9375rem' : '1rem',
            fontWeight: '600',
            color: theme.text
          }}>
            <TrendingDown size={20} color="#dc2626" />
            Excluded Tickers ({data.excludedTickers.length})
          </div>
          {showExcluded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>

        {showExcluded && (
          <div style={{ 
            marginTop: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {Object.entries(excludedByReason).map(([reason, tickers]) => (
              <div
                key={reason}
                style={{
                  padding: isMobile ? '1rem' : '1.25rem',
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                  backgroundColor: darkMode ? '#0e0c1e' : '#f8fafc'
                }}
              >
                <div style={{ 
                  fontSize: '0.9375rem', 
                  fontWeight: '600', 
                  color: theme.text,
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertTriangle size={16} color="#f59e0b" />
                  {reason} ({tickers.length})
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.5rem' 
                }}>
                  {tickers.map((ticker) => (
                    <div
                      key={ticker.ticker}
                      style={{
                        padding: '0.5rem 0.75rem',
                        backgroundColor: darkMode ? '#363258' : '#e2e8f0',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: theme.text,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem'
                      }}
                      title={`Excluded on ${new Date(ticker.excludedDate).toLocaleDateString()}`}
                    >
                      <span>{ticker.ticker}</span>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        color: theme.textSecondary 
                      }}>
                        {new Date(ticker.excludedDate).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
