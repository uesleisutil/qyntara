import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

interface ModalState {
  [modalId: string]: boolean;
}

interface LayoutConfig {
  preset: string;
  kpiCards: { id: string; visible: boolean; order: number }[];
  chartSizes: Record<string, { width: number; height: number }>;
}

interface UIContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  modals: ModalState;
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  layout: LayoutConfig;
  updateLayout: (layout: Partial<LayoutConfig>) => void;
  resetLayout: () => void;
}

const defaultLayout: LayoutConfig = {
  preset: 'default',
  kpiCards: [],
  chartSizes: {},
};

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load theme from localStorage or system preference
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
  });

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const stored = localStorage.getItem('fontSize');
    if (stored === 'small' || stored === 'medium' || stored === 'large' || stored === 'xlarge') {
      return stored;
    }
    return 'medium';
  });

  const [modals, setModals] = useState<ModalState>({});
  
  const [layout, setLayout] = useState<LayoutConfig>(() => {
    const stored = localStorage.getItem('layout');
    return stored ? JSON.parse(stored) : defaultLayout;
  });

  // Persist theme to localStorage and apply to document
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Persist fontSize to localStorage and apply to document
  useEffect(() => {
    localStorage.setItem('fontSize', fontSize);
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [fontSize]);

  // Persist layout to localStorage
  useEffect(() => {
    localStorage.setItem('layout', JSON.stringify(layout));
  }, [layout]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
  }, []);

  const openModal = useCallback((modalId: string) => {
    setModals((prev) => ({ ...prev, [modalId]: true }));
  }, []);

  const closeModal = useCallback((modalId: string) => {
    setModals((prev) => ({ ...prev, [modalId]: false }));
  }, []);

  const updateLayout = useCallback((newLayout: Partial<LayoutConfig>) => {
    setLayout((prev) => ({ ...prev, ...newLayout }));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(defaultLayout);
  }, []);

  return (
    <UIContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        fontSize,
        setFontSize,
        modals,
        openModal,
        closeModal,
        layout,
        updateLayout,
        resetLayout,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
