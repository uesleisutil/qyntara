/**
 * Data Quality Tab Component
 * 
 * Implements Requirements:
 * - 21.1: Display Data Quality tab with sections for completeness, anomalies, freshness, coverage
 * 
 * Features:
 * - Completeness monitoring per ticker
 * - Anomaly detection and listing
 * - Data freshness indicators
 * - Universe coverage metrics
 */

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Target } from 'lucide-react';
import { CompletenessTable } from './CompletenessTable';
import { AnomalyList } from './AnomalyList';
import { FreshnessIndicators } from './FreshnessIndicators';
import { CoverageMetrics } from './CoverageMetrics';
import { useDataQuality } from '../../hooks/useDataQuality';
import LoadingSpinner from '../shared/LoadingSpinner';
import Card from '../shared/Card';
import { KPICard } from '../shared/KPICard';

interface DataQualityTabProps {
  darkMode?: boolean;
  isMobile?: boolean;
}

export const DataQualityTab: React.FC<DataQualityTabProps> = ({ 
  darkMode = false, 
  isMobile = false 
}) => {
  const [days, setDays] = useState(30);
  const { data, loading, error } = useDataQuality(days) as any;

  const theme = {
    bg: darkMode ? '#0c0a1a' : '#f8fafc',
    cardBg: darkMode ? '#1a1836' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#9895b0' : '#64748b',
    border: darkMode ? '#2a2745' : '#e2e8f0',
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px' 
      }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <Card title={null} subtitle={null} icon={null} actions={null}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem',
          color: '#dc2626' 
        }}>
          <AlertTriangle size={20} />
          <span>Error loading data quality metrics: {error}</span>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card title={null} subtitle={null} icon={null} actions={null}>
        <div style={{ textAlign: 'center', color: theme.textSecondary }}>
          No data quality metrics available
        </div>
      </Card>
    );
  }

  const { completeness, anomalies, freshness, coverage } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1.5rem' }}>
      {/* Header with period selector */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: isMobile ? '1.25rem' : '1.5rem', 
          fontWeight: '700', 
          color: theme.text 
        }}>
          Data Quality Monitoring
        </h2>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.875rem', color: theme.textSecondary }}>
            Period:
          </label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              backgroundColor: theme.cardBg,
              color: theme.text,
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: isMobile ? '1rem' : '1.25rem'
      }}>
        <KPICard
          title="Overall Completeness"
          value={`${(completeness.overallCompleteness * 100).toFixed(1)}%`}
          trend={completeness.overallCompleteness >= 0.95 ? 'up' : 'down'}
          icon={<CheckCircle size={20} />}
        />
        
        <KPICard
          title="Anomalies Detected"
          value={anomalies.totalAnomalies}
          change={anomalies.anomalyRate}
          changeLabel="anomaly rate"
          trend={anomalies.anomalyRate < 0.05 ? 'up' : 'down'}
          icon={<AlertTriangle size={20} />}
        />
        
        <KPICard
          title="Data Freshness"
          value={freshness.currentSourcesPercentage ? `${(freshness.currentSourcesPercentage * 100).toFixed(0)}%` : 'N/A'}
          trend={freshness.currentSourcesPercentage >= 0.9 ? 'up' : 'down'}
          icon={<Clock size={20} />}
        />
        
        <KPICard
          title="Universe Coverage"
          value={`${(coverage.coverageRate * 100).toFixed(1)}%`}
          trend={coverage.coverageRate >= 0.9 ? 'up' : 'down'}
          icon={<Target size={20} />}
        />
      </div>

      {/* Data Completeness Section */}
      <section>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: isMobile ? '1.125rem' : '1.25rem', 
          fontWeight: '600', 
          color: theme.text 
        }}>
          Data Completeness by Ticker
        </h3>
        <CompletenessTable 
          data={completeness} 
          darkMode={darkMode} 
          isMobile={isMobile} 
        />
      </section>

      {/* Anomaly Detection Section */}
      <section>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: isMobile ? '1.125rem' : '1.25rem', 
          fontWeight: '600', 
          color: theme.text 
        }}>
          Detected Anomalies
        </h3>
        <AnomalyList 
          data={anomalies} 
          darkMode={darkMode} 
          isMobile={isMobile} 
        />
      </section>

      {/* Data Freshness Section */}
      <section>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: isMobile ? '1.125rem' : '1.25rem', 
          fontWeight: '600', 
          color: theme.text 
        }}>
          Data Freshness by Source
        </h3>
        <FreshnessIndicators 
          data={freshness} 
          darkMode={darkMode} 
          isMobile={isMobile} 
        />
      </section>

      {/* Universe Coverage Section */}
      <section>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: isMobile ? '1.125rem' : '1.25rem', 
          fontWeight: '600', 
          color: theme.text 
        }}>
          Universe Coverage Metrics
        </h3>
        <CoverageMetrics 
          data={coverage} 
          darkMode={darkMode} 
          isMobile={isMobile} 
        />
      </section>
    </div>
  );
};

export default DataQualityTab;
