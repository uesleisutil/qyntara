import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

// Context for temporal comparison state
interface TemporalComparisonContextType {
  enabled: boolean;
  comparisonPeriod: 'day' | 'week' | 'month' | 'quarter' | 'year';
  toggleEnabled: () => void;
  setComparisonPeriod: (period: 'day' | 'week' | 'month' | 'quarter' | 'year') => void;
}

const TemporalComparisonContext = createContext<TemporalComparisonContextType | undefined>(undefined);

export const useTemporalComparison = () => {
  const context = useContext(TemporalComparisonContext);
  if (!context) {
    throw new Error('useTemporalComparison must be used within TemporalComparisonProvider');
  }
  return context;
};

interface TemporalComparisonProviderProps {
  children: ReactNode;
}

export const TemporalComparisonProvider: React.FC<TemporalComparisonProviderProps> = ({ children }) => {
  const [enabled, setEnabled] = useState(false);
  const [comparisonPeriod, setComparisonPeriod] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('week');

  const toggleEnabled = () => setEnabled(!enabled);

  return (
    <TemporalComparisonContext.Provider
      value={{ enabled, comparisonPeriod, toggleEnabled, setComparisonPeriod }}
    >
      {children}
    </TemporalComparisonContext.Provider>
  );
};

// Temporal Comparison Toggle Component
export const TemporalComparisonToggle: React.FC = () => {
  const { enabled, comparisonPeriod, toggleEnabled, setComparisonPeriod } = useTemporalComparison();

  return (
    <div className="temporal-comparison-toggle" style={{ 
      display: 'flex', 
      gap: '1rem', 
      alignItems: 'center',
      padding: '0.75rem',
      background: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={toggleEnabled}
          style={{ cursor: 'pointer' }}
        />
        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
          Enable Temporal Comparison
        </span>
      </label>

      {enabled && (
        <>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Compare to:</label>
            <select
              value={comparisonPeriod}
              onChange={(e) => setComparisonPeriod(e.target.value as any)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              <option value="day">Previous Day</option>
              <option value="week">Previous Week</option>
              <option value="month">Previous Month</option>
              <option value="quarter">Previous Quarter</option>
              <option value="year">Previous Year</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
};

// Comparison Value Display Component
interface ComparisonValueProps {
  current: number;
  previous: number;
  label?: string;
  unit?: string;
  format?: (value: number) => string;
  reverseColors?: boolean; // For metrics where decrease is good (e.g., costs)
}

export const ComparisonValue: React.FC<ComparisonValueProps> = ({
  current,
  previous,
  label,
  unit = '',
  format = (v) => v.toFixed(2),
  reverseColors = false,
}) => {
  const { enabled } = useTemporalComparison();

  if (!enabled) {
    return (
      <div className="comparison-value">
        {label && <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>{label}</div>}
        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
          {format(current)}{unit}
        </div>
      </div>
    );
  }

  const absoluteChange = current - previous;
  const percentageChange = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;
  
  const isImprovement = reverseColors ? absoluteChange < 0 : absoluteChange > 0;
  const isDecline = reverseColors ? absoluteChange > 0 : absoluteChange < 0;
  
  const changeColor = isImprovement ? '#10b981' : isDecline ? '#ef4444' : '#64748b';
  const ChangeIcon = isImprovement ? ArrowUp : isDecline ? ArrowDown : Minus;

  return (
    <div className="comparison-value">
      {label && <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>{label}</div>}
      
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
          {format(current)}{unit}
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.25rem',
          fontSize: '0.875rem',
          color: changeColor,
          fontWeight: 500,
        }}>
          <ChangeIcon size={16} />
          <span>{Math.abs(percentageChange).toFixed(1)}%</span>
        </div>
      </div>

      <div style={{ 
        fontSize: '0.75rem', 
        color: '#64748b',
        marginTop: '0.25rem',
        display: 'flex',
        gap: '0.5rem',
      }}>
        <span>Previous: {format(previous)}{unit}</span>
        <span>•</span>
        <span style={{ color: changeColor }}>
          {absoluteChange >= 0 ? '+' : ''}{format(absoluteChange)}{unit}
        </span>
      </div>
    </div>
  );
};

// KPI Card with Temporal Comparison
interface TemporalKPICardProps {
  title: string;
  current: number;
  previous: number;
  unit?: string;
  format?: (value: number) => string;
  reverseColors?: boolean;
  icon?: ReactNode;
}

export const TemporalKPICard: React.FC<TemporalKPICardProps> = ({
  title,
  current,
  previous,
  unit = '',
  format = (v) => v.toFixed(2),
  reverseColors = false,
  icon,
}) => {
  return (
    <div style={{
      padding: '1.5rem',
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        {icon && <span style={{ color: '#64748b' }}>{icon}</span>}
        <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>
          {title}
        </h3>
      </div>
      
      <ComparisonValue
        current={current}
        previous={previous}
        unit={unit}
        format={format}
        reverseColors={reverseColors}
      />
    </div>
  );
};

// Chart Overlay for Temporal Comparison
interface ChartComparisonOverlayProps {
  currentData: Array<{ date: string; value: number }>;
  previousData: Array<{ date: string; value: number }>;
  children: ReactNode;
}

// @ts-ignore - currentData and previousData are used in child cloning
export const ChartComparisonOverlay: React.FC<ChartComparisonOverlayProps> = ({
  currentData,
  previousData,
  children,
}) => {
  const { enabled } = useTemporalComparison();

  // Prevent unused variable warning
  if (import.meta.env.DEV && currentData) {
    // currentData is available for future use
  }

  // If comparison is not enabled, just render the children
  if (!enabled) {
    return <>{children}</>;
  }

  // When enabled, the chart component should receive both datasets
  // This is a wrapper that passes the comparison data to the chart
  return (
    <div className="chart-comparison-overlay">
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            comparisonData: previousData,
            showComparison: true,
          } as any);
        }
        return child;
      })}
    </div>
  );
};
