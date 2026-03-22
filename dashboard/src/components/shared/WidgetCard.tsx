import React, { useState } from 'react';
import { GripVertical, ChevronUp, ChevronDown, Minimize2, Maximize2 } from 'lucide-react';

interface WidgetCardProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  accentColor?: string;
  darkMode: boolean;
  theme: Record<string, string>;
  children: React.ReactNode;
  /** If true, widget spans full width instead of fitting in grid */
  fullWidth?: boolean;
  /** Collapse state */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Reorder callbacks */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  /** Edit mode shows reorder controls */
  editMode?: boolean;
}

const WidgetCard: React.FC<WidgetCardProps> = ({
  title, icon, accentColor = '#3b82f6', darkMode, theme, children,
  collapsed, onToggleCollapse, onMoveUp, onMoveDown, isFirst, isLast, editMode,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: theme.card || (darkMode ? '#1e293b' : '#ffffff'),
        border: `1px solid ${hovered ? accentColor + '40' : (theme.border || (darkMode ? '#334155' : '#e2e8f0'))}`,
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: hovered
          ? `0 4px 20px ${accentColor}10, 0 1px 3px rgba(0,0,0,0.08)`
          : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.65rem 0.85rem',
        borderBottom: collapsed ? 'none' : `1px solid ${darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        cursor: onToggleCollapse ? 'pointer' : 'default',
        userSelect: 'none',
      }}
        onClick={onToggleCollapse}
      >
        {/* Edit mode grip + arrows */}
        {editMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: 2 }}
            onClick={e => e.stopPropagation()}
          >
            <GripVertical size={14} color={theme.textSecondary} style={{ opacity: 0.4 }} />
            <button onClick={onMoveUp} disabled={isFirst}
              style={{ background: 'none', border: 'none', cursor: isFirst ? 'default' : 'pointer', padding: 2, opacity: isFirst ? 0.2 : 0.6, color: theme.textSecondary }}>
              <ChevronUp size={14} />
            </button>
            <button onClick={onMoveDown} disabled={isLast}
              style={{ background: 'none', border: 'none', cursor: isLast ? 'default' : 'pointer', padding: 2, opacity: isLast ? 0.2 : 0.6, color: theme.textSecondary }}>
              <ChevronDown size={14} />
            </button>
          </div>
        )}

        {/* Icon */}
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: `${accentColor}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>

        {/* Title */}
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, flex: 1 }}>
          {title}
        </span>

        {/* Collapse toggle */}
        {onToggleCollapse && (
          <div style={{ color: theme.textSecondary, opacity: 0.5, display: 'flex' }}>
            {collapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </div>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding: '0.75rem 0.85rem' }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default WidgetCard;
