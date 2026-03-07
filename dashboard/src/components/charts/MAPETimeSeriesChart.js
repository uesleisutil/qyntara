import React from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';

/**
 * MAPETimeSeriesChart - Multi-line chart showing MAPE evolution over time
 * 
 * Features:
 * - Multi-line comparison (ensemble vs individual models)
 * - Confidence bands (95% CI)
 * - Hover tooltips with detailed metrics
 * - Threshold line at 7% target
 * - Interactive legend to toggle models
 */
const MAPETimeSeriesChart = ({ 
  data = [], 
  selectedModels = ['ensemble', 'deepar', 'lstm', 'prophet', 'xgboost'],
  showConfidenceBands = false,
  onModelClick = null
}) => {
  const modelColors = {
    ensemble: '#8884d8',
    deepar: '#82ca9d',
    lstm: '#ffc658',
    prophet: '#ff7c7c',
    xgboost: '#a28fd0'
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toFixed(2)}%
          </p>
        ))}
      </div>
    );
  };

  const handleLegendClick = (dataKey) => {
    if (onModelClick) {
      onModelClick(dataKey);
    }
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart 
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          stroke="#666"
        />
        <YAxis 
          label={{ 
            value: 'MAPE (%)', 
            angle: -90, 
            position: 'insideLeft',
            style: { fontSize: 12 }
          }}
          tick={{ fontSize: 12 }}
          stroke="#666"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          onClick={(e) => handleLegendClick(e.dataKey)}
          wrapperStyle={{ cursor: onModelClick ? 'pointer' : 'default' }}
        />
        
        {/* Target threshold line at 7% */}
        <ReferenceLine 
          y={7} 
          stroke="#ff0000" 
          strokeDasharray="3 3" 
          label={{ 
            value: 'Target (7%)', 
            position: 'right',
            fill: '#ff0000',
            fontSize: 11
          }}
        />

        {/* Confidence bands for ensemble if enabled */}
        {showConfidenceBands && (
          <>
            <Area 
              type="monotone" 
              dataKey="ensemble_upper" 
              stroke="none" 
              fill={modelColors.ensemble}
              fillOpacity={0.1}
              isAnimationActive={false}
            />
            <Area 
              type="monotone" 
              dataKey="ensemble_lower" 
              stroke="none" 
              fill={modelColors.ensemble}
              fillOpacity={0.1}
              isAnimationActive={false}
            />
          </>
        )}

        {/* Model lines */}
        {selectedModels.includes('ensemble') && (
          <Line 
            type="monotone" 
            dataKey="ensemble" 
            stroke={modelColors.ensemble}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
            name="Ensemble"
          />
        )}
        {selectedModels.includes('deepar') && (
          <Line 
            type="monotone" 
            dataKey="deepar" 
            stroke={modelColors.deepar}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 5 }}
            name="DeepAR"
          />
        )}
        {selectedModels.includes('lstm') && (
          <Line 
            type="monotone" 
            dataKey="lstm" 
            stroke={modelColors.lstm}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 5 }}
            name="LSTM"
          />
        )}
        {selectedModels.includes('prophet') && (
          <Line 
            type="monotone" 
            dataKey="prophet" 
            stroke={modelColors.prophet}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 5 }}
            name="Prophet"
          />
        )}
        {selectedModels.includes('xgboost') && (
          <Line 
            type="monotone" 
            dataKey="xgboost" 
            stroke={modelColors.xgboost}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 5 }}
            name="XGBoost"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
};

MAPETimeSeriesChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    date: PropTypes.string.isRequired,
    ensemble: PropTypes.number,
    deepar: PropTypes.number,
    lstm: PropTypes.number,
    prophet: PropTypes.number,
    xgboost: PropTypes.number,
    ensemble_upper: PropTypes.number,
    ensemble_lower: PropTypes.number
  })),
  selectedModels: PropTypes.arrayOf(PropTypes.string),
  showConfidenceBands: PropTypes.bool,
  onModelClick: PropTypes.func
};

export default MAPETimeSeriesChart;
