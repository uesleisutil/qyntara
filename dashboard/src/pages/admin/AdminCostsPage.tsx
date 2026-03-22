import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { DollarSign, TrendingDown, TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const fmt = (v: any, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : null;

const AdminCostsPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/monitoring/costs`, { headers: { 'x-api-key': API_KEY } });
      if (res.ok) setData(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCosts(); }, []);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1.25rem',
  };

  const latest = data?.latest || {};
  const threshold = latest.threshold || {};
  const projection = latest.monthly_projection || {};
  const total7d = latest.total_7_days || {};
  const byService = latest.costs_by_service || {};
  const byComponent = latest.costs_by_component || {};
  const anomalies = latest.anomalies || [];

  const kpis = [
    { label: 'Projeção Mensal (BRL)', value: fmt(projection.brl) ? `R$ ${fmt(projection.brl)}` : '—', color: '#f59e0b', icon: <DollarSign size={18} /> },
    { label: 'Custo 7 dias (USD)', value: fmt(total7d.usd) ? `$${fmt(total7d.usd)}` : '—', color: '#3b82f6', icon: <TrendingDown size={18} /> },
    { label: 'Orçamento Usado', value: fmt(threshold.percentage, 1) ? `${fmt(threshold.percentage, 1)}%` : '—', color: threshold.exceeded ? '#ef4444' : threshold.warning ? '#f59e0b' : '#10b981', icon: threshold.exceeded ? <TrendingUp size={18} /> : <TrendingDown size={18} /> },
    { label: 'Anomalias', value: `${anomalies.length}`, color: anomalies.length > 0 ? '#ef4444' : '#10b981', icon: <AlertTriangle size={18} /> },
  ];

  // Sort services by cost descending
  const sortedServices = Object.entries(byService).sort(([, a]: any, [, b]: any) => b - a).filter(([, v]: any) => v > 0);
  const maxServiceCost = sortedServices.length > 0 ? (sortedServices[0][1] as number) : 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Custos AWS</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>
            Monitoramento de custos, otimização e ROI.
            {latest.date && <span> Última atualização: {latest.date}</span>}
          </p>
        </div>
        <button onClick={fetchCosts} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: theme.textSecondary }}>Carregando dados de custos...</div>
      ) : !data ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem', color: theme.textSecondary }}>Sem dados de custos disponíveis.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {kpis.map((kpi, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ color: kpi.color }}>{kpi.icon}</div>
                  <span style={{ fontSize: '0.8rem', color: theme.textSecondary }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Budget bar */}
          {threshold.limit_brl && (
            <div style={{ ...cardStyle, marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: theme.textSecondary }}>Orçamento Mensal</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: threshold.exceeded ? '#ef4444' : '#10b981' }}>
                  R$ {fmt(projection.brl)} / R$ {fmt(threshold.limit_brl, 0)}
                </span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: darkMode ? '#334155' : '#e2e8f0' }}>
                <div style={{ height: '100%', borderRadius: 5, background: threshold.exceeded ? '#ef4444' : threshold.warning ? '#f59e0b' : '#10b981', width: `${Math.min(threshold.percentage || 0, 100)}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            {/* By Service */}
            {sortedServices.length > 0 && (
              <div style={cardStyle}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem' }}>Custo por Serviço (7 dias)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {sortedServices.map(([service, cost]: any) => (
                    <div key={service}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem', color: theme.text, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{service}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f59e0b' }}>${fmt(cost)}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: darkMode ? '#334155' : '#e2e8f0' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #2563eb, #3b82f6)', width: `${(cost / maxServiceCost) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Component */}
            {Object.keys(byComponent).length > 0 && (
              <div style={cardStyle}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem' }}>Custo por Componente</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Object.entries(byComponent).sort(([, a]: any, [, b]: any) => b - a).map(([comp, cost]: any) => (
                    <div key={comp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0' }}>
                      <span style={{ fontSize: '0.85rem', color: theme.text, textTransform: 'capitalize' }}>{comp}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: cost > 0 ? '#f59e0b' : theme.textSecondary }}>${fmt(cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Anomalies */}
          {anomalies.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem' }}>Anomalias de Custo</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {anomalies.map((a: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: 6, background: a.severity === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${a.severity === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', color: theme.text }}>{a.service}</span>
                      <span style={{ fontSize: '0.75rem', color: theme.textSecondary, marginLeft: '0.5rem' }}>${fmt(a.current_cost_usd)} (avg: ${fmt(a.average_cost_usd)})</span>
                    </div>
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

export default AdminCostsPage;
