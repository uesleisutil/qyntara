import React, { useState } from 'react';
import { Crown, Lock, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { PRO_PRICE_LABEL } from '../../constants';

interface ProGateProps {
  children: React.ReactNode;
  feature?: string;
  darkMode?: boolean;
  inline?: boolean;
  storageKey?: string;
}

export const useIsPro = () => {
  const { user } = useAuth();
  return user?.plan === 'pro';
};

const ProGate: React.FC<ProGateProps> = ({ children, feature = 'Este recurso', darkMode = true, inline = false, storageKey }) => {
  const isPro = useIsPro();
  const dismissKey = storageKey || `b3tr_progate_dismissed_${feature.replace(/\s+/g, '_')}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKey) === 'true'; } catch { return false; }
  });

  if (isPro || dismissed) return <>{children}</>;

  const close = () => {
    setDismissed(true);
    try { localStorage.setItem(dismissKey, 'true'); } catch {}
  };

  if (inline) {
    return (
      <div style={{ position: 'relative', opacity: 0.5, pointerEvents: 'none', filter: 'blur(2px)' }}>
        {children}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)', borderRadius: 8, backdropFilter: 'blur(2px)',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0.3rem 0.6rem',
            borderRadius: 12, background: 'rgba(245,158,11,0.2)', color: '#f59e0b',
            fontSize: '0.7rem', fontWeight: 600,
          }}>
            <Lock size={12} /> Pro
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: darkMode ? '#1a1836' : 'white',
      border: `1px solid ${darkMode ? '#2a2745' : '#e2e8f0'}`,
      borderRadius: 16, padding: 'clamp(1.5rem, 4vw, 2.5rem)',
      textAlign: 'center', maxWidth: 480, margin: '2rem auto',
      position: 'relative',
    }}>
      <button onClick={close} style={{
        position: 'absolute', top: 12, right: 12, background: 'none', border: 'none',
        color: darkMode ? '#64748b' : '#9895b0', cursor: 'pointer', padding: 4,
      }} aria-label="Fechar">
        <X size={18} />
      </button>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 1rem', boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
      }}>
        <Crown size={28} color="white" />
      </div>
      <h2 style={{
        fontSize: 'clamp(1.1rem, 3vw, 1.3rem)', fontWeight: 700,
        color: darkMode ? '#f1f5f9' : '#0c0a1a', marginBottom: '0.5rem',
      }}>
        Recurso exclusivo Pro
      </h2>
      <p style={{
        fontSize: '0.85rem', color: darkMode ? '#9895b0' : '#64748b',
        lineHeight: 1.6, marginBottom: '1.5rem',
      }}>
        {feature} está disponível no plano Pro. Faça upgrade para desbloquear
        carteira modelo, stop-loss, ranking de confiança e muito mais.
      </p>
      <button onClick={() => window.location.hash = '#/dashboard/upgrade'} style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.7rem 1.5rem', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white',
        fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 4px 14px rgba(245,158,11,0.3)',
        transition: 'transform 0.15s, box-shadow 0.15s',
        WebkitAppearance: 'none', appearance: 'none',
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(245,158,11,0.4)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(245,158,11,0.3)'; }}
      >
        Fazer Upgrade <ArrowRight size={16} />
      </button>
      <p style={{ fontSize: '0.72rem', color: darkMode ? '#64748b' : '#9895b0', marginTop: '0.75rem' }}>
        A partir de {PRO_PRICE_LABEL} · Cancele quando quiser
      </p>
    </div>
  );
};

export const ProBadge: React.FC<{ small?: boolean }> = ({ small = false }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: small ? '0.1rem 0.35rem' : '0.15rem 0.5rem',
    borderRadius: 10, background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: 'white', fontSize: small ? '0.55rem' : '0.6rem', fontWeight: 700,
    letterSpacing: '0.03em', lineHeight: 1,
  }}>
    <Crown size={small ? 8 : 10} /> PRO
  </span>
);

export default ProGate;
