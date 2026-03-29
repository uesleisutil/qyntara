import React from 'react';
import { useAuthStore } from '../store/authStore';
import { apiFetch } from '../hooks/useApi';
import { Zap, Crown, Star, Check, ExternalLink } from 'lucide-react';

interface Props { dark: boolean; }

const PLANS = [
  {
    key: 'free', name: 'Free', price: '$0', period: 'forever',
    icon: <Star size={20} />, color: '#6b7280',
    features: ['Market Scanner (all platforms)', '3 AI Signal previews/day', '5 portfolio positions', '7-day history'],
  },
  {
    key: 'pro', name: 'Pro', price: '$29', period: '/month',
    icon: <Zap size={20} />, color: '#6366f1', popular: true,
    features: ['Tudo do Grátis', 'Sinais de IA ilimitados', 'Arbitragem cross-plataforma', 'Análise de sentimento completa', '50 posições no portfólio', 'Análise de cenários', 'Histórico de 90 dias', 'Alertas por email'],
  },
  {
    key: 'quant', name: 'Quant', price: '$79', period: '/month',
    icon: <Crown size={20} />, color: '#f59e0b',
    features: ['Tudo do Pro', 'Alertas de Smart Money', 'Detecção de anomalias', 'Acesso à API', '500 posições no portfólio', 'Simulações Monte Carlo', 'Histórico ilimitado', 'Suporte prioritário'],
  },
];

export const BillingPage: React.FC<Props> = ({ dark }) => {
  const user = useAuthStore(s => s.user);
  const currentTier = user?.tier || 'free';

  const card = dark ? '#12141c' : '#fff';
  const border = dark ? '#1e2130' : '#e2e8f0';
  const textSec = dark ? '#8892a4' : '#64748b';

  const handleUpgrade = async (tier: string) => {
    const res = await apiFetch('/billing/checkout', { method: 'POST', body: JSON.stringify({ tier }) });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const handleManage = async () => {
    const res = await apiFetch('/billing/portal', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>Escolha seu plano</h2>
        <p style={{ color: textSec, fontSize: '0.85rem' }}>
          Desbloqueie inteligência para mercados de predição com IA
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
        {PLANS.map(plan => {
          const isCurrent = currentTier === plan.key;
          const isUpgrade = !isCurrent && plan.key !== 'free';
          return (
            <div key={plan.key} style={{
              background: card, border: `${plan.popular ? '2' : '1'}px solid ${plan.popular ? plan.color : border}`,
              borderRadius: 14, padding: '1.5rem', position: 'relative',
              boxShadow: plan.popular ? `0 0 20px ${plan.color}15` : undefined,
            }}>
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  background: plan.color, color: '#fff', fontSize: '0.62rem', fontWeight: 700,
                  padding: '2px 12px', borderRadius: 10,
                }}>MOST POPULAR</div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                <span style={{ color: plan.color }}>{plan.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{plan.name}</span>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 700 }}>{plan.price}</span>
                <span style={{ fontSize: '0.82rem', color: textSec }}>{plan.period}</span>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem 0' }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '0.78rem', color: textSec }}>
                    <Check size={14} color={plan.color} style={{ flexShrink: 0 }} /> {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button onClick={plan.key !== 'free' ? handleManage : undefined} style={{
                  width: '100%', padding: '0.65rem', borderRadius: 8,
                  border: `1px solid ${border}`, background: 'transparent',
                  color: textSec, fontSize: '0.82rem', cursor: plan.key !== 'free' ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  Plano atual {plan.key !== 'free' && <ExternalLink size={12} />}
                </button>
              ) : isUpgrade ? (
                <button onClick={() => handleUpgrade(plan.key)} style={{
                  width: '100%', padding: '0.65rem', borderRadius: 8, border: 'none',
                  background: plan.color, color: '#fff', fontWeight: 600,
                  fontSize: '0.82rem', cursor: 'pointer',
                }}>Assinar {plan.name}</button>
              ) : (
                <div style={{ height: 38 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
