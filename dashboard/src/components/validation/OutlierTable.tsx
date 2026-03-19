import React, { useState, useMemo } from 'react';
import { Card } from './Card';

interface OutlierPrediction {
  ticker: string;
  date: string;
  predicted: number;
  actual: number;
  error: number;
  errorPercentage: number;
  sector?: string;
  features?: Record<string, number>;
}

interface OutlierTableProps {
  data: OutlierPrediction[];
  threshold?: number; // Standard deviations threshold (default: 3)
  loading?: boolean;
  error?: Error;
  onOutlierClick?: (outlier: OutlierPrediction) => void;
}

/**
 * OutlierTable - Displays and analyzes prediction outliers
 * 
 * Requirements:
 * - 14.1: Identify outlier predictions on Validation tab
 * - 14.2: Define outliers as errors exceeding 3 standard deviations
 * - 14.3: Display table with ticker, predicted, actual, error
 * - 14.4: Highlight outliers in scatter plot (handled by parent)
 * - 14.5: Calculate percentage of predictions that are outliers
 * - 14.6: Allow users to click outlier entries for detailed information
 * - 14.7: Group outliers by error direction (over-prediction vs under-prediction)
 * - 14.8: Display common characteristics of outlier predictions
 */
export const OutlierTable: React.FC<OutlierTableProps> = ({
  data,
  threshold = 3,
  loading = false,
  error,
  onOutlierClick,
}) => {
  const [sortBy, setSortBy] = useState<'error' | 'date' | 'ticker'>('error');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterDirection, setFilterDirection] = useState<'all' | 'over' | 'under'>('all');

  // Calculate statistics and identify outliers
  const outlierAnalysis = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        outliers: [],
        totalPredictions: 0,
        outlierPercentage: 0,
        meanError: 0,
        stdError: 0,
        overPredictions: [],
        underPredictions: [],
        commonCharacteristics: {
          mostCommonSector: 'N/A',
          avgPredicted: 0,
          avgActual: 0,
        },
      };
    }

    // Calculate mean and standard deviation
    const errors = data.map((d) => d.error);
    const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const variance =
      errors.reduce((sum, err) => sum + Math.pow(err - meanError, 2), 0) / errors.length;
    const stdError = Math.sqrt(variance);

    // Identify outliers (errors > threshold * std dev)
    const outliers = data.filter((d) => Math.abs(d.error) > threshold * stdError);

    // Group by direction
    const overPredictions = outliers.filter((o) => o.error > 0);
    const underPredictions = outliers.filter((o) => o.error < 0);

    // Calculate outlier percentage
    const outlierPercentage = (outliers.length / data.length) * 100;

    // Analyze common characteristics
    const sectorCounts: Record<string, number> = {};
    outliers.forEach((o) => {
      if (o.sector) {
        sectorCounts[o.sector] = (sectorCounts[o.sector] || 0) + 1;
      }
    });

    const commonCharacteristics = {
      mostCommonSector: Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
      avgPredicted:
        outliers.reduce((sum, o) => sum + Math.abs(o.predicted), 0) / outliers.length || 0,
      avgActual: outliers.reduce((sum, o) => sum + Math.abs(o.actual), 0) / outliers.length || 0,
    };

    return {
      outliers,
      totalPredictions: data.length,
      outlierPercentage,
      meanError,
      stdError,
      overPredictions,
      underPredictions,
      commonCharacteristics,
    };
  }, [data, threshold]);

  // Filter and sort outliers
  const displayedOutliers = useMemo(() => {
    let filtered = outlierAnalysis.outliers;

    // Apply direction filter
    if (filterDirection === 'over') {
      filtered = outlierAnalysis.overPredictions;
    } else if (filterDirection === 'under') {
      filtered = outlierAnalysis.underPredictions;
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'error':
          comparison = Math.abs(a.error) - Math.abs(b.error);
          break;
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [outlierAnalysis, sortBy, sortOrder, filterDirection]);

  const handleSort = (column: 'error' | 'date' | 'ticker') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading outlier analysis...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
          <p>Error loading outlier analysis: {error.message}</p>
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          <p>No data available for outlier analysis</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600' }}>
          Outlier Analysis
        </h3>

        {/* Summary statistics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Total Outliers
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>
              {outlierAnalysis.outliers.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              {outlierAnalysis.outlierPercentage.toFixed(2)}% of predictions
            </div>
          </div>

          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Over-Predictions
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>
              {outlierAnalysis.overPredictions.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Predicted too high
            </div>
          </div>

          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Under-Predictions
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
              {outlierAnalysis.underPredictions.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Predicted too low
            </div>
          </div>

          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Common Sector
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>
              {outlierAnalysis.commonCharacteristics.mostCommonSector}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Most frequent in outliers
            </div>
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => setFilterDirection('all')}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              backgroundColor: filterDirection === 'all' ? '#3b82f6' : 'white',
              color: filterDirection === 'all' ? 'white' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            All ({outlierAnalysis.outliers.length})
          </button>
          <button
            onClick={() => setFilterDirection('over')}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              backgroundColor: filterDirection === 'over' ? '#f59e0b' : 'white',
              color: filterDirection === 'over' ? 'white' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Over-Predictions ({outlierAnalysis.overPredictions.length})
          </button>
          <button
            onClick={() => setFilterDirection('under')}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              backgroundColor: filterDirection === 'under' ? '#3b82f6' : 'white',
              color: filterDirection === 'under' ? 'white' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Under-Predictions ({outlierAnalysis.underPredictions.length})
          </button>
        </div>

        {/* Outlier table */}
        {displayedOutliers.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th
                    onClick={() => handleSort('ticker')}
                    style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    Ticker {sortBy === 'ticker' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('date')}
                    style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    style={{
                      padding: '0.75rem',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: '#374151',
                    }}
                  >
                    Predicted
                  </th>
                  <th
                    style={{
                      padding: '0.75rem',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: '#374151',
                    }}
                  >
                    Actual
                  </th>
                  <th
                    onClick={() => handleSort('error')}
                    style={{
                      padding: '0.75rem',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: '#374151',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    Error {sortBy === 'error' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#374151',
                    }}
                  >
                    Direction
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedOutliers.map((outlier, index) => (
                  <tr
                    key={`${outlier.ticker}-${outlier.date}-${index}`}
                    onClick={() => onOutlierClick && onOutlierClick(outlier)}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      cursor: onOutlierClick ? 'pointer' : 'default',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (onOutlierClick) {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: '0.75rem', fontWeight: '500', color: '#1f2937' }}>
                      {outlier.ticker}
                    </td>
                    <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                      {new Date(outlier.date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>
                      {outlier.predicted.toFixed(2)}%
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>
                      {outlier.actual.toFixed(2)}%
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: outlier.error > 0 ? '#f59e0b' : '#3b82f6',
                      }}
                    >
                      {outlier.error > 0 ? '+' : ''}
                      {outlier.error.toFixed(2)}%
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          backgroundColor: outlier.error > 0 ? '#fef3c7' : '#dbeafe',
                          color: outlier.error > 0 ? '#92400e' : '#1e40af',
                        }}
                      >
                        {outlier.error > 0 ? 'Over' : 'Under'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
            <p>No outliers found with the current filter</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default OutlierTable;
