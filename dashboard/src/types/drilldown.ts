export interface DrillDownLevel {
  type: 'tab' | 'chart' | 'sector' | 'ticker' | 'detail';
  label: string;
  value?: string;
  filters?: Record<string, any>;
}

export interface DrillDownState {
  levels: DrillDownLevel[];
  currentLevel: number;
  selectedElement?: {
    type: string;
    id: string;
    data: any;
  };
}

export interface DrillDownContextType {
  state: DrillDownState;
  drillDown: (level: DrillDownLevel) => void;
  drillUp: (targetLevel?: number) => void;
  reset: () => void;
  getCurrentFilters: () => Record<string, any>;
  isInDrillDown: boolean;
  breadcrumbPath: string[];
}
