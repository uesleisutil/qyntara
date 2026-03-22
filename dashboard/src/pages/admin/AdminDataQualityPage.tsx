import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const fmt = (v: any, d = 1) => v != null && !isNaN(v) ? Number(v).toFixed(d) : null;

const AdminDataQualityPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuality = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/monitoring/data-quality`, { headers: { 'x-api-key': API_KEY } });
      if (res.ok) setData(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchQuality(); }, []);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1.25rem',
  };

  const getStatusIcon = (value: number) => {
    if (value >= 0.95) return <CheckCircle size={16} color="#10b981" />;
    if (value >= 0.8) return <AlertTriangle size={16} color="#f59e0b" />;
    return <XCircle size={16} color="#ef4444" />;
  };

  // API returns: { completeness: { overallCompleteness, tickers[], dateRange }, freshness: {...}, coverage: {...}, anomalies: [...] }
  const completeness = data?.completeness || {};
  const freshness = data?.freshness || {};
  const coverage = data?.coverage || {};
  const anomalies = data?.anomalies || [];

  const overallCompleteness = completeness.overallCompleteness;
  const tickers = completeness.tickers || [];
  const lowCompleteness = tickers.filter((t: any) => t.completenessRate < 0.95);

  // Freshness: try to extract overall freshness rate
  const freshnessRate = freshness.overallFreshness ?? freshness.freshRate ?? (freshness.sources ? freshness.sources.filter((s: any) => s.status === 'fresh').length / Math.max(freshness.sources.length, 1) : null);

  // Coverage
  const coverageRate = coverage.coverageRate ?? coverage.overallCoverage ?? (coverage.covered && coverage.universe ? coverage.covered / coverage.universe : null);

  const kpis = [
    { label: 'Completude Geral', value: overallCompleteness, color: '#10b981' },
    { label: 'Freshness', value: freshnessRate, color: '#3b82f6' },
    { label: 'Cobertura', value: coverageRate, color: '#8b5cf6' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Qualidade de Dados</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>
            Completude, anomalias, freshness e cobertura do universo.
            {completeness.dateRange && <span> Período: {completeness.dateRange.start} a {completeness.dateRange.end}</span>}
          </p>
        </div>
        <button onClick={fetchQuality} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: theme.textSecondary }}>Carregando dados de qualidade...</div>
      ) : !data ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem', color: theme.textSecondary }}>Sem dados de qualidade disponíveis.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {kpis.map((m, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: theme.textSecondary }}>{m.label}</span>
                  {m.value != null && getStatusIcon(m.value)}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: m.color }}>
                  {m.value != null ? `${fmt(m.value * 100)}%` : '—'}
                </div>
                {m.value != null && (
                  <div style={{ marginTop: '0.5rem', height: 6, borderRadius: 3, background: darkMode ? '#334155' : '#e2e8f0' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: m.color, width: `${m.value * 100}%`, transition: 'width 0.3s' }} />
                  </div>
                )}
              </div>
            ))}
            {/* Anomalies count */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: theme.textSecondary }}>Anomalias</span>
                {anomalies.length > 0 ? <AlertTriangle size={16} color="#ef4444" /> : <CheckCircle size={16} color="#10b981" />}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: anomalies.length > 0 ? '#ef4444' : '#10b981' }}>
                {anomalies.length}
              </div>
            </div>
          </div>

          {/* Tickers with low completeness */}
          {lowCompleteness.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem' }}>
                Tickers com Completude {'<'} 95% ({lowCompleteness.length})
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                      {['Ticker', 'Completude', 'Esperado', 'Presente'].map(h => (
                        <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: theme.textSecondary }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lowCompleteness.slice(0, 20).map((t: any) => (
                      <tr key={t.ticker} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500, color: theme.text }}>{t.ticker}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: t.completenessRate < 0.5 ? '#ef4444' : '#f59e0b' }}>{fmt(t.completenessRate * 100)}%</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: theme.textSecondary }}>{t.expectedDataPoints}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: theme.textSecondary }}>{t.presentDataPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Full ticker list */}
          {tickers.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem' }}>
                Todos os Tickers ({tickers.length})
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {tickers.map((t: any) => (
                  <div key={t.ticker} style={{
                    padding: '0.3rem 0.6rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
                    background: t.completenessRate >= 0.95 ? 'rgba(16,185,129,0.1)' : t.completenessRate >= 0.5 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                    color: t.completenessRate >= 0.95 ? '#10b981' : t.completenessRate >= 0.5 ? '#f59e0b' : '#ef4444',
                    border: `1px solid ${t.completenessRate >= 0.95 ? 'rgba(16,185,129,0.2)' : t.completenessRate >= 0.5 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  }}>
                    {t.ticker} {fmt(t.completenessRate * 100)}%
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

export default AdminDataQualityPage;
