import React from 'react';
import { BaseChartProps } from '@lib/chartConfig';

interface BaseChartWrapperProps extends Omit<BaseChartProps, 'data'> {
  children: React.ReactNode;
  title?: string;
  description?: string;
  data?: any[];
}

export const BaseChart: React.FC<BaseChartWrapperProps> = ({
  children,
  loading,
  error,
  title,
  description,
  height = 300,
  responsive = true,
}) => {
  if (loading) {
    return (
      <div className="chart-container" style={{ height }}>
        <div className="chart-skeleton">
          <div className="skeleton-title" />
          <div className="skeleton-chart" style={{ height: height - 40 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-container chart-error" style={{ height }}>
        <div className="error-content">
          <svg className="error-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" />
          </svg>
          <p className="error-message">Failed to load chart</p>
          <p className="error-details">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`chart-container ${responsive ? 'chart-responsive' : ''}`}>
      {(title || description) && (
        <div className="chart-header">
          {title && <h3 className="chart-title">{title}</h3>}
          {description && <p className="chart-description">{description}</p>}
        </div>
      )}
      <div className="chart-content" style={{ height }}>
        {children}
      </div>
    </div>
  );
};
