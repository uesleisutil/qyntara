import { useUI } from '../contexts/UIContext';

// Color palettes for light and dark themes
export const CHART_COLORS = {
  light: {
    primary: '#3b82f6',
    secondary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',
    neutral: '#6b7280',
    gradient: ['#3b82f6', '#3b82f6', '#ec4899', '#f59e0b', '#10b981'],
    positive: '#10b981',
    negative: '#ef4444',
    grid: '#e5e7eb',
    text: '#1f2937',
    background: '#ffffff',
  },
  dark: {
    primary: '#60a5fa',
    secondary: '#3b82f6',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#22d3ee',
    neutral: '#9ca3af',
    gradient: ['#60a5fa', '#3b82f6', '#f472b6', '#fbbf24', '#34d399'],
    positive: '#34d399',
    negative: '#f87171',
    grid: '#2a2e3a',
    text: '#e8eaf0',
    background: '#1a1d27',
  },
};

// Chart dimensions
export const CHART_DIMENSIONS = {
  small: { width: 300, height: 200 },
  medium: { width: 500, height: 300 },
  large: { width: 700, height: 400 },
  xlarge: { width: 900, height: 500 },
};

// Common chart props
export interface BaseChartProps {
  data: any[];
  loading?: boolean;
  error?: Error;
  height?: number;
  width?: number;
  responsive?: boolean;
  onElementClick?: (element: any) => void;
  exportable?: boolean;
}

// Hook to get theme-aware chart colors
export const useChartColors = () => {
  const { theme } = useUI();
  return CHART_COLORS[theme];
};

// Recharts theme configuration
export const getRechartsTheme = (theme: 'light' | 'dark') => ({
  axis: {
    stroke: CHART_COLORS[theme].grid,
    fontSize: 12,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  grid: {
    stroke: CHART_COLORS[theme].grid,
    strokeDasharray: '3 3',
  },
  tooltip: {
    backgroundColor: CHART_COLORS[theme].background,
    border: `1px solid ${CHART_COLORS[theme].grid}`,
    borderRadius: 8,
    padding: 12,
    color: CHART_COLORS[theme].text,
  },
  legend: {
    fontSize: 12,
    fontFamily: 'Inter, system-ui, sans-serif',
    color: CHART_COLORS[theme].text,
  },
});

// D3 scale configurations
export const D3_SCALES = {
  colorScaleDiverging: (theme: 'light' | 'dark') => [
    CHART_COLORS[theme].negative,
    CHART_COLORS[theme].neutral,
    CHART_COLORS[theme].positive,
  ],
  colorScaleSequential: (theme: 'light' | 'dark') => [
    CHART_COLORS[theme].background,
    CHART_COLORS[theme].primary,
  ],
};

// Format helpers
export const formatters = {
  percentage: (value: number) => `${(value * 100).toFixed(2)}%`,
  currency: (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
  number: (value: number) => value.toLocaleString('pt-BR'),
  compact: (value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toFixed(0);
  },
};
