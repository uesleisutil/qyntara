import React from 'react';
import { theme } from '../styles';
import { Lock, Zap, Crown, Check } from 'lucide-react';
import { apiFetch } from '../hooks/useApi';

interface Props { requiredTier: string; currentTier: string; dark: boolean; }

const TIERS = [
  { key: 'pro', name: 'Pro', price: '$29/mês', icon: <Zap size={20} />, color: theme.accent,
    features: ['Sinais de IA ilimitados', 'Arbitragem cross-plataforma', 'Análise de sentimento completa', 'Histórico de 90 dias'] },
  { key: 'quant', name: 'Quant', price: '$79/mês', icon: <Crown size={20} />, color: theme.yellow,
    features: ['Tudo do Pro', 'Alertas de Smart Money', 'Simulação de risco do portfólio', 'Acesso à API', 'Histórico ilimitado'] },
];

export const UpgradeWall: React.FC<Props> = ({ requiredTier, currentTier, dark: _dark }) => {
  const handleUpgrade = async (tier: string) => {
    try {
      const res = await apiFetch('/billing/checkout', { method: 'POST', body: JSON.stringify({ tier }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) { console.error('Erro no checkout:', e); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1.5rem', textAlign: 'center' }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: theme.accentBg, color: theme.accent, marginBottom: '1rem',
      }}><Lock size={24} /></div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Faça upgrade para desbloquear</h3>
      <p style={{ fontSize: '0.82rem', color: theme.textSecondary, marginBottom: '2rem', maxWidth: 400 }}>
        Este recurso requer o plano {requiredTier} ou superior. Você está no plano {currentTier}.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {TIERS.map(t => (
          <div key={t.key} style={{
            background: theme.card, border: `1px solid ${t.key === requiredTier ? t.color : theme.border}`,
            borderRadius: 12, padding: '1.5rem', width: 240, textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
              <span style={{ color: t.color }}>{t.icon}</span>
              <span style={{ fontWeight: 700 }}>{t.name}</span>
              <span style={{ fontSize: '0.82rem', color: theme.textSecondary, marginLeft: 'auto' }}>{t.price}</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0' }}>
              {t.features.map(f => (
                <li key={f} style={{ fontSize: '0.75rem', color: theme.textSecondary, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={12} color={t.color} /> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => handleUpgrade(t.key)} style={{
              width: '100%', padding: '0.6rem', borderRadius: 8, border: 'none',
              background: t.color, color: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
            }}>Assinar {t.name}</button>
          </div>
        ))}
      </div>
    </div>
  );
};
