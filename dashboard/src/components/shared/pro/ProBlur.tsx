import React, { useState } from 'react';
import { Lock, X, ArrowRight } from 'lucide-react';

interface Props {
  isPro: boolean;
  darkMode: boolean;
  label?: string;
  storageKey?: string;
  children: React.ReactNode;
}

const ProBlur: React.FC<Props> = ({ isPro, darkMode, label = 'Disponível no plano Pro', storageKey = 'b3tr_pro_blur_dismissed', children }) => {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true'; } catch { return false; }
  });

  if (isPro || dismissed) return <>{children}</>;

  const close = () => {
    setDismissed(true);
    try { localStorage.setItem(storageKey, 'true'); } catch {}
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </div>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
        background: darkMode ? 'rgba(15,23,42,0.6)' : 'rgba(248,250,252,0.6)',
        borderRadius: 12,
      }}>
        <div style={{
          textAlign: 'center', padding: '1.5rem 2rem', borderRadius: 12, position: 'relative',
          background: darkMode ? '#1e1b40' : '#ffffff',
          border: `1px solid ${darkMode ? '#363258' : '#e2e8f0'}`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          maxWidth: 320,
        }}>
          <button onClick={close} style={{
            position: 'absolute', top: 8, right: 8, background: 'none', border: 'none',
            color: darkMode ? '#64748b' : '#9895b0', cursor: 'pointer', padding: 2,
          }} aria-label="Fechar">
            <X size={16} />
          </button>
          <Lock size={24} color="#f59e0b" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0c0a1a', marginBottom: 4 }}>
            {label}
          </div>
          <div style={{ fontSize: '0.75rem', color: darkMode ? '#b8b5d0' : '#64748b', lineHeight: 1.5, marginBottom: 12 }}>
            Assine o plano Pro para desbloquear este conteúdo.
          </div>
          <button onClick={() => { window.location.hash = '#/dashboard/upgrade'; }} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '0.45rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white',
            fontSize: '0.78rem', fontWeight: 600,
          }}>
            Ver planos <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProBlur;
