import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

/**
 * StockRankingChart - Bump chart showing stock ranking changes over time
 * 
 * Features:
 * - Shows top 20 stocks by MAPE ranking
 * - Lines show how rankings change over time
 * - Interactive tooltips with stock details
 * - Click stock to see detailed metrics (callback)
 * - Color-coded by stock with consistent colors
 * - Hover to highlight specific stock
 */
const StockRankingChart = ({ 
  rankings = [],
  topN = 20,
  onStockClick = null
}) => {
  const [hoveredStock, setHoveredStock] = useState(null);

  // Generate consistent colors for stocks
  const generateStockColor = (index) => {
    const hue = (index * 137.5) % 360; // Golden angle for good distribution
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Get all unique stocks from the data
  const allStocks = [...new Set(rankings.flatMap(r => 
    Object.keys(r).filter(key => key !== 'date')
  ))].slice(0, topN);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    // Sort by rank (value)
    const sortedPayload = [...payload].sort((a, b) => a.value - b.value);

    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg max-h-96 overflow-y-auto">
        <p className="font-semibold text-sm mb-2">{label}</p>
        {sortedPayload.slice(0, 10).map((entry, index) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: Rank {entry.value}
          </p>
        ))}
        {sortedPayload.length > 10 && (
          <p className="text-xs text-gray-500 mt-1">
            ... and {sortedPayload.length - 10} more
          </p>
        )}
      </div>
    );
  };

  const handleLineClick = (stock) => {
    if (onStockClick) {
      onStockClick(stock);
    }
  };

  const getStrokeWidth = (stock) => {
    if (!hoveredStock) return 2;
    return hoveredStock === stock ? 3 : 1;
  };

  const getOpacity = (stock) => {
    if (!hoveredStock) return 1;
    return hoveredStock === stock ? 1 : 0.3;
  };

  return (
    <ResponsiveContainer width="100%" height={500}>
      <LineChart 
        data={rankings}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 11 }}
          stroke="#666"
        />
        <YAxis 
          reversed 
          domain={[1, topN]} 
          label={{ 
            value: 'Rank (1 = Best)', 
            angle: -90, 
            position: 'insideLeft',
            style: { fontSize: 12 }
          }}
          tick={{ fontSize: 11 }}
          stroke="#666"
          ticks={[1, 5, 10, 15, 20]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ 
            maxHeight: '100px', 
            overflowY: 'auto',
            fontSize: '11px'
          }}
          onClick={(e) => handleLineClick(e.value)}
          iconType="line"
        />
        
        {/* Lines for each stock */}
        {allStocks.map((stock, idx) => (
          <Line 
            key={stock}
            type="monotone" 
            dataKey={stock} 
            stroke={generateStockColor(idx)}
            strokeWidth={getStrokeWidth(stock)}
            opacity={getOpacity(stock)}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name={stock}
            connectNulls={true}
            onMouseEnter={() => setHoveredStock(stock)}
            onMouseLeave={() => setHoveredStock(null)}
            onClick={() => handleLineClick(stock)}
            style={{ cursor: onStockClick ? 'pointer' : 'default' }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

StockRankingChart.propTypes = {
  rankings: PropTypes.arrayOf(PropTypes.shape({
    date: PropTypes.string.isRequired,
    // Dynamic stock symbols as keys with rank values
  })),
  topN: PropTypes.number,
  onStockClick: PropTypes.func
};

export default StockRankingChart;
