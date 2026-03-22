import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const fmt = (v: any, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : null;

const AdminValidationPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchValidation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/recommendations/validation`, { headers: { 'x-api-key': API_KEY } });
      if (res.ok) setData(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchValidation(); }, []);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1.25rem',
  };

  // API returns: { period, summary: { total_predictions, completed_validations, pending_validations, mean_absolute_error, directional_accuracy, rmse }, validations: [...] }
  const summary = data?.summary || {};
  const validations = data?.validations || [];

  const kpis = [
    { label: 'Total Predições', value: summary.total_predictions?.toString() || '—', color: '#3b82f6' },
    { label: 'Validações Completas', value: summary.completed_validations?.toString() || '—', color: '#10b981' },
    { label: 'Pendentes', value: summary.pending_validations?.toString() || '—', color: '#f59e0b' },
    { label: 'Acurácia Direcional', value: summary.directional_accuracy ? `${fmt(summary.directional_accuracy * 100, 1)}%` : summary.completed_validations === 0 ? 'Aguardando' : '—', color: '#8b5cf6' },
    { label: 'Erro Médio Absoluto', value: summary.mean_absolute_error ? `${fmt(summary.mean_absolute_error * 100)}%` : summary.completed_validations === 0 ? 'Aguardando' : '—', color: '#ef4444' },
    { label: 'RMSE', value: summary.rmse ? fmt(summary.rmse, 4) : summary.completed_validations === 0 ? 'Aguardando' : '—', color: '#06b6d4' },
  ];

  // Group validations by date (for future use)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Validação</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>
            Predicted vs Actual, acurácia temporal e análise de outliers.
            {data?.period && <span> Período: {data.period.start_date} a {data.period.end_date}</span>}
          </p>
        </div>
        <button onClick={fetchValidation} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: theme.textSecondary }}>Carregando dados de validação...</div>
      ) : !data ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem', color: theme.textSecondary }}>Sem dados de validação disponíveis.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {kpis.map((m, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.8rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>{m.label}</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {summary.completed_validations === 0 && summary.pending_validations > 0 && (
            <div style={{ ...cardStyle, marginBottom: '1rem', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <p style={{ fontSize: '0.9rem', color: '#3b82f6', margin: 0 }}>
                ⏳ As predições precisam de ~20 dias para serem validadas contra preços reais. {summary.pending_validations} predições aguardando validação.
              </p>
            </div>
          )}

          {/* Validations table */}
          {validations.length > 0 && (
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${theme.border}` }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text }}>Predições ({validations.length})</h3>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 500 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.border}`, position: 'sticky', top: 0, background: theme.card || (darkMode ? '#1e293b' : '#fff') }}>
                      {['Data', 'Ticker', 'Previsto', 'Real', 'Erro', 'Status'].map(h => (
                        <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: theme.textSecondary }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validations.slice(0, 50).map((v: any, i: number) => {
                      const hasActual = v.actual_price != null || v.actual != null;
                      const predicted = v.predicted_price ?? v.predicted;
                      const actual = v.actual_price ?? v.actual;
                      const error = hasActual && predicted ? Math.abs((predicted - actual) / actual) : null;
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: theme.textSecondary }}>{v.prediction_date || v.date || '—'}</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500, color: theme.text }}>{v.ticker}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: theme.textSecondary }}>R$ {fmt(predicted)}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: theme.textSecondary }}>{hasActual ? `R$ ${fmt(actual)}` : '—'}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: error != null ? (error > 0.1 ? '#ef4444' : '#10b981') : theme.textSecondary }}>
                            {error != null ? `${fmt(error * 100)}%` : '—'}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <span style={{
                              padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600,
                              background: hasActual ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                              color: hasActual ? '#10b981' : '#f59e0b',
                            }}>
                              {hasActual ? '✓ Validado' : '⏳ Pendente'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
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

export default AdminValidationPage;
