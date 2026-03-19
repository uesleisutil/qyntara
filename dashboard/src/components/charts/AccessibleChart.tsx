/**
 * Accessible Chart Wrapper
 * 
 * Wraps charts with accessibility features including ARIA labels and text descriptions
 * Requirement 68: Screen Reader Support for Charts
 */

import { ReactNode } from 'react';
import { generateChartAriaLabel, getChartTrendDescription } from '../../utils/accessibility';
import { AccessibleTooltip } from '../shared/AccessibleTooltip';

interface AccessibleChartProps {
  children: ReactNode;
  chartType: string;
  dataDescription: string;
  data?: any[];
  trendData?: number[];
  title?: string;
  tooltip?: string;
  tooltipDefinition?: string;
  tooltipFormula?: string;
  tooltipInterpretation?: string;
  tooltipTypicalRange?: string;
}

export function AccessibleChart({
  children,
  chartType,
  dataDescription,
  data,
  trendData,
  title,
  tooltip,
  tooltipDefinition,
  tooltipFormula,
  tooltipInterpretation,
  tooltipTypicalRange
}: AccessibleChartProps) {
  const ariaLabel = generateChartAriaLabel(chartType, dataDescription);
  const trendDescription = trendData ? getChartTrendDescription(trendData) : '';
  
  // Generate text summary of data
  const dataSummary = data && data.length > 0 
    ? `Contains ${data.length} data points. ${trendDescription}`
    : 'No data available';
  
  const chartContent = (
    <div style={{ width: '100%' }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: 'calc(1.125rem * var(--font-size-scale, 1))', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>{title}</h3>
        </div>
      )}
      
      <div
        role="img"
        aria-label={ariaLabel}
        aria-describedby={`chart-desc-${chartType}`}
        style={{ position: 'relative', width: '100%' }}
      >
        {children}
        
        {/* Hidden text description for screen readers */}
        <div id={`chart-desc-${chartType}`} style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: 0
        }}>
          {dataSummary}
        </div>
      </div>
    </div>
  );
  
  // Wrap with tooltip if provided
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
        {chartContent}
      </AccessibleTooltip>
    );
  }
  
  return chartContent;
}
