import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiFetch } from '../hooks/useApi';
import { theme, badgeStyle } from '../styles';
import { Zap, Crown, Star, Check, ExternalLink, Sparkles, Loader2 } from 'lucide-react';

interface Props { dark?: boolean; }

const PLANS = [
  {
    key: 'free', name: 'Grátis', price: 'R$0', period: 'para sempre',
    icon: <Star size={22} />, color: theme.textSecondary,
    features: ['Scanner de mercados', '3 prévias de sinais/dia', '5 posições no portfólio', 'Histórico de 7 dias'],
  },
  {
    key: 'pro', name: 'Pro', price: '$29', period: '/mês',
    icon: <Zap size={22} />, color: theme.accent, popular: true,
    features: ['Tudo do Grátis', 'Sinais de IA ilimitados', 'Arbitragem cross-plataforma', 'Sentimento + artigos completos', '50 posições no portfólio', 'Análise de cenários', 'Histórico de 90 dias', 'Alertas por email'],
  },
  {
    key: 'quant', name: 'Quant', price: '$79', period: '/mês',
    icon: <Crown size={22} />, color: theme.yellow,
    features: ['Tudo do Pro', 'Alertas de Smart Money', 'Detecção de anomalias', 'Acesso à API', '500 posições no portfólio', 'Simulações Monte Carlo', 'Histórico ilimitado', 'Suporte prioritário'],
  },
];

export const BillingPage: React.FC<Props> = () => {
  const user = useAuthStore(s => s.user);
  const currentTier = user?.tier || 'free';
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (tier: string) => {
    setLoadingTier(tier);
    setError(null);
    if (!user?.email_verified) {
      setError('Verifique seu email antes de assinar um plano.');
      setLoadingTier(null);
      return;
    }
    try {
      const res = await apiFetch('/billing/checkout', { method: 'POST', body: JSON.stringify({ tier }) });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.detail) {
        setError(data.detail);
      } else {
        setError('Não foi possível iniciar o checkout. Tente novamente.');
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao conectar com o servidor.');
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManage = async () => {
    setLoadingTier('manage');
    setError(null);
    try {
      const res = await apiFetch('/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.detail || 'Não foi possível abrir o portal.');
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao conectar com o servidor.');
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, margin: '0 auto 1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: theme.accentBg, color: theme.accent,
          animation: 'float 3s ease-in-out infinite',
        }}><Sparkles size={24} /></div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          Escolha seu plano
        </h2>
        <p style={{ color: theme.textSecondary, fontSize: '0.9rem' }}>
          Desbloqueie inteligência para mercados de predição com IA
        </p>
      </div>

      {error && (
        <div style={{
          maxWidth: 960, margin: '0 auto 1.5rem', padding: '0.75rem 1rem',
          borderRadius: 12, background: theme.redBg, border: `1px solid ${theme.red}20`,
          color: theme.red, fontSize: '0.82rem', textAlign: 'center',
          animation: 'fadeIn 0.3s ease',
        }}>{error}</div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
        gap: 20, maxWidth: 960, margin: '0 auto',
      }}>
        {PLANS.map((plan, i) => {
          const isCurrent = currentTier === plan.key;
          const isUpgrade = !isCurrent && plan.key !== 'free';
          const isLoading = loadingTier === plan.key;
          return (
            <div key={plan.key} className="plan-card" style={{
              background: plan.popular
                ? `linear-gradient(180deg, ${theme.card} 0%, ${plan.color}06 100%)`
                : theme.card,
              border: `${plan.popular ? '2' : '1'}px solid ${plan.popular ? plan.color : theme.border}`,
              borderRadius: 20, padding: '2rem', position: 'relative',
              boxShadow: plan.popular ? `0 0 40px ${plan.color}12` : undefined,
              transition: 'all 0.35s ease',
              animation: `fadeIn 0.4s ease ${i * 0.1}s both`,
            }}>
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
                  color: '#fff', fontSize: '0.62rem', fontWeight: 700,
                  padding: '4px 16px', borderRadius: 12,
                  boxShadow: `0 4px 12px ${theme.accent}40`,
                }}>MAIS POPULAR</div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${plan.color}12`, color: plan.color,
                }}>{plan.icon}</div>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', display: 'block' }}>{plan.name}</span>
                  {isCurrent && <span style={badgeStyle(theme.green, theme.greenBg)}>ATUAL</span>}
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}>{plan.price}</span>
                <span style={{ fontSize: '0.9rem', color: theme.textSecondary, marginLeft: 4 }}>{plan.period}</span>
              </div>

              <div style={{
                height: 1, background: `linear-gradient(90deg, transparent, ${theme.border}, transparent)`,
                marginBottom: '1.5rem',
              }} />

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem' }}>
                {plan.features.map(f => (
                  <li key={f} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '5px 0', fontSize: '0.82rem', color: theme.textSecondary,
                  }}>
                    <Check size={15} color={plan.color} style={{ flexShrink: 0 }} /> {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button onClick={plan.key !== 'free' ? handleManage : undefined}
                  disabled={loadingTier === 'manage'}
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: 10,
                    border: `1px solid ${theme.border}`, background: 'transparent',
                    color: theme.textSecondary, fontSize: '0.85rem', fontWeight: 500,
                    cursor: plan.key !== 'free' ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'all 0.2s',
                    opacity: loadingTier === 'manage' ? 0.7 : 1,
                  }}>
                  {loadingTier === 'manage' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                  Plano atual {plan.key !== 'free' && <ExternalLink size={13} />}
                </button>
              ) : isUpgrade ? (
                <button onClick={() => handleUpgrade(plan.key)}
                  disabled={!!loadingTier}
                  className="landing-btn-primary" style={{
                    width: '100%', padding: '0.75rem', borderRadius: 10, border: 'none',
                    background: plan.popular
                      ? `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`
                      : plan.color,
                    color: '#fff', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                    boxShadow: plan.popular ? `0 4px 16px ${theme.accent}30` : undefined,
                    transition: 'all 0.25s ease',
                    opacity: isLoading ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {isLoading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
                  {isLoading ? 'Redirecionando...' : `Assinar ${plan.name}`}
                </button>
              ) : (
                <div style={{ height: 42 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
