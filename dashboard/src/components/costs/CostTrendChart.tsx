/**
 * CostTrendChart Component
 * 
 * Displays AWS cost trends over time with service segmentation.
 * 
 * Features:
 * - Plots daily AWS costs as time series (past 90 days)
 * - Segments costs by service (Lambda, S3, API Gateway, other)
 * - Uses stacked area chart
 * - Displays total cost and average daily cost
 * - Highlights cost spikes (> 2 std devs)
 * 
 * Requirements: 16.1-16.8
 */

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useChartColors } from '../../lib/chartConfig';

interface CostDataPoint {
  date: string;
  lambda?: number;
  s3?: number;
  apiGateway?: number;
  other?: number;
  total?: number;
}

interface CostTrendData {
  time_series?: {
    daily_costs?: CostDataPoint[];
  };
}

interface CostTrendChartProps {
  data: CostTrendData | null;
  isLoading?: boolean;
  days?: number;
}

interface ChartDataPoint {
  date: string;
  Lambda: number;
  S3: number;
  'API Gateway': number;
  Other: number;
  total: number;
  isSpike?: boolean;
}

const CostTrendChart: React.FC<CostTrendChartProps> = ({ 
  data, 
  isLoading = false,
  days = 90 
}) => {
  const colors = useChartColors();

  // Service colors mapping
  const serviceColors = {
    Lambda: colors.primary,
    S3: colors.success,
    'API Gateway': colors.warning,
    Other: colors.neutral,
  };

  const { chartData, stats, spikes } = useMemo(() => {
    if (!data || !data.time_series || !data.time_series.daily_costs) {
      return { chartData: [], stats: null, spikes: [] };
    }

    const rawData = data.time_series.daily_costs;

    // Transform data for stacked area chart
    const transformed: ChartDataPoint[] = rawData.map((item) => ({
      date: item.date,
      Lambda: item.lambda || 0,
      S3: item.s3 || 0,
      'API Gateway': item.apiGateway || 0,
      Other: item.other || 0,
      total: item.total || 0,
    }));

    // Calculate statistics
    const totals = transformed.map((d) => d.total);
    const totalCost = totals.reduce((sum, val) => sum + val, 0);
    const avgCost = totalCost / totals.length;
    
    // Calculate standard deviation for spike detection
    const variance = totals.reduce((sum, val) => sum + Math.pow(val - avgCost, 2), 0) / totals.length;
    const stdDev = Math.sqrt(variance);
    const spikeThreshold = avgCost + 2 * stdDev;

    // Identify spikes (> 2 std devs)
    const detectedSpikes: ChartDataPoint[] = [];
    transformed.forEach((point) => {
      if (point.total > spikeThreshold) {
        point.isSpike = true;
        detectedSpikes.push(point);
      }
    });

    const statistics = {
      total: totalCost,
      average: avgCost,
      min: Math.min(...totals),
      max: Math.max(...totals),
      stdDev,
      spikeThreshold,
    };

    return { chartData: transformed, stats: statistics, spikes: detectedSpikes };
  }, [data]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.neutral }}>
        Carregando tendências de custos...
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.neutral }}>
        Sem dados de tendências de custos disponíveis
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      const isSpike = payload[0]?.payload?.isSpike;

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
          {isSpike && (
            <p
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.75rem',
                color: colors.error,
                fontWeight: '600',
              }}
            >
              ⚠️ Pico de Custo
            </p>
          )}
          {payload.map((entry: any, idx: number) => (
            <p
              key={idx}
              style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: entry.color }}
            >
              {entry.name}: R$ {entry.value.toFixed(2)}
            </p>
          ))}
          <p
            style={{
              margin: '0.5rem 0 0 0',
              paddingTop: '0.5rem',
              borderTop: `1px solid ${colors.grid}`,
              fontSize: '0.875rem',
              fontWeight: '600',
              color: colors.text,
            }}
          >
            Total: R$ {total.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: colors.text }}>
          Tendência de Custos AWS (Últimos {days} dias)
        </h3>
        {spikes.length > 0 && (
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
            {spikes.length} pico{spikes.length > 1 ? 's' : ''} detectado{spikes.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData}>
          <defs>
            {Object.entries(serviceColors).map(([service, color]) => (
              <linearGradient key={service} id={`color${service.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                <stop offset="95%" stopColor={color} stopOpacity={0.2} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: colors.text }}
            tickFormatter={(date) => format(parseISO(date), 'dd/MM', { locale: ptBR })}
          />
          <YAxis
            tick={{ fontSize: 12, fill: colors.text }}
            label={{
              value: 'Custo (R$)',
              angle: -90,
              position: 'insideLeft',
              style: { fill: colors.text },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '0.875rem', color: colors.text }}
            iconType="square"
          />
          
          {/* Stacked areas for each service */}
          <Area
            type="monotone"
            dataKey="Lambda"
            stackId="1"
            stroke={serviceColors.Lambda}
            fill={`url(#colorLambda)`}
            name="Lambda"
          />
          <Area
            type="monotone"
            dataKey="S3"
            stackId="1"
            stroke={serviceColors.S3}
            fill={`url(#colorS3)`}
            name="S3"
          />
          <Area
            type="monotone"
            dataKey="API Gateway"
            stackId="1"
            stroke={serviceColors['API Gateway']}
            fill={`url(#colorAPIGateway)`}
            name="API Gateway"
          />
          <Area
            type="monotone"
            dataKey="Other"
            stackId="1"
            stroke={serviceColors.Other}
            fill={`url(#colorOther)`}
            name="Outros"
          />

          {/* Mark spikes with dots */}
          {spikes.map((spike, idx) => (
            <ReferenceDot
              key={idx}
              x={spike.date}
              y={spike.total}
              r={6}
              fill={colors.error}
              stroke={colors.background}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
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
              Custo Total
            </p>
            <p style={{ fontSize: '1.125rem', fontWeight: '600', color: colors.text, margin: 0 }}>
              R$ {stats.total.toFixed(2)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.25rem 0' }}>
              Custo Médio Diário
            </p>
            <p style={{ fontSize: '1.125rem', fontWeight: '600', color: colors.primary, margin: 0 }}>
              R$ {stats.average.toFixed(2)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.25rem 0' }}>
              Custo Mínimo
            </p>
            <p style={{ fontSize: '1.125rem', fontWeight: '600', color: colors.success, margin: 0 }}>
              R$ {stats.min.toFixed(2)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: colors.neutral, margin: '0 0 0.25rem 0' }}>
              Custo Máximo
            </p>
            <p style={{ fontSize: '1.125rem', fontWeight: '600', color: colors.error, margin: 0 }}>
              R$ {stats.max.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Spike Details */}
      {spikes.length > 0 && (
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
            ⚠️ Picos de Custo Detectados (&gt; 2 desvios padrão)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {spikes.map((spike, idx) => (
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
                  {format(parseISO(spike.date), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: colors.error }}>
                  R$ {spike.total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CostTrendChart;
