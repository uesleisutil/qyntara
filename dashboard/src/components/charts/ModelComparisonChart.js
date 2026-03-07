import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip
} from 'recharts';

/**
 * ModelComparisonChart - Radar chart comparing 4 models across multiple metrics
 * 
 * Features:
 * - Compares DeepAR, LSTM, Prophet, XGBoost across metrics
 * - Metrics: MAPE, Coverage, Interval Width, Training Time, Inference Speed
 * - Interactive highlighting on hover
 * - Click model to highlight
 */
const ModelComparisonChart = ({ 
  data = [],
  highlightedModel = null,
  onModelClick = null
}) => {
  const [hoveredModel, setHoveredModel] = useState(null);

  const modelColors = {
    deepar: '#8884d8',
    lstm: '#82ca9d',
    prophet: '#ffc658',
    xgboost: '#ff7c7c'
  };

  const modelNames = {
    deepar: 'DeepAR',
    lstm: 'LSTM',
    prophet: 'Prophet',
    xgboost: 'XGBoost'
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-2">{payload[0]?.payload?.metric}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toFixed(1)}
          </p>
        ))}
      </div>
    );
  };

  const handleLegendClick = (e) => {
    if (onModelClick) {
      onModelClick(e.dataKey);
    }
  };

  const getOpacity = (model) => {
    if (!highlightedModel && !hoveredModel) return 0.6;
    if (highlightedModel === model || hoveredModel === model) return 0.9;
    return 0.2;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e0e0e0" />
        <PolarAngleAxis 
          dataKey="metric" 
          tick={{ fontSize: 12 }}
          stroke="#666"
        />
        <PolarRadiusAxis 
          angle={90} 
          domain={[0, 100]}
          tick={{ fontSize: 10 }}
          stroke="#666"
        />
        
        <Radar 
          name={modelNames.deepar}
          dataKey="deepar" 
          stroke={modelColors.deepar}
          fill={modelColors.deepar}
          fillOpacity={getOpacity('deepar')}
          strokeWidth={2}
          onMouseEnter={() => setHoveredModel('deepar')}
          onMouseLeave={() => setHoveredModel(null)}
        />
        <Radar 
          name={modelNames.lstm}
          dataKey="lstm" 
          stroke={modelColors.lstm}
          fill={modelColors.lstm}
          fillOpacity={getOpacity('lstm')}
          strokeWidth={2}
          onMouseEnter={() => setHoveredModel('lstm')}
          onMouseLeave={() => setHoveredModel(null)}
        />
        <Radar 
          name={modelNames.prophet}
          dataKey="prophet" 
          stroke={modelColors.prophet}
          fill={modelColors.prophet}
          fillOpacity={getOpacity('prophet')}
          strokeWidth={2}
          onMouseEnter={() => setHoveredModel('prophet')}
          onMouseLeave={() => setHoveredModel(null)}
        />
        <Radar 
          name={modelNames.xgboost}
          dataKey="xgboost" 
          stroke={modelColors.xgboost}
          fill={modelColors.xgboost}
          fillOpacity={getOpacity('xgboost')}
          strokeWidth={2}
          onMouseEnter={() => setHoveredModel('xgboost')}
          onMouseLeave={() => setHoveredModel(null)}
        />
        
        <Legend 
          onClick={handleLegendClick}
          wrapperStyle={{ cursor: onModelClick ? 'pointer' : 'default' }}
        />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  );
};

ModelComparisonChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    metric: PropTypes.string.isRequired,
    deepar: PropTypes.number,
    lstm: PropTypes.number,
    prophet: PropTypes.number,
    xgboost: PropTypes.number
  })),
  highlightedModel: PropTypes.string,
  onModelClick: PropTypes.func
};

export default ModelComparisonChart;
