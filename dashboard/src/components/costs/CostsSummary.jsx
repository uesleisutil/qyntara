/**
 * CostsSummary Component
 * 
 * Displays cost summary with:
 * - Custo total do mês atual
 * - Projeção mensal
 * - % do limite (R$500)
 * - Alerta visual se projeção > 80% ou > 100%
 * 
 * Requirements: 12.2, 12.3, 12.8, 12.9
 */

import React from 'react';
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

const CostsSummary = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Carregando resumo de custos...
      </div>
    );
  }

  if (!data || !data.latest) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Sem dados de custos disponíveis
      </div>
    );
  }

  const { latest } = data;
  const monthlyProjection = latest.monthly_projection?.brl || 0;
  const currentCost = latest.total_7_days?.brl || 0;
  const limit = 500; // R$500
  const percentOfLimit = (monthlyProjection / limit) * 100;

  // Determinar status do alerta
  const getAlertStatus = () => {
    if (percentOfLimit >= 100) {
      return {
        level: 'critical',
        color: '#ef4444',
        bgColor: '#fef2f2',
        icon: <AlertTriangle size={24} color="#ef4444" />,
        message: 'Limite excedido! Ação imediata necessária.'
      };
    }
    if (percentOfLimit >= 80) {
      return {
        level: 'warning',
        color: '#f59e0b',
        bgColor: '#fffbeb',
        icon: <AlertTriangle size={24} color="#f59e0b" />,
        message: 'Atenção: Projeção próxima do limite.'
      };
    }
    return {
      level: 'good',
      color: '#10b981',
      bgColor: '#f0fdf4',
      icon: <CheckCircle size={24} color="#10b981" />,
      message: 'Custos dentro do limite esperado.'
    };
  };

  const alertStatus = getAlertStatus();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Alerta de status */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: alertStatus.bgColor,
        borderRadius: '8px',
        border: `2px solid ${alertStatus.color}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {alertStatus.icon}
          <div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
              Status de Custos
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
              {alertStatus.message}
            </p>
          </div>
        </div>
      </div>

      {/* Cards de métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        {/* Custo total (últimos 7 dias) */}
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <DollarSign size={20} />
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>Custo (Últimos 7 dias)</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            R$ {currentCost.toFixed(2)}
          </p>
          <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '0.25rem 0 0 0' }}>
            USD ${latest.total_7_days?.usd?.toFixed(2) || '0.00'}
          </p>
        </div>

        {/* Projeção mensal */}
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingUp size={20} />
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>Projeção Mensal</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            R$ {monthlyProjection.toFixed(2)}
          </p>
          <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '0.25rem 0 0 0' }}>
            USD ${latest.monthly_projection?.usd?.toFixed(2) || '0.00'}
          </p>
        </div>

        {/* Percentual do limite */}
        <div style={{
          padding: '1.5rem',
          background: `linear-gradient(135deg, ${alertStatus.color} 0%, ${alertStatus.color}dd 100%)`,
          borderRadius: '8px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {alertStatus.icon}
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>% do Limite</p>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {percentOfLimit.toFixed(1)}%
          </p>
          <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '0.25rem 0 0 0' }}>
            Limite: R$ {limit.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
            Progresso do Limite Mensal
          </span>
          <span style={{ fontSize: '0.875rem', fontWeight: '600', color: alertStatus.color }}>
            R$ {monthlyProjection.toFixed(2)} / R$ {limit.toFixed(2)}
          </span>
        </div>
        
        <div style={{
          width: '100%',
          height: '24px',
          backgroundColor: '#e2e8f0',
          borderRadius: '12px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            width: `${Math.min(percentOfLimit, 100)}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${alertStatus.color} 0%, ${alertStatus.color}dd 100%)`,
            transition: 'width 0.5s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '0.5rem'
          }}>
            {percentOfLimit > 10 && (
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white' }}>
                {percentOfLimit.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Marcadores de threshold */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: '#64748b'
        }}>
          <span>R$ 0</span>
          <span style={{ color: '#f59e0b' }}>80% (R$ 400)</span>
          <span style={{ color: '#ef4444' }}>100% (R$ 500)</span>
        </div>
      </div>

      {/* Alertas ativos */}
      {latest.threshold?.exceeded && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          border: '1px solid #fecaca'
        }}>
          <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#991b1b', margin: '0 0 0.5rem 0' }}>
            ⚠️ Alerta de Custo
          </p>
          <p style={{ fontSize: '0.875rem', color: '#7f1d1d', margin: 0 }}>
            {latest.threshold.message || 'Limite de custo mensal excedido. Revise os gastos imediatamente.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default CostsSummary;
