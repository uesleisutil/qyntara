/**
 * Real-Time Status Bar Component
 * 
 * Displays real-time status updates and refresh controls.
 * Implements Requirements 48.1-48.11 (Real-Time Status Updates)
 */

import React, { useState, useEffect } from 'react';
import { useRealTime } from '../../../contexts/RealTimeContext';

const RealTimeStatusBar: React.FC = () => {
  const { status, setAutoRefresh, triggerRefresh } = useRealTime();
  const [countdown, setCountdown] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  // Calculate countdown to next refresh (Req 48.6)
  useEffect(() => {
    if (status.nextRefresh && status.autoRefresh) {
      const interval = setInterval(() => {
        const now = Date.now();
        const next = new Date(status.nextRefresh!).getTime();
        const remaining = Math.max(0, Math.floor((next - now) / 1000));
        setCountdown(remaining);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setCountdown(0);
    }
  }, [status.nextRefresh, status.autoRefresh]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await triggerRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleAutoRefresh = () => {
    setAutoRefresh(!status.autoRefresh);
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatLastRefresh = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.75rem 1rem',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        fontSize: '0.875rem',
      }}
    >
      {/* Connection Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div
          style={{
            width: '0.5rem',
            height: '0.5rem',
            borderRadius: '50%',
            backgroundColor: status.connected ? '#10b981' : '#ef4444',
            animation: status.connected ? 'none' : 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        />
        <span style={{ color: '#6b7280' }}>
          {status.connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Current Activity (Req 48.1, 48.2, 48.3) */}
      {status.currentActivity && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.25rem 0.75rem',
            backgroundColor: status.processing ? '#fef3c7' : '#dbeafe',
            color: status.processing ? '#92400e' : '#7c3aed',
            borderRadius: '0.25rem',
          }}
        >
          {status.processing && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ animation: 'spin 1s linear infinite' }}
            >
              <circle cx="7" cy="7" r="5" />
            </svg>
          )}
          <span>{status.currentActivity}</span>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Last Refresh (Req 48.5) */}
      <div style={{ color: '#6b7280' }}>
        Last refresh: {formatLastRefresh(status.lastRefresh)}
      </div>

      {/* Auto-refresh Toggle (Req 48.4) */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={status.autoRefresh}
          onChange={handleToggleAutoRefresh}
          style={{ cursor: 'pointer' }}
        />
        <span style={{ color: '#6b7280' }}>Auto-refresh</span>
      </label>

      {/* Countdown (Req 48.6) */}
      {status.autoRefresh && countdown > 0 && (
        <div
          style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: '#e5e7eb',
            borderRadius: '0.25rem',
            color: '#374151',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Next: {formatCountdown(countdown)}
        </div>
      )}

      {/* Manual Refresh Button (Req 48.7) */}
      <button
        onClick={handleRefresh}
        disabled={refreshing || status.processing}
        aria-label="Refresh data"
        title="Refresh data"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.375rem 0.75rem',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: 'white',
          backgroundColor: refreshing || status.processing ? '#9ca3af' : '#8b5cf6',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: refreshing || status.processing ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!refreshing && !status.processing) {
            e.currentTarget.style.backgroundColor = '#7c3aed';
          }
        }}
        onMouseLeave={(e) => {
          if (!refreshing && !status.processing) {
            e.currentTarget.style.backgroundColor = '#8b5cf6';
          }
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: refreshing ? 'spin 1s linear infinite' : 'none',
          }}
        >
          <path d="M12 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0z" />
          <path d="M7 3v4l2 2" />
        </svg>
        {refreshing ? 'Refreshing...' : 'Refresh'}
      </button>

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

export default RealTimeStatusBar;
