import React from 'react';
import { Skeleton } from './Skeleton';

interface SkeletonCardProps {
  showIcon?: boolean;
  timeout?: number;
  onTimeout?: () => void;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  showIcon = true,
  timeout = 10000,
  onTimeout,
}) => {
  return (
    <div
      style={{
        backgroundColor: 'white',
        padding: '1.25rem',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <Skeleton variant="text" width="60%" height="14px" animation="wave" />
        {showIcon && (
          <Skeleton variant="circle" width="18px" height="18px" animation="wave" />
        )}
      </div>
      <Skeleton
        variant="text"
        width="50%"
        height="28px"
        animation="wave"
        timeout={timeout}
        onTimeout={onTimeout}
      />
      <div style={{ marginTop: '0.5rem' }}>
        <Skeleton variant="text" width="40%" height="14px" animation="wave" />
      </div>
    </div>
  );
};
