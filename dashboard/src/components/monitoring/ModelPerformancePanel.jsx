/**
 * ModelPerformancePanel Component
 * 
 * Displays model performance metrics:
 * - Status da última execução
 * - 5 métricas principais (MAPE, Acurácia Direcional, MAE, Sharpe Ratio, Taxa de Acerto)
 * - Gráfico de evolução do MAPE com baseline
 * 
 * Requirements: 11.5, 11.6, 11.7
 */

import React from 'react';
import { Activity, TrendingUp, Target, BarChart3, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ModelPerformancePanel = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Carregando métricas de performance...
      </div>
    );
  }

  if (!data || !data.latest) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Sem dados de performance disponíveis
      </div>
    );
  }

  const { latest, time_series, summary } = data;

  // Preparar dados do gráfico MAPE
  const mapeChartData = time_series?.mape?.map(item => ({
    date: item.date,
    mape: item.mape
  })) || [];

  // Baseline MAPE (20%)
  const baselineMAPE = 20;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Status da última execução */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Activity size={24} color="#3b82f6" />
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
            Status da Última Execução
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Data</p>
            <p style={{ fontSize: '1rem', fontWeight: '500', color: '#1e293b', margin: 0 }}>
              {latest.date ? format(parseISO(latest.date), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}
            </p>
          </div>

          <div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Status</p>
            <p style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: latest.mape < baselineMAPE ? '#10b981' : '#ef4444',
              margin: 0 
            }}>
              {latest.mape < baselineMAPE ? 'Bom' : 'Atenção'}
            </p>
          </div>
        </div>
      </div>

      {/* 5 Métricas principais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Target size={20} />
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>MAPE</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {latest.mape?.toFixed(2)}%
          </p>
          <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '0.25rem 0 0 0' }}>
            Média: {summary?.avg_mape?.toFixed(2)}%
          </p>
        </div>

        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingUp size={20} />
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>Acurácia Direcional</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {(latest.directional_accuracy * 100).toFixed(1)}%
          </p>
          <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '0.25rem 0 0 0' }}>
            Média: {(summary?.avg_directional_accuracy * 100).toFixed(1)}%
          </p>
        </div>

        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <BarChart3 size={20} />
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>MAE</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {latest.mae?.toFixed(2)}
          </p>
          <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '0.25rem 0 0 0' }}>
            Média: {summary?.avg_mae?.toFixed(2)}
          </p>
        </div>

        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Activity size={20} />
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>Sharpe Ratio</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {latest.sharpe_ratio?.toFixed(2)}
          </p>
          <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '0.25rem 0 0 0' }}>
            Média: {summary?.avg_sharpe_ratio?.toFixed(2)}
          </p>
        </div>

        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Award size={20} />
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>Taxa de Acerto</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {(latest.hit_rate * 100).toFixed(1)}%
          </p>
          <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '0.25rem 0 0 0' }}>
            Média: {(summary?.avg_hit_rate * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Gráfico de evolução do MAPE */}
      {mapeChartData.length > 0 && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
            Evolução do MAPE (Últimos 30 dias)
          </h3>
          
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mapeChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => format(parseISO(date), 'dd/MM', { locale: ptBR })}
              />
              <YAxis tick={{ fontSize: 12 }} label={{ value: 'MAPE (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
                labelFormatter={(date) => format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR })}
                formatter={(value) => [`${value.toFixed(2)}%`, 'MAPE']}
              />
              <Legend />
              <ReferenceLine 
                y={baselineMAPE} 
                stroke="#ef4444" 
                strokeDasharray="5 5"
                label={{ value: 'Baseline (20%)', position: 'right', fill: '#ef4444' }}
              />
              <Line 
                type="monotone" 
                dataKey="mape" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="MAPE"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default ModelPerformancePanel;
