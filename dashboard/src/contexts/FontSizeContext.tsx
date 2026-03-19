/**
 * Font Size Context
 * 
 * Manages global font size settings for accessibility
 * Requirement 69: Adjustable Font Sizes
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

interface FontSizeContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  fontSizeScale: number;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

const FONT_SIZE_SCALES: Record<FontSize, number> = {
  small: 0.875,    // 87.5% - 14px base
  medium: 1,       // 100% - 16px base
  large: 1.125,    // 112.5% - 18px base
  xlarge: 1.25     // 125% - 20px base
};

const STORAGE_KEY = 'dashboard-font-size';

interface FontSizeProviderProps {
  children: ReactNode;
}

export function FontSizeProvider({ children }: FontSizeProviderProps) {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    // Load from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as FontSize) || 'medium';
  });
  
  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem(STORAGE_KEY, size);
    
    // Update CSS custom property
    const scale = FONT_SIZE_SCALES[size];
    document.documentElement.style.setProperty('--font-size-scale', scale.toString());
  };
  
  // Initialize font size on mount
  useEffect(() => {
    const scale = FONT_SIZE_SCALES[fontSize];
    document.documentElement.style.setProperty('--font-size-scale', scale.toString());
  }, [fontSize]);
  
  const value: FontSizeContextType = {
    fontSize,
    setFontSize,
    fontSizeScale: FONT_SIZE_SCALES[fontSize]
  };
  
  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (context === undefined) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
}
