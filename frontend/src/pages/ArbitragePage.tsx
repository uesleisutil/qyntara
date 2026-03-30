import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { Blurred } from '../components/Blurred';
import { theme } from '../styles';
import { GitCompare, ArrowRight, Lock, TrendingUp } from 'lucide-react';

interface ArbOpp {
  polymarket: { id: string; question: string; yes_price: number };
  kalshi: { id: string; question: string; yes_price: number };
  spread: number; similarity: number; direction: string;
}
interface Props { dark?: boolean; onAuthRequired: () => void; }

export const ArbitragePage: React.FC<Props> = ({ onAuthRequired }) => {
  const user = useAuthStore(s => s.user);
  const tier = user?.tier || 'free';
  const isPro = tier === 'pro' || tier === 'quant' || tier === 'enterprise';
  const { data, loading } = useApi<{ opportunities: ArbOpp[] }>(isPro ? '/arbitrage' : '', isPro ? 30000 : undefined);

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Lock size={24} color={theme.textMuted} style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>Arbitragem</h3>
        <p style={{ color: theme.textMuted, marginBottom: '1.5rem', fontSize: '0.82rem' }}>Entre para acessar</p>
        <button onClick={onAuthRequired} style={{
          padding: '0.65rem 1.5rem', borderRadius: 8, border: 'none',
          background: theme.text, color: theme.bg, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
        }}>Entrar</button>
      </div>
    );
  }

  if (!isPro) {
    return (
      <div>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Arbitragem</h2>
          <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>Cross-plataforma · Spread &gt; 3%</p>
        </div>
        <Blurred locked label="Arbitragem requer plano Pro" height={280}><div /></Blurred>
      </div>
    );
  }

  const opps = data?.opportunities || [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Arbitragem</h2>
          <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>{opps.length} oportunidade{opps.length !== 1 ? 's' : ''} · Cross-plataforma</p>
        </div>
      </div>

      {loading && !opps.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 120, borderRadius: 12, border: `1px solid ${theme.border}`, background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`, backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.1}s` }} />
          ))}
        </div>
      ) : opps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: theme.textMuted }}>
          <GitCompare size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
          <p style={{ fontSize: '0.85rem' }}>Mercados eficientes no momento. Sem arbitragem.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {opps.map((o, i) => <ArbRow key={i} o={o} i={i} />)}
        </div>
      )}
    </div>
  );
};

const ArbRow: React.FC<{ o: ArbOpp; i: number }> = ({ o, i }) => {
  const [hov, setHov] = useState(false);
  const spread = (o.spread * 100);
  const hot = spread > 5;

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      padding: '1.25rem', borderRadius: 12, border: `1px solid ${theme.border}`,
      background: hov ? theme.card : 'transparent', transition: 'all 0.2s',
      animation: `fadeIn 0.35s ease ${i * 0.08}s both`,
    }}>
      {/* Spread header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: hot ? theme.yellow : theme.green, letterSpacing: '-0.02em' }}>
          +{spread.toFixed(1)}%
        </span>
        <span style={{ fontSize: '0.65rem', color: theme.textMuted }}>spread</span>
        <span style={{ fontSize: '0.65rem', color: theme.textMuted }}>· {(o.similarity * 100).toFixed(0)}% similar</span>
        {/* Spread bar */}
        <div style={{ flex: 1, maxWidth: 100, height: 4, borderRadius: 2, background: theme.border, overflow: 'hidden', marginLeft: 'auto' }}>
          <div style={{ width: `${Math.min(spread * 10, 100)}%`, height: '100%', borderRadius: 2, background: hot ? theme.yellow : theme.green, transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* Platforms side by side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, padding: '0.75rem', borderRadius: 10, background: theme.bg, border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: '0.58rem', color: theme.purple, fontWeight: 700, marginBottom: 4, letterSpacing: '0.05em' }}>🟣 POLYMARKET</div>
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.35, marginBottom: 4 }}>{o.polymarket.question}</div>
          <div style={{ fontSize: '1rem', fontWeight: 800 }}>{(o.polymarket.yes_price * 100).toFixed(1)}¢</div>
        </div>
        <ArrowRight size={14} color={theme.textMuted} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, padding: '0.75rem', borderRadius: 10, background: theme.bg, border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: '0.58rem', color: theme.blue, fontWeight: 700, marginBottom: 4, letterSpacing: '0.05em' }}>🔵 KALSHI</div>
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.35, marginBottom: 4 }}>{o.kalshi.question}</div>
          <div style={{ fontSize: '1rem', fontWeight: 800 }}>{(o.kalshi.yes_price * 100).toFixed(1)}¢</div>
        </div>
      </div>

      {/* Strategy */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: '0.68rem', color: theme.textSecondary }}>
        <TrendingUp size={11} color={theme.green} />
        Comprar YES no {o.direction === 'buy_poly' ? 'Polymarket' : 'Kalshi'} (mais barato)
      </div>
    </div>
  );
};
