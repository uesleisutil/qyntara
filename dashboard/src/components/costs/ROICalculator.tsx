/**
 * ROICalculator Component
 * 
 * Calculates and displays return on investment for the ML system.
 * 
 * Features:
 * - Input portfolio value managed by system
 * - Calculate value generated (alpha * portfolio value)
 * - Calculate ROI = (value generated - costs) / costs
 * - Display ROI as percentage
 * - Display ROI trend over time
 * - Compare against target thresholds
 * - Display break-even analysis
 * 
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8
 */

import React, { useMemo, useState } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useChartColors, formatters } from '../../lib/chartConfig';

interface ROIDataPoint {
  date: string;
  alpha: number;
  totalCost: number;
  portfolioValue?: number;
  valueGenerated?: number;
  roi?: number;
}

interface ROIData {
  roi?: {
    daily_metrics?: ROIDataPoint[];
    target_threshold?: number;
    default_portfolio_value?: number;
  };
}

interface ROICalculatorProps {
  data: ROIData | null;
  isLoading?: boolean;
}

interface ChartDataPoint {
  date: string;
  roi: number;
  valueGenerated: number;
  totalCost: number;
  netValue: number;
}

type ROIStatus = 'excellent' | 'good' | 'fair' | 'poor';

const ROICalculator: React.FC<ROICalculatorProps> = ({
  data,
  isLoading = false,
}) => {
  const colors = useChartColors();
  const [portfolioValue, setPortfolioValue] = useState<number>(
    data?.roi?.default_portfolio_value || 1000000
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const { chartData, stats, breakEvenAnalysis } = useMemo(() => {
    if (!data || !data.roi || !data.roi.daily_metrics) {
      return { chartData: [], stats: null, breakEvenAnalysis: null };
    }

    const rawData = data.roi.daily_metrics;
    const targetThreshold = data.roi.target_threshold || 200; // Default 200% ROI target

    // Calculate ROI for each data point
    const transformed: ChartDataPoint[] = rawData.map((item) => {
      const valueGenerated = (item.alpha / 100) * portfolioValue;
      const roi = item.totalCost > 0 ? ((valueGenerated - item.totalCost) / item.totalCost) * 100 : 0;
      const netValue = valueGenerated - item.totalCost;

      return {
        date: item.date,
        roi,
        valueGenerated,
        totalCost: item.totalCost,
        netValue,
      };
    });

    // Calculate statistics
    const roiValues = transformed.map((d) => d.roi);
    const avgROI = roiValues.reduce((sum, val) => sum + val, 0) / roiValues.length;
    const minROI = Math.min(...roiValues);
    const maxROI = Math.max(...roiValues);

    // Calculate trend
    const n = roiValues.length;
    const xMean = (n - 1) / 2;
    const yMean = avgROI;
    
    let numerator = 0;
    let denominator = 0;
    roiValues.forEach((y, x) => {
      numerator += (x - xMean) * (y - yMean);
      denominator += Math.pow(x - xMean, 2);
    });
    
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const isImproving = slope > 0;

    // Calculate total value generated and costs
    const totalValueGenerated = transformed.reduce((sum, d) => sum + d.valueGenerated, 0);
    const totalCosts = transformed.reduce((sum, d) => sum + d.totalCost, 0);
    const totalNetValue = totalValueGenerated - totalCosts;
    const overallROI = totalCosts > 0 ? ((totalValueGenerated - totalCosts) / totalCosts) * 100 : 0;

    // Determine ROI status
    let status: ROIStatus = 'poor';
    if (avgROI >= targetThreshold) {
      status = 'excellent';
    } else if (avgROI >= targetThreshold * 0.75) {
      status = 'good';
    } else if (avgROI >= targetThreshold * 0.5) {
      status = 'fair';
    }

    // Break-even analysis
    // Find minimum portfolio value needed to break even (ROI = 0)
    // ROI = 0 when valueGenerated = totalCost
    // (alpha * portfolioValue) = totalCost
    // portfolioValue = totalCost / alpha
    const avgAlpha = rawData.reduce((sum, d) => sum + d.alpha, 0) / rawData.length;
    const avgDailyCost = totalCosts / rawData.length;
    const breakEvenPortfolio = avgAlpha > 0 ? (avgDailyCost / (avgAlpha / 100)) : 0;

    // Calculate portfolio value needed for target ROI
    // targetROI = ((alpha * portfolioValue) - cost) / cost
    // targetROI * cost = (alpha * portfolioValue) - cost
    // targetROI * cost + cost = alpha * portfolioValue
    // portfolioValue = (targetROI * cost + cost) / alpha
    const targetPortfolio = avgAlpha > 0 
      ? ((targetThreshold / 100) * avgDailyCost + avgDailyCost) / (avgAlpha / 100)
      : 0;

    const statistics = {
      average: avgROI,
      min: minROI,
      max: maxROI,
      trend: isImproving ? 'improving' : 'declining',
      slope,
      targetThreshold,
      status,
      totalValueGenerated,
      totalCosts,
      totalNetValue,
      overallROI,
      avgAlpha,
      avgDailyCost,
    };

    const breakEven = {
      breakEvenPortfolio,
      targetPortfolio,
      currentPortfolio: portfolioValue,
      isAboveBreakEven: portfolioValue >= breakEvenPortfolio,
      isAboveTarget: portfolioValue >= targetPortfolio,
      percentToBreakEven: breakEvenPortfolio > 0 
        ? ((portfolioValue - breakEvenPortfolio) / breakEvenPortfolio) * 100 
        : 100,
      percentToTarget: targetPortfolio > 0 
        ? ((portfolioValue - targetPortfolio) / targetPortfolio) * 100 
        : 100,
    };

    return {
      chartData: transformed,
      stats: statistics,
      breakEvenAnalysis: breakEven,
    };
  }, [data, portfolioValue]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.neutral }}>
        Carregando calculadora de ROI...
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.neutral }}>
        Sem dados de ROI disponíveis
      </div>
    );
  }

  const getStatusColor = (status: ROIStatus) => {
    switch (status) {
      case 'excellent':
        return colors.success;
      case 'good':
        return colors.info;
      case 'fair':
        return colors.warning;
      default:
        return colors.error;
    }
  };

  const getStatusIcon = (status: ROIStatus) => {
    switch (status) {
      case 'excellent':
        return '🎯';
      case 'good':
        return '✓';
      case 'fair':
        return '⚠️';
      default:
        return '❌';
    }
  };

  const getStatusLabel = (status: ROIStatus) => {
    switch (status) {
      case 'excellent':
        return 'Excelente';
      case 'good':
        return 'Bom';
      case 'fair':
        return 'Regular';
      default:
        return 'Baixo';
    }
  };

  const handleEditClick = () => {
    setEditValue(portfolioValue.toString());
    setIsEditing(true);
  };

  const handleSave = () => {
    const newValue = parseFloat(editValue);
    if (!isNaN(newValue) && newValue > 0) {
      setPortfolioValue(newValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const statusColor = stats ? getStatusColor(stats.status) : colors.neutral;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: colors.background,
            padding: '0.75rem',
            border: `1px solid ${colors.grid}`,
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        >
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: colors.text }}>
            {format(parseISO(label), 'dd/MM/yyyy', { locale: ptBR })}
          </p>
          {payload.map((entry: any, idx: number) => (
            <p
              key={idx}
              style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: entry.color }}
            >
              {entry.name}: {entry.name.includes('ROI') ? `${entry.value.toFixed(1)}%` : formatters.currency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header with Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: colors.text }}>
          Calculadora de ROI
        </h3>
        {stats && (
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
            <span style={{ fontSize: '1.25rem' }}>{getStatusIcon(stats.status)}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: statusColor }}>
              ROI {getStatusLabel(stats.status)}
            </span>
          </div>
        )}
      </div>

      {/* Portfolio Value Input */}
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: colors.background === '#ffffff' ? '#f6faf8' : '#2a4038',
          borderRadius: '8px',
          border: `1px solid ${colors.grid}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: colors.text }}>
            Valor do Portfólio Gerenciado
          </h4>
          {!isEditing && (
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
              placeholder="Digite o valor do portfólio"
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
                backgroundColor: colors.background === '#ffffff' ? '#d4e5dc' : '#3a5248',
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
            {formatters.currency(portfolioValue)}
          </p>
        )}
      </div>

      {/* Key ROI Metrics */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Overall ROI */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: colors.background === '#ffffff' ? '#f6faf8' : '#2a4038',
              borderRadius: '8px',
              border: `1px solid ${colors.grid}`,
            }}
          >
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.5rem 0' }}>
              ROI Geral
            </p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: statusColor, margin: 0 }}>
              {stats.overallROI.toFixed(1)}%
            </p>
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0.25rem 0 0 0' }}>
              {stats.trend === 'improving' ? '↗ Melhorando' : '↘ Declinando'}
            </p>
          </div>

          {/* Average ROI */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: colors.background === '#ffffff' ? '#f6faf8' : '#2a4038',
              borderRadius: '8px',
              border: `1px solid ${colors.grid}`,
            }}
          >
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.5rem 0' }}>
              ROI Médio Diário
            </p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: colors.text, margin: 0 }}>
              {stats.average.toFixed(1)}%
            </p>
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0.25rem 0 0 0' }}>
              Min: {stats.min.toFixed(1)}% | Max: {stats.max.toFixed(1)}%
            </p>
          </div>

          {/* Total Value Generated */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: colors.background === '#ffffff' ? '#f6faf8' : '#2a4038',
              borderRadius: '8px',
              border: `1px solid ${colors.grid}`,
            }}
          >
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.5rem 0' }}>
              Valor Gerado Total
            </p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: colors.success, margin: 0 }}>
              {formatters.currency(stats.totalValueGenerated)}
            </p>
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0.25rem 0 0 0' }}>
              Alpha médio: {stats.avgAlpha.toFixed(2)}%
            </p>
          </div>

          {/* Net Value */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: colors.background === '#ffffff' ? '#f6faf8' : '#2a4038',
              borderRadius: '8px',
              border: `1px solid ${colors.grid}`,
            }}
          >
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.5rem 0' }}>
              Valor Líquido
            </p>
            <p
              style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: stats.totalNetValue >= 0 ? colors.success : colors.error,
                margin: 0,
              }}
            >
              {formatters.currency(stats.totalNetValue)}
            </p>
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0.25rem 0 0 0' }}>
              Valor gerado - custos
            </p>
          </div>
        </div>
      )}

      {/* ROI Trend Chart */}
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: colors.background === '#ffffff' ? '#f6faf8' : '#2a4038',
          borderRadius: '8px',
          border: `1px solid ${colors.grid}`,
        }}
      >
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: '600', color: colors.text }}>
          Tendência de ROI ao Longo do Tempo
        </h4>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: colors.text }}
              tickFormatter={(date) => format(parseISO(date), 'dd/MM', { locale: ptBR })}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12, fill: colors.text }}
              tickFormatter={(value) => `${value.toFixed(0)}%`}
              label={{
                value: 'ROI (%)',
                angle: -90,
                position: 'insideLeft',
                style: { fill: colors.text },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: colors.text }}
              tickFormatter={(value) => formatters.currency(value)}
              label={{
                value: 'Valor (R$)',
                angle: 90,
                position: 'insideRight',
                style: { fill: colors.text },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '0.875rem', color: colors.text }}
              iconType="line"
            />

            {/* Target threshold line */}
            {stats && (
              <ReferenceLine
                yAxisId="left"
                y={stats.targetThreshold}
                stroke={colors.success}
                strokeDasharray="5 5"
                label={{
                  value: `Meta: ${stats.targetThreshold}%`,
                  position: 'right',
                  fill: colors.success,
                  fontSize: 12,
                }}
              />
            )}

            {/* Zero ROI line */}
            <ReferenceLine
              yAxisId="left"
              y={0}
              stroke={colors.error}
              strokeDasharray="3 3"
              label={{
                value: 'Break-even',
                position: 'left',
                fill: colors.error,
                fontSize: 12,
              }}
            />

            {/* ROI Line */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="roi"
              stroke={colors.primary}
              strokeWidth={3}
              dot={{ r: 4, fill: colors.primary }}
              activeDot={{ r: 6 }}
              name="ROI (%)"
            />

            {/* Value Generated Area */}
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="valueGenerated"
              fill={`${colors.success}40`}
              stroke={colors.success}
              strokeWidth={2}
              name="Valor Gerado"
            />

            {/* Total Cost Area */}
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="totalCost"
              fill={`${colors.error}40`}
              stroke={colors.error}
              strokeWidth={2}
              name="Custo Total"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Break-Even Analysis */}
      {breakEvenAnalysis && (
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: colors.background === '#ffffff' ? '#f6faf8' : '#2a4038',
            borderRadius: '8px',
            border: `1px solid ${colors.grid}`,
          }}
        >
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: '600', color: colors.text }}>
            Análise de Break-Even
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            {/* Current Portfolio */}
            <div
              style={{
                padding: '1rem',
                backgroundColor: colors.background,
                borderRadius: '8px',
                border: `2px solid ${colors.primary}`,
              }}
            >
              <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.5rem 0' }}>
                Portfólio Atual
              </p>
              <p style={{ fontSize: '1.25rem', fontWeight: '700', color: colors.primary, margin: 0 }}>
                {formatters.currency(breakEvenAnalysis.currentPortfolio)}
              </p>
              <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0.25rem 0 0 0' }}>
                Valor configurado
              </p>
            </div>

            {/* Break-Even Portfolio */}
            <div
              style={{
                padding: '1rem',
                backgroundColor: colors.background,
                borderRadius: '8px',
                border: `2px solid ${breakEvenAnalysis.isAboveBreakEven ? colors.success : colors.error}`,
              }}
            >
              <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.5rem 0' }}>
                Portfólio Break-Even
              </p>
              <p
                style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: breakEvenAnalysis.isAboveBreakEven ? colors.success : colors.error,
                  margin: 0,
                }}
              >
                {formatters.currency(breakEvenAnalysis.breakEvenPortfolio)}
              </p>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: breakEvenAnalysis.isAboveBreakEven ? colors.success : colors.error,
                  margin: '0.25rem 0 0 0',
                  fontWeight: '600',
                }}
              >
                {breakEvenAnalysis.isAboveBreakEven
                  ? `✓ ${Math.abs(breakEvenAnalysis.percentToBreakEven).toFixed(1)}% acima`
                  : `❌ ${Math.abs(breakEvenAnalysis.percentToBreakEven).toFixed(1)}% abaixo`}
              </p>
            </div>

            {/* Target Portfolio */}
            <div
              style={{
                padding: '1rem',
                backgroundColor: colors.background,
                borderRadius: '8px',
                border: `2px solid ${breakEvenAnalysis.isAboveTarget ? colors.success : colors.warning}`,
              }}
            >
              <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.5rem 0' }}>
                Portfólio para Meta de ROI
              </p>
              <p
                style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: breakEvenAnalysis.isAboveTarget ? colors.success : colors.warning,
                  margin: 0,
                }}
              >
                {formatters.currency(breakEvenAnalysis.targetPortfolio)}
              </p>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: breakEvenAnalysis.isAboveTarget ? colors.success : colors.warning,
                  margin: '0.25rem 0 0 0',
                  fontWeight: '600',
                }}
              >
                {breakEvenAnalysis.isAboveTarget
                  ? `✓ ${Math.abs(breakEvenAnalysis.percentToTarget).toFixed(1)}% acima`
                  : `⚠️ ${Math.abs(breakEvenAnalysis.percentToTarget).toFixed(1)}% abaixo`}
              </p>
            </div>
          </div>

          {/* Explanation */}
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: `${colors.info}10`,
              borderRadius: '8px',
              border: `1px solid ${colors.info}40`,
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: colors.info }}>
              💡 Como Interpretar
            </h5>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: colors.text }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Portfólio Break-Even:</strong> Valor mínimo necessário para que o sistema cubra seus próprios custos (ROI = 0%)
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Portfólio para Meta:</strong> Valor necessário para atingir o ROI alvo de {stats?.targetThreshold}%
              </li>
              <li>
                <strong>Seu Portfólio:</strong> {breakEvenAnalysis.isAboveBreakEven 
                  ? breakEvenAnalysis.isAboveTarget
                    ? 'Está acima da meta! O sistema está gerando valor significativo.'
                    : 'Está acima do break-even, mas abaixo da meta. Considere aumentar o portfólio gerenciado.'
                  : 'Está abaixo do break-even. O sistema não está cobrindo seus custos com o portfólio atual.'}
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ROI Comparison Against Target */}
      {stats && (
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: colors.background === '#ffffff' ? '#f6faf8' : '#2a4038',
            borderRadius: '8px',
            border: `1px solid ${colors.grid}`,
          }}
        >
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: '600', color: colors.text }}>
            Comparação com Meta de ROI
          </h4>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: colors.text }}>
                ROI Atual: {stats.overallROI.toFixed(1)}%
              </span>
              <span style={{ fontSize: '0.875rem', color: colors.text }}>
                Meta: {stats.targetThreshold}%
              </span>
            </div>

            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                height: '24px',
                backgroundColor: colors.background === '#ffffff' ? '#d4e5dc' : '#3a5248',
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Current ROI bar */}
              <div
                style={{
                  width: `${Math.min((stats.overallROI / stats.targetThreshold) * 100, 100)}%`,
                  height: '100%',
                  backgroundColor: statusColor,
                  transition: 'width 0.3s ease',
                }}
              />

              {/* Target marker */}
              <div
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  backgroundColor: colors.success,
                }}
              />
            </div>
          </div>

          {/* Status Message */}
          {stats.overallROI >= stats.targetThreshold ? (
            <div
              style={{
                padding: '1rem',
                backgroundColor: `${colors.success}10`,
                borderRadius: '8px',
                border: `1px solid ${colors.success}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🎯</span>
                <div>
                  <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: colors.success }}>
                    Meta de ROI Atingida!
                  </h5>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: colors.text }}>
                    O sistema está gerando um ROI de {stats.overallROI.toFixed(1)}%, superando a meta de{' '}
                    {stats.targetThreshold}% em {(stats.overallROI - stats.targetThreshold).toFixed(1)} pontos percentuais.
                  </p>
                </div>
              </div>
            </div>
          ) : stats.overallROI >= 0 ? (
            <div
              style={{
                padding: '1rem',
                backgroundColor: `${colors.warning}10`,
                borderRadius: '8px',
                border: `1px solid ${colors.warning}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <div>
                  <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: colors.warning }}>
                    ROI Positivo, Mas Abaixo da Meta
                  </h5>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: colors.text }}>
                    O sistema está gerando ROI positivo de {stats.overallROI.toFixed(1)}%, mas ainda está{' '}
                    {(stats.targetThreshold - stats.overallROI).toFixed(1)} pontos percentuais abaixo da meta de{' '}
                    {stats.targetThreshold}%. Considere aumentar o portfólio gerenciado ou otimizar custos.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '1rem',
                backgroundColor: `${colors.error}10`,
                borderRadius: '8px',
                border: `1px solid ${colors.error}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>❌</span>
                <div>
                  <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: colors.error }}>
                    ROI Negativo
                  </h5>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: colors.text }}>
                    O sistema está gerando ROI negativo de {stats.overallROI.toFixed(1)}%. Os custos excedem o valor
                    gerado. É necessário aumentar significativamente o portfólio gerenciado ou reduzir custos operacionais.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ROICalculator;
