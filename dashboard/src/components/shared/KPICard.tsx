import React from 'react';
import { AccessibleTooltip } from './AccessibleTooltip';
import { formatForScreenReader } from '../../utils/accessibility';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  tooltip?: string;
  tooltipDefinition?: string;
  tooltipFormula?: string;
  tooltipInterpretation?: string;
  tooltipTypicalRange?: string;
  onClick?: () => void;
  loading?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  change,
  changeLabel,
  trend = 'neutral',
  icon,
  tooltip,
  tooltipDefinition,
  tooltipFormula,
  tooltipInterpretation,
  tooltipTypicalRange,
  onClick,
  loading,
}) => {
  if (loading) {
    return (
      <div className="kpi-card kpi-card-loading" aria-busy="true" aria-label={`Loading ${title}`}>
        <div className="skeleton-line" style={{ width: '60%', height: '16px' }} />
        <div className="skeleton-line" style={{ width: '80%', height: '32px', marginTop: '8px' }} />
        <div className="skeleton-line" style={{ width: '40%', height: '14px', marginTop: '8px' }} />
      </div>
    );
  }

  // Generate accessible label
  const numericValue = typeof value === 'number' ? value : parseFloat(value.toString());
  const valueForScreenReader = !isNaN(numericValue) 
    ? formatForScreenReader(numericValue)
    : value;
  
  const ariaLabel = `${title}: ${valueForScreenReader}${
    change !== undefined 
      ? `, ${trend === 'up' ? 'increased' : trend === 'down' ? 'decreased' : 'unchanged'} by ${Math.abs(change)} percent ${changeLabel || ''}`
      : ''
  }`;

  const cardContent = (
    <div
      className={`kpi-card ${onClick ? 'kpi-card-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : 'region'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      <div className="kpi-card-header">
        <span className="kpi-card-title">{title}</span>
        {icon && <span className="kpi-card-icon" aria-hidden="true">{icon}</span>}
      </div>
      
      <div className="kpi-card-value" aria-hidden="true">{value}</div>
      
      {change !== undefined && (
        <div className={`kpi-card-change kpi-card-change-${trend}`} aria-hidden="true">
          {trend === 'up' && '↑'}
          {trend === 'down' && '↓'}
          {trend === 'neutral' && '→'}
          <span className="kpi-card-change-value">
            {change > 0 ? '+' : ''}{change}%
          </span>
          {changeLabel && <span className="kpi-card-change-label">{changeLabel}</span>}
        </div>
      )}
    </div>
  );

  // Wrap with tooltip if tooltip content is provided
  if (tooltip || tooltipDefinition || tooltipFormula || tooltipInterpretation || tooltipTypicalRange) {
    return (
      <AccessibleTooltip
        content={tooltip}
        definition={tooltipDefinition}
        formula={tooltipFormula}
        interpretation={tooltipInterpretation}
        typicalRange={tooltipTypicalRange}
        pinnable={true}
      >
        {cardContent}
      </AccessibleTooltip>
    );
  }

  return cardContent;
};
