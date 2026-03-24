import React from 'react';
import { Skeleton } from './Skeleton';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  timeout?: number;
  onTimeout?: () => void;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 5,
  showHeader = true,
  timeout = 10000,
  onTimeout,
}) => {
  return (
    <div style={{ width: '100%' }}>
      {showHeader && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={`header-${i}`}
              variant="text"
              width={`${100 / columns}%`}
              height="20px"
              animation="wave"
            />
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              variant="text"
              width={`${100 / columns}%`}
              height="16px"
              animation="wave"
              timeout={rowIndex === 0 && colIndex === 0 ? timeout : 0}
              onTimeout={rowIndex === 0 && colIndex === 0 ? onTimeout : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
