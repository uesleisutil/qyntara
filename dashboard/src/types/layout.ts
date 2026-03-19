export interface KPICardConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

export interface ChartSize {
  width: number;
  height: number;
}

export interface LayoutPreset {
  id: string;
  name: string;
  kpiCards: KPICardConfig[];
  chartSizes: Record<string, ChartSize>;
}

export interface LayoutConfig {
  currentPreset: string;
  presets: LayoutPreset[];
  kpiCards: KPICardConfig[];
  chartSizes: Record<string, ChartSize>;
}

export interface LayoutContextType {
  layout: LayoutConfig;
  kpiCards: KPICardConfig[];
  chartSizes: Record<string, ChartSize>;
  currentPreset: string;
  presets: LayoutPreset[];
  updateKPICard: (id: string, updates: Partial<KPICardConfig>) => void;
  reorderKPICards: (startIndex: number, endIndex: number) => void;
  toggleKPICardVisibility: (id: string) => void;
  updateChartSize: (chartId: string, size: ChartSize) => void;
  savePreset: (name: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  resetToDefault: () => void;
  exportLayout: () => string;
  importLayout: (layoutJson: string) => void;
  loading: boolean;
  error: string | null;
}
