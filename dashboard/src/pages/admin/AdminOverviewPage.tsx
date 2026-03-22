import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TrendingUp, DollarSign, AlertTriangle, CheckCircle, Activity, Server, Database, RefreshCw } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const fmt = (v: any, decimals = 1) => v != null && !isNaN(v) ? Number(v).toFixed(decimals) : null;

const AdminOverviewPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [perf, setPerf] = useState<any>(null);
  const [costs, setCosts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const headers = { 'x-api-key': API_KEY };
      const [perfRes, costRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/monitoring/model-performance`, { headers }),
        fetch(`${API_BASE_URL}/api/monitoring/costs`, { headers }),
      ]);
      if (perfRes.status === 'fulfilled' && perfRes.value.ok) setPerf(await perfRes.value.json());
      if (costRes.status === 'fulfilled' && costRes.value.ok) setCosts(await costRes.value.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const latest = perf?.latest || {};
  const summary = perf?.summary || {};
  const costLatest = costs?.latest || {};
  const costSummary = costs?.summary || {};

  const kpis = [
    { label: 'Acurácia Direcional', value: fmt(latest.directional_accuracy != null ? latest.directional_accuracy * 100 : summary.avg_directional_accuracy != null ? summary.avg_directional_accuracy * 100 : null) ? `${fmt((latest.directional_accuracy ?? summary.avg_directional_accuracy ?? 0) * 100)}%` : '—', icon: <TrendingUp size={18} />, color: '#10b981' },
    { label: 'MAPE', value: fmt(latest.mape ?? summary.avg_mape) ? `${fmt(latest.mape ?? summary.avg_mape)}%` : '—', icon: <Activity size={18} />, color: '#3b82f6' },
    { label: 'Projeção Mensal', value: costLatest.monthly_projection?.brl != null ? `R$ ${fmt(costLatest.monthly_projection.brl, 2)}` : costSummary.avg_monthly_projection_brl != null ? `R$ ${fmt(costSummary.avg_monthly_projection_brl, 2)}` : '—', icon: <DollarSign size={18} />, color: '#f59e0b' },
    { label: 'Custo 7 dias (USD)', value: costLatest.total_7_days?.usd != null ? `$${fmt(costLatest.total_7_days.usd, 2)}` : '—', icon: <Server size={18} />, color: '#8b5cf6' },
    { label: 'Sharpe Ratio', value: fmt(latest.sharpe_ratio ?? summary.avg_sharpe_ratio, 2) ?? '—', icon: <TrendingUp size={18} />, color: '#06b6d4' },
    { label: 'Status', value: 'Operacional', icon: <CheckCircle size={18} />, color: '#10b981' },
  ];

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1.25rem',
  };

  const threshold = costLatest.threshold || {};
  const anomalies = costs?.anomalies || costLatest.anomalies || [];
  const recentAnomalies = anomalies.slice(-5);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>🔒 Painel Administrativo</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>Visão geral de custos, performance do modelo e saúde do sistema.</p>
        </div>
        <button onClick={fetchAll} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: theme.textSecondary }}>Carregando dados administrativos...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {kpis.map((kpi, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${kpi.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>{kpi.icon}</div>
                  <span style={{ fontSize: '0.8rem', color: theme.textSecondary }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: theme.text }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Budget + Infra */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* Budget */}
            {threshold.limit_brl && (
              <div style={cardStyle}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <DollarSign size={16} color="#f59e0b" /> Orçamento Mensal
                </h3>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.85rem', color: theme.textSecondary }}>Projeção</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: threshold.exceeded ? '#ef4444' : threshold.warning ? '#f59e0b' : '#10b981' }}>
                      {fmt(threshold.percentage, 1)}%
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: darkMode ? '#334155' : '#e2e8f0' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: threshold.exceeded ? '#ef4444' : threshold.warning ? '#f59e0b' : '#10b981', width: `${Math.min(threshold.percentage || 0, 100)}%`, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                    <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>R$ 0</span>
                    <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>R$ {fmt(threshold.limit_brl, 0)}</span>
                  </div>
                </div>
                {threshold.alert_level && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', borderRadius: 6, background: threshold.alert_level === 'critical' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', fontSize: '0.8rem', color: threshold.alert_level === 'critical' ? '#ef4444' : '#f59e0b' }}>
                    <AlertTriangle size={14} /> Alerta: {threshold.alert_level}
                  </div>
                )}
              </div>
            )}

            <div style={cardStyle}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={16} color="#3b82f6" /> Infraestrutura
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {['Lambda Functions', 'API Gateway', 'S3 Buckets', 'DynamoDB', 'SES Email'].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: theme.textSecondary }}>{item}</span>
                    <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle size={12} /> Ativo</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Anomalias de custo */}
          {recentAnomalies.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} color="#f59e0b" /> Anomalias de Custo ({anomalies.length} total)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recentAnomalies.map((a: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: 6, background: a.severity === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${a.severity === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                    <span style={{ fontSize: '0.85rem', color: theme.text }}>{a.service}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: a.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>+{fmt(a.change_percentage, 0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminOverviewPage;
