import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { BaseChart } from './BaseChart';
import './PerformanceComponents.css';

interface FeatureImportance {
  feature: string;
  importance: number;
  description?: string;
}

interface ModelFeatureImportance {
  modelId: string;
  modelName: string;
  features: FeatureImportance[];
}

interface FeatureImportanceChartEnhancedProps {
  data: ModelFeatureImportance[];
  loading?: boolean;
  error?: Error;
  height?: number;
  topN?: number;
}

export const FeatureImportanceChartEnhanced: React.FC<FeatureImportanceChartEnhancedProps> = ({
  data,
  loading,
  error,
  height = 500,
  topN = 20,
}) => {
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Set initial selected model
  React.useEffect(() => {
    if (data && data.length > 0 && !selectedModel) {
      setSelectedModel(data[0].modelId);
    }
  }, [data, selectedModel]);

  // Get features for selected model
  const chartData = useMemo(() => {
    if (!data || !selectedModel) return [];

    const model = data.find(m => m.modelId === selectedModel);
    if (!model) return [];

    // Sort by importance and take top N
    const sorted = [...model.features]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, topN);

    // Convert to percentages
    const total = sorted.reduce((sum, f) => sum + f.importance, 0);
    return sorted.map(f => ({
      ...f,
      importancePercent: total > 0 ? (f.importance / total) * 100 : 0,
    }));
  }, [data, selectedModel, topN]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const feature = payload[0].payload;
    return (
      <div className="feature-tooltip">
        <p className="tooltip-label">{feature.feature}</p>
        <p className="tooltip-value">
          Importance: {feature.importancePercent.toFixed(2)}%
        </p>
        {feature.description && (
          <p className="tooltip-description">{feature.description}</p>
        )}
      </div>
    );
  };

  return (
    <BaseChart
      loading={loading}
      error={error}
      height={height}
      title="Feature Importance by Model"
      description="Top features driving model predictions"
    >
      <div className="feature-importance-container">
        <div className="model-selector">
          <label htmlFor="model-select">Select Model:</label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {data?.map(model => (
              <option key={model.modelId} value={model.modelId}>
                {model.modelName}
              </option>
            ))}
          </select>
        </div>

        <ResponsiveContainer width="100%" height={height - 120}>
          <BarChart
            data={chartData}
            layout="horizontal"
            margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#d4e5dc" />
            <XAxis
              dataKey="feature"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 11 }}
              interval={0}
            />
            <YAxis
              label={{
                value: 'Importance (%)',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 12, fontWeight: 600 },
              }}
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="importancePercent" name="Importance">
              {chartData.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`hsl(${210 + index * 10}, 70%, ${60 - index * 2}%)`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </BaseChart>
  );
};

export default FeatureImportanceChartEnhanced;
