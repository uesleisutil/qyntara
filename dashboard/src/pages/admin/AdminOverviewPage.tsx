import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TrendingUp, DollarSign, AlertTriangle, CheckCircle, Activity, Server, Database } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';

interface DashboardContext {
  darkMode: boolean;
  theme: Record<string, string>;
}

const AdminOverviewPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [performance, setPerformance] = useState<any>(null);
  const [costs, setCosts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const headers = { 'x-api-key': API_KEY };
        const [perfRes, costRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/api/monitoring/model-performance`, { headers }),
          fetch(`${API_BASE_URL}/api/monitoring/costs`, { headers }),
        ]);
        if (perfRes.status === 'fulfilled' && perfRes.value.ok) setPerformance(await perfRes.value.json());
        if (costRes.status === 'fulfilled' && costRes.value.ok) setCosts(await costRes.value.json());
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1.25rem',
  };

  const kpis = [
    { label: 'Acurácia do Modelo', value: performance?.accuracy ? `${(performance.accuracy * 100).toFixed(1)}%` : '—', icon: <TrendingUp size={18} />, color: '#10b981' },
    { label: 'MAPE', value: performance?.mape ? `${(performance.mape * 100).toFixed(1)}%` : '—', icon: <Activity size={18} />, color: '#3b82f6' },
    { label: 'Custo Mensal AWS', value: costs?.monthly_total ? `$${costs.monthly_total.toFixed(2)}` : '—', icon: <DollarSign size={18} />, color: '#f59e0b' },
    { label: 'Custo por Predição', value: costs?.cost_per_prediction ? `$${costs.cost_per_prediction.toFixed(4)}` : '—', icon: <Server size={18} />, color: '#8b5cf6' },
    { label: 'Sharpe Ratio', value: performance?.sharpe_ratio?.toFixed(2) || '—', icon: <TrendingUp size={18} />, color: '#06b6d4' },
    { label: 'Status', value: 'Operacional', icon: <CheckCircle size={18} />, color: '#10b981' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>
          🔒 Painel Administrativo
        </h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>
          Visão geral de custos, performance do modelo e saúde do sistema.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: theme.textSecondary }}>
          Carregando dados administrativos...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {kpis.map((kpi, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: `${kpi.color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color,
                  }}>
                    {kpi.icon}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: theme.textSecondary }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: theme.text }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Quick info cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            <div style={cardStyle}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={16} color="#3b82f6" /> Infraestrutura
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[
                  { label: 'Lambda Functions', status: 'Ativo' },
                  { label: 'API Gateway', status: 'Ativo' },
                  { label: 'S3 Buckets', status: 'Ativo' },
                  { label: 'DynamoDB', status: 'Ativo' },
                  { label: 'ElastiCache Redis', status: 'Ativo' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: theme.textSecondary }}>{item.label}</span>
                    <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CheckCircle size={12} /> {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} color="#f59e0b" /> Alertas Recentes
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <p style={{ fontSize: '0.85rem', color: theme.textSecondary, fontStyle: 'italic' }}>
                  Nenhum alerta ativo no momento.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminOverviewPage;
