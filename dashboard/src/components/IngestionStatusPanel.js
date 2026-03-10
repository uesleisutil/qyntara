import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

/**
 * IngestionStatusPanel Component
 * 
 * Displays data ingestion metrics and execution history:
 * - Success rate for last 24 hours
 * - Total executions, successful executions, and failed executions
 * - Bar chart showing records ingested over last 24 hours
 * - Status indicator based on success rate thresholds
 * 
 * Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 * 
 * Performance optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Recharts' ResponsiveContainer handles efficient rendering
 */
const IngestionStatusPanel = React.memo(({ ingestionData }) => {
  // Filter data to last 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentIngestion = ingestionData.filter(d => 
    new Date(d.timestamp) > cutoff
  );

  // Calculate success rate for last 24 hours
  const totalExecutions = recentIngestion.length;
  const successfulExecutions = recentIngestion.filter(d => d.status === 'success').length;
  const failedExecutions = recentIngestion.filter(d => d.status === 'error').length;
  const successRate = totalExecutions > 0 
    ? (successfulExecutions / totalExecutions * 100)
    : 0;

  // Determine status indicator based on success rate
  const getStatusIndicator = () => {
    if (successRate >= 90) {
      return { icon: CheckCircle, color: '#10b981', label: 'Saudável' };
    } else if (successRate >= 70) {
      return { icon: AlertTriangle, color: '#f59e0b', label: 'Atenção' };
    } else {
      return { icon: XCircle, color: '#ef4444', label: 'Crítico' };
    }
  };

  const statusIndicator = getStatusIndicator();
  const StatusIcon = statusIndicator.icon;

  // Handle empty state
  if (totalExecutions === 0) {
    return <p>Nenhum dado de ingestão disponível nas últimas 24 horas</p>;
  }

  // Show warning if all executions failed
  if (successfulExecutions === 0 && totalExecutions > 0) {
    return (
      <>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          marginBottom: '1rem',
          padding: '1rem',
          backgroundColor: '#fef3c7',
          borderRadius: '0.5rem'
        }}>
          <AlertTriangle size={24} color="#f59e0b" />
          <div>
            <div style={{ fontWeight: 'bold', color: '#f59e0b' }}>
              Ingestão sem sucesso nas últimas 24h
            </div>
            <div style={{ fontSize: '0.875rem', color: '#92400e' }}>
              {totalExecutions} tentativas realizadas, mas nenhum dado novo foi ingerido. 
              Isso pode indicar que a API externa não está retornando dados novos ou que a bolsa está fechada.
            </div>
          </div>
        </div>
        
        <div className="metric-grid">
          <div className="metric">
            <div className="metric-value">0%</div>
            <div className="metric-label">Taxa de Sucesso (24h)</div>
          </div>
          <div className="metric">
            <div className="metric-value">{totalExecutions}</div>
            <div className="metric-label">Tentativas (24h)</div>
          </div>
          <div className="metric">
            <div className="metric-value">0</div>
            <div className="metric-label">Sucessos</div>
          </div>
          <div className="metric">
            <div className="metric-value">{failedExecutions}</div>
            <div className="metric-label">Sem Dados</div>
          </div>
        </div>
      </>
    );
  }

  // Prepare chart data (last 24 hours)
  const chartData = recentIngestion;

  return (
    <>
      {/* Status indicator */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem', 
        marginBottom: '1rem' 
      }}>
        <StatusIcon size={24} color={statusIndicator.color} />
        <span style={{ fontWeight: 'bold', color: statusIndicator.color }}>
          {statusIndicator.label}
        </span>
      </div>

      {/* Metrics display */}
      <div className="metric-grid">
        <div className="metric">
          <div className="metric-value">{successRate.toFixed(1)}%</div>
          <div className="metric-label">Taxa de Sucesso (24h)</div>
        </div>
        <div className="metric">
          <div className="metric-value">{totalExecutions}</div>
          <div className="metric-label">Execuções (24h)</div>
        </div>
        <div className="metric">
          <div className="metric-value">{successfulExecutions}</div>
          <div className="metric-label">Sucessos</div>
        </div>
        <div className="metric">
          <div className="metric-value">{failedExecutions}</div>
          <div className="metric-label">Erros</div>
        </div>
      </div>

      {/* Bar chart for records ingested (only show if we have data) */}
      {chartData.length > 0 && (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => format(new Date(value), 'HH:mm')}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => format(new Date(value), 'dd/MM HH:mm', { locale: ptBR })}
                formatter={(value) => [value, 'Registros Ingeridos']}
              />
              <Bar dataKey="records_ingested" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
});

IngestionStatusPanel.displayName = 'IngestionStatusPanel';

export default IngestionStatusPanel;
