import React, { useState } from 'react';
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
} from 'recharts';
import { Card } from './Card';

interface TemporalDataPoint {
  date: string;
  accuracy: number;
  mape: number;
  correlation: number;
}

interface TemporalAccuracyChartProps {
  data: TemporalDataPoint[];
  loading?: boolean;
  error?: Error;
  height?: number;
}

type Granularity = 'daily' | 'weekly' | 'monthly';

/**
 * TemporalAccuracyChart - Displays accuracy metrics over time
 * 
 * Requirements:
 * - 12.1: Display temporal accuracy chart on Validation tab
 * - 12.2: Calculate daily or weekly accuracy metrics
 * - 12.3: Display accuracy as time series line chart
 * - 12.4: Display MAPE as time series line chart
 * - 12.5: Display correlation as time series line chart
 * - 12.6: Highlight periods where accuracy falls below acceptable thresholds
 * - 12.7: Allow users to select time granularity (daily, weekly, monthly)
 * - 12.8: Display trend lines for each metric
 */
export const TemporalAccuracyChart: React.FC<TemporalAccuracyChartProps> = ({
  data,
  loading = false,
  error,
  height = 400,
}) => {
  const [granularity, setGranularity] = useState<Granularity>('weekly');
  const [selectedMetric, setSelectedMetric] = useState<'all' | 'accuracy' | 'mape' | 'correlation'>('all');

  // Aggregate data based on granularity
  const aggregatedData = React.useMemo(() => {
    if (!data || data.length === 0) return [];

    if (granularity === 'daily') {
      return data;
    }

    // Group by week or month
    const grouped = new Map<string, TemporalDataPoint[]>();

    data.forEach((point) => {
      const date = new Date(point.date);
      let key: string;

      if (granularity === 'weekly') {
        // Get week start (Monday)
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(date.setDate(diff));
        key = weekStart.toISOString().split('T')[0];
      } else {
        // Monthly
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      }

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(point);
    });

    // Calculate averages for each group
    return Array.from(grouped.entries())
      .map(([date, points]) => ({
        date,
        accuracy: points.reduce((sum, p) => sum + p.accuracy, 0) / points.length,
        mape: points.reduce((sum, p) => sum + p.mape, 0) / points.length,
        correlation: points.reduce((sum, p) => sum + p.correlation, 0) / points.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data, granularity]);

  // Calculate trend lines using simple linear regression
  const calculateTrend = (values: number[]) => {
    const n = values.length;
    if (n < 2) return { slope: 0, intercept: 0 };

    const xValues = Array.from({ length: n }, (_, i) => i);
    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (values[i] - yMean);
      denominator += Math.pow(xValues[i] - xMean, 2);
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = yMean - slope * xMean;

    return { slope, intercept };
  };

  // Add trend lines to data
  const dataWithTrends = React.useMemo(() => {
    if (aggregatedData.length === 0) return [];

    const accuracyValues = aggregatedData.map((d) => d.accuracy);
    const mapeValues = aggregatedData.map((d) => d.mape);
    const correlationValues = aggregatedData.map((d) => d.correlation);

    const accuracyTrend = calculateTrend(accuracyValues);
    const mapeTrend = calculateTrend(mapeValues);
    const correlationTrend = calculateTrend(correlationValues);

    return aggregatedData.map((point, index) => ({
      ...point,
      accuracyTrend: accuracyTrend.slope * index + accuracyTrend.intercept,
      mapeTrend: mapeTrend.slope * index + mapeTrend.intercept,
      correlationTrend: correlationTrend.slope * index + correlationTrend.intercept,
    }));
  }, [aggregatedData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#1f2937' }}>
            {new Date(label).toLocaleDateString()}
          </p>
          {payload.map((entry: any, index: number) => {
            if (entry.dataKey.includes('Trend')) return null;
            return (
              <p
                key={index}
                style={{
                  margin: '4px 0',
                  fontSize: '0.875rem',
                  color: entry.color,
                }}
              >
                {entry.name}: {entry.value.toFixed(3)}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading temporal accuracy chart...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
          <p>Error loading temporal accuracy chart: {error.message}</p>
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          <p>No data available for temporal accuracy chart</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ padding: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
            Temporal Accuracy Analysis
          </h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Granularity selector */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['daily', 'weekly', 'monthly'] as Granularity[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: granularity === g ? '#3b82f6' : 'white',
                    color: granularity === g ? 'white' : '#6b7280',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>

            {/* Metric selector */}
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                backgroundColor: 'white',
                color: '#6b7280',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Metrics</option>
              <option value="accuracy">Accuracy Only</option>
              <option value="mape">MAPE Only</option>
              <option value="correlation">Correlation Only</option>
            </select>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={dataWithTrends}
            margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: '0.75rem', fill: '#6b7280' }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return granularity === 'monthly'
                  ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis
              tick={{ fontSize: '0.75rem', fill: '#6b7280' }}
              domain={[0, 1]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '0.875rem' }}
              iconType="line"
            />

            {/* Threshold line for acceptable accuracy (50%) */}
            <ReferenceLine
              y={0.5}
              stroke="#dc2626"
              strokeDasharray="5 5"
              label={{
                value: 'Min Acceptable (50%)',
                position: 'insideTopRight',
                style: { fontSize: '0.75rem', fill: '#dc2626' },
              }}
            />

            {/* Accuracy line */}
            {(selectedMetric === 'all' || selectedMetric === 'accuracy') && (
              <>
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  name="Accuracy"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="accuracyTrend"
                  name="Accuracy Trend"
                  stroke="#10b981"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </>
            )}

            {/* MAPE line (inverted scale for display) */}
            {(selectedMetric === 'all' || selectedMetric === 'mape') && (
              <>
                <Line
                  type="monotone"
                  dataKey="mape"
                  name="MAPE"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="mapeTrend"
                  name="MAPE Trend"
                  stroke="#f59e0b"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </>
            )}

            {/* Correlation line */}
            {(selectedMetric === 'all' || selectedMetric === 'correlation') && (
              <>
                <Line
                  type="monotone"
                  dataKey="correlation"
                  name="Correlation"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="correlationTrend"
                  name="Correlation Trend"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default TemporalAccuracyChart;
