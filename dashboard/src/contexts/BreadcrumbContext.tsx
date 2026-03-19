import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface BreadcrumbSegment {
  label: string;
  path?: string;
  onClick?: () => void;
}

interface BreadcrumbContextType {
  segments: BreadcrumbSegment[];
  setSegments: (segments: BreadcrumbSegment[]) => void;
  addSegment: (segment: BreadcrumbSegment) => void;
  removeSegment: (index: number) => void;
  clearSegments: () => void;
  navigateToSegment: (index: number) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

export const useBreadcrumb = (): BreadcrumbContextType => {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('useBreadcrumb must be used within a BreadcrumbProvider');
  }
  return context;
};

interface BreadcrumbProviderProps {
  children: ReactNode;
}

export const BreadcrumbProvider: React.FC<BreadcrumbProviderProps> = ({ children }) => {
  const [segments, setSegments] = useState<BreadcrumbSegment[]>([
    { label: 'Dashboard', onClick: () => {} }
  ]);

  const addSegment = useCallback((segment: BreadcrumbSegment) => {
    setSegments((prev) => [...prev, segment]);
  }, []);

  const removeSegment = useCallback((index: number) => {
    setSegments((prev) => prev.slice(0, index + 1));
  }, []);

  const clearSegments = useCallback(() => {
    setSegments([{ label: 'Dashboard', onClick: () => {} }]);
  }, []);

  const navigateToSegment = useCallback((index: number) => {
    const segment = segments[index];
    if (segment.onClick) {
      segment.onClick();
    }
    removeSegment(index);
  }, [segments, removeSegment]);

  return (
    <BreadcrumbContext.Provider
      value={{
        segments,
        setSegments,
        addSegment,
        removeSegment,
        clearSegments,
        navigateToSegment
      }}
    >
      {children}
    </BreadcrumbContext.Provider>
  );
};

export default BreadcrumbContext;
