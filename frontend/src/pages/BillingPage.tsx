import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiFetch } from '../hooks/useApi';
import { theme } from '../styles';
import { Zap, Crown, Star, Check, ExternalLink, Loader2 } from 'lucide-react';

interface Props { dark?: boolean; }

const PLANS = [
  { key: 'free', name: 'Grátis', price: 'R$0', period: '/sempre', color: theme.textMuted, icon: <Star size={18} />,
    features: ['Scanner de mercados', '3 sinais/dia', '5 posições', 'Sentimento básico'] },
  { key: 'pro', name: 'Pro', price: '$29', period: '/mês', color: theme.accent, icon: <Zap size={18} />, pop: true,
    features: ['Sinais ilimitados', 'Arbitragem', 'Sentimento completo', '50 posições', 'Cenários', 'Alertas email'] },
  { key: 'quant', name: 'Quant', price: '$79', period: '/mês', color: theme.yellow, icon: <Crown size={18} />,
    features: ['Tudo do Pro', 'Smart Money', 'API', '500 posições', 'Monte Carlo', 'Suporte prioritário'] },
];

export const BillingPage: React.FC<Props> = () => {
  const user = useAuthStore(s => s.user);
  const currentTier = user?.tier || 'free';
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (tier: string) => {
    setLoadingTier(tier); setError(null);
    if (!user?.email_verified) { setError('Verifique seu email antes de assinar.'); setLoadingTier(null); return; }
    try {
      const res = await apiFetch('/billing/checkout', { method: 'POST', body: JSON.stringify({ tier }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.detail || 'Erro ao iniciar checkout.');
    } catch { setError('Erro ao conectar.'); }
    finally { setLoadingTier(null); }
  };

  const handleManage = async () => {
    setLoadingTier('manage');
    try {
      const res = await apiFetch('/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    finally { setLoadingTier(null); }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Planos</h2>
        <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>Simples e transparente. Upgrade quando quiser.</p>
      </div>

      {error && (
        <div style={{ padding: '0.6rem 1rem', borderRadius: 10, background: `${theme.red}10`, border: `1px solid ${theme.red}20`, color: theme.red, fontSize: '0.78rem', marginBottom: '1.5rem' }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14, maxWidth: 860 }}>
        {PLANS.map(p => {
          const isCurrent = currentTier === p.key;
          const isUpgrade = !isCurrent && p.key !== 'free';
          const isLoading = loadingTier === p.key;
          return (
            <div key={p.key} style={{
              padding: '1.75rem', borderRadius: 14,
              border: `1px solid ${p.pop ? p.color : theme.border}`,
              background: theme.card, position: 'relative',
              transition: 'all 0.25s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
              {p.pop && <div style={{ position: 'absolute', top: -9, left: 16, background: p.color, color: '#fff', fontSize: '0.55rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: '0.05em' }}>POPULAR</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                <span style={{ color: p.color }}>{p.icon}</span>
                <span style={{ fontWeight: 700 }}>{p.name}</span>
                {isCurrent && <span style={{ fontSize: '0.55rem', fontWeight: 700, color: theme.green, background: `${theme.green}12`, padding: '2px 6px', borderRadius: 4, marginLeft: 'auto' }}>ATUAL</span>}
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>{p.price}</span>
                <span style={{ fontSize: '0.78rem', color: theme.textMuted }}>{p.period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem' }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: '0.78rem', color: theme.textSecondary }}>
                    <Check size={13} color={p.color} style={{ flexShrink: 0 }} /> {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button onClick={p.key !== 'free' ? handleManage : undefined} disabled={loadingTier === 'manage'} style={{
                  width: '100%', padding: '0.6rem', borderRadius: 8, border: `1px solid ${theme.border}`,
                  background: 'transparent', color: theme.textMuted, fontSize: '0.8rem', cursor: p.key !== 'free' ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>Plano atual {p.key !== 'free' && <ExternalLink size={12} />}</button>
              ) : isUpgrade ? (
                <button onClick={() => handleUpgrade(p.key)} disabled={!!loadingTier} style={{
                  width: '100%', padding: '0.6rem', borderRadius: 8, border: 'none',
                  background: p.pop ? p.color : theme.text, color: p.pop ? '#fff' : theme.bg,
                  fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: isLoading ? 0.7 : 1,
                }}>
                  {isLoading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                  {isLoading ? 'Redirecionando...' : `Assinar ${p.name}`}
                </button>
              ) : <div style={{ height: 36 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
