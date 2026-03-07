import React from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip
} from 'recharts';

/**
 * DriftDetectionChart - Heatmap showing KS test p-values for feature drift
 * 
 * Features:
 * - Heatmap visualization using scatter plot with sized cells
 * - Color-coded by drift status (red = drift detected, green = no drift)
 * - Shows KS test p-values for all features over time
 * - Interactive tooltips with p-value details
 * - Click cell to see feature distribution comparison (callback)
 */
const DriftDetectionChart = ({ 
  driftData = [],
  threshold = 0.05,
  onCellClick = null
}) => {
  const getDriftColor = (pValue) => {
    if (pValue < threshold) return '#ff4444'; // Red - drift detected
    if (pValue < threshold * 2) return '#ffaa44'; // Orange - warning
    return '#44ff44'; // Green - no drift
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const driftStatus = data.pValue < threshold ? 'DRIFT DETECTED' : 'No Drift';
    const statusColor = data.pValue < threshold ? '#ff4444' : '#44ff44';

    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-1">{data.feature}</p>
        <p className="text-xs text-gray-600 mb-1">Date: {data.date}</p>
        <p className="text-xs mb-1">
          <span className="font-semibold">KS Test p-value:</span> {data.pValue?.toFixed(4)}
        </p>
        <p className="text-xs font-semibold" style={{ color: statusColor }}>
          {driftStatus}
        </p>
        {data.ksStatistic && (
          <p className="text-xs text-gray-500 mt-1">
            KS Statistic: {data.ksStatistic?.toFixed(4)}
          </p>
        )}
      </div>
    );
  };

  const handleCellClick = (data) => {
    if (onCellClick) {
      onCellClick(data.feature, data.date);
    }
  };

  // Get unique features and dates for axis
  const uniqueFeatures = [...new Set(driftData.map(d => d.feature))];
  const uniqueDates = [...new Set(driftData.map(d => d.date))];

  return (
    <div className="w-full">
      <div className="flex items-center justify-end mb-2 text-xs text-gray-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#44ff44' }}></div>
            <span>No Drift</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ffaa44' }}></div>
            <span>Warning</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ff4444' }}></div>
            <span>Drift Detected</span>
          </div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={Math.max(400, uniqueFeatures.length * 20)}>
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 20, left: 150 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            type="category"
            dataKey="date" 
            name="Date"
            allowDuplicatedCategory={false}
            tick={{ fontSize: 10 }}
            stroke="#666"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            type="category"
            dataKey="feature" 
            name="Feature"
            allowDuplicatedCategory={false}
            width={140}
            tick={{ fontSize: 10 }}
            stroke="#666"
          />
          <ZAxis 
            type="number" 
            dataKey="pValue" 
            range={[200, 400]}
            name="P-Value"
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }} 
            content={<CustomTooltip />}
          />
          <Scatter 
            data={driftData}
            cursor={onCellClick ? 'pointer' : 'default'}
            onClick={handleCellClick}
          >
            {driftData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={getDriftColor(entry.pValue)}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

DriftDetectionChart.propTypes = {
  driftData: PropTypes.arrayOf(PropTypes.shape({
    date: PropTypes.string.isRequired,
    feature: PropTypes.string.isRequired,
    pValue: PropTypes.number.isRequired,
    ksStatistic: PropTypes.number,
    driftDetected: PropTypes.bool
  })),
  threshold: PropTypes.number,
  onCellClick: PropTypes.func
};

export default DriftDetectionChart;
