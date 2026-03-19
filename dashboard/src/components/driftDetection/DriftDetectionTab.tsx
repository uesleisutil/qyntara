/**
 * Drift Detection Tab Component
 * 
 * Implements Requirements:
 * - 25.1: Display Drift Detection tab with sections for data drift, concept drift, degradation, retraining
 * 
 * Features:
 * - Data drift detection with KS test
 * - Concept drift detection with correlation changes
 * - Performance degradation alerts
 * - Retraining recommendations
 */

import React, { useState } from 'react';
import { AlertTriangle, TrendingDown, RefreshCw, Target } from 'lucide-react';
import { useDrift } from '../../hooks/useDrift';
import LoadingSpinner from '../shared/LoadingSpinner';
import { KPICard } from '../shared/KPICard';
import { DataDriftChart } from './DataDriftChart';
import { ConceptDriftHeatmap } from './ConceptDriftHeatmap';
import { DegradationAlerts } from './DegradationAlerts';
import { RetrainingRecommendations } from './RetrainingRecommendations';

interface DriftDetectionTabProps {
  darkMode?: boolean;
  isMobile?: boolean;
}

export const DriftDetectionTab: React.FC<DriftDetectionTabProps> = ({ 
  darkMode = false, 
  isMobile = false 
}) => {
  const [days, setDays] = useState(90); // Display drift results for past 90 days (Req 25.8)
  const queryResult: any = useDrift({ days, enabled: true, refetchInterval: 5 * 60 * 1000 });
  const { data, isLoading, error, refresh } = queryResult;

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };

  if (isLoading) {
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: '#dc2626',
        padding: '1.5rem',
        backgroundColor: darkMode ? '#1e293b' : 'white',
        borderRadius: '8px',
        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
      }}>
        <AlertTriangle size={20} />
        <span>Error loading drift detection metrics: {error instanceof Error ? error.message : 'Unknown error'}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        textAlign: 'center',
        color: darkMode ? '#94a3b8' : '#64748b',
        padding: '1.5rem',
        backgroundColor: darkMode ? '#1e293b' : 'white',
        borderRadius: '8px',
        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
      }}>
        No drift detection data available
      </div>
    );
  }

  // Calculate summary metrics
  const driftedFeaturesCount = data.drifted_features?.length || 0;
  const totalFeatures = data.all_features?.length || 0;
  const driftPercentage = totalFeatures > 0 ? (driftedFeaturesCount / totalFeatures) * 100 : 0;
  
  const performanceDegraded = data.performance_drift || false;
  const mapeChange = data.mape_change_percentage || 0;

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
          Drift Detection & Model Monitoring
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
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          
          <button
            onClick={() => refresh()}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              backgroundColor: theme.cardBg,
              color: theme.text,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: isMobile ? '1rem' : '1.25rem'
      }}>
        <KPICard
          title="Drifted Features"
          value={`${driftedFeaturesCount} / ${totalFeatures}`}
          change={driftPercentage}
          changeLabel="% of features"
          trend={driftPercentage < 30 ? 'up' : 'down'}
          icon={<TrendingDown size={20} />}
        />
        
        <KPICard
          title="Performance Status"
          value={performanceDegraded ? 'Degraded' : 'Stable'}
          trend={performanceDegraded ? 'down' : 'up'}
          icon={<Target size={20} />}
        />
        
        <KPICard
          title="MAPE Change"
          value={`${mapeChange >= 0 ? '+' : ''}${mapeChange.toFixed(1)}%`}
          trend={Math.abs(mapeChange) < 20 ? 'up' : 'down'}
          icon={<AlertTriangle size={20} />}
        />
        
        <KPICard
          title="Retraining Status"
          value={driftPercentage > 30 || performanceDegraded ? 'Recommended' : 'Not Needed'}
          trend={driftPercentage > 30 || performanceDegraded ? 'down' : 'up'}
          icon={<RefreshCw size={20} />}
        />
      </div>

      {/* Data Drift Section - Implements sub-task 9.2 */}
      <section>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: isMobile ? '1.125rem' : '1.25rem', 
          fontWeight: '600', 
          color: theme.text 
        }}>
          Data Drift Detection
        </h3>
        <DataDriftChart 
          driftData={data.data_drift || []}
          darkMode={darkMode}
          isMobile={isMobile}
        />
      </section>

      {/* Concept Drift Section - Implements sub-task 9.4 */}
      <section>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: isMobile ? '1.125rem' : '1.25rem', 
          fontWeight: '600', 
          color: theme.text 
        }}>
          Concept Drift Detection
        </h3>
        <ConceptDriftHeatmap 
          conceptDriftData={data.concept_drift || []}
          darkMode={darkMode}
          isMobile={isMobile}
        />
      </section>

      {/* Performance Degradation Section - Implements sub-task 9.6 */}
      <section>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: isMobile ? '1.125rem' : '1.25rem', 
          fontWeight: '600', 
          color: theme.text 
        }}>
          Performance Degradation Alerts
        </h3>
        <DegradationAlerts
          performanceDegradation={data.performance_degradation || []}
          driftEvents={data.drift_events || []}
          darkMode={darkMode}
          isMobile={isMobile}
        />
      </section>

      {/* Retraining Recommendations Section - Implements sub-task 9.8 */}
      <section>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: isMobile ? '1.125rem' : '1.25rem', 
          fontWeight: '600', 
          color: theme.text 
        }}>
          Retraining Recommendations
        </h3>
        <RetrainingRecommendations
          driftedFeaturesPercentage={driftPercentage}
          conceptDriftDetected={data.concept_drift_detected || false}
          performanceDegradationDays={data.performance_degradation_days || 0}
          daysSinceLastTraining={data.days_since_last_training || 0}
          darkMode={darkMode}
          isMobile={isMobile}
        />
      </section>
    </div>
  );
};

export default DriftDetectionTab;
