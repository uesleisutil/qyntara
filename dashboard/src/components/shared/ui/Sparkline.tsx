import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDot?: boolean;
  showTooltip?: boolean;
  label?: string;
  dates?: string[];
}

const Sparkline: React.FC<SparklineProps> = ({
  data, width = 60, height = 20, color, showDot = true,
  showTooltip: _showTooltip = false, label: _label, dates: _dates,
}) => {
  if (!data.length || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const isUp = data[data.length - 1] >= data[0];
  const lineColor = color || (isUp ? '#10b981' : '#ef4444');

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x},${y}`;
  });

  const lastX = (width - 4) * ((data.length - 1) / (data.length - 1)) + 2;
  const lastY = height - 2 - ((data[data.length - 1] - min) / range) * (height - 4);

  return (
    <svg width={width} height={height} style={{ display: 'block', flexShrink: 0 }}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <circle cx={lastX} cy={lastY} r={2} fill={lineColor} />
      )}
    </svg>
  );
};

export { Sparkline };
export default Sparkline;
