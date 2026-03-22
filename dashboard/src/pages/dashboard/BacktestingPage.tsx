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
        <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>
          Simule estratégias com dados históricos, walk-forward analysis e métricas de risco.
        </p>
      </div>
      <BacktestingTab darkMode={darkMode} />
    </div>
  );
};

export default BacktestingPage;
