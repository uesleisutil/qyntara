import React, { useState } from 'react';
import { GripVertical, EyeOff } from 'lucide-react';
import { KPICard } from './KPICard';
import { useLayout } from '../../contexts/LayoutContext';

export interface DraggableKPICardProps {
  id: string;
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  tooltip?: string;
  onClick?: () => void;
  loading?: boolean;
  index: number;
  darkMode?: boolean;
}

export const DraggableKPICard: React.FC<DraggableKPICardProps> = ({
  id,
  index,
  darkMode = false,
  ...kpiProps
}) => {
  const { kpiCards, reorderKPICards, toggleKPICardVisibility } = useLayout();
  const [isDragging, setIsDragging] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const cardConfig = kpiCards.find(c => c.id === id);
  const isVisible = cardConfig?.visible ?? true;

  const theme = {
    border: darkMode ? '#2a3d36' : '#d4e5dc',
    hover: darkMode ? '#2a3d36' : '#e8f0ed'
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const startIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (startIndex !== index) {
      reorderKPICards(startIndex, index);
    }
  };

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleKPICardVisibility(id);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      style={{
        position: 'relative',
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: 'opacity 0.2s'
      }}
    >
      {/* Drag Handle and Controls */}
      {showControls && (
        <div
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            display: 'flex',
            gap: '0.25rem',
            zIndex: 10
          }}
        >
          <button
            onClick={handleToggleVisibility}
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              border: `1px solid ${theme.border}`,
              borderRadius: '0.375rem',
              padding: '0.25rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}
            title="Hide card"
            aria-label="Hide card"
          >
            <EyeOff size={14} color="#5a7268" />
          </button>
          
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              border: `1px solid ${theme.border}`,
              borderRadius: '0.375rem',
              padding: '0.25rem',
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}
            title="Drag to reorder"
          >
            <GripVertical size={14} color="#5a7268" />
          </div>
        </div>
      )}

      <KPICard {...kpiProps} />
    </div>
  );
};

export default DraggableKPICard;
