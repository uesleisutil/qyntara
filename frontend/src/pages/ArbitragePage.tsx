import React from 'react';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { UpgradeWall } from '../components/UpgradeWall';
import { theme } from '../styles';
import { GitCompare, ArrowRight, Lock } from 'lucide-react';

interface ArbOpp {
  polymarket: { id: string; question: string; yes_price: number };
  kalshi: { id: string; question: string; yes_price: number };
  spread: number; similarity: number; direction: string;
}

interface Props { dark: boolean; onAuthRequired: () => void; }

export const ArbitragePage: React.FC<Props> = ({ dark, onAuthRequired }) => {
  const user = useAuthStore(s => s.user);
  const tier = user?.tier || 'free';
  const isPro = tier === 'pro' || tier === 'quant' || tier === 'enterprise';
  const { data, loading } = useApi<{ opportunities: ArbOpp[] }>(isPro ? '/arbitrage' : '', isPro ? 30000 : undefined);

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Lock size={32} color={theme.textMuted} style={{ marginBottom: '1rem' }} />
        <p style={{ color: theme.textSecondary, marginBottom: '1rem' }}>Entre para acessar o Scanner de Arbitragem</p>
        <button onClick={onAuthRequired} style={{
          padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none',
          background: theme.accent, color: '#fff', fontWeight: 600, cursor: 'pointer',
        }}>Entrar</button>
      </div>
    );
  }

  if (!isPro) return <UpgradeWall requiredTier="pro" currentTier={tier} dark={dark} />;

  const opps = data?.opportunities || [];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
        <GitCompare size={18} color={theme.green} />
        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Arbitragem Cross-Plataforma</span>
      </div>
      <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '1rem', lineHeight: 1.5 }}>
        Mesmo evento com preços diferentes entre plataformas. Spread &gt; 3% = oportunidade de arbitragem.
      </p>

      {loading && !opps.length ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: theme.textMuted }}>Escaneando...</div>
      ) : opps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: theme.textMuted,
          background: theme.card, borderRadius: 12, border: `1px solid ${theme.border}` }}>
          Nenhuma oportunidade de arbitragem no momento. Os mercados estão precificados de forma eficiente.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opps.map((o, i) => (
            <div key={i} style={{
              padding: '1rem', background: theme.card, border: `1px solid ${theme.border}`,
              borderRadius: 10, borderLeft: `3px solid ${theme.green}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: theme.green }}>
                  +{(o.spread * 100).toFixed(1)}% spread
                </span>
                <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>Similaridade: {(o.similarity * 100).toFixed(0)}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, padding: '0.5rem 0.75rem', background: theme.bg, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.62rem', color: theme.purple, fontWeight: 600, marginBottom: 4 }}>🟣 POLYMARKET</div>
                  <div style={{ fontSize: '0.75rem', lineHeight: 1.3, marginBottom: 4 }}>{o.polymarket.question}</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{(o.polymarket.yes_price * 100).toFixed(1)}¢</div>
                </div>
                <ArrowRight size={16} color={theme.textMuted} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 200, padding: '0.5rem 0.75rem', background: theme.bg, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.62rem', color: theme.blue, fontWeight: 600, marginBottom: 4 }}>🔵 KALSHI</div>
                  <div style={{ fontSize: '0.75rem', lineHeight: 1.3, marginBottom: 4 }}>{o.kalshi.question}</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{(o.kalshi.yes_price * 100).toFixed(1)}¢</div>
                </div>
              </div>
              <div style={{ fontSize: '0.68rem', color: theme.textMuted, marginTop: 8 }}>
                Estratégia: Comprar YES no {o.direction === 'buy_poly' ? 'Polymarket' : 'Kalshi'} (mais barato)
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
