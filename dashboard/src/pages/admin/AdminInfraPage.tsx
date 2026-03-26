import React, { useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  RefreshCw, CheckCircle, AlertTriangle, XCircle, Database,
  Clock, Shield, Zap, Radio, Eye, ChevronDown,
  ChevronRight, Cpu, Globe, Bell, Archive,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../../components/shared/ui/InfoTooltip';
import { useLiveData } from '../../hooks/useLiveData';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

interface LambdaFn {
  name: string; status: string; invocations_24h: number; errors_24h: number;
  error_rate: number; avg_duration_ms: number; max_duration_ms: number;
}

const STATUS_COLORS: Record<string, string> = {
  healthy: '#10b981', warning: '#f59e0b', critical: '#ef4444',
  idle: '#6b7280', unknown: '#6b7280', ok: '#10b981', error: '#ef4444',
};

const StatusDot: React.FC<{ status: string; size?: number }> = ({ status, size = 8 }) => (
  <span style={{
    width: size, height: size, borderRadius: '50%', display: 'inline-block',
    background: STATUS_COLORS[status] || '#6b7280',
    boxShadow: status === 'critical' ? '0 0 6px rgba(239,68,68,0.5)' : status === 'healthy' ? '0 0 6px rgba(16,185,129,0.3)' : 'none',
  }} />
);

const fmt = (n: number, d = 0) => n != null ? n.toLocaleString('pt-BR', { maximumFractionDigits: d }) : '—';

const AdminInfraPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'lambdas', 'alarms']));
  const [lambdaFilter, setLambdaFilter] = useState<string>('all');
  const [lambdaSort, setLambdaSort] = useState<'name' | 'errors' | 'invocations'>('errors');

  const fetchData = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/api/monitoring/infrastructure`, {
      headers: { 'x-api-key': API_KEY },
    });
    if (res.ok) return res.json();
    return null;
  }, []);

  const { data, initialLoading: loading, lastUpdated, refresh } = useLiveData(fetchData, 'infrastructure');

  const toggleSection = (s: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1d27' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12,
    padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  const sectionHeader = (id: string, icon: React.ReactNode, title: string, badge?: React.ReactNode) => (
    <div
      onClick={() => toggleSection(id)}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: expandedSections.has(id) ? '0.75rem' : 0 }}
    >
      {expandedSections.has(id) ? <ChevronDown size={16} color={theme.textSecondary} /> : <ChevronRight size={16} color={theme.textSecondary} />}
      <span style={{ color: theme.textSecondary, opacity: 0.7 }}>{icon}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text }}>{title}</span>
      {badge}
    </div>
  );

  const getRelativeTime = (d: Date) => {
    const diff = Math.round((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    return `${Math.floor(diff / 3600)}h`;
  };

  // Loading skeleton
  if (loading && !data) {
    const sk: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1a1d27' : '#e2e8f0'} 25%, ${darkMode ? '#2a2e3a' : '#f1f5f9'} 50%, ${darkMode ? '#1a1d27' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ ...sk, height: 28, width: 280, marginBottom: 8 }} />
        <div style={{ ...sk, height: 16, width: 400, marginBottom: 24 }} />
        <div style={{ ...sk, height: 60, marginBottom: 16, borderRadius: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: 16 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} style={{ ...sk, height: 80, borderRadius: 12 }} />)}
        </div>
        <div style={{ ...sk, height: 300, borderRadius: 12 }} />
      </div>
    );
  }

  if (!data) return <div style={{ color: theme.textSecondary, padding: '2rem', textAlign: 'center' }}>Erro ao carregar dados de infraestrutura.</div>;

  const { lambdas, api_gateway, alarms, sagemaker, dynamodb, schedules, disaster_recovery, overall_status, issues } = data;

  // Filter & sort lambdas
  let filteredLambdas: LambdaFn[] = lambdas?.functions || [];
  if (lambdaFilter !== 'all') filteredLambdas = filteredLambdas.filter((f: LambdaFn) => f.status === lambdaFilter);
  filteredLambdas = [...filteredLambdas].sort((a: LambdaFn, b: LambdaFn) => {
    if (lambdaSort === 'errors') return b.errors_24h - a.errors_24h;
    if (lambdaSort === 'invocations') return b.invocations_24h - a.invocations_24h;
    return a.name.localeCompare(b.name);
  });

  const activeSchedules = (schedules || []).filter((s: any) => s.state === 'ENABLED');
  const disabledSchedules = (schedules || []).filter((s: any) => s.state !== 'ENABLED');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>
            🏗️ Observabilidade da Infraestrutura
          </h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            Mapa completo de serviços, saúde, tráfego e alertas
            {lastUpdated && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.5rem', borderRadius: 10 }}>
                <Clock size={10} /> {getRelativeTime(lastUpdated)}
              </span>
            )}
          </p>
        </div>
        <button onClick={refresh} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 2px 8px rgba(37,99,235,0.25)', opacity: loading ? 0.7 : 1 }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Atualizar
        </button>
      </div>

      {/* Overall Status Banner */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.85rem 1rem',
        background: overall_status === 'healthy' ? (darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)') : overall_status === 'warning' ? (darkMode ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.03)') : (darkMode ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.03)'),
        borderColor: overall_status === 'healthy' ? 'rgba(16,185,129,0.2)' : overall_status === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      }}>
        {overall_status === 'healthy' ? <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} /> : overall_status === 'warning' ? <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} /> : <XCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />}
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: STATUS_COLORS[overall_status] || '#6b7280', marginBottom: 2 }}>
            {overall_status === 'healthy' ? 'Infraestrutura operando normalmente' : `${(issues || []).length} ponto(s) de atenção`}
          </div>
          {(issues || []).length > 0 && (
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>{issues.join(' · ')}</div>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Lambdas', value: `${lambdas?.healthy || 0}/${lambdas?.total || 0}`, sub: 'saudáveis', icon: <Zap size={16} />, color: lambdas?.critical > 0 ? '#ef4444' : '#10b981' },
          { label: 'API Requests', value: fmt(api_gateway?.count || 0), sub: '24h', icon: <Globe size={16} />, color: '#3b82f6' },
          { label: 'API 5xx', value: fmt(api_gateway?.['5xxerror'] || 0), sub: '24h', icon: <XCircle size={16} />, color: (api_gateway?.['5xxerror'] || 0) > 0 ? '#ef4444' : '#10b981' },
          { label: 'Alarmes', value: `${alarms?.alarm_count || 0}`, sub: `${alarms?.ok_count || 0} OK`, icon: <Bell size={16} />, color: (alarms?.alarm_count || 0) > 0 ? '#ef4444' : '#10b981' },
          { label: 'SageMaker', value: `${sagemaker?.active_endpoints || 0}`, sub: 'endpoints ativos', icon: <Cpu size={16} />, color: (sagemaker?.active_endpoints || 0) > 0 ? '#f59e0b' : '#10b981' },
          { label: 'DR Backup', value: disaster_recovery?.backup_age_hours != null ? `${fmt(disaster_recovery.backup_age_hours, 1)}h` : '—', sub: 'idade', icon: <Archive size={16} />, color: disaster_recovery?.status === 'healthy' ? '#10b981' : disaster_recovery?.status === 'warning' ? '#f59e0b' : '#ef4444' },
        ].map((kpi, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</span> {kpi.label}
            </div>
            <div style={{ fontSize: 'clamp(1rem, 3vw, 1.3rem)', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.68rem', color: theme.textSecondary }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Alarms Section */}
      <div style={{ ...cardStyle, marginBottom: '1rem' }}>
        {sectionHeader('alarms', <Bell size={16} />, 'Alarmes CloudWatch',
          (alarms?.alarm_count || 0) > 0 ? <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600 }}>{alarms.alarm_count} ativo(s)</span> : <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', borderRadius: 10, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600 }}>Tudo OK</span>
        )}
        {expandedSections.has('alarms') && (
          <div>
            {(alarms?.firing || []).length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0' }}>
                <CheckCircle size={14} /> Nenhum alarme disparado. {alarms?.ok_count || 0} alarmes em estado OK, {alarms?.insufficient_data_count || 0} sem dados.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {alarms.firing.map((a: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <XCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>{a.name}</div>
                      <div style={{ fontSize: '0.72rem', color: theme.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lambda Functions Section */}
      <div style={{ ...cardStyle, marginBottom: '1rem' }}>
        {sectionHeader('lambdas', <Zap size={16} />, `Lambda Functions (${lambdas?.total || 0})`,
          lambdas?.critical > 0 ? <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600 }}>{lambdas.critical} crítica(s)</span> : null
        )}
        {expandedSections.has('lambdas') && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {['all', 'healthy', 'warning', 'critical', 'idle'].map(f => (
                <button key={f} onClick={() => setLambdaFilter(f)} style={{
                  padding: '0.25rem 0.6rem', borderRadius: 6, border: `1px solid ${lambdaFilter === f ? '#3b82f6' : theme.border}`,
                  background: lambdaFilter === f ? 'rgba(59,130,246,0.1)' : 'transparent',
                  color: lambdaFilter === f ? '#3b82f6' : theme.textSecondary, fontSize: '0.72rem', cursor: 'pointer',
                }}>
                  {f === 'all' ? 'Todas' : f === 'healthy' ? '✅ Saudável' : f === 'warning' ? '⚠️ Atenção' : f === 'critical' ? '🔴 Crítica' : '💤 Ociosa'}
                </button>
              ))}
              <span style={{ fontSize: '0.68rem', color: theme.textSecondary, marginLeft: 'auto' }}>Ordenar:</span>
              {(['errors', 'invocations', 'name'] as const).map(s => (
                <button key={s} onClick={() => setLambdaSort(s)} style={{
                  padding: '0.2rem 0.5rem', borderRadius: 4, border: 'none',
                  background: lambdaSort === s ? 'rgba(59,130,246,0.1)' : 'transparent',
                  color: lambdaSort === s ? '#3b82f6' : theme.textSecondary, fontSize: '0.68rem', cursor: 'pointer',
                }}>
                  {s === 'errors' ? 'Erros' : s === 'invocations' ? 'Invocações' : 'Nome'}
                </button>
              ))}
            </div>
            {/* Lambda table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500 }}>Função</th>
                    <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500 }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500 }}>Invocações</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500 }}>Erros</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500 }}>Taxa Erro</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500 }}>Duração Média</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500 }}>Duração Máx</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLambdas.map((fn: LambdaFn, i: number) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${darkMode ? '#1f2230' : '#f1f5f9'}` }}>
                      <td style={{ padding: '0.45rem 0.5rem', color: theme.text, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{fn.name}</span>
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: `${STATUS_COLORS[fn.status]}15`, color: STATUS_COLORS[fn.status] }}>
                          <StatusDot status={fn.status} size={6} /> {fn.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: theme.text }}>{fmt(fn.invocations_24h)}</td>
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: fn.errors_24h > 0 ? '#ef4444' : theme.textSecondary, fontWeight: fn.errors_24h > 0 ? 600 : 400 }}>{fmt(fn.errors_24h)}</td>
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: fn.error_rate > 0.1 ? '#ef4444' : fn.error_rate > 0 ? '#f59e0b' : theme.textSecondary }}>{(fn.error_rate * 100).toFixed(1)}%</td>
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: theme.textSecondary }}>{fn.avg_duration_ms > 0 ? `${fmt(fn.avg_duration_ms, 0)}ms` : '—'}</td>
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: fn.max_duration_ms > 600000 ? '#f59e0b' : theme.textSecondary }}>{fn.max_duration_ms > 0 ? `${fmt(fn.max_duration_ms, 0)}ms` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* API Gateway + DynamoDB + DR row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        {/* API Gateway */}
        <div style={cardStyle}>
          {sectionHeader('apigw', <Globe size={16} />, 'API Gateway')}
          {expandedSections.has('apigw') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { label: 'Requests (24h)', value: fmt(api_gateway?.count || 0), color: '#3b82f6' },
                { label: 'Latência média', value: `${fmt(api_gateway?.latency || 0, 0)}ms`, color: (api_gateway?.latency || 0) > 1000 ? '#f59e0b' : '#10b981' },
                { label: 'Erros 4xx', value: fmt(api_gateway?.['4xxerror'] || 0), color: (api_gateway?.['4xxerror'] || 0) > 50 ? '#f59e0b' : theme.textSecondary },
                { label: 'Erros 5xx', value: fmt(api_gateway?.['5xxerror'] || 0), color: (api_gateway?.['5xxerror'] || 0) > 0 ? '#ef4444' : '#10b981' },
              ].map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: theme.textSecondary }}>{m.label}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DynamoDB */}
        <div style={cardStyle}>
          {sectionHeader('dynamo', <Database size={16} />, `DynamoDB (${(dynamodb || []).length} tabelas)`)}
          {expandedSections.has('dynamo') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {(dynamodb || []).map((t: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: i < dynamodb.length - 1 ? `1px solid ${darkMode ? '#1f2230' : '#f1f5f9'}` : 'none' }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', color: theme.text, fontFamily: 'monospace' }}>{t.name.replace('B3Dashboard-', '')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{fmt(t.items)} itens</span>
                    <StatusDot status={t.status === 'ACTIVE' ? 'healthy' : 'critical'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disaster Recovery */}
        <div style={cardStyle}>
          {sectionHeader('dr', <Shield size={16} />, 'Disaster Recovery')}
          {expandedSections.has('dr') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', color: theme.textSecondary }}>Status</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 600, color: STATUS_COLORS[disaster_recovery?.status] || '#6b7280' }}>
                  <StatusDot status={disaster_recovery?.status || 'unknown'} /> {disaster_recovery?.status || 'desconhecido'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', color: theme.textSecondary }}>Último backup</span>
                <span style={{ fontSize: '0.82rem', color: theme.text }}>{disaster_recovery?.last_backup ? new Date(disaster_recovery.last_backup).toLocaleString('pt-BR') : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', color: theme.textSecondary }}>Idade do backup</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: STATUS_COLORS[disaster_recovery?.status] || '#6b7280' }}>{disaster_recovery?.backup_age_hours != null ? `${fmt(disaster_recovery.backup_age_hours, 1)}h` : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', color: theme.textSecondary }}>RPO / RTO</span>
                <span style={{ fontSize: '0.82rem', color: theme.text }}>24h / 4h</span>
              </div>
              {disaster_recovery?.status !== 'healthy' && (
                <div style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem', borderRadius: 6, background: 'rgba(245,158,11,0.08)', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <AlertTriangle size={12} /> Backup pode estar atrasado. Verifique a Lambda B3Dashboard-BackupConfiguration.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* EventBridge Schedules */}
      <div style={{ ...cardStyle, marginBottom: '1rem' }}>
        {sectionHeader('schedules', <Radio size={16} />, `EventBridge Schedules (${activeSchedules.length} ativas)`,
          disabledSchedules.length > 0 ? <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', borderRadius: 10, background: 'rgba(107,114,128,0.1)', color: '#6b7280', fontWeight: 500 }}>{disabledSchedules.length} desabilitada(s)</span> : null
        )}
        {expandedSections.has('schedules') && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500 }}>Regra</th>
                  <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500 }}>Estado</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500 }}>Schedule</th>
                </tr>
              </thead>
              <tbody>
                {[...activeSchedules, ...disabledSchedules].map((s: any, i: number) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${darkMode ? '#1f2230' : '#f1f5f9'}`, opacity: s.state !== 'ENABLED' ? 0.5 : 1 }}>
                    <td style={{ padding: '0.4rem 0.5rem', color: theme.text, fontFamily: 'monospace', fontSize: '0.73rem' }}>{s.name}</td>
                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                      <StatusDot status={s.state === 'ENABLED' ? 'healthy' : 'idle'} />
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', color: theme.textSecondary, fontFamily: 'monospace', fontSize: '0.7rem' }}>{s.schedule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SageMaker */}
      {(sagemaker?.active_training > 0 || sagemaker?.active_endpoints > 0) && (
        <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: 'rgba(245,158,11,0.3)', background: darkMode ? 'rgba(245,158,11,0.04)' : 'rgba(245,158,11,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Cpu size={16} color="#f59e0b" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text }}>SageMaker — Recursos Ativos</span>
            <InfoTooltip text="Recursos SageMaker ativos geram custo contínuo. Endpoints devem ser desligados quando não estiverem em uso." darkMode={darkMode} size={12} />
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem' }}>
            {sagemaker.active_training > 0 && <span style={{ color: '#f59e0b' }}>🏋️ {sagemaker.active_training} training job(s)</span>}
            {sagemaker.active_endpoints > 0 && <span style={{ color: '#ef4444' }}>🔴 {sagemaker.active_endpoints} endpoint(s) — custo contínuo</span>}
          </div>
        </div>
      )}

      {/* Architecture Map */}
      <div style={{ ...cardStyle }}>
        {sectionHeader('arch', <Eye size={16} />, 'Mapa da Arquitetura')}
        {expandedSections.has('arch') && (
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.8, fontFamily: 'monospace' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '1rem' }}>
              {[
                { title: '📡 Ingestão', items: ['EventBridge → Quotes5mIngest (5min)', 'EventBridge → IngestFeatures (diário)', 'EventBridge → BootstrapHistory (diário)', 'EventBridge → SentimentAnalysis (diário)'] },
                { title: '🧠 DL Pipeline', items: ['PrepareTrainingData → S3', 'WeeklyRetrain → Hybrid (TabPFN + Transformer+BiLSTM)', 'RankSageMaker → S3 recommendations/', 'GenerateEnsembleInsights', 'GenerateFeatureImportance', 'GeneratePredictionIntervals'] },
                { title: '📊 Monitoramento', items: ['MonitorIngestion (5min pregão)', 'MonitorModelQuality (diário)', 'MonitorModelPerformance (diário)', 'MonitorCosts (diário)', 'MonitorDrift (diário)', 'MonitorSageMaker (domingos)'] },
                { title: '🌐 API & Frontend', items: ['CloudFront → API Gateway', 'API GW → DashboardAPI Lambda', 'API GW → UserAuth Lambda', 'API GW → AgentHub Lambda', 'API GW → S3Proxy Lambda', 'GitHub Pages (qyntara.tech)'] },
                { title: '💾 Storage', items: [`S3 bucket (quotes, recs, monitoring)`, `DynamoDB (${(dynamodb || []).length} tabelas)`, 'Secrets Manager (BRAPI token)', 'SSM Parameter Store (config)'] },
                { title: '🛡️ Segurança & DR', items: ['WAF (rate limit + rules)', 'KMS encryption', 'Backup diário 02:00 UTC', 'DR Health Check (12h)', 'CloudWatch Alarms → SNS'] },
              ].map((section, i) => (
                <div key={i}>
                  <div style={{ fontWeight: 600, color: theme.text, marginBottom: '0.3rem', fontFamily: 'inherit', fontSize: '0.8rem' }}>{section.title}</div>
                  {section.items.map((item, j) => (
                    <div key={j} style={{ paddingLeft: '0.5rem', borderLeft: `2px solid ${theme.border}`, marginBottom: '0.15rem', paddingTop: '0.1rem', paddingBottom: '0.1rem' }}>{item}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminInfraPage;
