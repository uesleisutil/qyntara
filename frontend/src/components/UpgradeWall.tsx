import React from 'react';
import { Lock, Zap, Crown } from 'lucide-react';
import { apiFetch } from '../hooks/useApi';

interface Props {
  requiredTier: string;
  currentTier: string;
  dark: boolean;
}

const TIERS = [
  { key: 'pro', name: 'Pro', price: '$29/mo', icon: <Zap size={20} />, color: '#6366f1',
    features: ['Unlimited AI Signals', 'Cross-platform Arbitrage', 'Sentiment Analysis', '90-day History'] },
  { key: 'quant', name: 'Quant', price: '$79/mo', icon: <Crown size={20} />, color: '#f59e0b',
    features: ['Everything in Pro', 'Smart Money Alerts', 'Portfolio Risk Sim', 'API Access', 'Unlimited History'] },
];

export const UpgradeWall: React.FC<Props> = ({ requiredTier, currentTier, dark }) => {
  const bg = dark ? '#12141c' : '#fff';
  const border = dark ? '#1e2130' : '#e2e8f0';
  const textSec = dark ? '#8892a4' : '#64748b';

  const handleUpgrade = async (tier: string) => {
    try {
      const res = await apiFetch('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      console.error('Checkout error:', e);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '3rem 1.5rem', textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#6366f115', color: '#6366f1', marginBottom: '1rem',
      }}>
        <Lock size={24} />
      </div>

      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Upgrade to unlock
      </h3>
      <p style={{ fontSize: '0.82rem', color: textSec, marginBottom: '2rem', maxWidth: 400 }}>
        This feature requires {requiredTier} tier or above. You're currently on {currentTier}.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {TIERS.map(t => (
          <div key={t.key} style={{
            background: bg, border: `1px solid ${t.key === requiredTier ? t.color : border}`,
            borderRadius: 12, padding: '1.5rem', width: 240, textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
              <span style={{ color: t.color }}>{t.icon}</span>
              <span style={{ fontWeight: 700 }}>{t.name}</span>
              <span style={{ fontSize: '0.82rem', color: textSec, marginLeft: 'auto' }}>{t.price}</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0' }}>
              {t.features.map(f => (
                <li key={f} style={{ fontSize: '0.75rem', color: textSec, padding: '2px 0' }}>
                  ✓ {f}
                </li>
              ))}
            </ul>
            <button onClick={() => handleUpgrade(t.key)} style={{
              width: '100%', padding: '0.6rem', borderRadius: 8, border: 'none',
              background: t.color, color: '#fff', fontWeight: 600, fontSize: '0.82rem',
              cursor: 'pointer',
            }}>
              Upgrade to {t.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
