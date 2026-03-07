import React from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

/**
 * PredictionIntervalChart - Fan chart showing prediction intervals with actual values
 * 
 * Features:
 * - Shows 50%, 80%, 95% confidence intervals as layered areas
 * - Point forecast line
 * - Actual values as a line with markers
 * - Interactive tooltips with exact values and coverage info
 * - Hover to see if actual falls within intervals
 */
const PredictionIntervalChart = ({ 
  predictions = [],
  actuals = [],
  showIntervals = { p50: true, p80: true, p95: true }
}) => {
  // Merge predictions and actuals by date
  const mergedData = predictions.map(pred => {
    const actual = actuals.find(a => a.date === pred.date);
    return {
      ...pred,
      actual: actual?.value
    };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const hasActual = data.actual !== undefined && data.actual !== null;
    
    // Check coverage
    let coverage = null;
    if (hasActual) {
      if (data.actual >= data.lower_95 && data.actual <= data.upper_95) {
        coverage = '95%';
      } else if (data.actual >= data.lower_80 && data.actual <= data.upper_80) {
        coverage = '80%';
      } else if (data.actual >= data.lower_50 && data.actual <= data.upper_50) {
        coverage = '50%';
      } else {
        coverage = 'Outside all intervals';
      }
    }

    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-2">{label}</p>
        
        {hasActual && (
          <>
            <p className="text-xs font-semibold text-red-600 mb-1">
              Actual: R$ {data.actual?.toFixed(2)}
            </p>
            <p className="text-xs text-gray-600 mb-2">
              Coverage: {coverage}
            </p>
          </>
        )}
        
        <p className="text-xs text-blue-600 font-semibold mb-1">
          Forecast: R$ {data.forecast?.toFixed(2)}
        </p>
        
        {showIntervals.p95 && (
          <p className="text-xs text-gray-600">
            95% CI: [{data.lower_95?.toFixed(2)}, {data.upper_95?.toFixed(2)}]
          </p>
        )}
        {showIntervals.p80 && (
          <p className="text-xs text-gray-600">
            80% CI: [{data.lower_80?.toFixed(2)}, {data.upper_80?.toFixed(2)}]
          </p>
        )}
        {showIntervals.p50 && (
          <p className="text-xs text-gray-600">
            50% CI: [{data.lower_50?.toFixed(2)}, {data.upper_50?.toFixed(2)}]
          </p>
        )}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart 
        data={mergedData}
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
            value: 'Price (R$)', 
            angle: -90, 
            position: 'insideLeft',
            style: { fontSize: 12 }
          }}
          tick={{ fontSize: 12 }}
          stroke="#666"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        
        {/* 95% confidence interval */}
        {showIntervals.p95 && (
          <>
            <Area 
              type="monotone" 
              dataKey="upper_95" 
              stroke="none" 
              fill="#8884d8" 
              fillOpacity={0.1}
              name="95% Upper"
              isAnimationActive={false}
            />
            <Area 
              type="monotone" 
              dataKey="lower_95" 
              stroke="none" 
              fill="#8884d8" 
              fillOpacity={0.1}
              name="95% Lower"
              isAnimationActive={false}
            />
          </>
        )}
        
        {/* 80% confidence interval */}
        {showIntervals.p80 && (
          <>
            <Area 
              type="monotone" 
              dataKey="upper_80" 
              stroke="none" 
              fill="#8884d8" 
              fillOpacity={0.15}
              name="80% Upper"
              isAnimationActive={false}
            />
            <Area 
              type="monotone" 
              dataKey="lower_80" 
              stroke="none" 
              fill="#8884d8" 
              fillOpacity={0.15}
              name="80% Lower"
              isAnimationActive={false}
            />
          </>
        )}
        
        {/* 50% confidence interval */}
        {showIntervals.p50 && (
          <>
            <Area 
              type="monotone" 
              dataKey="upper_50" 
              stroke="none" 
              fill="#8884d8" 
              fillOpacity={0.2}
              name="50% Upper"
              isAnimationActive={false}
            />
            <Area 
              type="monotone" 
              dataKey="lower_50" 
              stroke="none" 
              fill="#8884d8" 
              fillOpacity={0.2}
              name="50% Lower"
              isAnimationActive={false}
            />
          </>
        )}
        
        {/* Point forecast */}
        <Line 
          type="monotone" 
          dataKey="forecast" 
          stroke="#8884d8" 
          strokeWidth={2} 
          dot={false}
          name="Forecast"
        />
        
        {/* Actual values */}
        <Line 
          type="monotone" 
          dataKey="actual" 
          stroke="#ff7c7c" 
          strokeWidth={2.5} 
          dot={{ r: 4, fill: '#ff7c7c' }}
          connectNulls={false}
          name="Actual"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

PredictionIntervalChart.propTypes = {
  predictions: PropTypes.arrayOf(PropTypes.shape({
    date: PropTypes.string.isRequired,
    forecast: PropTypes.number.isRequired,
    lower_50: PropTypes.number,
    upper_50: PropTypes.number,
    lower_80: PropTypes.number,
    upper_80: PropTypes.number,
    lower_95: PropTypes.number,
    upper_95: PropTypes.number
  })),
  actuals: PropTypes.arrayOf(PropTypes.shape({
    date: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired
  })),
  showIntervals: PropTypes.shape({
    p50: PropTypes.bool,
    p80: PropTypes.bool,
    p95: PropTypes.bool
  })
};

export default PredictionIntervalChart;
