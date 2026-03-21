import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';

interface DashboardContext {
  darkMode: boolean;
  theme: Record<string, string>;
}

const AdminDataQualityPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [quality, setQuality] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchQuality(); }, []);

  const fetchQuality = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/monitoring/data-quality`, { headers: { 'x-api-key': API_KEY } });
      if (res.ok) setQuality(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1.25rem',
  };

  const getStatusIcon = (value: number) => {
    if (value >= 0.95) return <CheckCircle size={16} color="#10b981" />;
    if (value >= 0.8) return <AlertTriangle size={16} color="#f59e0b" />;
    return <XCircle size={16} color="#ef4444" />;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Qualidade de Dados</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>Completude, anomalias, freshness e cobertura do universo.</p>
        </div>
        <button onClick={fetchQuality} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white',
          borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
        }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: theme.textSecondary }}>
          Carregando dados de qualidade...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Completude', value: quality?.completeness, color: '#10b981' },
              { label: 'Freshness', value: quality?.freshness, color: '#3b82f6' },
              { label: 'Cobertura', value: quality?.coverage, color: '#8b5cf6' },
              { label: 'Consistência', value: quality?.consistency, color: '#f59e0b' },
            ].map((m, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: theme.textSecondary }}>{m.label}</span>
                  {m.value != null && getStatusIcon(m.value)}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: m.color }}>
                  {m.value != null ? `${(m.value * 100).toFixed(1)}%` : '—'}
                </div>
                {m.value != null && (
                  <div style={{ marginTop: '0.5rem', height: 6, borderRadius: 3, background: darkMode ? '#334155' : '#e2e8f0' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: m.color, width: `${m.value * 100}%`, transition: 'width 0.3s' }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {quality?.anomalies && quality.anomalies.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem' }}>Anomalias Detectadas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {quality.anomalies.map((a: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem',
                    borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  }}>
                    <AlertTriangle size={14} color="#f87171" />
                    <span style={{ fontSize: '0.85rem', color: theme.text }}>{a.description || a.ticker || JSON.stringify(a)}</span>
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
