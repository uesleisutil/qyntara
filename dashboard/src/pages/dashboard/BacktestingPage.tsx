import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { BacktestingTab } from '../../components/backtesting';

interface DashboardContext {
  darkMode: boolean;
  theme: Record<string, string>;
}

const BacktestingPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Backtesting</h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.875rem', margin: 0 }}>
          Teste a estratégia do modelo com dados passados — veja quanto você teria ganho (ou perdido) e compare com o Ibovespa e CDI.
        </p>
      </div>
      <BacktestingTab darkMode={darkMode} />
    </div>
  );
};

export default BacktestingPage;
