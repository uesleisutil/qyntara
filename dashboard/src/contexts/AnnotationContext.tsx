import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { AnnotationContextType, Annotation, ANNOTATION_CATEGORIES } from '../types/annotations';

const AnnotationContext = createContext<AnnotationContextType | undefined>(undefined);

export const useAnnotations = (): AnnotationContextType => {
  const context = useContext(AnnotationContext);
  if (!context) {
    throw new Error('useAnnotations must be used within an AnnotationProvider');
  }
  return context;
};

interface AnnotationProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'dashboard_annotations';

export const AnnotationProvider: React.FC<AnnotationProviderProps> = ({ children }) => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load annotations from localStorage on mount
  useEffect(() => {
    const loadAnnotations = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setAnnotations(parsed);
        }
      } catch (err) {
        console.error('Failed to load annotations:', err);
        setError('Failed to load annotations');
      }
    };

    loadAnnotations();
  }, []);

  // Save annotations to localStorage whenever they change
  const saveAnnotations = useCallback((newAnnotations: Annotation[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newAnnotations));
    } catch (err) {
      console.error('Failed to save annotations:', err);
      throw new Error('Failed to save annotations');
    }
  }, []);

  const getAnnotationsForChart = useCallback((chartId: string): Annotation[] => {
    return annotations.filter((a) => a.chartId === chartId);
  }, [annotations]);

  const getAnnotationsForDate = useCallback((chartId: string, date: string): Annotation[] => {
    return annotations.filter((a) => a.chartId === chartId && a.date === date);
  }, [annotations]);

  const addAnnotation = useCallback(async (
    annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const newAnnotation: Annotation = {
        ...annotation,
        id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now,
        color: annotation.category 
          ? ANNOTATION_CATEGORIES.find(c => c.value === annotation.category)?.color 
          : '#8b5cf6'
      };

      const newAnnotations = [...annotations, newAnnotation];
      setAnnotations(newAnnotations);
      saveAnnotations(newAnnotations);

      // TODO: Sync with DynamoDB when backend is ready
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add annotation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [annotations, saveAnnotations]);

  const updateAnnotation = useCallback(async (
    id: string,
    updates: Partial<Omit<Annotation, 'id' | 'createdAt'>>
  ) => {
    setLoading(true);
    setError(null);

    try {
      const newAnnotations = annotations.map((a) =>
        a.id === id
          ? { ...a, ...updates, updatedAt: new Date().toISOString() }
          : a
      );

      setAnnotations(newAnnotations);
      saveAnnotations(newAnnotations);

      // TODO: Sync with DynamoDB when backend is ready
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update annotation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [annotations, saveAnnotations]);

  const deleteAnnotation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const newAnnotations = annotations.filter((a) => a.id !== id);
      setAnnotations(newAnnotations);
      saveAnnotations(newAnnotations);

      // TODO: Sync with DynamoDB when backend is ready
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete annotation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [annotations, saveAnnotations]);

  const filterByCategory = useCallback((category: string): Annotation[] => {
    return annotations.filter((a) => a.category === category);
  }, [annotations]);

  const exportAnnotations = useCallback((chartId?: string): string => {
    const toExport = chartId
      ? annotations.filter((a) => a.chartId === chartId)
      : annotations;
    return JSON.stringify(toExport, null, 2);
  }, [annotations]);

  const importAnnotations = useCallback(async (annotationsJson: string) => {
    setLoading(true);
    setError(null);

    try {
      const imported = JSON.parse(annotationsJson);
      if (!Array.isArray(imported)) {
        throw new Error('Invalid annotations format');
      }

      const newAnnotations = [...annotations, ...imported];
      setAnnotations(newAnnotations);
      saveAnnotations(newAnnotations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import annotations');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [annotations, saveAnnotations]);

  return (
    <AnnotationContext.Provider
      value={{
        annotations,
        getAnnotationsForChart,
        getAnnotationsForDate,
        addAnnotation,
        updateAnnotation,
        deleteAnnotation,
        filterByCategory,
        exportAnnotations,
        importAnnotations,
        loading,
        error
      }}
    >
      {children}
    </AnnotationContext.Provider>
  );
};

export default AnnotationContext;
