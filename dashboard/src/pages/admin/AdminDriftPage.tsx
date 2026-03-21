import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { DriftDetectionTab } from '../../components/driftDetection';

interface DashboardContext {
  darkMode: boolean;
  theme: Record<string, string>;
}

const AdminDriftPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Drift Detection</h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>
          Monitoramento de data drift, concept drift e degradação de performance.
        </p>
      </div>
      <DriftDetectionTab darkMode={darkMode} />
    </div>
  );
};

export default AdminDriftPage;
