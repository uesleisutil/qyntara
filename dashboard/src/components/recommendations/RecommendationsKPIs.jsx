/**
 * RecommendationsKPIs Component
 * 
 * Displays key performance indicators for recommendations:
 * - Total de ações recomendadas
 * - Retorno médio esperado
 * - Score médio de confiança
 * 
 * Requirements: 10.5
 */

import React from 'react';
import { TrendingUp, Target, Award } from 'lucide-react';

const RecommendationsKPIs = ({ recommendations }) => {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="kpis-grid">
        <div className="kpi-card">
          <p className="kpi-label">Carregando...</p>
        </div>
      </div>
    );
  }

  // Calcular métricas
  const totalRecommendations = recommendations.length;
  
  const avgExpectedReturn = recommendations.reduce((sum, rec) => {
    return sum + (rec.expected_return || rec.exp_return_20 || 0);
  }, 0) / totalRecommendations;
  
  const avgConfidenceScore = recommendations.reduce((sum, rec) => {
    return sum + (rec.confidence_score || rec.score || 0);
  }, 0) / totalRecommendations;

  return (
    <div className="kpis-grid" style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
      gap: '1rem',
      marginBottom: '1.5rem'
    }}>
      <div className="kpi-card" style={{
        padding: '1.5rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '8px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Award size={20} />
          <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total de Ações</p>
        </div>
        <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
          {totalRecommendations}
        </p>
      </div>

      <div className="kpi-card" style={{
        padding: '1.5rem',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        borderRadius: '8px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <TrendingUp size={20} />
          <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>Retorno Médio Esperado</p>
        </div>
        <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
          {(avgExpectedReturn * 100).toFixed(2)}%
        </p>
      </div>

      <div className="kpi-card" style={{
        padding: '1.5rem',
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        borderRadius: '8px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Target size={20} />
          <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>Score Médio de Confiança</p>
        </div>
        <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
          {avgConfidenceScore.toFixed(1)}
        </p>
      </div>
    </div>
  );
};

export default RecommendationsKPIs;
