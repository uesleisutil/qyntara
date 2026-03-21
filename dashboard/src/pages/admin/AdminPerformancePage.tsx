import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';

interface DashboardContext {
  darkMode: boolean;
  theme: Record<string, string>;
}

const AdminPerformancePage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [performance, setPerformance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformance();
  }, []);

  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/monitoring/model-performance`, { headers: { 'x-api-key': API_KEY } });
      if (res.ok) setPerformance(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1.25rem',
  };

  const metrics = performance ? [
    { label: 'Acurácia', value: `${((performance.accuracy || 0) * 100).toFixed(1)}%`, color: '#10b981' },
    { label: 'MAPE', value: `${((performance.mape || 0) * 100).toFixed(1)}%`, color: '#3b82f6' },
    { label: 'Sharpe Ratio', value: (performance.sharpe_ratio || 0).toFixed(2), color: '#8b5cf6' },
    { label: 'Max Drawdown', value: `${((performance.max_drawdown || 0) * 100).toFixed(1)}%`, color: '#ef4444' },
    { label: 'Win Rate', value: `${((performance.win_rate || 0) * 100).toFixed(1)}%`, color: '#f59e0b' },
    { label: 'Sortino Ratio', value: (performance.sortino_ratio || 0).toFixed(2), color: '#06b6d4' },
  ] : [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Performance do Modelo</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>Métricas de acurácia, risco e retorno do modelo de ML.</p>
        </div>
        <button onClick={fetchPerformance} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white',
          borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
        }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: theme.textSecondary }}>
          Carregando métricas de performance...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {metrics.map((m, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.8rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>{m.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {performance?.models && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem' }}>Breakdown por Modelo</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                      {['Modelo', 'Acurácia', 'MAPE', 'Peso Ensemble'].map(h => (
                        <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: theme.textSecondary }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(performance.models).map(([name, data]: [string, any]) => (
                      <tr key={name} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '0.6rem 1rem', fontWeight: 500, color: theme.text }}>{name}</td>
                        <td style={{ padding: '0.6rem 1rem', color: '#10b981' }}>{((data.accuracy || 0) * 100).toFixed(1)}%</td>
                        <td style={{ padding: '0.6rem 1rem', color: '#3b82f6' }}>{((data.mape || 0) * 100).toFixed(1)}%</td>
                        <td style={{ padding: '0.6rem 1rem', color: theme.textSecondary }}>{((data.weight || 0) * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPerformancePage;
