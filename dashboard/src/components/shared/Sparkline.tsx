import React, { useState, useRef } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showTooltip?: boolean;
  dates?: string[]; // Optional dates for tooltip
  label?: string; // Label for the sparkline
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 100,
  height = 30,
  color,
  showTooltip = true,
  dates,
  label,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data || data.length === 0) {
    return null;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Calculate trend direction
  const trend = data[data.length - 1] > data[0] ? 'up' : data[data.length - 1] < data[0] ? 'down' : 'neutral';
  
  // Color based on trend if not specified
  const lineColor = color || (trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#64748b');

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y, value, index };
  });

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const index = Math.round((x / width) * (data.length - 1));
    
    if (index >= 0 && index < data.length) {
      setHoveredIndex(index);
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <div className="sparkline-container" style={{ position: 'relative', display: 'inline-block' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className={`sparkline sparkline-${trend}`}
        role="img"
        aria-label={`${label || 'Sparkline'} showing ${trend} trend`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: showTooltip ? 'crosshair' : 'default' }}
      >
        {/* Line path */}
        <path
          d={pathData}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover point */}
        {showTooltip && hoveredIndex !== null && (
          <circle
            cx={points[hoveredIndex].x}
            cy={points[hoveredIndex].y}
            r="3"
            fill={lineColor}
            stroke="white"
            strokeWidth="2"
          />
        )}

        {/* Basic tooltip (SVG title) */}
        {!showTooltip && (
          <title>
            Min: {min.toFixed(2)}, Max: {max.toFixed(2)}, Latest: {data[data.length - 1].toFixed(2)}
          </title>
        )}
      </svg>

      {/* Enhanced tooltip */}
      {showTooltip && hoveredIndex !== null && (
        <div
          className="sparkline-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 40,
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '0.5rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            pointerEvents: 'none',
            zIndex: 10000,
            whiteSpace: 'nowrap',
          }}
        >
          {dates && dates[hoveredIndex] && (
            <div><strong>{dates[hoveredIndex]}</strong></div>
          )}
          <div>{label && `${label}: `}{data[hoveredIndex].toFixed(2)}</div>
        </div>
      )}
    </div>
  );
};
