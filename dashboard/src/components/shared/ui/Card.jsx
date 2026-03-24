import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Card - Consistent card component for dashboard panels
 * 
 * Features:
 * - Consistent styling across dashboard
 * - Optional title, subtitle, and icon
 * - Optional actions (buttons, links)
 * - Hover effects
 * - Loading and error states
 * - Collapsible content
 */
const Card = ({ 
  title,
  subtitle,
  icon,
  actions,
  children,
  className = '',
  hoverable = false,
  loading = false,
  error = null,
  collapsible = false,
  defaultCollapsed = false,
  padding = 'normal'
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    normal: 'p-6',
    lg: 'p-8'
  };

  const toggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm ${
        hoverable ? 'hover:shadow-md transition-shadow duration-200' : ''
      } ${className}`}
    >
      {/* Header */}
      {(title || icon || actions) && (
        <div className={`flex items-center justify-between border-b border-gray-200 ${paddingClasses[padding]}`}>
          <div className="flex items-center gap-3 flex-1">
            {icon && (
              <div className="flex-shrink-0 text-gray-600">
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-gray-600 truncate">
                  {subtitle}
                </p>
              )}
            </div>
            {collapsible && (
              <button
                onClick={toggleCollapse}
                className="flex-shrink-0 p-1 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label={isCollapsed ? 'Expand' : 'Collapse'}
              >
                <svg
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isCollapsed ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}
          </div>
          {actions && !isCollapsed && (
            <div className="flex items-center gap-2 ml-4">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {!isCollapsed && (
        <div className={paddingClasses[padding]}>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && children}
        </div>
      )}
    </div>
  );
};

Card.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  icon: PropTypes.node,
  actions: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
  hoverable: PropTypes.bool,
  loading: PropTypes.bool,
  error: PropTypes.string,
  collapsible: PropTypes.bool,
  defaultCollapsed: PropTypes.bool,
  padding: PropTypes.oneOf(['none', 'sm', 'normal', 'lg'])
};

export default Card;
