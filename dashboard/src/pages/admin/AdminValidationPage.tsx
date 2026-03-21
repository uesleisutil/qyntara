import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';

interface DashboardContext {
  darkMode: boolean;
  theme: Record<string, string>;
}

const AdminValidationPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [validation, setValidation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchValidation(); }, []);

  const fetchValidation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/recommendations/validation`, { headers: { 'x-api-key': API_KEY } });
      if (res.ok) setValidation(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1.25rem',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Validação</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>Predicted vs Actual, acurácia temporal e análise de outliers.</p>
        </div>
        <button onClick={fetchValidation} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white',
          borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
        }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: theme.textSecondary }}>
          Carregando dados de validação...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Predições Validadas', value: validation?.total_validated || '—', color: '#3b82f6' },
              { label: 'Acurácia Direcional', value: validation?.directional_accuracy ? `${(validation.directional_accuracy * 100).toFixed(1)}%` : '—', color: '#10b981' },
              { label: 'Erro Médio', value: validation?.mean_error ? `${(validation.mean_error * 100).toFixed(2)}%` : '—', color: '#f59e0b' },
              { label: 'Correlação', value: validation?.correlation?.toFixed(3) || '—', color: '#8b5cf6' },
            ].map((m, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.8rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>{m.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {validation?.validations && validation.validations.length > 0 && (
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${theme.border}` }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text }}>Últimas Validações</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                      {['Ticker', 'Previsto', 'Real', 'Erro', 'Direção'].map(h => (
                        <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: theme.textSecondary, background: darkMode ? '#0f172a' : '#f8fafc' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validation.validations.slice(0, 20).map((v: any, i: number) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '0.6rem 1rem', fontWeight: 500, color: theme.text }}>{v.ticker}</td>
                        <td style={{ padding: '0.6rem 1rem', color: theme.textSecondary }}>{v.predicted?.toFixed(2)}</td>
                        <td style={{ padding: '0.6rem 1rem', color: theme.textSecondary }}>{v.actual?.toFixed(2)}</td>
                        <td style={{ padding: '0.6rem 1rem', color: Math.abs(v.error || 0) > 0.1 ? '#ef4444' : '#10b981' }}>
                          {v.error ? `${(v.error * 100).toFixed(2)}%` : '—'}
                        </td>
                        <td style={{ padding: '0.6rem 1rem' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600,
                            background: v.direction_correct ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: v.direction_correct ? '#10b981' : '#ef4444',
                          }}>
                            {v.direction_correct ? '✓ Correto' : '✗ Errado'}
                          </span>
                        </td>
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

export default AdminValidationPage;
