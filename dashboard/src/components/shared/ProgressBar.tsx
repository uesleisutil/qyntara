import React from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  target?: number; // Target value for goals
  label?: string;
  showPercentage?: boolean;
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'auto';
  size?: 'sm' | 'md' | 'lg';
  showValues?: boolean; // Show actual and target values
  unit?: string; // Unit for values (%, $, etc.)
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  target,
  label,
  showPercentage = true,
  color = 'auto',
  size = 'md',
  showValues = false,
  unit = '',
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  // Auto-determine color based on progress toward target
  let barColor = color;
  if (color === 'auto' && target) {
    const progressToTarget = (value / target) * 100;
    if (progressToTarget >= 90) {
      barColor = 'green'; // On track
    } else if (progressToTarget >= 70) {
      barColor = 'yellow'; // Behind
    } else {
      barColor = 'red'; // Significantly behind
    }
  } else if (color === 'auto') {
    barColor = 'blue';
  }

  return (
    <div className={`progress-bar-container progress-bar-${size}`}>
      {(label || showValues) && (
        <div className="progress-bar-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '0.5rem',
          fontSize: size === 'sm' ? '0.75rem' : size === 'lg' ? '1rem' : '0.875rem',
        }}>
          {label && (
            <span className="progress-bar-label" style={{ fontWeight: 500 }}>
              {label}
            </span>
          )}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {showValues && (
              <span className="progress-bar-values" style={{ fontSize: '0.875rem', color: '#5a7268' }}>
                <strong>{value.toFixed(2)}{unit}</strong>
                {target && ` / ${target.toFixed(2)}${unit}`}
              </span>
            )}
            {showPercentage && (
              <span className="progress-bar-percentage" style={{ 
                fontWeight: 600,
                color: barColor === 'green' ? '#4ead8a' : 
                       barColor === 'yellow' ? '#d4a84b' : 
                       barColor === 'red' ? '#e07070' : '#5a9e87',
              }}>
                {percentage.toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      )}
      <div 
        className="progress-bar-track" 
        style={{
          width: '100%',
          backgroundColor: '#d4e5dc',
          borderRadius: '9999px',
          overflow: 'hidden',
          height: size === 'sm' ? '0.5rem' : size === 'lg' ? '1.5rem' : '1rem',
        }}
      >
        <div
          className={`progress-bar-fill progress-bar-fill-${barColor}`}
          style={{ 
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: 
              barColor === 'green' ? '#4ead8a' : 
              barColor === 'yellow' ? '#d4a84b' : 
              barColor === 'red' ? '#e07070' : '#5a9e87',
            transition: 'width 0.3s ease-in-out',
            borderRadius: '9999px',
          }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
        />
      </div>
    </div>
  );
};
