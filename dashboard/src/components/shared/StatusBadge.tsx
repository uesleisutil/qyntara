import React from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info, 
  Activity,
  TrendingDown,
} from 'lucide-react';

type StatusType = 
  | 'success' | 'warning' | 'error' | 'info'
  | 'good' | 'fair' | 'poor' | 'critical'
  | 'active' | 'acknowledged' | 'resolved'
  | 'no-drift' | 'drift-detected'
  | 'excellent' | 'current' | 'stale';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  icon?: React.ReactNode;
  tooltip?: string;
  onClick?: () => void;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  icon,
  tooltip,
  onClick,
  showIcon = true,
  size = 'md',
}) => {
  // Map status to colors
  const getStatusColor = (status: StatusType): { bg: string; text: string; border: string } => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      success: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
      good: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
      excellent: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
      current: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
      resolved: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
      'no-drift': { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
      
      warning: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
      fair: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
      acknowledged: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
      stale: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
      
      error: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
      poor: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
      critical: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
      'drift-detected': { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
      
      info: { bg: '#dbeafe', text: '#1e40af', border: '#8b5cf6' },
      active: { bg: '#dbeafe', text: '#1e40af', border: '#8b5cf6' },
    };

    return colorMap[status] || colorMap.info;
  };

  // Get default icon based on status
  const getDefaultIcon = (status: StatusType): React.ReactNode => {
    const iconMap: Record<string, React.ReactNode> = {
      success: <CheckCircle size={16} />,
      good: <CheckCircle size={16} />,
      excellent: <CheckCircle size={16} />,
      current: <CheckCircle size={16} />,
      resolved: <CheckCircle size={16} />,
      'no-drift': <CheckCircle size={16} />,
      
      warning: <AlertTriangle size={16} />,
      fair: <AlertTriangle size={16} />,
      acknowledged: <AlertTriangle size={16} />,
      stale: <AlertTriangle size={16} />,
      
      error: <XCircle size={16} />,
      poor: <XCircle size={16} />,
      critical: <XCircle size={16} />,
      'drift-detected': <TrendingDown size={16} />,
      
      info: <Info size={16} />,
      active: <Activity size={16} />,
    };

    return iconMap[status] || <Info size={16} />;
  };

  const colors = getStatusColor(status);
  const displayIcon = icon || (showIcon ? getDefaultIcon(status) : null);

  const sizeStyles = {
    sm: { padding: '0.25rem 0.5rem', fontSize: '0.75rem', iconSize: 12 },
    md: { padding: '0.375rem 0.75rem', fontSize: '0.875rem', iconSize: 16 },
    lg: { padding: '0.5rem 1rem', fontSize: '1rem', iconSize: 20 },
  };

  const style = sizeStyles[size];

  return (
    <span
      className={`status-badge status-badge-${status}`}
      title={tooltip}
      role="status"
      aria-label={`${status}: ${label}`}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: style.padding,
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        borderRadius: '9999px',
        fontSize: style.fontSize,
        fontWeight: 500,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      {displayIcon && (
        <span className="status-badge-icon" style={{ display: 'flex', alignItems: 'center' }}>
          {displayIcon}
        </span>
      )}
      <span className="status-badge-label">{label}</span>
    </span>
  );
};

// Status badge legend component
interface StatusBadgeLegendProps {
  categories: {
    title: string;
    badges: Array<{
      status: StatusType;
      label: string;
      description: string;
    }>;
  }[];
}

export const StatusBadgeLegend: React.FC<StatusBadgeLegendProps> = ({ categories }) => {
  return (
    <div className="status-badge-legend" style={{ 
      padding: '1rem', 
      background: '#f8fafc', 
      borderRadius: '8px',
    }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600 }}>
        Status Badge Legend
      </h3>
      {categories.map((category, idx) => (
        <div key={idx} style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>
            {category.title}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {category.badges.map((badge, badgeIdx) => (
              <div key={badgeIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <StatusBadge status={badge.status} label={badge.label} size="sm" />
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  {badge.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
