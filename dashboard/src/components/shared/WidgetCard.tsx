import React from 'react';
import { Minimize2, Maximize2 } from 'lucide-react';

interface Props {
  id: string;
  title: string;
  icon: React.ReactNode;
  accentColor?: string;
  darkMode: boolean;
  theme: Record<string, string>;
  children: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  fullWidth?: boolean;
  editMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const WidgetCard: React.FC<Props> = ({
  title, icon, accentColor = '#3b82f6', darkMode, theme, children,
  collapsed, onToggleCollapse,
}) => (
  <div style={{
    background: theme.card || (darkMode ? '#1e293b' : '#ffffff'),
    border: `1px solid ${theme.border || (darkMode ? '#334155' : '#e2e8f0')}`,
    borderRadius: 12, overflow: 'hidden',
    transition: 'box-shadow 0.2s',
  }}>
    <div
      onClick={onToggleCollapse}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.6rem 0.75rem',
        cursor: onToggleCollapse ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{
        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
        background: `${accentColor}10`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: theme.text, flex: 1 }}>{title}</span>
      {onToggleCollapse && (
        <div style={{ color: theme.textSecondary, opacity: 0.35, display: 'flex' }}>
          {collapsed ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
        </div>
      )}
    </div>
    {!collapsed && (
      <div style={{ padding: '0 0.75rem 0.75rem' }}>{children}</div>
    )}
  </div>
);

export default WidgetCard;
