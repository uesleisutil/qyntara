import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, RefreshCw } from 'lucide-react';
import { API_BASE_URL, API_KEY } from './config';

function App() {
  const [activeTab, setActiveTab] = useState('recommendations');
  const [recommendations, setRecommendations] = useState([]);
  const [costs, setCosts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (activeTab === 'recommendations') {
        const response = await fetch(`${API_BASE_URL}/api/recommendations/latest`, {
          headers: { 'x-api-key': API_KEY }
        });
        if (response.ok) {
          const data = await response.json();
          setRecommendations(data.recommendations || []);
        }
      } else if (activeTab === 'costs') {
        const response = await fetch(`${API_BASE_URL}/api/monitoring/costs?days=30`, {
          headers: { 'x-api-key': API_KEY }
        });
        if (response.ok) {
          const data = await response.json();
          setCosts(data);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', color: '#1e293b' }}>
          B3 Tactical Ranking - MLOps Dashboard
        </h1>
        <p style={{ margin: '0.5rem 0 0 0', color: '#64748b' }}>
          Monitoramento Completo de Performance e Métricas
        </p>
      </header>

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#991b1b'
        }}>
          Erro: {error}
        </div>
      )}

      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '2rem',
        borderBottom: '2px solid #e2e8f0'
      }}>
        <button
          onClick={() => setActiveTab('recommendations')}
          style={{
            padding: '1rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'recommendations' ? '3px solid #3b82f6' : '3px solid transparent',
            color: activeTab === 'recommendations' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'recommendations' ? 'bold' : 'normal',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1rem'
          }}
        >
          <TrendingUp size={20} />
          Recomendações
        </button>
        
        <button
          onClick={() => setActiveTab('costs')}
          style={{
            padding: '1rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'costs' ? '3px solid #3b82f6' : '3px solid transparent',
            color: activeTab === 'costs' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'costs' ? 'bold' : 'normal',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1rem'
          }}
        >
          <DollarSign size={20} />
          Custos
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
          <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto' }} />
          <p>Carregando...</p>
        </div>
      )}

      {!loading && activeTab === 'recommendations' && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginTop: 0 }}>Recomendações</h2>
          {recommendations.length === 0 ? (
            <p style={{ color: '#64748b' }}>Nenhuma recomendação disponível no momento.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Ticker</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Retorno Esperado</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.slice(0, 20).map((rec, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem' }}>{rec.ticker}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {(rec.expected_return * 100).toFixed(2)}%
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {rec.score?.toFixed(4) || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'costs' && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginTop: 0 }}>Custos AWS</h2>
          {!costs ? (
            <p style={{ color: '#64748b' }}>Nenhum dado de custo disponível.</p>
          ) : (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3>Resumo (últimos 7 dias)</h3>
                <p style={{ fontSize: '2rem', margin: '0.5rem 0', color: '#3b82f6' }}>
                  R$ {costs.latest?.total_7_days?.brl?.toFixed(2) || '0.00'}
                </p>
                <p style={{ color: '#64748b', margin: 0 }}>
                  Projeção mensal: R$ {costs.latest?.monthly_projection?.brl?.toFixed(2) || '0.00'}
                </p>
              </div>
              
              {costs.latest?.costs_by_service && (
                <div>
                  <h3>Custos por Serviço</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Serviço</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Custo (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(costs.latest.costs_by_service).map(([service, cost]) => (
                        <tr key={service} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem' }}>{service}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            ${cost.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
          Dashboard v3.0 - {new Date().toLocaleString('pt-BR')}
        </span>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            background: loading ? '#94a3b8' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem'
          }}
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>
    </div>
  );
}

export default App;
