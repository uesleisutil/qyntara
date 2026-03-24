import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { BaseChart } from './BaseChart';
import './PerformanceComponents.css';

interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  alpha?: number;
  beta?: number;
  informationRatio?: number;
}

interface BenchmarkData {
  model: PerformanceMetrics;
  ibovespa: PerformanceMetrics;
  movingAverage: PerformanceMetrics;
  cdi?: PerformanceMetrics;
}

interface TimeSeriesPoint {
  date: string;
  model: number;
  ibovespa: number;
  movingAverage: number;
  cdi?: number;
}

interface BenchmarkComparisonChartProps {
  data: BenchmarkData;
  timeSeriesData?: TimeSeriesPoint[];
  loading?: boolean;
  error?: Error;
  height?: number;
}

export const BenchmarkComparisonChart: React.FC<BenchmarkComparisonChartProps> = ({
  data,
  timeSeriesData = [],
  loading,
  error,
  height = 500,
}) => {
  const [activeView, setActiveView] = useState<'cumulative' | 'metrics'>('cumulative');

  const metricsData = [
    {
      metric: 'Total Return',
      model: data.model.totalReturn,
      ibovespa: data.ibovespa.totalReturn,
      movingAverage: data.movingAverage.totalReturn,
      cdi: data.cdi?.totalReturn,
      unit: '%',
    },
    {
      metric: 'Sharpe Ratio',
      model: data.model.sharpeRatio,
      ibovespa: data.ibovespa.sharpeRatio,
      movingAverage: data.movingAverage.sharpeRatio,
      cdi: data.cdi?.sharpeRatio,
      unit: '',
    },
    {
      metric: 'Max Drawdown',
      model: data.model.maxDrawdown,
      ibovespa: data.ibovespa.maxDrawdown,
      movingAverage: data.movingAverage.maxDrawdown,
      cdi: data.cdi?.maxDrawdown,
      unit: '%',
    },
    {
      metric: 'Volatility',
      model: data.model.volatility,
      ibovespa: data.ibovespa.volatility,
      movingAverage: data.movingAverage.volatility,
      cdi: data.cdi?.volatility,
      unit: '%',
    },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;

    return (
      <div className="benchmark-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {entry.value.toFixed(2)}%
          </p>
        ))}
      </div>
    );
  };

  return (
    <BaseChart
      loading={loading}
      error={error}
      height={height}
      title="Benchmark Comparison"
      description="Model performance vs market benchmarks"
    >
      <div className="benchmark-container">
        <div className="view-toggle">
          <button
            className={activeView === 'cumulative' ? 'active' : ''}
            onClick={() => setActiveView('cumulative')}
          >
            Cumulative Returns
          </button>
          <button
            className={activeView === 'metrics' ? 'active' : ''}
            onClick={() => setActiveView('metrics')}
          >
            Metrics Comparison
          </button>
        </div>

        {activeView === 'cumulative' && timeSeriesData.length > 0 && (
          <ResponsiveContainer width="100%" height={height - 150}>
            <LineChart
              data={timeSeriesData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                label={{
                  value: 'Date',
                  position: 'insideBottom',
                  offset: -10,
                  style: { fontSize: 12 },
                }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                label={{
                  value: 'Cumulative Return (%)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 12 },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="model"
                name="Model"
                stroke="#8884d8"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="ibovespa"
                name="Ibovespa"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="movingAverage"
                name="Moving Average"
                stroke="#ffc658"
                strokeWidth={2}
                dot={false}
              />
              {data.cdi && (
                <Line
                  type="monotone"
                  dataKey="cdi"
                  name="CDI"
                  stroke="#ff7c7c"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}

        {activeView === 'metrics' && (
          <div className="metrics-table-container">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Model</th>
                  <th>Ibovespa</th>
                  <th>Moving Avg</th>
                  {data.cdi && <th>CDI</th>}
                </tr>
              </thead>
              <tbody>
                {metricsData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="metric-name">{row.metric}</td>
                    <td className="metric-value model">
                      {row.model.toFixed(2)}{row.unit}
                    </td>
                    <td className="metric-value">
                      {row.ibovespa.toFixed(2)}{row.unit}
                    </td>
                    <td className="metric-value">
                      {row.movingAverage.toFixed(2)}{row.unit}
                    </td>
                    {data.cdi && row.cdi !== undefined && (
                      <td className="metric-value">
                        {row.cdi.toFixed(2)}{row.unit}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {data.model.alpha !== undefined && (
              <div className="alpha-section">
                <h4>Alpha (vs Ibovespa)</h4>
                <p className={`alpha-value ${data.model.alpha > 0 ? 'positive' : 'negative'}`}>
                  {data.model.alpha > 0 ? '+' : ''}{data.model.alpha.toFixed(2)}%
                </p>
                <p className="alpha-description">
                  {data.model.alpha > 0
                    ? 'Model is outperforming the benchmark'
                    : 'Model is underperforming the benchmark'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </BaseChart>
  );
};

export default BenchmarkComparisonChart;
