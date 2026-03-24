import React, { useEffect, useState } from 'react';

interface SkeletonProps {
  variant: 'text' | 'rect' | 'circle' | 'chart' | 'table' | 'card';
  width?: number | string;
  height?: number | string;
  count?: number;
  animation?: 'pulse' | 'wave';
  timeout?: number; // Max time to show skeleton before showing timeout message (default 10 seconds)
  onTimeout?: () => void; // Callback when timeout is reached
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant,
  width,
  height,
  count = 1,
  animation = 'wave',
  timeout = 10000, // 10 seconds default
  onTimeout,
}) => {
  const [showTimeout, setShowTimeout] = useState(false);

  useEffect(() => {
    if (timeout > 0) {
      const timer = setTimeout(() => {
        setShowTimeout(true);
        if (onTimeout) {
          onTimeout();
        }
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [timeout, onTimeout]);

  const getVariantStyles = () => {
    switch (variant) {
      case 'text':
        return { width: width || '100%', height: height || '1em', borderRadius: '4px' };
      case 'rect':
        return { width: width || '100%', height: height || '100px', borderRadius: '8px' };
      case 'circle':
        return { width: width || '40px', height: height || '40px', borderRadius: '50%' };
      case 'chart':
        return { width: width || '100%', height: height || '300px', borderRadius: '8px' };
      case 'table':
        return { width: width || '100%', height: height || '400px', borderRadius: '8px' };
      case 'card':
        return { width: width || '100%', height: height || '200px', borderRadius: '12px' };
      default:
        return { width: width || '100%', height: height || '20px', borderRadius: '4px' };
    }
  };

  const styles = getVariantStyles();

  if (showTimeout) {
    return (
      <div
        style={{
          ...styles,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          border: '1px dashed #cbd5e1',
          padding: '2rem',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
        <div style={{ fontSize: '0.875rem', color: '#64748b', textAlign: 'center' }}>
          Loading is taking longer than expected...
        </div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
          Please wait while we fetch the data
        </div>
      </div>
    );
  }

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`skeleton skeleton-${animation}`}
          style={{
            ...styles,
            marginBottom: count > 1 && index < count - 1 ? '0.5rem' : '0',
          }}
          role="status"
          aria-label="Loading..."
          aria-live="polite"
        />
      ))}
    </>
  );
};
