import { useUI } from '../contexts/UIContext';

// Color palettes for light and dark themes — Lavender-Green
export const CHART_COLORS = {
  light: {
    primary: '#5a9e87',
    secondary: '#6ba89a',
    success: '#4ead8a',
    warning: '#d4a84b',
    error: '#e07070',
    info: '#5ab0a0',
    neutral: '#7a9088',
    gradient: ['#5a9e87', '#6ba89a', '#d4a84b', '#5ab0a0', '#4ead8a'],
    positive: '#4ead8a',
    negative: '#e07070',
    grid: '#d4e5dc',
    text: '#1a2e26',
    background: '#ffffff',
  },
  dark: {
    primary: '#7ec4aa',
    secondary: '#8fd0b8',
    success: '#6dcaa5',
    warning: '#e0b85c',
    error: '#e89090',
    info: '#6dc4b4',
    neutral: '#8fa89c',
    gradient: ['#7ec4aa', '#8fd0b8', '#e0b85c', '#6dc4b4', '#6dcaa5'],
    positive: '#6dcaa5',
    negative: '#e89090',
    grid: '#2a3d36',
    text: '#e8f0ed',
    background: '#1a2626',
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
