import React from 'react';
import { Skeleton } from './Skeleton';

interface SkeletonChartProps {
  height?: number | string;
  showTitle?: boolean;
  showLegend?: boolean;
  timeout?: number;
  onTimeout?: () => void;
}

export const SkeletonChart: React.FC<SkeletonChartProps> = ({
  height = '300px',
  showTitle = true,
  showLegend = true,
  timeout = 10000,
  onTimeout,
}) => {
  return (
    <div style={{ width: '100%' }}>
      {showTitle && (
        <Skeleton
          variant="text"
          width="40%"
          height="24px"
          animation="wave"
          timeout={0}
        />
      )}
      <div style={{ marginTop: showTitle ? '1rem' : '0' }}>
        <Skeleton
          variant="chart"
          height={height}
          animation="wave"
          timeout={timeout}
          onTimeout={onTimeout}
        />
      </div>
      {showLegend && (
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '1rem',
            justifyContent: 'center',
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              key={`legend-${i}`}
              variant="text"
              width="80px"
              height="16px"
              animation="wave"
            />
          ))}
        </div>
      )}
    </div>
  );
};
