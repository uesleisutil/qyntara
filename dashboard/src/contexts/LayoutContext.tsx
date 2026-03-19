import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { LayoutContextType, LayoutConfig, KPICardConfig, ChartSize, LayoutPreset } from '../types/layout';

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const useLayout = (): LayoutContextType => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};

interface LayoutProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'dashboard_layout';

const DEFAULT_KPI_CARDS: KPICardConfig[] = [
  { id: 'total-assets', label: 'Total Assets', visible: true, order: 0 },
  { id: 'best-asset', label: 'Best Asset', visible: true, order: 1 },
  { id: 'worst-asset', label: 'Worst Asset', visible: true, order: 2 },
  { id: 'positive-assets', label: 'Positive Assets', visible: true, order: 3 },
  { id: 'negative-assets', label: 'Negative Assets', visible: true, order: 4 }
];

const DEFAULT_CHART_SIZES: Record<string, ChartSize> = {
  'recommendations-chart': { width: 800, height: 400 },
  'performance-chart': { width: 800, height: 400 },
  'validation-chart': { width: 800, height: 400 }
};

const DEFAULT_LAYOUT: LayoutConfig = {
  currentPreset: 'default',
  presets: [
    {
      id: 'default',
      name: 'Default',
      kpiCards: DEFAULT_KPI_CARDS,
      chartSizes: DEFAULT_CHART_SIZES
    }
  ],
  kpiCards: DEFAULT_KPI_CARDS,
  chartSizes: DEFAULT_CHART_SIZES
};

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children }) => {
  const [layout, setLayout] = useState<LayoutConfig>(DEFAULT_LAYOUT);
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load layout from localStorage on mount
  useEffect(() => {
    const loadLayout = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setLayout(parsed);
        }
      } catch (err) {
        console.error('Failed to load layout:', err);
        setError('Failed to load layout');
      }
    };

    loadLayout();
  }, []);

  // Save layout to localStorage whenever it changes
  const saveLayout = useCallback((newLayout: LayoutConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
    } catch (err) {
      console.error('Failed to save layout:', err);
      throw new Error('Failed to save layout');
    }
  }, []);

  const updateKPICard = useCallback((id: string, updates: Partial<KPICardConfig>) => {
    setLayout((prev) => {
      const newKpiCards = prev.kpiCards.map((card) =>
        card.id === id ? { ...card, ...updates } : card
      );
      const newLayout = { ...prev, kpiCards: newKpiCards };
      saveLayout(newLayout);
      return newLayout;
    });
  }, [saveLayout]);

  const reorderKPICards = useCallback((startIndex: number, endIndex: number) => {
    setLayout((prev) => {
      const newKpiCards = [...prev.kpiCards];
      const [removed] = newKpiCards.splice(startIndex, 1);
      newKpiCards.splice(endIndex, 0, removed);
      
      // Update order property
      const reordered = newKpiCards.map((card, index) => ({
        ...card,
        order: index
      }));

      const newLayout = { ...prev, kpiCards: reordered };
      saveLayout(newLayout);
      return newLayout;
    });
  }, [saveLayout]);

  const toggleKPICardVisibility = useCallback((id: string) => {
    setLayout((prev) => {
      const newKpiCards = prev.kpiCards.map((card) =>
        card.id === id ? { ...card, visible: !card.visible } : card
      );
      const newLayout = { ...prev, kpiCards: newKpiCards };
      saveLayout(newLayout);
      return newLayout;
    });
  }, [saveLayout]);

  const updateChartSize = useCallback((chartId: string, size: ChartSize) => {
    setLayout((prev) => {
      const newChartSizes = {
        ...prev.chartSizes,
        [chartId]: size
      };
      const newLayout = { ...prev, chartSizes: newChartSizes };
      saveLayout(newLayout);
      return newLayout;
    });
  }, [saveLayout]);

  const savePreset = useCallback((name: string) => {
    setLayout((prev) => {
      const newPreset: LayoutPreset = {
        id: `preset-${Date.now()}`,
        name,
        kpiCards: prev.kpiCards,
        chartSizes: prev.chartSizes
      };

      const newPresets = [...prev.presets, newPreset];
      const newLayout = {
        ...prev,
        presets: newPresets,
        currentPreset: newPreset.id
      };
      saveLayout(newLayout);
      return newLayout;
    });
  }, [saveLayout]);

  const loadPreset = useCallback((presetId: string) => {
    setLayout((prev) => {
      const preset = prev.presets.find((p) => p.id === presetId);
      if (!preset) {
        throw new Error('Preset not found');
      }

      const newLayout = {
        ...prev,
        currentPreset: presetId,
        kpiCards: preset.kpiCards,
        chartSizes: preset.chartSizes
      };
      saveLayout(newLayout);
      return newLayout;
    });
  }, [saveLayout]);

  const deletePreset = useCallback((presetId: string) => {
    if (presetId === 'default') {
      throw new Error('Cannot delete default preset');
    }

    setLayout((prev) => {
      const newPresets = prev.presets.filter((p) => p.id !== presetId);
      const newCurrentPreset = prev.currentPreset === presetId ? 'default' : prev.currentPreset;
      
      const newLayout = {
        ...prev,
        presets: newPresets,
        currentPreset: newCurrentPreset
      };
      saveLayout(newLayout);
      return newLayout;
    });
  }, [saveLayout]);

  const resetToDefault = useCallback(() => {
    const newLayout = { ...DEFAULT_LAYOUT };
    setLayout(newLayout);
    saveLayout(newLayout);
  }, [saveLayout]);

  const exportLayout = useCallback((): string => {
    return JSON.stringify(layout, null, 2);
  }, [layout]);

  const importLayout = useCallback((layoutJson: string) => {
    try {
      const imported = JSON.parse(layoutJson);
      setLayout(imported);
      saveLayout(imported);
    } catch (err) {
      throw new Error('Invalid layout JSON');
    }
  }, [saveLayout]);

  return (
    <LayoutContext.Provider
      value={{
        layout,
        kpiCards: layout.kpiCards,
        chartSizes: layout.chartSizes,
        currentPreset: layout.currentPreset,
        presets: layout.presets,
        updateKPICard,
        reorderKPICards,
        toggleKPICardVisibility,
        updateChartSize,
        savePreset,
        loadPreset,
        deletePreset,
        resetToDefault,
        exportLayout,
        importLayout,
        loading,
        error
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export default LayoutContext;
