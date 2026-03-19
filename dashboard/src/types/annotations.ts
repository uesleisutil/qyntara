export interface Annotation {
  id: string;
  chartId: string;
  date: string;
  text: string;
  category?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationContextType {
  annotations: Annotation[];
  getAnnotationsForChart: (chartId: string) => Annotation[];
  getAnnotationsForDate: (chartId: string, date: string) => Annotation[];
  addAnnotation: (annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateAnnotation: (id: string, updates: Partial<Omit<Annotation, 'id' | 'createdAt'>>) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  filterByCategory: (category: string) => Annotation[];
  exportAnnotations: (chartId?: string) => string;
  importAnnotations: (annotationsJson: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const ANNOTATION_CATEGORIES = [
  { value: 'event', label: 'Market Event', color: '#3b82f6' },
  { value: 'decision', label: 'Trading Decision', color: '#10b981' },
  { value: 'note', label: 'General Note', color: '#f59e0b' },
  { value: 'alert', label: 'Alert', color: '#ef4444' },
  { value: 'milestone', label: 'Milestone', color: '#8b5cf6' }
];
