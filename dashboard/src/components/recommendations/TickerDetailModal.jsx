/**
 * TickerDetailModal Component
 * 
 * Modal que exibe detalhes da predição ao clicar em um ticker.
 * Mostra contribuição de cada modelo do ensemble.
 * 
 * Requirements: 10.7
 */

import React from 'react';
import { X, TrendingUp, BarChart3 } from 'lucide-react';

const TickerDetailModal = ({ ticker, onClose }) => {
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
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '600px',
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
          alignItems: 'center'
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
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Métricas principais */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
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
        </div>
      </div>
    </div>
  );
};

export default TickerDetailModal;
