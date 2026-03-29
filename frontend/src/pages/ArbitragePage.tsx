import React from 'react';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { Blurred } from '../components/Blurred';
import { theme, badgeStyle } from '../styles';
import { GitCompare, ArrowRight, Lock, Flame, TrendingUp, Zap } from 'lucide-react';

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
      <div style={{
        textAlign: 'center', padding: '4rem 2rem',
        background: theme.card, borderRadius: 20, border: `1px solid ${theme.border}`,
        animation: 'fadeIn 0.4s ease',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1.25rem',
          background: theme.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Lock size={28} color={theme.green} /></div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Scanner de Arbitragem</h3>
        <p style={{ color: theme.textSecondary, marginBottom: '1.5rem', fontSize: '0.85rem' }}>Entre para acessar o scanner de arbitragem cross-plataforma</p>
        <button onClick={onAuthRequired} style={{
          padding: '0.7rem 1.8rem', borderRadius: 10, border: 'none',
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
          color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
          boxShadow: `0 4px 16px ${theme.accent}30`,
        }}>Entrar</button>
      </div>
    );
  }

  if (!isPro) {
    return (
      <div style={{ animation: 'fadeIn 0.4s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
          <GitCompare size={20} color={theme.green} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Arbitragem Cross-Plataforma</h2>
          <span style={badgeStyle(theme.yellow, theme.yellowBg)}>PRO</span>
        </div>
        <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '1rem', lineHeight: 1.6 }}>
          Mesmo evento com preços diferentes entre plataformas. Spread &gt; 3% = oportunidade.
        </p>
        <Blurred locked label="Arbitragem requer plano Pro" height={300}>
          <div />
        </Blurred>
      </div>
    );
  }

  const opps = data?.opportunities || [];

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <GitCompare size={20} color={theme.green} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Arbitragem Cross-Plataforma</h2>
          </div>
          <p style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
            Mesmo evento com preços diferentes entre plataformas. Spread &gt; 3% = oportunidade.
          </p>
        </div>
        {opps.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 8, background: theme.greenBg, border: `1px solid ${theme.green}20`,
            animation: 'pulse 3s infinite',
          }}>
            <Zap size={13} color={theme.green} />
            <span style={{ fontSize: '0.7rem', color: theme.green, fontWeight: 600 }}>
              {opps.length} oportunidade{opps.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && !opps.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{
              height: 140, borderRadius: 16, border: `1px solid ${theme.border}`,
              background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`,
              backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.15}s`,
            }} />
          ))}
        </div>
      ) : opps.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem', color: theme.textMuted,
          background: theme.card, borderRadius: 20, border: `1px solid ${theme.border}`,
        }}>
          <GitCompare size={36} color={theme.textMuted} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: '0.95rem', marginBottom: 6 }}>Nenhuma oportunidade de arbitragem</p>
          <p style={{ fontSize: '0.78rem' }}>Os mercados estão precificados de forma eficiente no momento.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {opps.map((o, i) => {
            const spreadPct = (o.spread * 100);
            const isHot = spreadPct > 5;
            return (
              <ArbCard key={i} opp={o} index={i} spreadPct={spreadPct} isHot={isHot} />
            );
          })}
        </div>
      )}
    </div>
  );
};

const ArbCard: React.FC<{ opp: ArbOpp; index: number; spreadPct: number; isHot: boolean }> = ({ opp: o, index, spreadPct, isHot }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '1.25rem', borderRadius: 16,
        background: hovered ? theme.cardHover : theme.card,
        border: `1px solid ${hovered ? theme.borderHover : theme.border}`,
        borderLeft: `3px solid ${isHot ? theme.yellow : theme.green}`,
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? `0 12px 32px rgba(0,0,0,0.2)` : 'none',
        animation: `fadeIn 0.4s ease ${index * 0.1}s both`,
      }}
    >
      {/* Spread header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{
          fontSize: '1rem', fontWeight: 800, color: isHot ? theme.yellow : theme.green,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          +{spreadPct.toFixed(1)}% spread
          {isHot && <Flame size={14} style={{ animation: 'pulse 1.5s infinite' }} />}
        </span>
        <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>
          Similaridade: {(o.similarity * 100).toFixed(0)}%
        </span>
        {isHot && <span style={badgeStyle(theme.yellow, theme.yellowBg)}>QUENTE</span>}

        {/* Spread bar */}
        <div style={{ flex: 1, maxWidth: 120, height: 6, borderRadius: 3, background: theme.border, overflow: 'hidden', marginLeft: 'auto' }}>
          <div style={{
            width: `${Math.min(spreadPct * 10, 100)}%`, height: '100%', borderRadius: 3,
            background: `linear-gradient(90deg, ${theme.green}, ${isHot ? theme.yellow : theme.green})`,
            transition: 'width 0.8s ease',
            boxShadow: `0 0 8px ${isHot ? theme.yellow : theme.green}30`,
          }} />
        </div>
      </div>

      {/* Platforms */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: 200, padding: '0.75rem 1rem',
          background: theme.bg, borderRadius: 12,
          border: `1px solid ${theme.border}`,
          transition: 'border-color 0.2s',
          borderColor: hovered ? theme.purpleBg : theme.border,
        }}>
          <div style={{ fontSize: '0.62rem', color: theme.purple, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            🟣 POLYMARKET
          </div>
          <div style={{ fontSize: '0.78rem', lineHeight: 1.4, marginBottom: 6, color: theme.textSecondary }}>{o.polymarket.question}</div>
          <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{(o.polymarket.yes_price * 100).toFixed(1)}¢</div>
        </div>

        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: theme.accentBg, color: theme.accent,
          transition: 'transform 0.3s',
          transform: hovered ? 'scale(1.15) rotate(5deg)' : 'scale(1)',
        }}>
          <ArrowRight size={16} />
        </div>

        <div style={{
          flex: 1, minWidth: 200, padding: '0.75rem 1rem',
          background: theme.bg, borderRadius: 12,
          border: `1px solid ${theme.border}`,
          transition: 'border-color 0.2s',
          borderColor: hovered ? theme.blueBg : theme.border,
        }}>
          <div style={{ fontSize: '0.62rem', color: theme.blue, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            🔵 KALSHI
          </div>
          <div style={{ fontSize: '0.78rem', lineHeight: 1.4, marginBottom: 6, color: theme.textSecondary }}>{o.kalshi.question}</div>
          <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{(o.kalshi.yes_price * 100).toFixed(1)}¢</div>
        </div>
      </div>

      {/* Strategy */}
      <div style={{
        fontSize: '0.72rem', color: theme.textSecondary, marginTop: 12,
        padding: '8px 12px', borderRadius: 8, background: `${theme.green}08`,
        border: `1px solid ${theme.green}15`,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <TrendingUp size={12} color={theme.green} />
        Estratégia: Comprar YES no {o.direction === 'buy_poly' ? 'Polymarket' : 'Kalshi'} (mais barato)
      </div>
    </div>
  );
};
