/**
 * CostPerPredictionChart Component
 * 
 * Displays cost per prediction metrics with trend analysis.
 * 
 * Features:
 * - Calculate daily cost / predictions
 * - Display as time series
 * - Calculate average cost per prediction
 * - Display trend (increasing/stable/decreasing)
 * - Highlight days exceeding target thresholds
 * - Segment by model type
 * - Display efficiency improvements over time
 * 
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useChartColors, formatters } from '../../../lib/chartConfig';

interface CostPerPredictionDataPoint {
  date: string;
  totalCost: number;
  predictionCount: number;
  costPerPrediction: number;
  modelBreakdown?: {
    [modelType: string]: {
      cost: number;
      predictions: number;
      costPerPrediction: number;
    };
  };
}

interface CostPerPredictionData {
  cost_per_prediction?: {
    daily_metrics?: CostPerPredictionDataPoint[];
    target_threshold?: number;
  };
}

interface CostPerPredictionChartProps {
  data: CostPerPredictionData | null;
  isLoading?: boolean;
  showModelSegmentation?: boolean;
}

interface ChartDataPoint {
  date: string;
  costPerPrediction: number;
  exceedsThreshold?: boolean;
  [modelType: string]: any;
}

type TrendType = 'increasing' | 'stable' | 'decreasing';

const CostPerPredictionChart: React.FC<CostPerPredictionChartProps> = ({
  data,
  isLoading = false,
  showModelSegmentation = false,
}) => {
  const colors = useChartColors();

  const { chartData, stats, thresholdExceeded, modelTypes } = useMemo(() => {
    if (!data || !data.cost_per_prediction || !data.cost_per_prediction.daily_metrics) {
      return { chartData: [], stats: null, thresholdExceeded: [], modelTypes: [] };
    }

    const rawData = data.cost_per_prediction.daily_metrics;
    const targetThreshold = data.cost_per_prediction.target_threshold || 0.10; // Default R$ 0.10

    // Transform data for line chart
    const transformed: ChartDataPoint[] = rawData.map((item) => {
      const point: ChartDataPoint = {
        date: item.date,
        costPerPrediction: item.costPerPrediction,
        exceedsThreshold: item.costPerPrediction > targetThreshold,
      };

      // Add model breakdown if available
      if (showModelSegmentation && item.modelBreakdown) {
        Object.entries(item.modelBreakdown).forEach(([modelType, metrics]) => {
          point[modelType] = metrics.costPerPrediction;
        });
      }

      return point;
    });

    // Extract unique model types
    const types = showModelSegmentation && rawData[0]?.modelBreakdown
      ? Object.keys(rawData[0].modelBreakdown)
      : [];

    // Calculate statistics
    const costs = transformed.map((d) => d.costPerPrediction);
    const avgCost = costs.reduce((sum, val) => sum + val, 0) / costs.length;

    // Calculate trend using linear regression
    const n = costs.length;
    const xMean = (n - 1) / 2;
    const yMean = avgCost;
    
    let numerator = 0;
    let denominator = 0;
    costs.forEach((y, x) => {
      numerator += (x - xMean) * (y - yMean);
      denominator += Math.pow(x - xMean, 2);
    });
    
    const slope = denominator !== 0 ? numerator / denominator : 0;
    
    // Determine trend
    let trend: TrendType = 'stable';
    const trendThreshold = avgCost * 0.05; // 5% change threshold
    if (slope > trendThreshold) {
      trend = 'increasing';
    } else if (slope < -trendThreshold) {
      trend = 'decreasing';
    }

    // Calculate efficiency improvement (comparing first 7 days vs last 7 days)
    const firstWeek = costs.slice(0, Math.min(7, Math.floor(n / 2)));
    const lastWeek = costs.slice(-Math.min(7, Math.floor(n / 2)));
    const firstWeekAvg = firstWeek.reduce((sum, val) => sum + val, 0) / firstWeek.length;
    const lastWeekAvg = lastWeek.reduce((sum, val) => sum + val, 0) / lastWeek.length;
    const efficiencyImprovement = ((firstWeekAvg - lastWeekAvg) / firstWeekAvg) * 100;

    // Identify days exceeding threshold
    const exceeded = transformed.filter((point) => point.exceedsThreshold);

    const statistics = {
      average: avgCost,
      min: Math.min(...costs),
      max: Math.max(...costs),
      trend,
      slope,
      targetThreshold,
      efficiencyImprovement,
      firstWeekAvg,
      lastWeekAvg,
    };

    return {
      chartData: transformed,
      stats: statistics,
      thresholdExceeded: exceeded,
      modelTypes: types,
    };
  }, [data, showModelSegmentation]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.neutral }}>
        Carregando custo por predição...
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.neutral }}>
        Sem dados de custo por predição disponíveis
      </div>
    );
  }

  const getTrendColor = (trend: TrendType) => {
    switch (trend) {
      case 'increasing':
        return colors.error;
      case 'decreasing':
        return colors.success;
      default:
        return colors.neutral;
    }
  };

  const getTrendIcon = (trend: TrendType) => {
    switch (trend) {
      case 'increasing':
        return '↗';
      case 'decreasing':
        return '↘';
      default:
        return '→';
    }
  };

  const getTrendLabel = (trend: TrendType) => {
    switch (trend) {
      case 'increasing':
        return 'Aumentando';
      case 'decreasing':
        return 'Diminuindo';
      default:
        return 'Estável';
    }
  };

  const modelColors: { [key: string]: string } = {
    'LSTM': colors.primary,
    'RandomForest': colors.success,
    'XGBoost': colors.warning,
    'LightGBM': colors.info,
    'Ensemble': colors.secondary,
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const exceedsThreshold = payload[0]?.payload?.exceedsThreshold;

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
          {exceedsThreshold && (
            <p
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.75rem',
                color: colors.error,
                fontWeight: '600',
              }}
            >
              ⚠️ Acima do Limite
            </p>
          )}
          {payload.map((entry: any, idx: number) => (
            <p
              key={idx}
              style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: entry.color }}
            >
              {entry.name}: {formatters.currency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: colors.text }}>
          Custo por Predição
        </h3>
        {stats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.875rem',
                color: getTrendColor(stats.trend),
                fontWeight: '600',
                padding: '0.25rem 0.5rem',
                backgroundColor: `${getTrendColor(stats.trend)}20`,
                borderRadius: '4px',
              }}
            >
              {getTrendIcon(stats.trend)} {getTrendLabel(stats.trend)}
            </span>
            {thresholdExceeded.length > 0 && (
              <span
                style={{
                  fontSize: '0.875rem',
                  color: colors.error,
                  fontWeight: '500',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: `${colors.error}20`,
                  borderRadius: '4px',
                }}
              >
                {thresholdExceeded.length} dia{thresholdExceeded.length > 1 ? 's' : ''} acima do limite
              </span>
            )}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: colors.text }}
            tickFormatter={(date) => format(parseISO(date), 'dd/MM', { locale: ptBR })}
          />
          <YAxis
            tick={{ fontSize: 12, fill: colors.text }}
            tickFormatter={(value) => formatters.currency(value)}
            label={{
              value: 'Custo por Predição (R$)',
              angle: -90,
              position: 'insideLeft',
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
              y={stats.targetThreshold}
              stroke={colors.error}
              strokeDasharray="5 5"
              label={{
                value: `Limite: ${formatters.currency(stats.targetThreshold)}`,
                position: 'right',
                fill: colors.error,
                fontSize: 12,
              }}
            />
          )}

          {/* Main cost per prediction line */}
          <Line
            type="monotone"
            dataKey="costPerPrediction"
            stroke={colors.primary}
            strokeWidth={2}
            dot={{ r: 4, fill: colors.primary }}
            activeDot={{ r: 6 }}
            name="Custo por Predição"
          />

          {/* Model segmentation lines */}
          {showModelSegmentation &&
            modelTypes.map((modelType) => (
              <Line
                key={modelType}
                type="monotone"
                dataKey={modelType}
                stroke={modelColors[modelType] || colors.neutral}
                strokeWidth={1.5}
                dot={{ r: 3 }}
                name={modelType}
              />
            ))}

          {/* Mark threshold-exceeding days */}
          {thresholdExceeded.map((point, idx) => (
            <ReferenceDot
              key={idx}
              x={point.date}
              y={point.costPerPrediction}
              r={6}
              fill={colors.error}
              stroke={colors.background}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Statistics Summary */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
            padding: '1rem',
            backgroundColor: colors.background === '#ffffff' ? '#f8fafc' : '#374151',
            borderRadius: '8px',
            border: `1px solid ${colors.grid}`,
          }}
        >
          <div>
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.25rem 0' }}>
              Custo Médio
            </p>
            <p style={{ fontSize: '1.125rem', fontWeight: '600', color: colors.text, margin: 0 }}>
              {formatters.currency(stats.average)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.25rem 0' }}>
              Custo Mínimo
            </p>
            <p style={{ fontSize: '1.125rem', fontWeight: '600', color: colors.success, margin: 0 }}>
              {formatters.currency(stats.min)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.25rem 0' }}>
              Custo Máximo
            </p>
            <p style={{ fontSize: '1.125rem', fontWeight: '600', color: colors.error, margin: 0 }}>
              {formatters.currency(stats.max)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.25rem 0' }}>
              Limite Alvo
            </p>
            <p style={{ fontSize: '1.125rem', fontWeight: '600', color: colors.warning, margin: 0 }}>
              {formatters.currency(stats.targetThreshold)}
            </p>
          </div>
        </div>
      )}

      {/* Efficiency Improvement */}
      {stats && stats.efficiencyImprovement !== 0 && !isNaN(stats.efficiencyImprovement) && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: stats.efficiencyImprovement > 0 ? `${colors.success}10` : `${colors.error}10`,
            borderRadius: '8px',
            border: `1px solid ${stats.efficiencyImprovement > 0 ? colors.success : colors.error}40`,
          }}
        >
          <h4
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: stats.efficiencyImprovement > 0 ? colors.success : colors.error,
            }}
          >
            {stats.efficiencyImprovement > 0 ? '✓' : '⚠️'} Melhoria de Eficiência
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.25rem 0' }}>
                Primeira Semana
              </p>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: colors.text, margin: 0 }}>
                {formatters.currency(stats.firstWeekAvg)}
              </p>
            </div>
            <div style={{ fontSize: '1.5rem', color: colors.neutral }}>→</div>
            <div>
              <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.25rem 0' }}>
                Última Semana
              </p>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: colors.text, margin: 0 }}>
                {formatters.currency(stats.lastWeekAvg)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.25rem 0' }}>
                Melhoria
              </p>
              <p
                style={{
                  fontSize: '1.125rem',
                  fontWeight: '700',
                  color: stats.efficiencyImprovement > 0 ? colors.success : colors.error,
                  margin: 0,
                }}
              >
                {stats.efficiencyImprovement > 0 ? '+' : ''}
                {stats.efficiencyImprovement.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Threshold Exceeded Details */}
      {thresholdExceeded.length > 0 && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: `${colors.error}10`,
            borderRadius: '8px',
            border: `1px solid ${colors.error}40`,
          }}
        >
          <h4
            style={{
              margin: '0 0 0.75rem 0',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: colors.error,
            }}
          >
            ⚠️ Dias Acima do Limite
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {thresholdExceeded.slice(0, 5).map((point, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem',
                  backgroundColor: colors.background,
                  borderRadius: '4px',
                }}
              >
                <span style={{ fontSize: '0.875rem', color: colors.text }}>
                  {format(parseISO(point.date), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: colors.error }}>
                  {formatters.currency(point.costPerPrediction)}
                </span>
              </div>
            ))}
            {thresholdExceeded.length > 5 && (
              <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0.5rem 0 0 0', textAlign: 'center' }}>
                +{thresholdExceeded.length - 5} dia{thresholdExceeded.length - 5 > 1 ? 's' : ''} adiciona{thresholdExceeded.length - 5 > 1 ? 'is' : 'l'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CostPerPredictionChart;
