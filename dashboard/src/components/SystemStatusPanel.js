import React from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

/**
 * SystemStatusPanel Component
 * 
 * Displays overall system health with status indicators for each subsystem:
 * - Ingestion: Green check when success rate ≥ 90%, warning/error otherwise
 * - Model Quality: Green check when MAPE ≤ 15% AND coverage ≥ 80%, warning/error otherwise
 * - Recommendations: Green check when data available, error otherwise
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 * 
 * Performance optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 */
const SystemStatusPanel = React.memo(({ recommendations, qualityData, ingestionData }) => {
  // Calculate ingestion success rate (last 24 hours)
  const recentIngestion = ingestionData.filter(d => 
    new Date(d.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  const ingestionSuccessRate = recentIngestion.length > 0 
    ? (recentIngestion.filter(d => d.status === 'success').length / recentIngestion.length * 100)
    : 0;
  
  // Get current quality metrics
  const currentQuality = qualityData.length > 0 ? qualityData[qualityData.length - 1] : null;
  
  // Determine health status for each subsystem
  const ingestionHealthy = ingestionSuccessRate >= 90;
  
  const qualityHealthy = currentQuality && 
    currentQuality.mape <= 0.15 && 
    currentQuality.coverage >= 0.80;
  
  const qualityWarning = currentQuality && 
    (currentQuality.mape > 0.15 || currentQuality.coverage < 0.80);
  
  const recommendationsHealthy = recommendations.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Ingestion Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Ingestão de Dados</span>
        {ingestionHealthy ? (
          <CheckCircle size={20} color="#10b981" />
        ) : (
          <XCircle size={20} color="#ef4444" />
        )}
      </div>
      
      {/* Model Quality Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Qualidade do Modelo</span>
        {qualityHealthy ? (
          <CheckCircle size={20} color="#10b981" />
        ) : qualityWarning ? (
          <AlertTriangle size={20} color="#f59e0b" />
        ) : (
          <XCircle size={20} color="#ef4444" />
        )}
      </div>
      
      {/* Recommendations Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Recomendações</span>
        {recommendationsHealthy ? (
          <CheckCircle size={20} color="#10b981" />
        ) : (
          <XCircle size={20} color="#ef4444" />
        )}
      </div>
    </div>
  );
});

SystemStatusPanel.displayName = 'SystemStatusPanel';

export default SystemStatusPanel;
