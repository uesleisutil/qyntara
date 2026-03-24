import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Briefcase, Target } from 'lucide-react';
import CarteirasTab from '../../components/carteiras/CarteirasTab';
import PortfolioTab from '../../components/portfolio/PortfolioTab';
import ProGate from '../../components/shared/pro/ProGate';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

type SubTab = 'minhas' | 'modelo';

const CarteirasPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [subTab, setSubTab] = useState<SubTab>('minhas');

  const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: 'minhas', label: 'Minhas Carteiras', icon: <Briefcase size={16} /> },
    { key: 'modelo', label: 'Carteira Modelo', icon: <Target size={16} /> },
  ];

  return (
    <div style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: `1px solid ${theme?.border || '#2a2745'}`, paddingBottom: '0.75rem' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: subTab === t.key ? 600 : 400,
              background: subTab === t.key ? (darkMode ? '#2a2745' : '#ede9fe') : 'transparent',
              color: subTab === t.key ? (darkMode ? '#a78bfa' : '#7c3aed') : (theme?.textSecondary || '#9895b0'),
              transition: 'all 0.2s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {subTab === 'minhas' && <CarteirasTab darkMode={darkMode} />}
      {subTab === 'modelo' && (
        <ProGate feature="A Carteira Modelo" darkMode={darkMode}>
          <PortfolioTab darkMode={darkMode} />
        </ProGate>
      )}
    </div>
  );
};

export default CarteirasPage;
