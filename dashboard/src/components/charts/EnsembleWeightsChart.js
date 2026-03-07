import React from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

/**
 * EnsembleWeightsChart - Stacked area chart showing ensemble weight evolution
 * 
 * Features:
 * - Stacked area chart showing how weights change over time
 * - Shows weight evolution based on model performance
 * - Interactive tooltips with weight details
 * - Click to see weight calculation details (callback)
 * - Weights always sum to 1.0 (100%)
 */
const EnsembleWeightsChart = ({ 
  weights = [],
  onDateClick = null
}) => {
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    // Calculate total to verify it sums to 1.0
    const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);

    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-2">{label}</p>
        {payload.reverse().map((entry, index) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {(entry.value * 100).toFixed(1)}%
          </p>
        ))}
        <p className="text-xs text-gray-500 mt-2 pt-2 border-t">
          Total: {(total * 100).toFixed(1)}%
        </p>
      </div>
    );
  };

  const handleClick = (data) => {
    if (onDateClick && data && data.activeLabel) {
      onDateClick(data.activeLabel);
    }
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart 
        data={weights}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        onClick={handleClick}
        style={{ cursor: onDateClick ? 'pointer' : 'default' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          stroke="#666"
        />
        <YAxis 
          label={{ 
            value: 'Weight', 
            angle: -90, 
            position: 'insideLeft',
            style: { fontSize: 12 }
          }}
          tick={{ fontSize: 12 }}
          stroke="#666"
          domain={[0, 1]}
          tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          formatter={(value) => modelNames[value] || value}
        />
        
        {/* Stacked areas for each model */}
        <Area 
          type="monotone" 
          dataKey="deepar" 
          stackId="1" 
          stroke={modelColors.deepar}
          fill={modelColors.deepar}
          name={modelNames.deepar}
        />
        <Area 
          type="monotone" 
          dataKey="lstm" 
          stackId="1" 
          stroke={modelColors.lstm}
          fill={modelColors.lstm}
          name={modelNames.lstm}
        />
        <Area 
          type="monotone" 
          dataKey="prophet" 
          stackId="1" 
          stroke={modelColors.prophet}
          fill={modelColors.prophet}
          name={modelNames.prophet}
        />
        <Area 
          type="monotone" 
          dataKey="xgboost" 
          stackId="1" 
          stroke={modelColors.xgboost}
          fill={modelColors.xgboost}
          name={modelNames.xgboost}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

EnsembleWeightsChart.propTypes = {
  weights: PropTypes.arrayOf(PropTypes.shape({
    date: PropTypes.string.isRequired,
    deepar: PropTypes.number.isRequired,
    lstm: PropTypes.number.isRequired,
    prophet: PropTypes.number.isRequired,
    xgboost: PropTypes.number.isRequired
  })),
  onDateClick: PropTypes.func
};

export default EnsembleWeightsChart;
