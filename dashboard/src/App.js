import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, RefreshCw, AlertCircle, CheckCircle, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { API_BASE_URL, API_KEY } from './config';

function App() {
  const [activeTab, setActiveTab] = useState('recommendations');
  const [recommendations, setRecommendations] = useState([]);
  const [costs, setCosts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

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
          setLastUpdate(new Date());
        } else {
          throw new Error('Falha ao carregar recomendações');
        }
      } else if (activeTab === 'costs') {
        const response = await fetch(`${API_BASE_URL}/api/monitoring/costs?days=30`, {
          headers: { 'x-api-key': API_KEY }
        });
        if (response.ok) {
          const data = await response.json();
          setCosts(data);
          setLastUpdate(new Date());
        } else {
          throw new Error('Falha ao carregar custos');
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

  // Auto-refresh a cada 5 minutos
  useEffect(() => {
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercent = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '1.5rem 2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1 style={{
            margin: 0,
            fontSize: '1.75rem',
            fontWeight: '700',
            color: '#0f172a',
            letterSpacing: '-0.025em'
          }}>
            B3 Tactical Ranking
          </h1>
          <p style={{
            margin: '0.25rem 0 0 0',
            color: '#64748b',
            fontSize: '0.875rem'
          }}>
            Dashboard de Monitoramento MLOps
          </p>
        </div>
      </header>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {/* Status Banner */}
        {error && (
          <div style={{
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <AlertCircle size={20} color="#dc2626" />
            <span style={{ color: '#991b1b', fontSize: '0.875rem', fontWeight: '500' }}>
              {error}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          backgroundColor: 'white',
          padding: '0.5rem',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <button
            onClick={() => setActiveTab('recommendations')}
            style={{
              flex: 1,
              padding: '0.875rem 1.5rem',
              background: activeTab === 'recommendations' ? '#3b82f6' : 'transparent',
              color: activeTab === 'recommendations' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.9375rem',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'recommendations' ? '0 4px 6px rgba(59, 130, 246, 0.2)' : 'none'
            }}
          >
            <TrendingUp size={18} />
            Recomendações
          </button>
          
          <button
            onClick={() => setActiveTab('costs')}
            style={{
              flex: 1,
              padding: '0.875rem 1.5rem',
              background: activeTab === 'costs' ? '#3b82f6' : 'transparent',
              color: activeTab === 'costs' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.9375rem',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'costs' ? '0 4px 6px rgba(59, 130, 246, 0.2)' : 'none'
            }}
          >
            <DollarSign size={18} />
            Custos AWS
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{
            backgroundColor: 'white',
            padding: '4rem 2rem',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <RefreshCw
              size={40}
              color="#3b82f6"
              style={{
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem'
              }}
            />
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.9375rem' }}>
              Carregando dados...
            </p>
          </div>
        )}

        {/* Recommendations Tab */}
        {!loading && activeTab === 'recommendations' && (
          <div>
            {/* KPIs */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>
                    Total de Ativos
                  </span>
                  <CheckCircle size={20} color="#10b981" />
                </div>
                <p style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: '#0f172a' }}>
                  {recommendations.length}
                </p>
              </div>

              {recommendations.length > 0 && (
                <>
                  <div style={{
                    backgroundColor: 'white',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>
                        Melhor Retorno
                      </span>
                      <ArrowUpRight size={20} color="#10b981" />
                    </div>
                    <p style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: '#10b981' }}>
                      {formatPercent(Math.max(...recommendations.map(r => r.expected_return || 0)))}
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: 'white',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>
                        Retorno Médio
                      </span>
                      <TrendingUp size={20} color="#3b82f6" />
                    </div>
                    <p style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: '#3b82f6' }}>
                      {formatPercent(recommendations.reduce((acc, r) => acc + (r.expected_return || 0), 0) / recommendations.length)}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Recommendations Table */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
                  Top 20 Recomendações
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                  Ativos ranqueados por retorno esperado
                </p>
              </div>

              {recommendations.length === 0 ? (
                <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                  <TrendingDown size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                  <p style={{ color: '#64748b', margin: 0, fontSize: '0.9375rem' }}>
                    Nenhuma recomendação disponível no momento
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Rank
                        </th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Ticker
                        </th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Retorno Esperado
                        </th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Score
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recommendations.slice(0, 20).map((rec, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background-color 0.15s',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#64748b', fontWeight: '500' }}>
                            #{idx + 1}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.9375rem', fontWeight: '600', color: '#0f172a' }}>
                            {rec.ticker}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              backgroundColor: rec.expected_return > 0 ? '#dcfce7' : '#fee2e2',
                              color: rec.expected_return > 0 ? '#166534' : '#991b1b'
                            }}>
                              {rec.expected_return > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                              {formatPercent(rec.expected_return)}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.875rem', color: '#64748b', fontWeight: '500' }}>
                            {rec.score?.toFixed(4) || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Costs Tab */}
        {!loading && activeTab === 'costs' && (
          <div>
            {costs && costs.latest && (
              <>
                {/* Cost KPIs */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.5rem',
                  marginBottom: '2rem'
                }}>
                  <div style={{
                    backgroundColor: 'white',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>
                        Custo Total (7 dias)
                      </span>
                      <DollarSign size={20} color="#3b82f6" />
                    </div>
                    <p style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: '#0f172a' }}>
                      {formatCurrency(costs.latest.total_7_days?.brl || 0)}
                    </p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                      ${costs.latest.total_7_days?.usd?.toFixed(2) || '0.00'} USD
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: 'white',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>
                        Projeção Mensal
                      </span>
                      <TrendingUp size={20} color={costs.latest.threshold?.exceeded ? '#dc2626' : '#10b981'} />
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: '2rem',
                      fontWeight: '700',
                      color: costs.latest.threshold?.exceeded ? '#dc2626' : '#0f172a'
                    }}>
                      {formatCurrency(costs.latest.monthly_projection?.brl || 0)}
                    </p>
                    {costs.latest.threshold?.exceeded && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#dc2626', fontWeight: '500' }}>
                        ⚠️ Acima do limite
                      </p>
                    )}
                  </div>
                </div>

                {/* Costs by Service */}
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
                      Custos por Serviço AWS
                    </h2>
                    <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                      Últimos 7 dias
                    </p>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Serviço
                          </th>
                          <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Custo (USD)
                          </th>
                          <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            % do Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(costs.latest.costs_by_service || {})
                          .sort(([, a], [, b]) => b - a)
                          .map(([service, cost]) => {
                            const total = Object.values(costs.latest.costs_by_service).reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? (cost / total) * 100 : 0;
                            return (
                              <tr
                                key={service}
                                style={{
                                  borderBottom: '1px solid #f1f5f9',
                                  transition: 'background-color 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <td style={{ padding: '1rem 1.5rem', fontSize: '0.9375rem', fontWeight: '500', color: '#0f172a' }}>
                                  {service}
                                </td>
                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.9375rem', fontWeight: '600', color: '#0f172a' }}>
                                  ${cost.toFixed(2)}
                                </td>
                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                    <div style={{
                                      flex: '0 0 60px',
                                      height: '6px',
                                      backgroundColor: '#e2e8f0',
                                      borderRadius: '3px',
                                      overflow: 'hidden'
                                    }}>
                                      <div style={{
                                        width: `${percentage}%`,
                                        height: '100%',
                                        backgroundColor: '#3b82f6',
                                        borderRadius: '3px'
                                      }} />
                                    </div>
                                    <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b', minWidth: '45px', textAlign: 'right' }}>
                                      {percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {!costs && (
              <div style={{
                backgroundColor: 'white',
                padding: '3rem 2rem',
                borderRadius: '12px',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <DollarSign size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: '#64748b', margin: 0, fontSize: '0.9375rem' }}>
                  Nenhum dado de custo disponível
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            {lastUpdate && (
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                Última atualização: {lastUpdate.toLocaleString('pt-BR')}
              </p>
            )}
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
              Atualização automática a cada 5 minutos
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              background: loading ? '#e2e8f0' : '#3b82f6',
              color: loading ? '#94a3b8' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 2px 4px rgba(59, 130, 246, 0.2)'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#2563eb';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Atualizando...' : 'Atualizar Agora'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;
