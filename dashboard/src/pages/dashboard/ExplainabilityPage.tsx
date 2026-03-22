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
    <div style={{ overflow: 'hidden' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Explicabilidade</h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.875rem', margin: 0 }}>
          Entenda por que cada ação foi recomendada — veja quais indicadores mais pesaram na decisão do modelo e como eles influenciam a previsão de preço.
        </p>
      </div>
      <ExplainabilityTab darkMode={darkMode} />
    </div>
  );
};

export default ExplainabilityPage;
