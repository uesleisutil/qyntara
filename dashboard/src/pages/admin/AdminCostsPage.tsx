import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { DollarSign, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';

interface DashboardContext {
  darkMode: boolean;
  theme: Record<string, string>;
}

const AdminCostsPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [costs, setCosts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCosts(); }, []);

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/monitoring/costs`, { headers: { 'x-api-key': API_KEY } });
      if (res.ok) setCosts(await res.json());
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Custos AWS</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>Monitoramento de custos, otimização e ROI.</p>
        </div>
        <button onClick={fetchCosts} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white',
          borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
        }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: theme.textSecondary }}>
          Carregando dados de custos...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Custo Mensal Total', value: costs?.monthly_total ? `$${costs.monthly_total.toFixed(2)}` : '—', color: '#f59e0b', icon: <DollarSign size={18} /> },
              { label: 'Custo por Predição', value: costs?.cost_per_prediction ? `$${costs.cost_per_prediction.toFixed(4)}` : '—', color: '#3b82f6', icon: <TrendingDown size={18} /> },
              { label: 'Variação Mensal', value: costs?.monthly_change ? `${costs.monthly_change > 0 ? '+' : ''}${(costs.monthly_change * 100).toFixed(1)}%` : '—', color: (costs?.monthly_change || 0) > 0 ? '#ef4444' : '#10b981', icon: (costs?.monthly_change || 0) > 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} /> },
              { label: 'Budget Restante', value: costs?.budget_remaining ? `$${costs.budget_remaining.toFixed(2)}` : '—', color: '#10b981', icon: <DollarSign size={18} /> },
            ].map((kpi, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ color: kpi.color }}>{kpi.icon}</div>
                  <span style={{ fontSize: '0.8rem', color: theme.textSecondary }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {costs?.breakdown && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem' }}>Breakdown por Serviço</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(costs.breakdown).map(([service, cost]: [string, any]) => (
                  <div key={service}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.85rem', color: theme.text }}>{service}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>${typeof cost === 'number' ? cost.toFixed(2) : cost}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: darkMode ? '#334155' : '#e2e8f0' }}>
                      <div style={{
                        height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                        width: `${Math.min(((typeof cost === 'number' ? cost : 0) / (costs.monthly_total || 1)) * 100, 100)}%`,
                      }} />
                    </div>
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
