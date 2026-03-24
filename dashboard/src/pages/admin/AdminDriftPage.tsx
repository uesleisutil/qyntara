import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { DriftDetectionTab } from '../../components/admin/driftDetection';
import InfoTooltip from '../../components/shared/ui/InfoTooltip';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const AdminDriftPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1836' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12,
    padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>📊 Drift Detection</h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
          Monitoramento de data drift, concept drift e degradação de performance
          <InfoTooltip text="Drift é quando a distribuição dos dados muda ao longo do tempo, podendo degradar a performance do modelo. Monitore regularmente para decidir quando retreinar." darkMode={darkMode} size={12} />
        </p>
      </div>

      {/* How it works banner */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
        borderColor: darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
          💡 <strong style={{ color: theme.text }}>Como funciona:</strong> O sistema monitora três tipos de drift: <strong style={{ color: theme.text }}>Data Drift</strong> (mudança na distribuição das features), <strong style={{ color: theme.text }}>Concept Drift</strong> (mudança na relação features→target) e <strong style={{ color: theme.text }}>Degradação</strong> (queda nas métricas de performance). Quando detectado, recomendações de retreinamento são geradas automaticamente.
        </div>
      </div>

      <DriftDetectionTab darkMode={darkMode} />
    </div>
  );
};

export default AdminDriftPage;
