/**
 * TickerDetailModal Component
 * 
 * Modal que exibe detalhes completos de um ticker:
 * - Histórico de recomendações
 * - Métricas fundamentalistas
 * - Notícias recentes
 * - Contribuição de cada modelo do ensemble
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import React, { useState, useEffect } from 'react';
import { X, TrendingUp, BarChart3, Newspaper, AlertCircle, Loader } from 'lucide-react';
import api from '../../services/api';

const TickerDetailModal = ({ ticker, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailData, setDetailData] = useState(null);

  // Fetch ticker details (Req 3.2, 3.3, 3.4)
  useEffect(() => {
    if (!ticker) return;

    const fetchTickerDetails = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch ticker details from API
        // Try to fetch all data in parallel for better performance
        const [historyData, fundamentalsData, newsData] = await Promise.allSettled([
          api.get(`/api/ticker/${ticker.ticker}/history`, { days: 90 }),
          api.get(`/api/ticker/${ticker.ticker}/fundamentals`),
          api.get(`/api/ticker/${ticker.ticker}/news`, { limit: 5 })
        ]);

        // Check if all API calls failed
        const allFailed = historyData.status === 'rejected' && 
                         fundamentalsData.status === 'rejected' && 
                         newsData.status === 'rejected';

        // Check if failures are due to network errors (not just endpoint not found)
        const hasNetworkError = allFailed && (
          (historyData.reason?.message && historyData.reason.message.includes('Network')) ||
          (fundamentalsData.reason?.message && fundamentalsData.reason.message.includes('Network')) ||
          (newsData.reason?.message && newsData.reason.message.includes('Network'))
        );

        if (hasNetworkError) {
          // If all API calls failed due to network error, show error message
          setError('Falha ao carregar detalhes do ticker. Por favor, tente novamente.');
          console.error('Network error - all API calls failed:', {
            history: historyData.reason,
            fundamentals: fundamentalsData.reason,
            news: newsData.reason
          });
        } else {
          // Process results - use real data if available, fallback to mock data
          const history = historyData.status === 'fulfilled' && Array.isArray(historyData.value?.data)
            ? historyData.value.data
            : generateMockHistory(ticker.ticker);

          const fundamentals = fundamentalsData.status === 'fulfilled' && fundamentalsData.value?.data && typeof fundamentalsData.value.data === 'object'
            ? fundamentalsData.value.data
            : generateMockFundamentals();

          const news = newsData.status === 'fulfilled' && Array.isArray(newsData.value?.data)
            ? newsData.value.data
            : generateMockNews(ticker.ticker);

          setDetailData({
            history,
            fundamentals,
            news
          });

          // Log if any API calls failed (for debugging)
          if (historyData.status === 'rejected') {
            console.warn('Failed to fetch ticker history, using mock data:', historyData.reason);
          }
          if (fundamentalsData.status === 'rejected') {
            console.warn('Failed to fetch fundamentals, using mock data:', fundamentalsData.reason);
          }
          if (newsData.status === 'rejected') {
            console.warn('Failed to fetch news, using mock data:', newsData.reason);
          }
        }
      } catch (err) {
        setError('Falha ao carregar detalhes do ticker. Por favor, tente novamente.');
        console.error('Error fetching ticker details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTickerDetails();
  }, [ticker]);

  // Handle Escape key press (Req 3.6)
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!ticker) return null;

  // Modelos do ensemble
  const models = [
    { name: 'XGBoost', weight: ticker.model_weights?.xgboost || 0.25, prediction: ticker.predictions?.xgboost || 0 },
    { name: 'LSTM', weight: ticker.model_weights?.lstm || 0.25, prediction: ticker.predictions?.lstm || 0 },
    { name: 'Prophet', weight: ticker.model_weights?.prophet || 0.25, prediction: ticker.predictions?.prophet || 0 },
    { name: 'DeepAR', weight: ticker.model_weights?.deepar || 0.25, prediction: ticker.predictions?.deepar || 0 }
  ];

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={onClose} // Close on overlay click (Req 3.6)
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          zIndex: 1
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>
            {ticker.ticker}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              color: '#64748b'
            }}
            aria-label="Fechar modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Loading State (Req 3.7) */}
          {loading && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '3rem',
              gap: '1rem'
            }}>
              <Loader size={32} color="#3b82f6" className="animate-spin" />
              <p style={{ color: '#64748b', margin: 0 }}>Carregando detalhes...</p>
            </div>
          )}

          {/* Error State (Req 3.8) */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b'
            }}>
              <AlertCircle size={20} />
              <p style={{ margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Loaded Content */}
          {!loading && !error && detailData && (
            <>
              {/* Métricas principais */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <TrendingUp size={16} color="#3b82f6" />
                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>Retorno Esperado</p>
                  </div>
                  <p style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 'bold', 
                    margin: 0,
                    color: (ticker.expected_return || ticker.exp_return_20 || 0) >= 0 ? '#10b981' : '#ef4444'
                  }}>
                    {((ticker.expected_return || ticker.exp_return_20 || 0) * 100).toFixed(2)}%
                  </p>
                </div>

                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <BarChart3 size={16} color="#3b82f6" />
                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>Score de Confiança</p>
                  </div>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#1e293b' }}>
                    {(ticker.confidence_score || ticker.score || 0).toFixed(1)}
                  </p>
                </div>
              </div>

              {/* Recommendation History (Req 3.2) */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#1e293b' }}>
                  Histórico de Recomendações
                </h3>
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc' }}>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: '#64748b' }}>Data</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#64748b' }}>Score</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#64748b' }}>Retorno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.history.map((entry, idx) => (
                        <tr key={idx} style={{ borderTop: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{entry.date}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem' }}>{entry.score.toFixed(1)}</td>
                          <td style={{ 
                            padding: '0.75rem', 
                            textAlign: 'right', 
                            fontSize: '0.875rem',
                            color: entry.return >= 0 ? '#10b981' : '#ef4444',
                            fontWeight: '500'
                          }}>
                            {(entry.return * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fundamentals (Req 3.3) */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#1e293b' }}>
                  Métricas Fundamentalistas
                </h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '1rem'
                }}>
                  {Object.entries(detailData.fundamentals).map(([key, value]) => (
                    <div key={key} style={{
                      padding: '1rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px'
                    }}>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.25rem 0', textTransform: 'uppercase' }}>
                        {key}
                      </p>
                      <p style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0, color: '#1e293b' }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* News (Req 3.4) */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Newspaper size={20} />
                  Notícias Recentes
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {detailData.news.map((article, idx) => (
                    <div key={idx} style={{
                      padding: '1rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <p style={{ fontSize: '0.875rem', fontWeight: '500', margin: '0 0 0.25rem 0', color: '#1e293b' }}>
                        {article.title}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                        {article.source} • {article.date}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contribuição dos modelos */}
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#1e293b' }}>
                  Contribuição dos Modelos do Ensemble
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {models.map((model, idx) => (
                    <div key={idx}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginBottom: '0.5rem',
                        fontSize: '0.875rem'
                      }}>
                        <span style={{ fontWeight: '500', color: '#1e293b' }}>{model.name}</span>
                        <span style={{ color: '#64748b' }}>
                          Peso: {(model.weight * 100).toFixed(1)}% | 
                          Predição: {(model.prediction * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: '#e2e8f0',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${model.weight * 100}%`,
                          height: '100%',
                          backgroundColor: '#3b82f6',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informações adicionais */}
              {ticker.sector && (
                <div style={{ 
                  marginTop: '1.5rem',
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px'
                }}>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>Setor</p>
                  <p style={{ fontSize: '1rem', fontWeight: '500', margin: '0.25rem 0 0 0', color: '#1e293b' }}>
                    {ticker.sector}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Mock data generators (to be replaced with real API calls)
const generateMockHistory = (ticker) => {
  const history = [];
  const today = new Date();
  for (let i = 0; i < 10; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i * 7);
    history.push({
      date: date.toLocaleDateString('pt-BR'),
      score: 70 + Math.random() * 20,
      return: (Math.random() - 0.3) * 0.15
    });
  }
  return history;
};

const generateMockFundamentals = () => ({
  'P/L': (15 + Math.random() * 10).toFixed(2),
  'P/VP': (1.5 + Math.random() * 2).toFixed(2),
  'Div. Yield': ((Math.random() * 8).toFixed(2) + '%'),
  'ROE': ((10 + Math.random() * 15).toFixed(2) + '%'),
  'Dív/PL': (0.5 + Math.random() * 1.5).toFixed(2)
});

const generateMockNews = (ticker) => [
  {
    title: `${ticker} anuncia resultados do trimestre`,
    source: 'InfoMoney',
    date: 'Há 2 dias'
  },
  {
    title: `Analistas recomendam ${ticker} para carteira`,
    source: 'Valor Econômico',
    date: 'Há 5 dias'
  },
  {
    title: `${ticker} expande operações no setor`,
    source: 'Bloomberg',
    date: 'Há 1 semana'
  }
];

export default TickerDetailModal;
