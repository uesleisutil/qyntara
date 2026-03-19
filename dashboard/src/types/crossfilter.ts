export interface CrossFilter {
  id: string;
  sourceChart: string;
  filterType: 'sector' | 'ticker' | 'dateRange' | 'range' | 'category';
  label: string;
  values: any[];
  appliedAt: string;
}

export interface CrossFilterContextType {
  filters: CrossFilter[];
  addFilter: (filter: Omit<CrossFilter, 'id' | 'appliedAt'>) => void;
  removeFilter: (filterId: string) => void;
  clearAllFilters: () => void;
  getActiveFilters: () => CrossFilter[];
  getFilteredData: <T>(data: T[], filterFn: (item: T, filters: CrossFilter[]) => boolean) => T[];
  hasActiveFilters: boolean;
  filterCount: number;
}
