import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import { BaseChart } from './BaseChart';
import './PerformanceComponents.css';

interface PredictionError {
  ticker: string;
  date: string;
  predicted: number;
  actual: number;
  error: number;
  errorPercentage: number;
}

interface ErrorDistributionData {
  bins: { min: number; max: number; count: number; percentage: number }[];
  mean: number;
  stdDev: number;
  outliers: PredictionError[];
}

interface ErrorDistributionChartProps {
  data: ErrorDistributionData;
  loading?: boolean;
  error?: Error;
  height?: number;
  onBinClick?: (bin: { min: number; max: number; count: number }) => void;
}

export const ErrorDistributionChart: React.FC<ErrorDistributionChartProps> = ({
  data,
  loading,
  error,
  height = 400,
  onBinClick,
}) => {
  // Calculate outlier threshold (3 standard deviations)
  const outlierThreshold = useMemo(() => {
    if (!data) return 0;
    return Math.abs(data.mean) + 3 * data.stdDev;
  }, [data]);

  // Prepare chart data with outlier highlighting
  const chartData = useMemo(() => {
    if (!data || !data.bins) return [];

    return data.bins.map(bin => ({
      binLabel: `${bin.min.toFixed(1)} to ${bin.max.toFixed(1)}`,
      binCenter: (bin.min + bin.max) / 2,
      count: bin.count,
      percentage: bin.percentage,
      isOutlier: Math.abs((bin.min + bin.max) / 2) > outlierThreshold,
    }));
  }, [data, outlierThreshold]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const bin = payload[0].payload;
    return (
      <div className="error-tooltip">
        <p className="tooltip-label">{bin.binLabel}%</p>
        <p className="tooltip-value">Count: {bin.count}</p>
        <p className="tooltip-percentage">
          {bin.percentage.toFixed(1)}% of predictions
        </p>
        {bin.isOutlier && (
          <p className="tooltip-outlier">⚠️ Outlier bin</p>
        )}
      </div>
    );
  };

  const handleBarClick = (data: any) => {
    if (onBinClick && data) {
      const bin = chartData.find(b => b.binLabel === data.binLabel);
      if (bin) {
        onBinClick({
          min: parseFloat(bin.binLabel.split(' to ')[0]),
          max: parseFloat(bin.binLabel.split(' to ')[1]),
          count: bin.count,
        });
      }
    }
  };

  return (
    <BaseChart
      loading={loading}
      error={error}
      height={height}
      title="Prediction Error Distribution"
      description={`Mean: ${data?.mean.toFixed(2)}%, Std Dev: ${data?.stdDev.toFixed(2)}%`}
    >
      <ResponsiveContainer width="100%" height={height - 80}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="binLabel"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 11 }}
            label={{
              value: 'Prediction Error (%)',
              position: 'insideBottom',
              offset: -50,
              style: { fontSize: 12, fontWeight: 600 },
            }}
          />
          <YAxis
            label={{
              value: 'Frequency',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12, fontWeight: 600 },
            }}
            tick={{ fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="rect"
          />
          <ReferenceLine
            x={0}
            stroke="#666"
            strokeDasharray="3 3"
            label={{ value: 'Zero Error', position: 'top', fontSize: 11 }}
          />
          <Bar
            dataKey="count"
            name="Error Frequency"
            onClick={handleBarClick}
            cursor={onBinClick ? 'pointer' : 'default'}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isOutlier ? '#ff7c7c' : '#8884d8'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </BaseChart>
  );
};

export default ErrorDistributionChart;
