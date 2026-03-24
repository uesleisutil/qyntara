import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TrendingUp, DollarSign, AlertTriangle, CheckCircle, Activity, Server, Database, RefreshCw, Shield, Clock, XCircle, Loader2 } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../../components/shared/ui/InfoTooltip';
import { getCurrentMonthPriceKey } from '../../constants';
import { fmt } from '../../lib/formatters';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }
interface HealthStatus { name: string; desc: string; status: 'ok' | 'error' | 'loading'; latency?: number; }

const AdminOverviewPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [perf, setPerf] = useState<any>(null);
  const [costs, setCosts] = useState<any>(null);
  const [quality, setQuality] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [healthChecks, setHealthChecks] = useState<HealthStatus[]>([
    { name: 'API Gateway', desc: 'REST endpoints', status: 'loading' },
    { name: 'Lambda Auth', desc: 'Autenticação', status: 'loading' },
    { name: 'S3 Proxy', desc: 'Dados curados', status: 'loading' },
    { name: 'DynamoDB', desc: 'Users + Notifications', status: 'loading' },
    { name: 'Recomendações', desc: 'ML pipeline', status: 'loading' },
  ]);

  const runHealthChecks = async () => {
    const headers = { 'x-api-key': API_KEY };
    const token = localStorage.getItem('authToken');
    const checks: { name: string; desc: string; fn: () => Promise<Response> }[] = [
      { name: 'API Gateway', desc: 'REST endpoints', fn: () => fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers }) },
      { name: 'Lambda Auth', desc: 'Autenticação', fn: () => fetch(`${API_BASE_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } }) },
      { name: 'S3 Proxy', desc: 'Dados curados', fn: () => fetch(`${API_BASE_URL}/s3-proxy?key=${getCurrentMonthPriceKey()}`, { headers }) },
      { name: 'DynamoDB', desc: 'Users + Notifications', fn: () => fetch(`${API_BASE_URL}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } }) },
      { name: 'Recomendações', desc: 'ML pipeline', fn: () => fetch(`${API_BASE_URL}/api/recommendations/history`, { headers }) },
    ];
    const results: HealthStatus[] = [];
    for (const check of checks) {
      const start = performance.now();
      try {
        const res = await check.fn();
        const latency = Math.round(performance.now() - start);
        results.push({ name: check.name, desc: check.desc, status: res.ok ? 'ok' : 'error', latency });
      } catch {
        results.push({ name: check.name, desc: check.desc, status: 'error', latency: 0 });
      }
    }
    setHealthChecks(results);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const headers = { 'x-api-key': API_KEY };
      const [perfRes, costRes, qualRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/monitoring/model-performance`, { headers }),
        fetch(`${API_BASE_URL}/api/monitoring/costs`, { headers }),
        fetch(`${API_BASE_URL}/api/monitoring/data-quality`, { headers }),
      ]);
      if (perfRes.status === 'fulfilled' && perfRes.value.ok) setPerf(await perfRes.value.json());
      if (costRes.status === 'fulfilled' && costRes.value.ok) setCosts(await costRes.value.json());
      if (qualRes.status === 'fulfilled' && qualRes.value.ok) setQuality(await qualRes.value.json());
      setLastUpdated(new Date());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); runHealthChecks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1d27' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12,
    padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  const getRelativeTime = (d: Date) => {
    const diff = Math.round((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'agora mesmo';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    return `há ${Math.floor(diff / 3600)}h`;
  };

  if (loading) {
    const sk: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1a1d27' : '#e2e8f0'} 25%, ${darkMode ? '#2a2e3a' : '#f1f5f9'} 50%, ${darkMode ? '#1a1d27' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ ...sk, height: 28, width: 220, marginBottom: 8 }} />
          <div style={{ ...sk, height: 16, width: 320 }} />
        </div>
        <div style={{ ...sk, height: 52, marginBottom: '1rem', borderRadius: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} style={{ ...cardStyle, padding: '1rem' }}>
              <div style={{ ...sk, height: 14, width: 80, marginBottom: 8 }} />
              <div style={{ ...sk, height: 28, width: 60 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '1rem' }}>
          <div style={{ ...sk, height: 180, borderRadius: 12 }} />
          <div style={{ ...sk, height: 180, borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  const latest = perf?.latest || {};
  const summary = perf?.summary || {};
  const costLatest = costs?.latest || {};
  const threshold = costLatest.threshold || {};
  const anomalies = costs?.anomalies || costLatest.anomalies || [];
  const completeness = quality?.completeness || {};
  const freshness = quality?.freshness || {};

  const dirAcc = latest.directional_accuracy ?? summary.avg_directional_accuracy;
  const mape = latest.mape ?? summary.avg_mape;
  const sharpe = latest.sharpe_ratio ?? summary.avg_sharpe_ratio;
  const projBrl = costLatest.monthly_projection?.brl;
  const cost7d = costLatest.total_7_days?.usd;
  const overallCompleteness = completeness.overallCompleteness;
  const freshnessRate = freshness.currentSourcesPercentage;

  const issues: string[] = [];
  if (dirAcc != null && dirAcc < 0.5) issues.push('Acurácia direcional abaixo de 50%');
  if (mape != null && mape > 3) issues.push('MAPE acima de 3%');
  if (threshold.exceeded) issues.push('Orçamento mensal excedido');
  if (anomalies.length > 2) issues.push(`${anomalies.length} anomalias de custo`);
  if (overallCompleteness != null && overallCompleteness < 0.9) issues.push('Completude abaixo de 90%');
  const verdictOk = issues.length === 0;

  const kpis = [
    { label: 'Acurácia Direcional', value: dirAcc != null ? `${fmt(dirAcc * 100)}%` : '—', color: dirAcc != null && dirAcc >= 0.6 ? '#10b981' : '#f59e0b', icon: <TrendingUp size={16} />, tip: 'Percentual de previsões que acertaram a direção (alta/baixa) do preço.' },
    { label: 'MAPE', value: mape != null ? `${fmt(mape)}%` : '—', color: mape != null && mape <= 1 ? '#10b981' : mape != null && mape <= 2 ? '#f59e0b' : '#ef4444', icon: <Activity size={16} />, tip: 'Erro percentual absoluto médio. Quanto menor, mais preciso.' },
    { label: 'Sharpe Ratio', value: sharpe != null ? `${fmt(sharpe, 2)}` : '—', color: sharpe != null && sharpe >= 0 ? '#10b981' : '#ef4444', icon: <TrendingUp size={16} />, tip: 'Razão retorno/risco. Positivo = retorno acima do CDI ajustado ao risco.' },
    { label: 'Projeção Mensal', value: projBrl != null ? `R$ ${fmt(projBrl, 2)}` : '—', color: '#f59e0b', icon: <DollarSign size={16} />, tip: 'Projeção de custo AWS para o mês atual em reais.' },
    { label: 'Custo 7d (USD)', value: cost7d != null ? `$${fmt(cost7d, 2)}` : '—', color: '#3b82f6', icon: <Server size={16} />, tip: 'Custo total dos últimos 7 dias em dólares.' },
    { label: 'Completude', value: overallCompleteness != null ? `${fmt(overallCompleteness * 100)}%` : '—', color: overallCompleteness != null && overallCompleteness >= 0.95 ? '#10b981' : '#f59e0b', icon: <Database size={16} />, tip: 'Percentual médio de dados presentes vs esperados.' },
    { label: 'Freshness', value: freshnessRate != null ? `${fmt(freshnessRate * 100)}%` : '—', color: freshnessRate != null && freshnessRate >= 0.9 ? '#10b981' : '#f59e0b', icon: <Clock size={16} />, tip: 'Percentual de fontes de dados atualizadas no prazo.' },
    { label: 'Anomalias Custo', value: `${anomalies.length}`, color: anomalies.length > 0 ? '#ef4444' : '#10b981', icon: <AlertTriangle size={16} />, tip: 'Picos inesperados de custo em serviços AWS.' },
  ];

  const recentAnomalies = anomalies.slice(-5);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>🔒 Painel Administrativo</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            Visão geral de performance, custos e saúde do sistema
            {lastUpdated && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.5rem', borderRadius: 10 }}>
                <Clock size={10} /> {getRelativeTime(lastUpdated)}
              </span>
            )}
          </p>
        </div>
        <button onClick={() => { fetchAll(); runHealthChecks(); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 2px 8px rgba(37,99,235,0.25)', WebkitAppearance: 'none' as any }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Verdict Card */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.85rem 1rem',
        background: verdictOk ? (darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)') : (darkMode ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.03)'),
        borderColor: verdictOk ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      }}>
        {verdictOk ? <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} /> : <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />}
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: verdictOk ? '#10b981' : '#ef4444', marginBottom: 2 }}>
            {verdictOk ? 'Sistema operando normalmente' : `${issues.length} ponto${issues.length > 1 ? 's' : ''} de atenção`}
          </div>
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
            {verdictOk ? 'Todos os indicadores dentro dos limites esperados.' : issues.join(' · ')}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
        borderColor: darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
          💡 <strong style={{ color: theme.text }}>Visão geral:</strong> Este painel consolida métricas de performance do modelo (acurácia, MAPE, Sharpe), custos AWS (projeção mensal, anomalias) e qualidade de dados (completude, freshness). Use as abas específicas para análises detalhadas.
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {kpis.map((kpi, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={12} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</span>
              <span style={{ fontSize: 'clamp(1rem, 3vw, 1.35rem)', fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Budget + Infrastructure */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {threshold.limit_brl && (
          <div style={cardStyle}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={16} color="#f59e0b" /> Orçamento Mensal
              <InfoTooltip text="Barra de progresso do orçamento. Verde = OK, Amarelo = atenção, Vermelho = excedido." darkMode={darkMode} size={12} />
            </h3>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.82rem', color: theme.textSecondary }}>Projeção</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: threshold.exceeded ? '#ef4444' : threshold.warning ? '#f59e0b' : '#10b981' }}>{fmt(threshold.percentage, 1)}%</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: darkMode ? '#2a2e3a' : '#e2e8f0' }}>
                <div style={{ height: '100%', borderRadius: 5, background: threshold.exceeded ? '#ef4444' : threshold.warning ? '#f59e0b' : '#10b981', width: `${Math.min(threshold.percentage || 0, 100)}%`, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>R$ 0</span>
                <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>R$ {fmt(threshold.limit_brl, 0)}</span>
              </div>
            </div>
            {threshold.alert_level && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', borderRadius: 6, background: threshold.alert_level === 'critical' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', fontSize: '0.78rem', color: threshold.alert_level === 'critical' ? '#ef4444' : '#f59e0b' }}>
                <AlertTriangle size={14} /> Alerta: {threshold.alert_level}
              </div>
            )}
          </div>
        )}

        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={16} color="#3b82f6" /> Infraestrutura (Health Check)
            <InfoTooltip text="Status real dos serviços AWS verificado via chamadas HTTP. Latência em ms." darkMode={darkMode} size={12} />
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {healthChecks.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.82rem', color: theme.text }}>{item.name}</span>
                  <span style={{ fontSize: '0.68rem', color: theme.textSecondary, marginLeft: '0.4rem' }}>{item.desc}</span>
                </div>
                {item.status === 'loading' ? (
                  <span style={{ fontSize: '0.75rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Loader2 size={12} className="spin" /> Verificando</span>
                ) : item.status === 'ok' ? (
                  <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle size={12} /> OK {item.latency != null && <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>{item.latency}ms</span>}</span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><XCircle size={12} /> Erro</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost Anomalies */}
      {recentAnomalies.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} color="#f59e0b" /> Anomalias de Custo
            <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: 10, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 600 }}>{anomalies.length}</span>
            <InfoTooltip text="Serviços AWS com custos acima da média histórica." darkMode={darkMode} size={12} />
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentAnomalies.map((a: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: 8, background: a.severity === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${a.severity === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`, flexWrap: 'wrap', gap: '0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {a.severity === 'critical' ? <XCircle size={14} color="#ef4444" /> : <AlertTriangle size={14} color="#f59e0b" />}
                  <span style={{ fontSize: '0.82rem', color: theme.text }}>{a.service}</span>
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: a.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>+{fmt(a.change_percentage, 0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOverviewPage;
