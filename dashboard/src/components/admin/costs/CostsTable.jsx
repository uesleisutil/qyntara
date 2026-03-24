/**
 * CostsTable Component
 * 
 * Displays detailed cost breakdown table by component.
 * Shows cost per recommendation.
 * 
 * Requirements: 12.6, 12.7
 */

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const CostsTable = ({ data, isLoading }) => {
  const tableData = useMemo(() => {
    if (!data || !data.time_series || !data.time_series.by_component) {
      return [];
    }

    // Pegar os últimos 7 dias
    const recentData = data.time_series.by_component.slice(-7);
    
    // Calcular totais por componente
    const components = ['training', 'inference', 'storage', 'compute', 'monitoring'];
    
    return components.map(component => {
      const costs = recentData.map(day => day[component] || 0);
      const total = costs.reduce((sum, cost) => sum + cost, 0);
      const avg = total / costs.length;
      
      // Calcular tendência (comparar últimos 3 dias vs 3 dias anteriores)
      const recent = costs.slice(-3).reduce((sum, c) => sum + c, 0) / 3;
      const previous = costs.slice(0, 3).reduce((sum, c) => sum + c, 0) / 3;
      const trend = previous > 0 ? ((recent - previous) / previous) * 100 : 0;
      
      return {
        component: component.charAt(0).toUpperCase() + component.slice(1),
        total,
        avg,
        trend
      };
    }).sort((a, b) => b.total - a.total);
  }, [data]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Carregando detalhamento de custos...
      </div>
    );
  }

  if (tableData.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Sem dados detalhados de custos disponíveis
      </div>
    );
  }

  const totalCost = tableData.reduce((sum, item) => sum + item.total, 0);
  const costPerRecommendation = data?.latest?.cost_per_recommendation || 0;

  const getTrendIcon = (trend) => {
    if (trend > 5) return <TrendingUp size={16} color="#ef4444" />;
    if (trend < -5) return <TrendingDown size={16} color="#10b981" />;
    return <Minus size={16} color="#64748b" />;
  };

  const getTrendColor = (trend) => {
    if (trend > 5) return '#ef4444';
    if (trend < -5) return '#10b981';
    return '#64748b';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1a1836' }}>
        Detalhamento de Custos por Componente (Últimos 7 dias)
      </h3>

      {/* Tabela */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#1a1836' }}>
                Componente
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#1a1836' }}>
                Total (7 dias)
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#1a1836' }}>
                Média Diária
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#1a1836' }}>
                % do Total
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: '#1a1836' }}>
                Tendência
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => {
              const percentage = (row.total / totalCost) * 100;
              
              return (
                <tr 
                  key={idx}
                  style={{ 
                    borderBottom: '1px solid #e2e8f0',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '0.75rem', fontWeight: '500', color: '#1a1836' }}>
                    {row.component}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#1a1836' }}>
                    R$ {row.total.toFixed(2)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b' }}>
                    R$ {row.avg.toFixed(2)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b' }}>
                    {percentage.toFixed(1)}%
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '0.25rem',
                      color: getTrendColor(row.trend)
                    }}>
                      {getTrendIcon(row.trend)}
                      <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                        {row.trend > 0 ? '+' : ''}{row.trend.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            
            {/* Linha de total */}
            <tr style={{ backgroundColor: '#f8fafc', fontWeight: '600' }}>
              <td style={{ padding: '0.75rem', color: '#1a1836' }}>
                TOTAL
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a1836' }}>
                R$ {totalCost.toFixed(2)}
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b' }}>
                R$ {(totalCost / 7).toFixed(2)}
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b' }}>
                100%
              </td>
              <td style={{ padding: '0.75rem' }}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Custo por recomendação */}
      <div style={{
        padding: '1.5rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '8px',
        color: 'white'
      }}>
        <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: '0 0 0.5rem 0' }}>
          Custo por Recomendação
        </p>
        <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
          R$ {costPerRecommendation.toFixed(4)}
        </p>
        <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '0.25rem 0 0 0' }}>
          Baseado em {data?.latest?.num_recommendations || 50} recomendações
        </p>
      </div>

      {/* Anomalias de custo */}
      {data?.anomalies && data.anomalies.length > 0 && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fffbeb',
          borderRadius: '8px',
          border: '1px solid #fbbf24'
        }}>
          <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400e', margin: '0 0 0.5rem 0' }}>
            ⚠️ Anomalias de Custo Detectadas
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.anomalies.slice(0, 3).map((anomaly, idx) => (
              <p key={idx} style={{ fontSize: '0.875rem', color: '#78350f', margin: 0 }}>
                • {anomaly.description || `Aumento anormal de ${anomaly.increase_percent?.toFixed(1)}% detectado`}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CostsTable;
