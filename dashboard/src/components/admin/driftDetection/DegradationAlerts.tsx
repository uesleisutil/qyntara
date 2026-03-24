import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Activity, ChevronDown, ChevronUp } from 'lucide-react';

interface PerformanceDegradation {
  metric: string; current: number; baseline: number; change: number;
  changePercentage: number; degraded: boolean; duration: number;
  severity: 'low' | 'medium' | 'high' | 'critical'; threshold: number; firstDetected?: string;
}

interface DriftCorrelation { driftType: 'data' | 'concept'; feature?: string; date: string; magnitude: number; }

interface DegradationAlert {
  id: string; metric: string; severity: 'low' | 'medium' | 'high' | 'critical';
  magnitude: number; duration: number; timestamp: string; active: boolean;
  correlatedDrift?: DriftCorrelation[];
}

interface DegradationAlertsProps {
  performanceDegradation?: PerformanceDegradation[];
  driftEvents?: Array<{ date: string; type: string; description: string; severity: string }>;
  darkMode?: boolean;
  isMobile?: boolean;
}

export const DegradationAlerts: React.FC<DegradationAlertsProps> = ({
  performanceDegradation = [], driftEvents = [], darkMode = false,
}) => {
  const [alerts, setAlerts] = useState<DegradationAlert[]>([]);
  const [alertHistory, setAlertHistory] = useState<DegradationAlert[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const theme = {
    cardBg: darkMode ? '#1e1b40' : '#fff',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#b8b5d0' : '#64748b',
    border: darkMode ? '#363258' : '#e2e8f0',
    alertBg: {
      critical: darkMode ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)',
      high: darkMode ? 'rgba(249,115,22,0.1)' : 'rgba(249,115,22,0.05)',
      medium: darkMode ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.05)',
      low: darkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
    },
    alertBorder: {
      critical: darkMode ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.25)',
      high: darkMode ? 'rgba(249,115,22,0.3)' : 'rgba(249,115,22,0.25)',
      medium: darkMode ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.25)',
      low: darkMode ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.25)',
    },
    alertText: {
      critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#8b5cf6',
    },
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden',
  };

  useEffect(() => {
    if (!performanceDegradation || performanceDegradation.length === 0) { setAlerts([]); return; }
    const newAlerts: DegradationAlert[] = performanceDegradation.filter(d => d.degraded).map(deg => {
      const degradationStart = new Date(deg.firstDetected || Date.now());
      degradationStart.setDate(degradationStart.getDate() - deg.duration);
      const correlatedDrift: DriftCorrelation[] = (driftEvents || [])
        .filter(ev => { const d = new Date(ev.date); return d >= degradationStart && (ev.type === 'data' || ev.type === 'feature'); })
        .map(ev => ({ driftType: (ev.type === 'data' ? 'data' : 'concept') as 'data' | 'concept', date: ev.date, magnitude: 0.5 }))
        .slice(0, 3);
      return { id: `${deg.metric}-${Date.now()}`, metric: deg.metric, severity: deg.severity, magnitude: Math.abs(deg.change), duration: deg.duration, timestamp: deg.firstDetected || new Date().toISOString(), active: true, correlatedDrift };
    });
    setAlerts(newAlerts);
    if (newAlerts.length > 0) setAlertHistory(prev => [...newAlerts, ...prev].slice(0, 50));
  }, [performanceDegradation, driftEvents]);

  const getSeverityIcon = (sev: string) => {
    if (sev === 'critical' || sev === 'high') return <AlertTriangle size={18} />;
    return <Activity size={18} />;
  };

  const formatMetricName = (m: string) => ({ mape: 'MAPE', accuracy: 'Acurácia', sharpe_ratio: 'Sharpe Ratio', sharpeRatio: 'Sharpe Ratio' }[m] || m);

  const formatDuration = (d: number) => {
    if (d === 0) return 'Recém detectado';
    if (d === 1) return '1 dia';
    if (d < 7) return `${d} dias`;
    if (d < 30) return `${Math.floor(d / 7)} semanas`;
    return `${Math.floor(d / 30)} meses`;
  };

  const formatTimestamp = (ts: string) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const severityLabel: Record<string, string> = { critical: 'CRÍTICO', high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' };

  const activeAlerts = alerts.filter(a => a.active);
  const hasActiveAlerts = activeAlerts.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Alertas ativos */}
      <div style={cardStyle}>
        <div style={{ padding: '1rem', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color={hasActiveAlerts ? '#ef4444' : theme.textSecondary} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Alertas de Performance Ativos</h4>
            {hasActiveAlerts && (
              <span style={{ background: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: 10 }}>{activeAlerts.length}</span>
            )}
          </div>
        </div>
        <div style={{ padding: '1rem' }}>
          {!hasActiveAlerts ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: theme.textSecondary }}>
              <Activity size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Nenhum alerta de degradação ativo</p>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem' }}>Todas as métricas estão dentro dos limites aceitáveis</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activeAlerts.map(alert => {
                const isExpanded = expandedAlert === alert.id;
                const deg = performanceDegradation?.find(d => d.metric === alert.metric);
                return (
                  <div key={alert.id} style={{ background: theme.alertBg[alert.severity], border: `1px solid ${theme.alertBorder[alert.severity]}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}
                      onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}>
                      <div style={{ color: theme.alertText[alert.severity], flexShrink: 0 }}>{getSeverityIcon(alert.severity)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>
                            Degradação de {formatMetricName(alert.metric)}
                          </h5>
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.65rem', fontWeight: 600,
                            background: theme.alertBg[alert.severity], color: theme.alertText[alert.severity],
                            border: `1px solid ${theme.alertBorder[alert.severity]}`,
                          }}>{severityLabel[alert.severity] || alert.severity.toUpperCase()}</span>
                        </div>
                        {deg && (
                          <p style={{ margin: '0.2rem 0', fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                            Atual: <strong style={{ color: theme.text }}>{deg.current.toFixed(3)}</strong> | Baseline: <strong style={{ color: theme.text }}>{deg.baseline.toFixed(3)}</strong> | Variação: <strong style={{ color: theme.alertText[alert.severity] }}>{deg.change > 0 ? '+' : ''}{deg.change.toFixed(3)} ({deg.changePercentage.toFixed(1)}%)</strong>
                          </p>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.4rem', fontSize: '0.72rem', color: theme.textSecondary }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Clock size={12} /> Duração: {formatDuration(alert.duration)}</span>
                          {alert.correlatedDrift && alert.correlatedDrift.length > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Activity size={12} /> {alert.correlatedDrift.length} evento(s) de drift</span>
                          )}
                        </div>
                      </div>
                      <div style={{ color: theme.textSecondary, flexShrink: 0 }}>{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
                    </div>
                    {isExpanded && alert.correlatedDrift && alert.correlatedDrift.length > 0 && (
                      <div style={{ padding: '0.75rem', borderTop: `1px solid ${theme.alertBorder[alert.severity]}`, background: darkMode ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.5)' }}>
                        <h6 style={{ margin: '0 0 0.5rem 0', fontSize: '0.72rem', fontWeight: 600, color: theme.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eventos de Drift Correlacionados</h6>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {alert.correlatedDrift.map((drift, idx) => (
                            <div key={idx} style={{ padding: '0.5rem', background: theme.cardBg, borderRadius: 6, fontSize: '0.75rem', color: theme.textSecondary, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 500, color: theme.text }}>{drift.driftType === 'data' ? 'Data Drift' : 'Concept Drift'}{drift.feature && `: ${drift.feature}`}</span>
                              <span>{new Date(drift.date).toLocaleDateString('pt-BR')}</span>
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

      {/* Histórico de alertas */}
      <div style={cardStyle}>
        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowHistory(!showHistory)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color={theme.textSecondary} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Histórico de Alertas</h4>
            <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>({alertHistory.length} total)</span>
          </div>
          <div style={{ color: theme.textSecondary }}>{showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
        </div>
        {showHistory && (
          <div style={{ borderTop: `1px solid ${theme.border}`, maxHeight: 400, overflowY: 'auto' }}>
            {alertHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: theme.textSecondary, fontSize: '0.85rem' }}>
                Nenhum histórico de alertas disponível
              </div>
            ) : (
              <div style={{ padding: '0.5rem' }}>
                {alertHistory.map((alert, idx) => (
                  <div key={`${alert.id}-${idx}`} style={{ padding: '0.65rem', borderBottom: idx < alertHistory.length - 1 ? `1px solid ${theme.border}` : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ color: theme.alertText[alert.severity], flexShrink: 0 }}>{getSeverityIcon(alert.severity)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, color: theme.text }}>Degradação de {formatMetricName(alert.metric)}</div>
                      <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.1rem' }}>{formatTimestamp(alert.timestamp)} · Duração: {formatDuration(alert.duration)}</div>
                    </div>
                    <span style={{
                      padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.65rem', fontWeight: 600,
                      background: theme.alertBg[alert.severity], color: theme.alertText[alert.severity],
                      border: `1px solid ${theme.alertBorder[alert.severity]}`,
                    }}>{severityLabel[alert.severity] || alert.severity}</span>
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
