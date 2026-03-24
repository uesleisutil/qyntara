import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbSegment {
  label: string;
  path?: string;
  onClick?: () => void;
}

export interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
  maxLength?: number;
  className?: string;
  darkMode?: boolean;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  segments,
  maxLength = 50,
  className = '',
  darkMode = false
}) => {
  const theme = {
    text: darkMode ? '#e8f0ed' : '#121a1a',
    textSecondary: darkMode ? '#8fa89c' : '#5a7268',
    hover: darkMode ? '#2a3d36' : '#e8f0ed',
    active: '#5a9e87'
  };

  const truncateLabel = (label: string, maxLen: number): string => {
    if (label.length <= maxLen) return label;
    return `${label.substring(0, maxLen - 3)}...`;
  };

  const handleKeyDown = (e: React.KeyboardEvent, onClick?: () => void) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        fontSize: '0.875rem',
        overflowX: 'auto',
        whiteSpace: 'nowrap'
      }}
    >
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          listStyle: 'none',
          margin: 0,
          padding: 0
        }}
      >
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const isClickable = !isLast && segment.onClick;

          return (
            <li
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {index > 0 && (
                <ChevronRight
                  size={16}
                  color={theme.textSecondary}
                  aria-hidden="true"
                />
              )}
              
              {index === 0 && (
                <Home
                  size={16}
                  color={isLast ? theme.active : theme.textSecondary}
                  aria-hidden="true"
                  style={{ marginRight: '0.25rem' }}
                />
              )}

              {isClickable ? (
                <button
                  onClick={segment.onClick}
                  onKeyDown={(e) => handleKeyDown(e, segment.onClick)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.375rem',
                    color: theme.textSecondary,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.hover;
                    e.currentTarget.style.color = theme.text;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = theme.textSecondary;
                  }}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {truncateLabel(segment.label, maxLength)}
                </button>
              ) : (
                <span
                  style={{
                    padding: '0.25rem 0.5rem',
                    color: isLast ? theme.active : theme.text,
                    fontWeight: isLast ? '600' : '500',
                    fontSize: '0.875rem'
                  }}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {truncateLabel(segment.label, maxLength)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
