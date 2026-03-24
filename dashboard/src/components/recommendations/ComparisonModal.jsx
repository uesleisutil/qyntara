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
          borderBottom: '1px solid #d4e5dc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          zIndex: 1
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#1a2626' }}>
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
              color: '#5a7268'
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
                border: '2px solid #d4e5dc',
                borderRadius: '12px',
                backgroundColor: '#f6faf8'
              }}>
                <h3 style={{ 
                  margin: '0 0 1rem 0', 
                  fontSize: '1.25rem', 
                  fontWeight: 'bold', 
                  color: '#1a2626',
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
                      <BarChart3 size={14} color="#5a7268" />
                      <p style={{ fontSize: '0.75rem', color: '#5a7268', margin: 0 }}>Score</p>
                    </div>
                    <p style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 'bold', 
                      margin: 0,
                      color: (ticker.confidence_score || ticker.score || 0) === bestScore ? '#4ead8a' : '#1a2626'
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
                      <TrendingUp size={14} color="#5a7268" />
                      <p style={{ fontSize: '0.75rem', color: '#5a7268', margin: 0 }}>Retorno Esperado</p>
                    </div>
                    <p style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 'bold', 
                      margin: 0,
                      color: ((ticker.expected_return || ticker.exp_return_20 || 0) * 100) === bestReturn ? '#4ead8a' : 
                             ((ticker.expected_return || ticker.exp_return_20 || 0) >= 0 ? '#1a2626' : '#e07070')
                    }}>
                      {((ticker.expected_return || ticker.exp_return_20 || 0) * 100).toFixed(2)}%
                    </p>
                  </div>

                  <div style={{
                    padding: '0.75rem',
                    backgroundColor: 'white',
                    borderRadius: '8px'
                  }}>
                    <p style={{ fontSize: '0.75rem', color: '#5a7268', margin: '0 0 0.25rem 0' }}>Setor</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: '500', margin: 0, color: '#1a2626' }}>
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
              color: '#1a2626',
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
                backgroundColor: '#f6faf8',
                borderRadius: '8px'
              }}>
                <Loader size={24} className="animate-spin" style={{ color: '#5a9e87' }} />
                <span style={{ marginLeft: '0.5rem', color: '#5a7268' }}>Carregando histórico...</span>
              </div>
            ) : historicalData.length === 0 ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: '#f6faf8',
                borderRadius: '8px',
                color: '#8fa89c',
                fontSize: '0.85rem'
              }}>
                Histórico de desempenho não disponível via API.
              </div>
            ) : (
              <div style={{
                padding: '1rem',
                backgroundColor: '#f6faf8',
                borderRadius: '8px',
                border: '1px solid #d4e5dc'
              }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d4e5dc" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: '#5a7268' }}
                      stroke="#b0c8bc"
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: '#5a7268' }}
                      stroke="#b0c8bc"
                      label={{ 
                        value: 'Retorno (%)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { fontSize: 12, fill: '#5a7268' }
                      }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #d4e5dc',
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
                      const colors = ['#5a9e87', '#4ead8a', '#d4a84b', '#e07070', '#5a9e87'];
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
                  color: '#5a7268', 
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
              color: '#1a2626',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Activity size={20} />
              Comparação Detalhada
            </h3>
            
            <div style={{ 
              overflowX: 'auto',
              border: '1px solid #d4e5dc',
              borderRadius: '8px'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f6faf8' }}>
                  <tr>
                    <th style={{ 
                      padding: '0.75rem', 
                      textAlign: 'left', 
                      fontSize: '0.875rem', 
                      fontWeight: '600',
                      color: '#5a7268',
                      borderBottom: '2px solid #d4e5dc'
                    }}>
                      Métrica
                    </th>
                    {metrics.map((m, idx) => (
                      <th key={idx} style={{ 
                        padding: '0.75rem', 
                        textAlign: 'center', 
                        fontSize: '0.875rem', 
                        fontWeight: '600',
                        color: '#1a2626',
                        borderBottom: '2px solid #d4e5dc'
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
                      color: '#5a7268',
                      borderBottom: '1px solid #d4e5dc'
                    }}>
                      Score de Confiança
                    </td>
                    {metrics.map((m, idx) => (
                      <td key={idx} style={{ 
                        padding: '0.75rem', 
                        textAlign: 'center',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: m.score === bestScore ? '#4ead8a' : '#1a2626',
                        backgroundColor: m.score === bestScore ? '#edf5f1' : 'transparent',
                        borderBottom: '1px solid #d4e5dc'
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
                      color: '#5a7268',
                      borderBottom: '1px solid #d4e5dc'
                    }}>
                      Retorno Esperado
                    </td>
                    {metrics.map((m, idx) => (
                      <td key={idx} style={{ 
                        padding: '0.75rem', 
                        textAlign: 'center',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: m.expectedReturn === bestReturn ? '#4ead8a' : (m.expectedReturn >= 0 ? '#1a2626' : '#e07070'),
                        backgroundColor: m.expectedReturn === bestReturn ? '#edf5f1' : 'transparent',
                        borderBottom: '1px solid #d4e5dc'
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
                      color: '#5a7268'
                    }}>
                      Setor
                    </td>
                    {metrics.map((m, idx) => (
                      <td key={idx} style={{ 
                        padding: '0.75rem', 
                        textAlign: 'center',
                        fontSize: '0.875rem',
                        color: '#5a7268'
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
            backgroundColor: '#edf5f1',
            border: '1px solid #b0e8c8',
            borderRadius: '8px'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#1a5a3a', margin: 0 }}>
              <strong>Destaque verde:</strong> Melhor valor na métrica
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonModal;
