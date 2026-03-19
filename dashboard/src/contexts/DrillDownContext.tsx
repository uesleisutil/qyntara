import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { DrillDownContextType, DrillDownState, DrillDownLevel } from '../types/drilldown';

const DrillDownContext = createContext<DrillDownContextType | undefined>(undefined);

export const useDrillDown = (): DrillDownContextType => {
  const context = useContext(DrillDownContext);
  if (!context) {
    throw new Error('useDrillDown must be used within a DrillDownProvider');
  }
  return context;
};

interface DrillDownProviderProps {
  children: ReactNode;
}

const INITIAL_STATE: DrillDownState = {
  levels: [],
  currentLevel: 0,
  selectedElement: undefined
};

export const DrillDownProvider: React.FC<DrillDownProviderProps> = ({ children }) => {
  const [state, setState] = useState<DrillDownState>(INITIAL_STATE);

  const drillDown = useCallback((level: DrillDownLevel) => {
    setState((prev) => ({
      ...prev,
      levels: [...prev.levels, level],
      currentLevel: prev.levels.length
    }));
  }, []);

  const drillUp = useCallback((targetLevel?: number) => {
    setState((prev) => {
      const newLevel = targetLevel !== undefined ? targetLevel : Math.max(0, prev.currentLevel - 1);
      return {
        ...prev,
        levels: prev.levels.slice(0, newLevel + 1),
        currentLevel: newLevel,
        selectedElement: undefined
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const getCurrentFilters = useCallback((): Record<string, any> => {
    return state.levels.reduce((acc, level) => {
      if (level.filters) {
        return { ...acc, ...level.filters };
      }
      return acc;
    }, {});
  }, [state.levels]);

  const breadcrumbPath = state.levels.map((level) => level.label);
  const isInDrillDown = state.levels.length > 0;

  return (
    <DrillDownContext.Provider
      value={{
        state,
        drillDown,
        drillUp,
        reset,
        getCurrentFilters,
        isInDrillDown,
        breadcrumbPath
      }}
    >
      {children}
    </DrillDownContext.Provider>
  );
};

export default DrillDownContext;
