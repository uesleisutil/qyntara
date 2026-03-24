import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { LineChart, Target } from 'lucide-react';
import PerformanceTab from '../../components/performance/PerformanceTab';
import TrackingTab from '../../components/tracking/TrackingTab';
import ProGate from '../../components/shared/pro/ProGate';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

type SubTab = 'overview' | 'tracking';

const PerformancePage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [subTab, setSubTab] = useState<SubTab>('overview');

  const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Visão Geral', icon: <LineChart size={16} /> },
    { key: 'tracking', label: 'Acompanhamento por Safra', icon: <Target size={16} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: `1px solid ${theme?.border || '#2a2e3a'}`, paddingBottom: '0.75rem' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: subTab === t.key ? 600 : 400,
              background: subTab === t.key ? (darkMode ? '#2a2e3a' : '#e8ebf0') : 'transparent',
              color: subTab === t.key ? (darkMode ? '#60a5fa' : '#2563eb') : (theme?.textSecondary || '#6b7280'),
              transition: 'all 0.2s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && <PerformanceTab darkMode={darkMode} />}
      {subTab === 'tracking' && (
        <ProGate feature="O Acompanhamento por Safra" darkMode={darkMode}>
          <TrackingTab darkMode={darkMode} />
        </ProGate>
      )}
    </div>
  );
};

export default PerformancePage;
