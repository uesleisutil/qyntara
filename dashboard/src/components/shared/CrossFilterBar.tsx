import React from 'react';
import { X, Filter } from 'lucide-react';
import { useCrossFilter } from '../../contexts/CrossFilterContext';

export interface CrossFilterBarProps {
  darkMode?: boolean;
}

export const CrossFilterBar: React.FC<CrossFilterBarProps> = ({ darkMode = false }) => {
  const { filters, removeFilter, clearAllFilters, filterCount } = useCrossFilter();

  const theme = {
    bg: darkMode ? '#1a1836' : '#f8fafc',
    cardBg: darkMode ? '#0c0a1a' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#9895b0' : '#64748b',
    border: darkMode ? '#2a2745' : '#e2e8f0',
    hover: darkMode ? '#2a2745' : '#e2e8f0'
  };

  if (filters.length === 0) {
    return null;
  }

  const formatFilterLabel = (filter: typeof filters[0]): string => {
    if (Array.isArray(filter.values)) {
      if (filter.values.length === 1) {
        return `${filter.label}: ${filter.values[0]}`;
      }
      return `${filter.label}: ${filter.values.length} items`;
    }
    return `${filter.label}: ${filter.values}`;
  };

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: theme.bg,
        borderRadius: '0.5rem',
        border: `1px solid ${theme.border}`,
        marginBottom: '1rem'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} color="#8b5cf6" />
          <span style={{ fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
            Active Cross-Filters ({filterCount})
          </span>
        </div>
        <button
          onClick={clearAllFilters}
          style={{
            padding: '0.375rem 0.75rem',
            backgroundColor: 'transparent',
            color: '#dc2626',
            border: `1px solid ${theme.border}`,
            borderRadius: '0.375rem',
            fontSize: '0.8125rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#fee2e2';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Clear All
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}
      >
        {filters.map((filter) => (
          <div
            key={filter.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              color: theme.text
            }}
          >
            <span style={{ fontWeight: '500' }}>
              {formatFilterLabel(filter)}
            </span>
            <button
              onClick={() => removeFilter(filter.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0.25rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label={`Remove ${filter.label} filter`}
            >
              <X size={14} color={theme.textSecondary} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CrossFilterBar;
