import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { ExplainabilityTab } from '../../components/explainability';

interface DashboardContext {
  darkMode: boolean;
  theme: Record<string, string>;
}

const ExplainabilityPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Explicabilidade</h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>
          Entenda por que cada ação foi recomendada — SHAP values, análise de sensibilidade e impacto de features.
        </p>
      </div>
      <ExplainabilityTab darkMode={darkMode} />
    </div>
  );
};

export default ExplainabilityPage;
