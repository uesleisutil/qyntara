import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const fmt = (v: any, d = 1) => v != null && !isNaN(v) ? Number(v).toFixed(d) : null;

const AdminPerformancePage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/monitoring/model-performance`, { headers: { 'x-api-key': API_KEY } });
      if (res.ok) setData(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPerformance(); }, []);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1.25rem',
  };

  const latest = data?.latest || {};
  const summary = data?.summary || {};
  const timeSeries = data?.time_series || {};

  const metrics = [
    { label: 'Acurácia Direcional', value: fmt((latest.directional_accuracy ?? summary.avg_directional_accuracy ?? 0) * 100), suffix: '%', color: '#10b981' },
    { label: 'MAPE', value: fmt(latest.mape ?? summary.avg_mape), suffix: '%', color: '#3b82f6' },
    { label: 'Sharpe Ratio', value: fmt(latest.sharpe_ratio ?? summary.avg_sharpe_ratio, 2), suffix: '', color: '#8b5cf6' },
    { label: 'MAE', value: fmt((latest.mae ?? summary.avg_mae ?? 0) * 100, 3), suffix: '%', color: '#ef4444' },
    { label: 'Hit Rate', value: fmt((latest.hit_rate ?? summary.avg_hit_rate ?? 0) * 100), suffix: '%', color: '#f59e0b' },
    { label: 'Amostra', value: latest.sample_size?.toString() || '—', suffix: ' tickers', color: '#06b6d4' },
  ];

  const mapeHistory = timeSeries.mape || [];
  const accHistory = timeSeries.directional_accuracy || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Performance do Modelo</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem' }}>
            Métricas de acurácia, risco e retorno.
            {data?.period && <span> {data.period.start_date} a {data.period.end_date}</span>}
          </p>
        </div>
        <button onClick={fetchPerformance} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, flexShrink: 0 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: theme.textSecondary }}>Carregando métricas de performance...</div>
      ) : !data ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem', color: theme.textSecondary }}>Sem dados de performance disponíveis. Execute o monitor de performance para gerar métricas.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {metrics.map((m, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.8rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>{m.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: m.color }}>{m.value != null ? `${m.value}${m.suffix}` : '—'}</div>
              </div>
            ))}
          </div>

          {/* MAPE History */}
          {mapeHistory.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem' }}>Histórico MAPE (últimos {mapeHistory.length} dias)</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
                {mapeHistory.map((d: any, i: number) => {
                  const maxMape = Math.max(...mapeHistory.map((x: any) => x.mape || 0), 1);
                  const h = ((d.mape || 0) / maxMape) * 100;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${d.date}: ${fmt(d.mape)}%`}>
                      <div style={{ width: '100%', height: `${h}%`, minHeight: 2, borderRadius: '3px 3px 0 0', background: (d.mape || 0) > 2 ? '#ef4444' : (d.mape || 0) > 1 ? '#f59e0b' : '#3b82f6', transition: 'height 0.3s' }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>{mapeHistory[0]?.date}</span>
                <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>{mapeHistory[mapeHistory.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* Accuracy History */}
          {accHistory.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem' }}>Acurácia Direcional (últimos {accHistory.length} dias)</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
                {accHistory.map((d: any, i: number) => {
                  const h = ((d.accuracy || 0) * 100);
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${d.date}: ${fmt((d.accuracy || 0) * 100)}%`}>
                      <div style={{ width: '100%', height: `${h}%`, minHeight: 2, borderRadius: '3px 3px 0 0', background: (d.accuracy || 0) >= 0.7 ? '#10b981' : (d.accuracy || 0) >= 0.5 ? '#f59e0b' : '#ef4444', transition: 'height 0.3s' }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>{accHistory[0]?.date}</span>
                <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>{accHistory[accHistory.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPerformancePage;
