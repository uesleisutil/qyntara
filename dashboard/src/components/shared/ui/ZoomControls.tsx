import React from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  zoomLevel: number;
  darkMode?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onReset,
  zoomLevel,
  darkMode = false,
  position = 'top-right'
}) => {
  const theme = {
    bg: darkMode ? '#1e1b40' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    border: darkMode ? '#363258' : '#e2e8f0',
    hover: darkMode ? '#363258' : '#f1f5f9'
  };

  const positionStyles = {
    'top-right': { top: '1rem', right: '1rem' },
    'top-left': { top: '1rem', left: '1rem' },
    'bottom-right': { bottom: '1rem', right: '1rem' },
    'bottom-left': { bottom: '1rem', left: '1rem' }
  };

  return (
    <div
      style={{
        position: 'absolute',
        ...positionStyles[position],
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        backgroundColor: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: '0.5rem',
        padding: '0.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        zIndex: 10
      }}
    >
      <button
        onClick={onZoomIn}
        title="Zoom In"
        aria-label="Zoom in"
        style={{
          background: 'none',
          border: 'none',
          padding: '0.5rem',
          cursor: 'pointer',
          borderRadius: '0.375rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.hover}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <ZoomIn size={18} color={theme.text} />
      </button>

      <div
        style={{
          padding: '0.25rem 0.5rem',
          fontSize: '0.75rem',
          fontWeight: '600',
          color: theme.text,
          textAlign: 'center',
          borderTop: `1px solid ${theme.border}`,
          borderBottom: `1px solid ${theme.border}`
        }}
      >
        {Math.round(zoomLevel * 100)}%
      </div>

      <button
        onClick={onZoomOut}
        title="Zoom Out"
        aria-label="Zoom out"
        style={{
          background: 'none',
          border: 'none',
          padding: '0.5rem',
          cursor: 'pointer',
          borderRadius: '0.375rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.hover}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <ZoomOut size={18} color={theme.text} />
      </button>

      <button
        onClick={onReset}
        title="Reset Zoom"
        aria-label="Reset zoom"
        style={{
          background: 'none',
          border: 'none',
          padding: '0.5rem',
          cursor: 'pointer',
          borderRadius: '0.375rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.2s',
          borderTop: `1px solid ${theme.border}`
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.hover}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Maximize2 size={18} color={theme.text} />
      </button>
    </div>
  );
};

export default ZoomControls;
