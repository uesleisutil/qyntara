/**
 * DataQualityPanel Component
 * 
 * Displays data quality metrics:
 * - Status da última ingestão
 * - Score de qualidade dos dados históricos
 * - Gráfico de evolução de métricas de qualidade
 * 
 * Requirements: 11.2, 11.3, 11.4
 */

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Database, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DataQualityPanel = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Carregando dados de qualidade...
      </div>
    );
  }

  if (!data || !data.latest) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Sem dados de qualidade disponíveis
      </div>
    );
  }

  const { latest, time_series, summary } = data;

  // Status da última ingestão
  const getStatusIcon = (completeness) => {
    if (completeness >= 95) return <CheckCircle size={20} color="#10b981" />;
    if (completeness >= 90) return <AlertTriangle size={20} color="#f59e0b" />;
    return <XCircle size={20} color="#ef4444" />;
  };

  const getStatusColor = (completeness) => {
    if (completeness >= 95) return '#10b981';
    if (completeness >= 90) return '#f59e0b';
    return '#ef4444';
  };

  // Preparar dados do gráfico
  const chartData = time_series?.quality_scores?.map(item => ({
    date: item.date,
    qualityScore: item.quality_score,
    completeness: item.completeness * 100,
    errorRate: item.error_rate * 100
  })) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Status da última ingestão */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Database size={24} color="#3b82f6" />
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
            Status da Última Ingestão
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Timestamp</p>
            <p style={{ fontSize: '1rem', fontWeight: '500', color: '#1e293b', margin: 0 }}>
              {latest.date ? format(parseISO(latest.date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
            </p>
          </div>

          <div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Completude</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {getStatusIcon(latest.completeness * 100)}
              <p style={{ 
                fontSize: '1rem', 
                fontWeight: '600', 
                color: getStatusColor(latest.completeness * 100),
                margin: 0 
              }}>
                {(latest.completeness * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Quality Score</p>
            <p style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b', margin: 0 }}>
              {latest.quality_score?.toFixed(1) || 'N/A'}
            </p>
          </div>

          <div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Taxa de Erro</p>
            <p style={{ fontSize: '1rem', fontWeight: '600', color: '#ef4444', margin: 0 }}>
              {(latest.error_rate * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Resumo de métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingUp size={20} />
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>Quality Score Médio</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {summary?.avg_quality_score?.toFixed(1) || 'N/A'}
          </p>
        </div>

        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <CheckCircle size={20} />
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>Completude Média</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {(summary?.avg_completeness * 100).toFixed(1)}%
          </p>
        </div>

        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={20} />
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>Total de Anomalias</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {summary?.total_anomalies || 0}
          </p>
        </div>
      </div>

      {/* Gráfico de evolução */}
      {chartData.length > 0 && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
            Evolução das Métricas de Qualidade (Últimos 30 dias)
          </h3>
          
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => format(parseISO(date), 'dd/MM', { locale: ptBR })}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
                labelFormatter={(date) => format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR })}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="qualityScore" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Quality Score"
                dot={{ r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="completeness" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Completude (%)"
                dot={{ r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="errorRate" 
                stroke="#ef4444" 
                strokeWidth={2}
                name="Taxa de Erro (%)"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default DataQualityPanel;
