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
  { value: 'event', label: 'Market Event', color: '#5a9e87' },
  { value: 'decision', label: 'Trading Decision', color: '#4ead8a' },
  { value: 'note', label: 'General Note', color: '#d4a84b' },
  { value: 'alert', label: 'Alert', color: '#e07070' },
  { value: 'milestone', label: 'Milestone', color: '#5a9e87' }
];
