/**
 * ComparisonModal Component
 * 
 * Modal for comparing multiple tickers side-by-side:
 * - Displays scores, returns, and historical performance
 * - Supports up to 5 tickers
 * - Shows comparative metrics
 * 
 * Requirements: 4.4, 4.5, 4.6, 4.7, 4.9
 */

import React, { useState, useEffect } from 'react';
import { X, TrendingUp, BarChart3, Activity, Loader } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../services/api';

const ComparisonModal = ({ tickers, onClose }) => {
  const [historicalData, setHistoricalData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  if (!tickers || tickers.length === 0) return null;

  // Fetch historical performance data for all tickers (Req 4.7)
  useEffect(() => {
    const fetchHistoricalData = async () => {
      setLoadingHistory(true);
      
      try {
        // Fetch history for all tickers in parallel
        const historyPromises = tickers.map(ticker =>
          api.get(`/api/ticker/${ticker.ticker}/history`, { days: 90 })
            .then(response => ({
              ticker: ticker.ticker,
              data: response.data
            }))
            .catch(() => ({
              ticker: ticker.ticker,
              data: []
            }))
        );

        const histories = await Promise.all(historyPromises);
        
        // Transform data for chart - combine all ticker histories by date
        const dateMap = new Map();
        
        histories.forEach(({ ticker, data }) => {
          data.forEach(point => {
            const dateKey = point.date;
            if (!dateMap.has(dateKey)) {
              dateMap.set(dateKey, { date: dateKey });
            }
            // Store cumulative return for this ticker
            dateMap.get(dateKey)[ticker] = (point.return || 0) * 100;
          });
        });

        // Convert to array and sort by date
        const chartData = Array.from(dateMap.values())
          .sort((a, b) => {
            // Parse Brazilian date format (DD/MM/YYYY)
            const parseDate = (dateStr) => {
              const [day, month, year] = dateStr.split('/');
              return new Date(year, month - 1, day);
            };
            return parseDate(a.date) - parseDate(b.date);
          });

        setHistoricalData(chartData);
      } catch (error) {
        console.error('Error fetching historical data:', error);
        setHistoricalData([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistoricalData();
  }, [tickers]);

  // Calculate comparative metrics
  const metrics = tickers.map(ticker => ({
    ticker: ticker.ticker,
    score: ticker.confidence_score || ticker.score || 0,
    expectedReturn: (ticker.expected_return || ticker.exp_return_20 || 0) * 100,
    sector: ticker.sector || '-'
  }));

  // Find best/worst for highlighting
  const bestScore = Math.max(...metrics.map(m => m.score));
  const bestReturn = Math.max(...metrics.map(m => m.expectedReturn));

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
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '1000px',
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
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#1a1836' }}>
            Comparação de Tickers
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
          {/* Ticker Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(tickers.length, 3)}, 1fr)`,
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            {tickers.map((ticker, idx) => (
              <div key={idx} style={{
                padding: '1.5rem',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                backgroundColor: '#f8fafc'
              }}>
                <h3 style={{ 
                  margin: '0 0 1rem 0', 
                  fontSize: '1.25rem', 
                  fontWeight: 'bold', 
                  color: '#1a1836',
                  textAlign: 'center'
                }}>
                  {ticker.ticker}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{
                    padding: '0.75rem',
                    backgroundColor: 'white',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <BarChart3 size={14} color="#64748b" />
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Score</p>
                    </div>
                    <p style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 'bold', 
                      margin: 0,
                      color: (ticker.confidence_score || ticker.score || 0) === bestScore ? '#10b981' : '#1a1836'
                    }}>
                      {(ticker.confidence_score || ticker.score || 0).toFixed(1)}
                    </p>
                  </div>

                  <div style={{
                    padding: '0.75rem',
                    backgroundColor: 'white',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <TrendingUp size={14} color="#64748b" />
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Retorno Esperado</p>
                    </div>
                    <p style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 'bold', 
                      margin: 0,
                      color: ((ticker.expected_return || ticker.exp_return_20 || 0) * 100) === bestReturn ? '#10b981' : 
                             ((ticker.expected_return || ticker.exp_return_20 || 0) >= 0 ? '#1a1836' : '#ef4444')
                    }}>
                      {((ticker.expected_return || ticker.exp_return_20 || 0) * 100).toFixed(2)}%
                    </p>
                  </div>

                  <div style={{
                    padding: '0.75rem',
                    backgroundColor: 'white',
                    borderRadius: '8px'
                  }}>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Setor</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: '500', margin: 0, color: '#1a1836' }}>
                      {ticker.sector || '-'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Historical Performance Chart (Req 4.7) */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              marginBottom: '1rem', 
              color: '#1a1836',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <TrendingUp size={20} />
              Desempenho Histórico
            </h3>

            {loadingHistory ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '3rem',
                backgroundColor: '#f8fafc',
                borderRadius: '8px'
              }}>
                <Loader size={24} className="animate-spin" style={{ color: '#8b5cf6' }} />
                <span style={{ marginLeft: '0.5rem', color: '#64748b' }}>Carregando histórico...</span>
              </div>
            ) : historicalData.length === 0 ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                color: '#9895b0',
                fontSize: '0.85rem'
              }}>
                Histórico de desempenho não disponível via API.
              </div>
            ) : (
              <div style={{
                padding: '1rem',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      stroke="#cbd5e1"
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      stroke="#cbd5e1"
                      label={{ 
                        value: 'Retorno (%)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { fontSize: 12, fill: '#64748b' }
                      }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '0.875rem'
                      }}
                      formatter={(value) => `${value.toFixed(2)}%`}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '0.875rem' }}
                      iconType="line"
                    />
                    {tickers.map((ticker, idx) => {
                      // Generate distinct colors for each ticker
                      const colors = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                      return (
                        <Line
                          key={ticker.ticker}
                          type="monotone"
                          dataKey={ticker.ticker}
                          stroke={colors[idx % colors.length]}
                          strokeWidth={2}
                          dot={false}
                          name={ticker.ticker}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
                <p style={{ 
                  fontSize: '0.75rem', 
                  color: '#64748b', 
                  marginTop: '0.5rem',
                  textAlign: 'center'
                }}>
                  Retornos históricos dos últimos 90 dias
                </p>
              </div>
            )}
          </div>

          {/* Comparison Table (Req 4.5, 4.6, 4.7) */}
          <div>
            <h3 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              marginBottom: '1rem', 
              color: '#1a1836',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Activity size={20} />
              Comparação Detalhada
            </h3>
            
            <div style={{ 
              overflowX: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '8px'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th style={{ 
                      padding: '0.75rem', 
                      textAlign: 'left', 
                      fontSize: '0.875rem', 
                      fontWeight: '600',
                      color: '#64748b',
                      borderBottom: '2px solid #e2e8f0'
                    }}>
                      Métrica
                    </th>
                    {metrics.map((m, idx) => (
                      <th key={idx} style={{ 
                        padding: '0.75rem', 
                        textAlign: 'center', 
                        fontSize: '0.875rem', 
                        fontWeight: '600',
                        color: '#1a1836',
                        borderBottom: '2px solid #e2e8f0'
                      }}>
                        {m.ticker}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ 
                      padding: '0.75rem', 
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#64748b',
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      Score de Confiança
                    </td>
                    {metrics.map((m, idx) => (
                      <td key={idx} style={{ 
                        padding: '0.75rem', 
                        textAlign: 'center',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: m.score === bestScore ? '#10b981' : '#1a1836',
                        backgroundColor: m.score === bestScore ? '#f0fdf4' : 'transparent',
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        {m.score.toFixed(1)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ 
                      padding: '0.75rem', 
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#64748b',
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      Retorno Esperado
                    </td>
                    {metrics.map((m, idx) => (
                      <td key={idx} style={{ 
                        padding: '0.75rem', 
                        textAlign: 'center',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: m.expectedReturn === bestReturn ? '#10b981' : (m.expectedReturn >= 0 ? '#1a1836' : '#ef4444'),
                        backgroundColor: m.expectedReturn === bestReturn ? '#f0fdf4' : 'transparent',
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        {m.expectedReturn.toFixed(2)}%
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ 
                      padding: '0.75rem', 
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#64748b'
                    }}>
                      Setor
                    </td>
                    {metrics.map((m, idx) => (
                      <td key={idx} style={{ 
                        padding: '0.75rem', 
                        textAlign: 'center',
                        fontSize: '0.875rem',
                        color: '#64748b'
                      }}>
                        {m.sector}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#166534', margin: 0 }}>
              <strong>Destaque verde:</strong> Melhor valor na métrica
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonModal;
