import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle } from 'lucide-react';

/**
 * ModelQualityPanel Component
 * 
 * Displays model quality metrics and historical trends:
 * - Current MAPE, coverage, successful predictions, and total predictions
 * - Line chart showing MAPE and coverage trends over last 14 days
 * - Warning indicators when MAPE > 15% or coverage < 80%
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.5, 2.6
 * 
 * Performance optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Recharts' ResponsiveContainer handles efficient rendering
 */
const ModelQualityPanel = React.memo(({ qualityData }) => {
  // Get current quality metrics (most recent data point)
  const currentQuality = qualityData.length > 0 ? qualityData[qualityData.length - 1] : null;
  
  // Filter data to last 14 days for the chart
  const chartData = qualityData.slice(-14);
  
  // Check for warning conditions
  const mapeWarning = currentQuality && currentQuality.mape > 0.15;
  const coverageWarning = currentQuality && currentQuality.coverage < 0.80;
  const hasWarning = mapeWarning || coverageWarning;

  // Handle empty state
  if (!currentQuality) {
    return <p>Dados de qualidade não disponíveis</p>;
  }

  return (
    <>
      {/* Warning indicators */}
      {hasWarning && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          padding: '0.75rem', 
          backgroundColor: '#fef3c7', 
          borderRadius: '4px', 
          marginBottom: '1rem',
          color: '#92400e'
        }}>
          <AlertTriangle size={20} />
          <div>
            {mapeWarning && <div>MAPE acima do limite (15%)</div>}
            {coverageWarning && <div>Cobertura abaixo do limite (80%)</div>}
          </div>
        </div>
      )}

      {/* Metrics display */}
      <div className="metric-grid">
        <div className="metric">
          <div className="metric-value">{(currentQuality.mape * 100).toFixed(1)}%</div>
          <div className="metric-label">MAPE</div>
        </div>
        <div className="metric">
          <div className="metric-value">{(currentQuality.coverage * 100).toFixed(1)}%</div>
          <div className="metric-label">Cobertura</div>
        </div>
        <div className="metric">
          <div className="metric-value">{currentQuality.successful_predictions}</div>
          <div className="metric-label">Predições OK</div>
        </div>
        <div className="metric">
          <div className="metric-value">{currentQuality.total_predictions}</div>
          <div className="metric-label">Total Predições</div>
        </div>
      </div>
      
      {/* Line chart for trends (only show if we have multiple data points) */}
      {chartData.length > 1 && (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="dt" 
                tickFormatter={(value) => format(parseISO(value), 'dd/MM', { locale: ptBR })}
              />
              <YAxis 
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                labelFormatter={(value) => format(parseISO(value), 'dd/MM/yyyy', { locale: ptBR })}
                formatter={(value, name) => [
                  `${(value * 100).toFixed(1)}%`,
                  name === 'mape' ? 'MAPE' : 'Cobertura'
                ]}
              />
              <Line 
                type="monotone" 
                dataKey="mape" 
                stroke="#ef4444" 
                strokeWidth={2}
                name="mape"
              />
              <Line 
                type="monotone" 
                dataKey="coverage" 
                stroke="#10b981" 
                strokeWidth={2}
                name="coverage"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
});

ModelQualityPanel.displayName = 'ModelQualityPanel';

export default ModelQualityPanel;
