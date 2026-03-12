import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, RefreshCw, AlertCircle, CheckCircle, TrendingDown, ArrowUpRight, ArrowDownRight, Moon, Sun } from 'lucide-react';
import { API_BASE_URL, API_KEY } from './config';

function App() {
  const [activeTab, setActiveTab] = useState('recommendations');
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsHistory, setRecommendationsHistory] = useState([]);
  const [costs, setCosts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    hover: darkMode ? '#334155' : '#f8fafc',
    tableBg: darkMode ? '#0f172a' : '#f8fafc',
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (activeTab === 'recommendations') {
        // Buscar recomendações atuais
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
        
        // Buscar histórico
        const historyResponse = await fetch(`${API_BASE_URL}/api/recommendations/history?days=30`, {
          headers: { 'x-api-key': API_KEY }
        });
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setRecommendationsHistory(historyData.time_series || []);
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
      backgroundColor: theme.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      transition: 'background-color 0.3s ease'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: theme.cardBg,
        borderBottom: `1px solid ${theme.border}`,
        padding: '1.5rem 2rem',
        boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '1.75rem',
              fontWeight: '700',
              color: theme.text,
              letterSpacing: '-0.025em'
            }}>
              B3 Tactical Ranking
            </h1>
            <p style={{
              margin: '0.25rem 0 0 0',
              color: theme.textSecondary,
              fontSize: '0.875rem'
            }}>
              Dashboard de Monitoramento MLOps
            </p>
          </div>
          
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              padding: '0.75rem',
              backgroundColor: darkMode ? '#334155' : '#f1f5f9',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: darkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
          >
            {darkMode ? <Sun size={20} color="#fbbf24" /> : <Moon size={20} color="#64748b" />}
          </button>
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
          backgroundColor: theme.cardBg,
          padding: '0.5rem',
          borderRadius: '12px',
          boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
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
            backgroundColor: theme.cardBg,
            padding: '4rem 2rem',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <RefreshCw
              size={40}
              color="#3b82f6"
              style={{
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem'
              }}
            />
            <p style={{ color: theme.textSecondary, margin: 0, fontSize: '0.9375rem' }}>
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.25rem',
              marginBottom: '2rem'
            }}>
              {recommendations.length > 0 && (() => {
                const validReturns = recommendations
                  .map(r => ({ ticker: r.ticker, return: r.exp_return_20 }))
                  .filter(item => item.return !== null && item.return !== undefined && !isNaN(item.return));
                
                const returns = validReturns.map(item => item.return);
                const positiveReturns = returns.filter(val => val > 0);
                const negativeReturns = returns.filter(val => val < 0);
                
                const maxReturn = returns.length > 0 ? Math.max(...returns) : 0;
                const minReturn = returns.length > 0 ? Math.min(...returns) : 0;
                const avgReturn = returns.length > 0 
                  ? returns.reduce((acc, val) => acc + val, 0) / returns.length 
                  : 0;
                const avgPositive = positiveReturns.length > 0
                  ? positiveReturns.reduce((acc, val) => acc + val, 0) / positiveReturns.length
                  : 0;
                const avgNegative = negativeReturns.length > 0
                  ? negativeReturns.reduce((acc, val) => acc + val, 0) / negativeReturns.length
                  : 0;
                
                const bestTicker = validReturns.find(item => item.return === maxReturn)?.ticker || 'N/A';
                const worstTicker = validReturns.find(item => item.return === minReturn)?.ticker || 'N/A';

                return (
                  <>
                    <div style={{
                      backgroundColor: theme.cardBg,
                      padding: '1.25rem',
                      borderRadius: '12px',
                      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                          Total de Ativos
                        </span>
                        <CheckCircle size={18} color="#10b981" />
                      </div>
                      <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: theme.text }}>
                        {recommendations.length}
                      </p>
                    </div>

                    <div style={{
                      backgroundColor: theme.cardBg,
                      padding: '1.25rem',
                      borderRadius: '12px',
                      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                          Melhor Ativo
                        </span>
                        <ArrowUpRight size={18} color="#10b981" />
                      </div>
                      <p style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
                        {bestTicker}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: '#10b981' }}>
                        {formatPercent(maxReturn)}
                      </p>
                    </div>

                    <div style={{
                      backgroundColor: theme.cardBg,
                      padding: '1.25rem',
                      borderRadius: '12px',
                      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                          Pior Ativo
                        </span>
                        <ArrowDownRight size={18} color="#dc2626" />
                      </div>
                      <p style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
                        {worstTicker}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: '#dc2626' }}>
                        {formatPercent(minReturn)}
                      </p>
                    </div>

                    <div style={{
                      backgroundColor: theme.cardBg,
                      padding: '1.25rem',
                      borderRadius: '12px',
                      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                          Retorno Médio
                        </span>
                        <TrendingUp size={18} color="#3b82f6" />
                      </div>
                      <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#3b82f6' }}>
                        {formatPercent(avgReturn)}
                      </p>
                    </div>

                    <div style={{
                      backgroundColor: theme.cardBg,
                      padding: '1.25rem',
                      borderRadius: '12px',
                      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                          Ativos Positivos
                        </span>
                        <ArrowUpRight size={18} color="#10b981" />
                      </div>
                      <p style={{ margin: '0 0 0.25rem 0', fontSize: '1.75rem', fontWeight: '700', color: '#10b981' }}>
                        {positiveReturns.length}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: theme.textSecondary }}>
                        Média: {formatPercent(avgPositive)}
                      </p>
                    </div>

                    <div style={{
                      backgroundColor: theme.cardBg,
                      padding: '1.25rem',
                      borderRadius: '12px',
                      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                          Ativos Negativos
                        </span>
                        <ArrowDownRight size={18} color="#dc2626" />
                      </div>
                      <p style={{ margin: '0 0 0.25rem 0', fontSize: '1.75rem', fontWeight: '700', color: '#dc2626' }}>
                        {negativeReturns.length}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: theme.textSecondary }}>
                        Média: {formatPercent(avgNegative)}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Performance ao Longo do Tempo */}
            {recommendationsHistory.length > 0 && (
              <div style={{
                backgroundColor: theme.cardBg,
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '2rem',
                boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '700', color: theme.text }}>
                  Evolução de Performance (30 dias)
                </h2>
                
                {/* Gráfico de linha simples */}
                <div style={{ position: 'relative', height: '300px', marginBottom: '1rem' }}>
                  <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                    {(() => {
                      const width = 1000;
                      const height = 300;
                      const padding = { top: 20, right: 20, bottom: 40, left: 60 };
                      const chartWidth = width - padding.left - padding.right;
                      const chartHeight = height - padding.top - padding.bottom;
                      
                      // Preparar dados
                      const data = recommendationsHistory.slice(-30);
                      const maxReturn = Math.max(...data.map(d => d.max_return));
                      const minReturn = Math.min(...data.map(d => d.min_return));
                      const range = maxReturn - minReturn;
                      
                      // Escala Y
                      const scaleY = (value) => {
                        return padding.top + chartHeight - ((value - minReturn) / range) * chartHeight;
                      };
                      
                      // Escala X
                      const scaleX = (index) => {
                        return padding.left + (index / (data.length - 1)) * chartWidth;
                      };
                      
                      // Criar path para linha de retorno médio
                      const avgPath = data.map((d, i) => {
                        const x = scaleX(i);
                        const y = scaleY(d.avg_return);
                        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                      }).join(' ');
                      
                      // Criar path para melhor retorno
                      const maxPath = data.map((d, i) => {
                        const x = scaleX(i);
                        const y = scaleY(d.max_return);
                        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                      }).join(' ');
                      
                      // Criar path para pior retorno
                      const minPath = data.map((d, i) => {
                        const x = scaleX(i);
                        const y = scaleY(d.min_return);
                        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                      }).join(' ');
                      
                      // Grid horizontal
                      const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
                        const y = padding.top + chartHeight * ratio;
                        const value = maxReturn - (range * ratio);
                        return { y, value };
                      });
                      
                      return (
                        <g>
                          {/* Grid */}
                          {gridLines.map((line, i) => (
                            <g key={i}>
                              <line
                                x1={padding.left}
                                y1={line.y}
                                x2={padding.left + chartWidth}
                                y2={line.y}
                                stroke={darkMode ? '#334155' : '#e2e8f0'}
                                strokeWidth="1"
                              />
                              <text
                                x={padding.left - 10}
                                y={line.y + 4}
                                textAnchor="end"
                                fill={theme.textSecondary}
                                fontSize="11"
                              >
                                {formatPercent(line.value)}
                              </text>
                            </g>
                          ))}
                          
                          {/* Linha zero */}
                          {minReturn < 0 && maxReturn > 0 && (
                            <line
                              x1={padding.left}
                              y1={scaleY(0)}
                              x2={padding.left + chartWidth}
                              y2={scaleY(0)}
                              stroke={darkMode ? '#64748b' : '#94a3b8'}
                              strokeWidth="2"
                              strokeDasharray="4 4"
                            />
                          )}
                          
                          {/* Linhas */}
                          <path
                            d={maxPath}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2"
                            opacity="0.6"
                          />
                          <path
                            d={avgPath}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="3"
                          />
                          <path
                            d={minPath}
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth="2"
                            opacity="0.6"
                          />
                          
                          {/* Pontos na linha média */}
                          {data.map((d, i) => (
                            <circle
                              key={i}
                              cx={scaleX(i)}
                              cy={scaleY(d.avg_return)}
                              r="4"
                              fill="#3b82f6"
                            />
                          ))}
                          
                          {/* Eixo X - datas */}
                          {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d, i, arr) => {
                            const index = data.indexOf(d);
                            const x = scaleX(index);
                            const date = new Date(d.date);
                            const label = `${date.getDate()}/${date.getMonth() + 1}`;
                            return (
                              <text
                                key={i}
                                x={x}
                                y={padding.top + chartHeight + 20}
                                textAnchor="middle"
                                fill={theme.textSecondary}
                                fontSize="11"
                              >
                                {label}
                              </text>
                            );
                          })}
                        </g>
                      );
                    })()}
                  </svg>
                </div>
                
                {/* Legenda */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '20px', height: '3px', backgroundColor: '#3b82f6' }} />
                    <span style={{ fontSize: '0.875rem', color: theme.textSecondary }}>Retorno Médio</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '20px', height: '2px', backgroundColor: '#10b981', opacity: 0.6 }} />
                    <span style={{ fontSize: '0.875rem', color: theme.textSecondary }}>Melhor Retorno</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '20px', height: '2px', backgroundColor: '#dc2626', opacity: 0.6 }} />
                    <span style={{ fontSize: '0.875rem', color: theme.textSecondary }}>Pior Retorno</span>
                  </div>
                </div>
              </div>
            )}

            {/* Recommendations Table */}
            <div style={{
              backgroundColor: theme.cardBg,
              borderRadius: '12px',
              transition: 'all 0.3s ease',
              boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '1.5rem', borderBottom: `1px solid ${theme.border}` }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: theme.text }}>
                  Top 20 Recomendações
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', color: theme.textSecondary, fontSize: '0.875rem' }}>
                  Ativos ranqueados por retorno esperado
                </p>
              </div>

              {recommendations.length === 0 ? (
                <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                  <TrendingDown size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                  <p style={{ color: theme.textSecondary, margin: 0, fontSize: '0.9375rem' }}>
                    Nenhuma recomendação disponível no momento
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: theme.tableBg, borderBottom: `1px solid ${theme.border}` }}>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Rank
                        </th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Ticker
                        </th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Retorno Esperado
                        </th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Score
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recommendations.slice(0, 20).map((rec, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: `1px solid ${theme.border}`,
                            transition: 'background-color 0.15s',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.hover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: theme.textSecondary, fontWeight: '500' }}>
                            #{idx + 1}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.9375rem', fontWeight: '600', color: theme.text }}>
                            {rec.ticker}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                            {rec.exp_return_20 !== null && rec.exp_return_20 !== undefined && !isNaN(rec.exp_return_20) ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                backgroundColor: rec.exp_return_20 > 0 ? '#dcfce7' : '#fee2e2',
                                color: rec.exp_return_20 > 0 ? '#166534' : '#991b1b'
                              }}>
                                {rec.exp_return_20 > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                {formatPercent(rec.exp_return_20)}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.875rem', color: theme.textSecondary }}>N/A</span>
                            )}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.875rem', color: theme.textSecondary, fontWeight: '500' }}>
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
                    backgroundColor: theme.cardBg,
                    padding: '1.5rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: '0.875rem', fontWeight: '500' }}>
                        Custo Total (7 dias)
                      </span>
                      <DollarSign size={20} color="#3b82f6" />
                    </div>
                    <p style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: theme.text }}>
                      {formatCurrency(costs.latest.total_7_days?.brl || 0)}
                    </p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: theme.textSecondary }}>
                      ${costs.latest.total_7_days?.usd?.toFixed(2) || '0.00'} USD
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: '1.5rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: '0.875rem', fontWeight: '500' }}>
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
                  backgroundColor: theme.cardBg,
                  borderRadius: '12px',
                  boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '1.5rem', borderBottom: `1px solid ${theme.border}` }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: theme.text }}>
                      Custos por Serviço AWS
                    </h2>
                    <p style={{ margin: '0.25rem 0 0 0', color: theme.textSecondary, fontSize: '0.875rem' }}>
                      Últimos 7 dias
                    </p>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: theme.tableBg, borderBottom: `1px solid ${theme.border}` }}>
                          <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Serviço
                          </th>
                          <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Custo (USD)
                          </th>
                          <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                                  borderBottom: `1px solid ${theme.border}`,
                                  transition: 'background-color 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.hover}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <td style={{ padding: '1rem 1.5rem', fontSize: '0.9375rem', fontWeight: '500', color: theme.text }}>
                                  {service}
                                </td>
                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.9375rem', fontWeight: '600', color: theme.text }}>
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
                                    <span style={{ fontSize: '0.875rem', fontWeight: '500', color: theme.textSecondary, minWidth: '45px', textAlign: 'right' }}>
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
                backgroundColor: theme.cardBg,
                padding: '3rem 2rem',
                borderRadius: '12px',
                textAlign: 'center',
                boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <DollarSign size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: theme.textSecondary, margin: 0, fontSize: '0.9375rem' }}>
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
          backgroundColor: theme.cardBg,
          borderRadius: '12px',
          boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            {lastUpdate && (
              <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textSecondary }}>
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
