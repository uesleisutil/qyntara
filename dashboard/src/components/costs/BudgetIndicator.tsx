/**
 * BudgetIndicator Component
 * 
 * Displays budget monitoring with alerts and projections.
 * 
 * Features:
 * - Allow budget limit configuration
 * - Display warning at 80% of budget
 * - Display critical alert at 100% of budget
 * - Show current spend as percentage
 * - Project end-of-month costs
 * - Display days remaining in month
 * - Calculate required daily spend to stay within budget
 * 
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8
 */

import React, { useMemo, useState } from 'react';
import { useChartColors, formatters } from '../../lib/chartConfig';

interface BudgetData {
  budget?: {
    limit?: number;
    current: number;
    projected: number;
    daysRemaining: number;
    daysInMonth: number;
  };
}

interface BudgetIndicatorProps {
  data: BudgetData | null;
  isLoading?: boolean;
  onBudgetChange?: (newLimit: number) => void;
}

type BudgetStatus = 'on-track' | 'warning' | 'critical';

const BudgetIndicator: React.FC<BudgetIndicatorProps> = ({
  data,
  isLoading = false,
  onBudgetChange,
}) => {
  const colors = useChartColors();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const budgetMetrics = useMemo(() => {
    if (!data || !data.budget) {
      return null;
    }

    const { limit = 1000, current, projected, daysRemaining, daysInMonth } = data.budget;

    // Calculate percentage of budget used
    const percentage = (current / limit) * 100;

    // Determine status
    let status: BudgetStatus = 'on-track';
    if (percentage >= 100) {
      status = 'critical';
    } else if (percentage >= 80) {
      status = 'warning';
    }

    // Calculate required daily spend to stay within budget
    const remainingBudget = limit - current;
    const requiredDailySpend = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;

    // Calculate current daily average
    const daysElapsed = daysInMonth - daysRemaining;
    const currentDailyAverage = daysElapsed > 0 ? current / daysElapsed : 0;

    // Calculate projected percentage
    const projectedPercentage = (projected / limit) * 100;

    return {
      limit,
      current,
      projected,
      percentage,
      projectedPercentage,
      status,
      daysRemaining,
      daysInMonth,
      daysElapsed,
      remainingBudget,
      requiredDailySpend,
      currentDailyAverage,
      isOverBudget: current > limit,
      willExceedBudget: projected > limit,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.neutral }}>
        Carregando indicadores de orçamento...
      </div>
    );
  }

  if (!budgetMetrics) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.neutral }}>
        Sem dados de orçamento disponíveis
      </div>
    );
  }

  const getStatusColor = (status: BudgetStatus) => {
    switch (status) {
      case 'critical':
        return colors.error;
      case 'warning':
        return colors.warning;
      default:
        return colors.success;
    }
  };

  const getStatusIcon = (status: BudgetStatus) => {
    switch (status) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      default:
        return '✓';
    }
  };

  const getStatusLabel = (status: BudgetStatus) => {
    switch (status) {
      case 'critical':
        return 'Orçamento Excedido';
      case 'warning':
        return 'Atenção: Próximo ao Limite';
      default:
        return 'Dentro do Orçamento';
    }
  };

  const handleEditClick = () => {
    setEditValue(budgetMetrics.limit.toString());
    setIsEditing(true);
  };

  const handleSave = () => {
    const newLimit = parseFloat(editValue);
    if (!isNaN(newLimit) && newLimit > 0 && onBudgetChange) {
      onBudgetChange(newLimit);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const statusColor = getStatusColor(budgetMetrics.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header with Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: colors.text }}>
          Indicadores de Orçamento
        </h3>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: `${statusColor}20`,
            borderRadius: '8px',
            border: `2px solid ${statusColor}`,
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>{getStatusIcon(budgetMetrics.status)}</span>
          <span style={{ fontSize: '0.875rem', fontWeight: '600', color: statusColor }}>
            {getStatusLabel(budgetMetrics.status)}
          </span>
        </div>
      </div>

      {/* Budget Limit Configuration */}
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: colors.background === '#ffffff' ? '#f8fafc' : '#374151',
          borderRadius: '8px',
          border: `1px solid ${colors.grid}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: colors.text }}>
            Limite de Orçamento Mensal
          </h4>
          {!isEditing && onBudgetChange && (
            <button
              onClick={handleEditClick}
              style={{
                padding: '0.25rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: '500',
                color: colors.primary,
                backgroundColor: `${colors.primary}10`,
                border: `1px solid ${colors.primary}`,
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Configurar
            </button>
          )}
        </div>

        {isEditing ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Digite o limite"
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '0.875rem',
                border: `1px solid ${colors.grid}`,
                borderRadius: '4px',
                backgroundColor: colors.background,
                color: colors.text,
              }}
            />
            <button
              onClick={handleSave}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.75rem',
                fontWeight: '500',
                color: '#ffffff',
                backgroundColor: colors.success,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Salvar
            </button>
            <button
              onClick={handleCancel}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.75rem',
                fontWeight: '500',
                color: colors.text,
                backgroundColor: colors.background === '#ffffff' ? '#e5e7eb' : '#4b5563',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: colors.text }}>
            {formatters.currency(budgetMetrics.limit)}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: colors.background === '#ffffff' ? '#f8fafc' : '#374151',
          borderRadius: '8px',
          border: `1px solid ${colors.grid}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: '600', color: colors.text }}>
            Gasto Atual
          </span>
          <span style={{ fontSize: '1.125rem', fontWeight: '700', color: statusColor }}>
            {budgetMetrics.percentage.toFixed(1)}%
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: '24px',
            backgroundColor: colors.background === '#ffffff' ? '#e5e7eb' : '#4b5563',
            borderRadius: '12px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Current spend bar */}
          <div
            style={{
              width: `${Math.min(budgetMetrics.percentage, 100)}%`,
              height: '100%',
              backgroundColor: statusColor,
              transition: 'width 0.3s ease',
              position: 'relative',
            }}
          />

          {/* 80% warning marker */}
          <div
            style={{
              position: 'absolute',
              left: '80%',
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: colors.warning,
              opacity: 0.6,
            }}
          />

          {/* 100% critical marker */}
          <div
            style={{
              position: 'absolute',
              left: '100%',
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: colors.error,
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: colors.neutral }}>
            {formatters.currency(budgetMetrics.current)} gasto
          </span>
          <span style={{ fontSize: '0.75rem', color: colors.neutral }}>
            {formatters.currency(budgetMetrics.remainingBudget)} restante
          </span>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Days Remaining */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: colors.background === '#ffffff' ? '#f8fafc' : '#374151',
            borderRadius: '8px',
            border: `1px solid ${colors.grid}`,
          }}
        >
          <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.5rem 0' }}>
            Dias Restantes no Mês
          </p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', color: colors.text, margin: 0 }}>
            {budgetMetrics.daysRemaining}
          </p>
          <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0.25rem 0 0 0' }}>
            de {budgetMetrics.daysInMonth} dias
          </p>
        </div>

        {/* Projected End-of-Month Cost */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: colors.background === '#ffffff' ? '#f8fafc' : '#374151',
            borderRadius: '8px',
            border: `1px solid ${colors.grid}`,
          }}
        >
          <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.5rem 0' }}>
            Projeção Fim do Mês
          </p>
          <p
            style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: budgetMetrics.willExceedBudget ? colors.error : colors.text,
              margin: 0,
            }}
          >
            {formatters.currency(budgetMetrics.projected)}
          </p>
          <p
            style={{
              fontSize: '0.75rem',
              color: budgetMetrics.willExceedBudget ? colors.error : colors.neutral,
              margin: '0.25rem 0 0 0',
            }}
          >
            {budgetMetrics.projectedPercentage.toFixed(1)}% do orçamento
          </p>
        </div>

        {/* Current Daily Average */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: colors.background === '#ffffff' ? '#f8fafc' : '#374151',
            borderRadius: '8px',
            border: `1px solid ${colors.grid}`,
          }}
        >
          <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.5rem 0' }}>
            Gasto Médio Diário Atual
          </p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', color: colors.text, margin: 0 }}>
            {formatters.currency(budgetMetrics.currentDailyAverage)}
          </p>
          <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0.25rem 0 0 0' }}>
            últimos {budgetMetrics.daysElapsed} dias
          </p>
        </div>

        {/* Required Daily Spend */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: colors.background === '#ffffff' ? '#f8fafc' : '#374151',
            borderRadius: '8px',
            border: `1px solid ${colors.grid}`,
          }}
        >
          <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.5rem 0' }}>
            Gasto Diário Necessário
          </p>
          <p
            style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: budgetMetrics.requiredDailySpend < budgetMetrics.currentDailyAverage ? colors.error : colors.success,
              margin: 0,
            }}
          >
            {formatters.currency(budgetMetrics.requiredDailySpend)}
          </p>
          <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0.25rem 0 0 0' }}>
            para manter orçamento
          </p>
        </div>
      </div>

      {/* Alert Messages */}
      {budgetMetrics.status === 'critical' && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: `${colors.error}10`,
            borderRadius: '8px',
            border: `2px solid ${colors.error}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🚨</span>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: colors.error }}>
                Alerta Crítico: Orçamento Excedido
              </h4>
              <p style={{ margin: 0, fontSize: '0.875rem', color: colors.text }}>
                O gasto atual de {formatters.currency(budgetMetrics.current)} excedeu o limite de orçamento de{' '}
                {formatters.currency(budgetMetrics.limit)}. Ação imediata é necessária para controlar os custos.
              </p>
              {budgetMetrics.willExceedBudget && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: colors.text }}>
                  A projeção para o fim do mês é de {formatters.currency(budgetMetrics.projected)}, o que representa{' '}
                  {budgetMetrics.projectedPercentage.toFixed(1)}% do orçamento.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {budgetMetrics.status === 'warning' && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: `${colors.warning}10`,
            borderRadius: '8px',
            border: `2px solid ${colors.warning}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: colors.warning }}>
                Aviso: Próximo ao Limite do Orçamento
              </h4>
              <p style={{ margin: 0, fontSize: '0.875rem', color: colors.text }}>
                Você já utilizou {budgetMetrics.percentage.toFixed(1)}% do orçamento mensal. Para manter-se dentro do
                limite, o gasto diário não deve exceder {formatters.currency(budgetMetrics.requiredDailySpend)}.
              </p>
              {budgetMetrics.willExceedBudget && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: colors.text, fontWeight: '600' }}>
                  ⚠️ A projeção atual indica que o orçamento será excedido em{' '}
                  {formatters.currency(budgetMetrics.projected - budgetMetrics.limit)}.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {budgetMetrics.status === 'on-track' && !budgetMetrics.willExceedBudget && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: `${colors.success}10`,
            borderRadius: '8px',
            border: `1px solid ${colors.success}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✓</span>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: colors.success }}>
                Orçamento Sob Controle
              </h4>
              <p style={{ margin: 0, fontSize: '0.875rem', color: colors.text }}>
                Você está dentro do orçamento com {budgetMetrics.percentage.toFixed(1)}% utilizado. Continue monitorando
                para manter os custos controlados.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetIndicator;
