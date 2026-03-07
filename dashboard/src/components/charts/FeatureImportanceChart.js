import React from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

/**
 * FeatureImportanceChart - Horizontal bar chart showing SHAP feature importance
 * 
 * Features:
 * - Horizontal bars for better feature name readability
 * - Color-coded by feature category (technical, volume, lag, rolling, etc)
 * - Interactive tooltips with detailed SHAP values
 * - Click bar to see feature distribution (callback)
 */
const FeatureImportanceChart = ({ 
  shapValues = [],
  topN = 20,
  onFeatureClick = null
}) => {
  // Color mapping for feature categories
  const categoryColors = {
    technical: '#8884d8',
    volume: '#82ca9d',
    lag: '#ffc658',
    rolling: '#ff7c7c',
    volatility: '#a28fd0',
    other: '#999999'
  };

  const getCategoryColor = (category) => {
    return categoryColors[category] || categoryColors.other;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-1">{data.feature}</p>
        <p className="text-xs text-gray-600 mb-1">Category: {data.category}</p>
        <p className="text-xs">
          <span className="font-semibold">SHAP Value:</span> {data.importance?.toFixed(4)}
        </p>
        {data.description && (
          <p className="text-xs text-gray-500 mt-1">{data.description}</p>
        )}
      </div>
    );
  };

  const handleBarClick = (data) => {
    if (onFeatureClick) {
      onFeatureClick(data.feature);
    }
  };

  // Take top N features
  const displayData = shapValues.slice(0, topN);

  return (
    <ResponsiveContainer width="100%" height={Math.max(400, topN * 25)}>
      <BarChart 
        data={displayData} 
        layout="vertical"
        margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis 
          type="number" 
          label={{ 
            value: 'SHAP Value (Feature Importance)', 
            position: 'bottom',
            style: { fontSize: 12 }
          }}
          tick={{ fontSize: 11 }}
          stroke="#666"
        />
        <YAxis 
          type="category" 
          dataKey="feature" 
          width={140}
          tick={{ fontSize: 11 }}
          stroke="#666"
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar 
          dataKey="importance"
          cursor={onFeatureClick ? 'pointer' : 'default'}
          onClick={handleBarClick}
        >
          {displayData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={getCategoryColor(entry.category)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

FeatureImportanceChart.propTypes = {
  shapValues: PropTypes.arrayOf(PropTypes.shape({
    feature: PropTypes.string.isRequired,
    importance: PropTypes.number.isRequired,
    category: PropTypes.string.isRequired,
    description: PropTypes.string
  })),
  topN: PropTypes.number,
  onFeatureClick: PropTypes.func
};

export default FeatureImportanceChart;
