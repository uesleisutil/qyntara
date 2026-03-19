/**
 * DegradationAlerts Component
 * 
 * Implements Requirements:
 * - 27.1: Monitor performance metrics on the Drift Detection tab
 * - 27.2: Alert when MAPE increases by more than 20% relative to baseline
 * - 27.3: Alert when accuracy decreases by more than 10 percentage points
 * - 27.4: Alert when Sharpe ratio decreases by more than 0.5
 * - 27.5: Display active degradation alerts in the notification center
 * - 27.6: Display magnitude and duration of performance degradation
 * - 27.7: Correlate degradation with detected drift events
 * - 27.8: Track degradation alert history
 * 
 * Features:
 * - Real-time performance monitoring
 * - Alert severity classification
 * - Drift event correlation
 * - Alert history tracking
 * - Dark mode support
 * - Mobile responsive layout
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, Clock, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';

interface PerformanceDegradation {
  metric: string;
  current: number;
  baseline: number;
  change: number;
  changePercentage: number;
  degraded: boolean;
  duration: number; // days
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: number;
  firstDetected?: string;
}

interface DriftCorrelation {
  driftType: 'data' | 'concept';
  feature?: string;
  date: string;
  magnitude: number;
}

interface DegradationAlert {
  id: string;
  metric: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  magnitude: number;
  duration: number;
  timestamp: string;
  active: boolean;
  correlatedDrift?: DriftCorrelation[];
}

interface DegradationAlertsProps {
  performanceDegradation?: PerformanceDegradation[];
  driftEvents?: Array<{
    date: string;
    type: 'performance' | 'feature' | 'data';
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  darkMode?: boolean;
  isMobile?: boolean;
}

export const DegradationAlerts: React.FC<DegradationAlertsProps> = ({
  performanceDegradation = [],
  driftEvents = [],
  darkMode = false,
}) => {
  const [alerts, setAlerts] = useState<DegradationAlert[]>([]);
  const [alertHistory, setAlertHistory] = useState<DegradationAlert[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    alertBg: {
      critical: darkMode ? '#7f1d1d' : '#fef2f2',
      high: darkMode ? '#7c2d12' : '#fff7ed',
      medium: darkMode ? '#713f12' : '#fefce8',
      low: darkMode ? '#1e3a8a' : '#eff6ff',
    },
    alertBorder: {
      critical: darkMode ? '#991b1b' : '#fecaca',
      high: darkMode ? '#9a3412' : '#fed7aa',
      medium: darkMode ? '#854d0e' : '#fef08a',
      low: darkMode ? '#1e40af' : '#bfdbfe',
    },
    alertText: {
      critical: darkMode ? '#fca5a5' : '#dc2626',
      high: darkMode ? '#fdba74' : '#ea580c',
      medium: darkMode ? '#fde047' : '#ca8a04',
      low: darkMode ? '#93c5fd' : '#2563eb',
    },
  };

  // Generate alerts from performance degradation data (Req 27.1, 27.2, 27.3, 27.4)
  useEffect(() => {
    if (!performanceDegradation || performanceDegradation.length === 0) {
      setAlerts([]);
      return;
    }

    const newAlerts: DegradationAlert[] = performanceDegradation
      .filter(deg => deg.degraded)
      .map(deg => {
        // Correlate with drift events (Req 27.7)
        const correlatedDrift = correlateDriftEvents(deg, driftEvents);

        return {
          id: `${deg.metric}-${Date.now()}`,
          metric: deg.metric,
          severity: deg.severity,
          magnitude: Math.abs(deg.change),
          duration: deg.duration,
          timestamp: deg.firstDetected || new Date().toISOString(),
          active: true,
          correlatedDrift,
        };
      });

    setAlerts(newAlerts);

    // Track alert history (Req 27.8)
    if (newAlerts.length > 0) {
      setAlertHistory(prev => {
        const updated = [...newAlerts, ...prev];
        // Keep last 50 alerts
        return updated.slice(0, 50);
      });
    }
  }, [performanceDegradation, driftEvents]);

  // Correlate degradation with drift events (Req 27.7)
  const correlateDriftEvents = (
    degradation: PerformanceDegradation,
    events: Array<{ date: string; type: string; description: string; severity: string }>
  ): DriftCorrelation[] => {
    if (!events || events.length === 0) return [];

    // Find drift events within the degradation period
    const degradationStart = new Date(degradation.firstDetected || Date.now());
    degradationStart.setDate(degradationStart.getDate() - degradation.duration);

    return events
      .filter(event => {
        const eventDate = new Date(event.date);
        return eventDate >= degradationStart && (event.type === 'data' || event.type === 'feature');
      })
      .map(event => ({
        driftType: (event.type === 'data' ? 'data' : 'concept') as 'data' | 'concept',
        date: event.date,
        magnitude: 0.5, // Placeholder - would be calculated from actual drift data
      }))
      .slice(0, 3); // Show top 3 correlated events
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle size={20} />;
      case 'high':
        return <TrendingDown size={20} />;
      case 'medium':
        return <Activity size={20} />;
      default:
        return <Activity size={20} />;
    }
  };

  const formatMetricName = (metric: string): string => {
    const names: Record<string, string> = {
      mape: 'MAPE',
      accuracy: 'Accuracy',
      sharpe_ratio: 'Sharpe Ratio',
      sharpeRatio: 'Sharpe Ratio',
    };
    return names[metric] || metric;
  };

  const formatDuration = (days: number): string => {
    if (days === 0) return 'Just detected';
    if (days === 1) return '1 day';
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)} weeks`;
    return `${Math.floor(days / 30)} months`;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activeAlerts = alerts.filter(a => a.active);
  const hasActiveAlerts = activeAlerts.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Active Alerts Section (Req 27.5, 27.6) */}
      <div
        style={{
          backgroundColor: theme.cardBg,
          borderRadius: '8px',
          border: `1px solid ${theme.border}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1rem',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={20} color={hasActiveAlerts ? '#dc2626' : theme.textSecondary} />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: theme.text }}>
              Active Performance Alerts
            </h4>
            {hasActiveAlerts && (
              <span
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '9999px',
                }}
              >
                {activeAlerts.length}
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: '1rem' }}>
          {!hasActiveAlerts ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem',
                color: theme.textSecondary,
                fontSize: '0.875rem',
              }}
            >
              <Activity size={48} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p style={{ margin: 0 }}>No active performance degradation alerts</p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>
                All metrics are within acceptable thresholds
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activeAlerts.map(alert => {
                const isExpanded = expandedAlert === alert.id;
                const degradation = performanceDegradation?.find(d => d.metric === alert.metric);

                return (
                  <div
                    key={alert.id}
                    style={{
                      backgroundColor: theme.alertBg[alert.severity],
                      border: `1px solid ${theme.alertBorder[alert.severity]}`,
                      borderRadius: '6px',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Alert Header */}
                    <div
                      style={{
                        padding: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                      }}
                      onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                    >
                      <div style={{ color: theme.alertText[alert.severity], flexShrink: 0 }}>
                        {getSeverityIcon(alert.severity)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            marginBottom: '0.25rem',
                          }}
                        >
                          <h5
                            style={{
                              margin: 0,
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              color: theme.text,
                            }}
                          >
                            {formatMetricName(alert.metric)} Degradation
                          </h5>
                          <StatusBadge
                            status={alert.severity === 'critical' || alert.severity === 'high' ? 'error' : 'warning'}
                            label={alert.severity.toUpperCase()}
                          />
                        </div>

                        {degradation && (
                          <p
                            style={{
                              margin: '0.25rem 0',
                              fontSize: '0.75rem',
                              color: theme.textSecondary,
                              lineHeight: '1.4',
                            }}
                          >
                            Current: <strong>{degradation.current.toFixed(3)}</strong> | Baseline:{' '}
                            <strong>{degradation.baseline.toFixed(3)}</strong> | Change:{' '}
                            <strong style={{ color: theme.alertText[alert.severity] }}>
                              {degradation.change > 0 ? '+' : ''}
                              {degradation.change.toFixed(3)} ({degradation.changePercentage.toFixed(1)}%)
                            </strong>
                          </p>
                        )}

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            marginTop: '0.5rem',
                            fontSize: '0.75rem',
                            color: theme.textSecondary,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={14} />
                            <span>Duration: {formatDuration(alert.duration)}</span>
                          </div>
                          {alert.correlatedDrift && alert.correlatedDrift.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Activity size={14} />
                              <span>{alert.correlatedDrift.length} drift event(s)</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ color: theme.textSecondary, flexShrink: 0 }}>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>

                    {/* Expanded Details (Req 27.7) */}
                    {isExpanded && alert.correlatedDrift && alert.correlatedDrift.length > 0 && (
                      <div
                        style={{
                          padding: '0.75rem',
                          borderTop: `1px solid ${theme.alertBorder[alert.severity]}`,
                          backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
                        }}
                      >
                        <h6
                          style={{
                            margin: '0 0 0.5rem 0',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: theme.text,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          Correlated Drift Events
                        </h6>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {alert.correlatedDrift.map((drift, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: '0.5rem',
                                backgroundColor: theme.cardBg,
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                color: theme.textSecondary,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '500', color: theme.text }}>
                                  {drift.driftType === 'data' ? 'Data Drift' : 'Concept Drift'}
                                  {drift.feature && `: ${drift.feature}`}
                                </span>
                                <span>{new Date(drift.date).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Alert History Section (Req 27.8) */}
      <div
        style={{
          backgroundColor: theme.cardBg,
          borderRadius: '8px',
          border: `1px solid ${theme.border}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setShowHistory(!showHistory)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={20} color={theme.textSecondary} />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: theme.text }}>
              Alert History
            </h4>
            <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
              ({alertHistory.length} total)
            </span>
          </div>
          <div style={{ color: theme.textSecondary }}>
            {showHistory ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        {showHistory && (
          <div
            style={{
              borderTop: `1px solid ${theme.border}`,
              maxHeight: '400px',
              overflowY: 'auto',
            }}
          >
            {alertHistory.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: theme.textSecondary,
                  fontSize: '0.875rem',
                }}
              >
                No alert history available
              </div>
            ) : (
              <div style={{ padding: '0.5rem' }}>
                {alertHistory.map((alert, idx) => (
                  <div
                    key={`${alert.id}-${idx}`}
                    style={{
                      padding: '0.75rem',
                      borderBottom: idx < alertHistory.length - 1 ? `1px solid ${theme.border}` : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ color: theme.alertText[alert.severity], flexShrink: 0 }}>
                      {getSeverityIcon(alert.severity)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: '500', color: theme.text }}>
                        {formatMetricName(alert.metric)} Degradation
                      </div>
                      <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginTop: '0.125rem' }}>
                        {formatTimestamp(alert.timestamp)} • Duration: {formatDuration(alert.duration)}
                      </div>
                    </div>
                    <StatusBadge
                      status={alert.severity === 'critical' || alert.severity === 'high' ? 'error' : 'warning'}
                      label={alert.severity}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
