/**
 * System Health Indicator Component
 * 
 * Displays system health status with detailed component information.
 * Implements Requirements 47.1-47.10 (System Health Indicator)
 */

import React, { useState, useRef, useEffect } from 'react';
import { useSystemHealth } from '../../../contexts/SystemHealthContext';
import { ComponentHealth } from '../../../types/notifications';

const SystemHealthIndicator: React.FC = () => {
  const { health, loading, fetchHealth } = useSystemHealth();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        buttonRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleRefresh = async () => {
    await fetchHealth();
  };

  // Get color for health status
  const getStatusColor = (status: 'green' | 'yellow' | 'red'): string => {
    switch (status) {
      case 'green':
        return '#10b981'; // green
      case 'yellow':
        return '#f59e0b'; // amber
      case 'red':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  const formatLastCheck = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Health Indicator Button (Req 47.1) */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        aria-label={`System health: ${health.status}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: 'transparent',
          border: '1px solid #e5e7eb',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {/* Status Indicator */}
        <div
          style={{
            width: '0.75rem',
            height: '0.75rem',
            borderRadius: '50%',
            backgroundColor: getStatusColor(health.status),
            boxShadow: `0 0 0 2px ${getStatusColor(health.status)}33`,
            animation: loading ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
          }}
        />
        <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
          System Health
        </span>
      </button>

      {/* Detailed Status Panel (Req 47.9) */}
      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="System health details"
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            right: 0,
            width: '20rem',
            maxWidth: '90vw',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            zIndex: 50,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
                System Status
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                Last checked {formatLastCheck(health.lastCheck)}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh health status"
              style={{
                padding: '0.25rem',
                background: 'transparent',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: '#6b7280',
                borderRadius: '0.25rem',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: loading ? 'spin 1s linear infinite' : 'none',
                }}
              >
                <path d="M14 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0z" />
                <path d="M8 2v6l3 3" />
              </svg>
            </button>
          </div>

          {/* Component Status List */}
          <div style={{ padding: '0.5rem' }}>
            {/* API Gateway (Req 47.2) */}
            <ComponentStatusItem
              label="API Gateway"
              component={health.components.apiGateway}
            />
            
            {/* Lambda (Req 47.3) */}
            <ComponentStatusItem
              label="Lambda Functions"
              component={health.components.lambda}
            />
            
            {/* S3 (Req 47.4) */}
            <ComponentStatusItem
              label="S3 Storage"
              component={health.components.s3}
            />
            
            {/* Data Freshness (Req 47.5) */}
            <ComponentStatusItem
              label="Data Freshness"
              component={health.components.dataFreshness}
            />
          </div>

          {/* Overall Status */}
          <div
            style={{
              padding: '1rem',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '1rem',
                  height: '1rem',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(health.status),
                }}
              />
              <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                Overall Status:{' '}
                <span style={{ color: getStatusColor(health.status) }}>
                  {health.status.toUpperCase()}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

// Component Status Item
interface ComponentStatusItemProps {
  label: string;
  component: ComponentHealth;
}

const ComponentStatusItem: React.FC<ComponentStatusItemProps> = ({ label, component }) => {
  const getComponentStatusColor = (status: ComponentHealth['status']): string => {
    switch (status) {
      case 'healthy':
        return '#10b981';
      case 'warning':
        return '#f59e0b';
      case 'failing':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getComponentStatusIcon = (status: ComponentHealth['status']): string => {
    switch (status) {
      case 'healthy':
        return '✓';
      case 'warning':
        return '⚠';
      case 'failing':
        return '✗';
      default:
        return '?';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.75rem',
        marginBottom: '0.5rem',
        border: '1px solid #e5e7eb',
        borderRadius: '0.375rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1.5rem',
          height: '1.5rem',
          borderRadius: '50%',
          backgroundColor: `${getComponentStatusColor(component.status)}22`,
          color: getComponentStatusColor(component.status),
          fontSize: '0.875rem',
          fontWeight: 'bold',
          flexShrink: 0,
        }}
      >
        {getComponentStatusIcon(component.status)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.125rem' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          {component.message}
        </div>
        {component.details && (
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.125rem' }}>
            {component.details}
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemHealthIndicator;
