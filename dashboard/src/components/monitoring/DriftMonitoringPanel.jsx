/**
 * DriftMonitoringPanel Component
 * 
 * Displays drift detection information:
 * - Alerta visual se drift detectado
 * - Lista de features com drift
 * - Timeline de eventos de drift
 * - Gráfico de evolução dos pesos do ensemble
 * 
 * Requirements: 11.8, 11.9, 11.10, 18.3, 18.4
 */

import React from 'react';
import { AlertTriangle, CheckCircle, TrendingUp, GitBranch } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DriftMonitoringPanel = ({ driftData, ensembleData, isLoading }) => {
  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Carregando dados de drift...
      </div>
    );
  }

  if (!driftData || !driftData.latest) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Sem dados de drift disponíveis
      </div>
    );
  }

  const { latest, time_series, drift_events, summary } = driftData;

  // Determinar severidade do drift
  const getDriftSeverity = (driftScore) => {
    if (driftScore > 0.7) return { level: 'critical', color: '#ef4444', label: 'Crítico' };
    if (driftScore > 0.5) return { level: 'warning', color: '#f59e0b', label: 'Atenção' };
    return { level: 'good', color: '#10b981', label: 'Normal' };
  };

  const severity = getDriftSeverity(latest.drift_score);

  // Preparar dados do gráfico de drift score
  const driftChartData = time_series?.drift_score?.map(item => ({
    date: item.date,
    driftScore: item.drift_score,
    driftDetected: item.drift_detected
  })) || [];

  // Preparar dados do gráfico de pesos do ensemble
  const ensembleChartData = ensembleData?.time_series?.map(item => ({
    date: item.date,
    xgboost: item.weights?.xgboost || 0,
    lstm: item.weights?.lstm || 0,
    prophet: item.weights?.prophet || 0,
    deepar: item.weights?.deepar || 0
  })) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Alerta de drift */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: latest.drift_detected ? '#fef2f2' : '#f0fdf4',
        borderRadius: '8px',
        border: `2px solid ${severity.color}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          {latest.drift_detected ? (
            <AlertTriangle size={24} color={severity.color} />
          ) : (
            <CheckCircle size={24} color={severity.color} />
          )}
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
            {latest.drift_detected ? 'Drift Detectado!' : 'Sem Drift Detectado'}
          </h3>
          <span style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: severity.color,
            color: 'white',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}>
            {severity.label}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Drift Score</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: severity.color, margin: 0 }}>
              {latest.drift_score?.toFixed(3)}
            </p>
          </div>

          <div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>MAPE Atual</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              {latest.current_mape?.toFixed(2)}%
            </p>
          </div>

          <div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>MAPE Baseline</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#64748b', margin: 0 }}>
              {latest.baseline_mape?.toFixed(2)}%
            </p>
          </div>
        </div>

        {latest.retrain_recommended && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #fbbf24'
          }}>
            <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400e', margin: '0 0 0.5rem 0' }}>
              ⚠️ Retreinamento Recomendado
            </p>
            <p style={{ fontSize: '0.875rem', color: '#78350f', margin: 0 }}>
              {latest.retrain_reason}
            </p>
          </div>
        )}
      </div>

      {/* Features com drift */}
      {latest.features_with_drift && latest.features_with_drift.length > 0 && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
            Features com Drift Detectado
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {latest.features_with_drift.slice(0, 10).map((feature, idx) => (
              <div key={idx} style={{
                padding: '0.75rem',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1e293b' }}>
                  {feature.name || feature}
                </span>
                <span style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '600',
                  color: feature.drift_score > 0.7 ? '#ef4444' : '#f59e0b'
                }}>
                  Score: {feature.drift_score?.toFixed(3) || 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline de eventos de drift */}
      {drift_events && drift_events.length > 0 && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
            Timeline de Eventos de Drift (Últimos 30 dias)
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
            {drift_events.slice(0, 20).map((event, idx) => (
              <div key={idx} style={{
                padding: '0.75rem',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                borderLeft: `4px solid ${event.severity === 'critical' ? '#ef4444' : '#f59e0b'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
                    {event.type || 'Drift Detectado'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {event.date ? format(parseISO(event.date), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                  {event.description || `Drift score: ${event.drift_score?.toFixed(3)}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico de evolução do drift score */}
      {driftChartData.length > 0 && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
            Evolução do Drift Score
          </h3>
          
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={driftChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => format(parseISO(date), 'dd/MM', { locale: ptBR })}
              />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 1]} />
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
                dataKey="driftScore" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Drift Score"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráfico de evolução dos pesos do ensemble */}
      {ensembleChartData.length > 0 && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <GitBranch size={24} color="#3b82f6" />
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
              Evolução dos Pesos do Ensemble
            </h3>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ensembleChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => format(parseISO(date), 'dd/MM', { locale: ptBR })}
              />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 1]} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
                labelFormatter={(date) => format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR })}
              />
              <Legend />
              <Line type="monotone" dataKey="xgboost" stroke="#8b5cf6" strokeWidth={2} name="XGBoost" />
              <Line type="monotone" dataKey="lstm" stroke="#3b82f6" strokeWidth={2} name="LSTM" />
              <Line type="monotone" dataKey="prophet" stroke="#10b981" strokeWidth={2} name="Prophet" />
              <Line type="monotone" dataKey="deepar" stroke="#f59e0b" strokeWidth={2} name="DeepAR" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Resumo de estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingUp size={20} />
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>Total de Eventos</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {summary?.total_drift_events || 0}
          </p>
        </div>

        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={20} />
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>Recomendações de Retreino</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {summary?.total_retrain_recommendations || 0}
          </p>
        </div>

        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingUp size={20} />
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>Drift Score Médio</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {summary?.avg_drift_score?.toFixed(3) || 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DriftMonitoringPanel;
