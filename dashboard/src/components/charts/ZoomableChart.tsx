import React, { useState, useRef } from 'react';
import { useChartZoom } from '../../hooks/useChartZoom';
import { ZoomControls } from '../shared/ZoomControls';
import { useAnnotations } from '../../contexts/AnnotationContext';
import { AnnotationModal } from '../shared/AnnotationModal';
import { MessageSquare } from 'lucide-react';

export interface ZoomableChartProps {
  chartId: string;
  children: React.ReactNode;
  enableZoom?: boolean;
  enablePan?: boolean;
  enableAnnotations?: boolean;
  darkMode?: boolean;
  height?: number;
  width?: number;
}

export const ZoomableChart: React.FC<ZoomableChartProps> = ({
  chartId,
  children,
  enableZoom = true,
  enablePan = true,
  enableAnnotations = true,
  darkMode = false,
  height = 400,
  width: _width = 800
}) => {
  const { zoomState, controls, handlers } = useChartZoom({
    enableWheel: enableZoom,
    enablePan,
    enablePinch: enableZoom
  });

  const { addAnnotation, getAnnotationsForChart } = useAnnotations();
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  const annotations = getAnnotationsForChart(chartId);

  const theme = {
    bg: darkMode ? '#1e293b' : 'white',
    border: darkMode ? '#334155' : '#e2e8f0',
    text: darkMode ? '#f1f5f9' : '#0f172a'
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!enableAnnotations) return;

    e.preventDefault();
    
    // Get the date from the click position (simplified - would need chart-specific logic)
    const date = new Date().toISOString().split('T')[0];
    setSelectedDate(date);
    setShowAnnotationModal(true);
  };

  const handleSaveAnnotation = async (text: string, category?: string) => {
    try {
      await addAnnotation({
        chartId,
        date: selectedDate,
        text,
        category
      });
    } catch (err) {
      console.error('Failed to save annotation:', err);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: `${height}px`,
        overflow: 'hidden',
        backgroundColor: theme.bg,
        borderRadius: '0.5rem',
        border: `1px solid ${theme.border}`
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Zoom Controls */}
      {enableZoom && (
        <ZoomControls
          onZoomIn={controls.zoomIn}
          onZoomOut={controls.zoomOut}
          onReset={controls.reset}
          zoomLevel={zoomState.scale}
          darkMode={darkMode}
          position="top-right"
        />
      )}

      {/* Annotation Indicator */}
      {enableAnnotations && annotations.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: theme.bg,
            border: `1px solid ${theme.border}`,
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            color: theme.text,
            zIndex: 5
          }}
        >
          <MessageSquare size={14} />
          <span>{annotations.length} annotation{annotations.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Chart Content */}
      <div
        {...handlers}
        style={{
          width: '100%',
          height: '100%',
          cursor: enablePan ? 'grab' : 'default',
          transform: `scale(${zoomState.scale}) translate(${zoomState.translateX}px, ${zoomState.translateY}px)`,
          transformOrigin: 'center center',
          transition: 'transform 0.1s ease-out'
        }}
      >
        {children}
      </div>

      {/* Annotation Modal */}
      {showAnnotationModal && (
        <AnnotationModal
          isOpen={showAnnotationModal}
          onClose={() => setShowAnnotationModal(false)}
          onSave={handleSaveAnnotation}
          date={selectedDate}
          darkMode={darkMode}
        />
      )}
    </div>
  );
};

export default ZoomableChart;
