import React from 'react';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { Blurred } from '../components/Blurred';
import { theme, badgeStyle } from '../styles';
import { TrendingUp, TrendingDown, Minus, Brain, Lock, Target, Flame } from 'lucide-react';

interface Signal {
  market_id: string; source: string; question: string; yes_price: number;
  volume_24h: number; signal_score: number; signal_type: string; direction: string;
}

interface Props { dark?: boolean; onAuthRequired: () => void; }

export const SignalsPage: React.FC<Props> = ({ onAuthRequired }) => {
  const user = useAuthStore(s => s.user);
  const tier = user?.tier || 'free';
  const isPro = tier === 'pro' || tier === 'quant' || tier === 'enterprise';

  const { data, loading, error } = useApi<{ signals: Signal[] }>(
    isPro ? '/signals?limit=30' : '/signals/preview', 30000
  );

  if (!user) {
    return (
      <div style={{
        textAlign: 'center', padding: '4rem 2rem',
        background: theme.card, borderRadius: 20, border: `1px solid ${theme.border}`,
        animation: 'fadeIn 0.4s ease',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1.25rem',
          background: theme.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Lock size={28} color={theme.accent} /></div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Sinais de IA</h3>
        <p style={{ color: theme.textSecondary, marginBottom: '1.5rem', fontSize: '0.85rem' }}>Entre para acessar os sinais de edge detection</p>
        <button onClick={onAuthRequired} style={{
          padding: '0.7rem 1.8rem', borderRadius: 10, border: 'none',
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
          color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
          boxShadow: `0 4px 16px ${theme.accent}30`,
        }}>Entrar</button>
      </div>
    );
  }

  if (error === 'upgrade_required' || (!isPro && data)) {
    return (
      <div style={{ animation: 'fadeIn 0.4s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
          <Brain size={20} color={theme.accent} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>AI Edge Finder</h2>
          <span style={badgeStyle(theme.yellow, theme.yellowBg)}>PRO</span>
        </div>
        <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '1rem', lineHeight: 1.6 }}>
          Mercados onde a IA detecta edge potencial — divergência de preço em relação à probabilidade estimada.
        </p>
        <Blurred locked label="Sinais de IA requerem plano Pro" height={300}>
          <div />
        </Blurred>
      </div>
    );
  }

  const signals = data?.signals || [];

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Brain size={20} color={theme.accent} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>AI Edge Finder</h2>
            {!isPro && <span style={badgeStyle(theme.yellow, theme.yellowBg)}>PRO</span>}
          </div>
          <p style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
            Mercados onde a IA detecta edge potencial — divergência de preço em relação à probabilidade estimada.
          </p>
        </div>
        {signals.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 8, background: theme.accentBg, border: `1px solid ${theme.accentBorder}`,
          }}>
            <Target size={13} color={theme.accent} />
            <span style={{ fontSize: '0.7rem', color: theme.accent, fontWeight: 600 }}>
              {signals.length} sinais ativos
            </span>
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && !signals.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{
              height: 72, borderRadius: 14, border: `1px solid ${theme.border}`,
              background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`,
              backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.1}s`,
            }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {signals.map((s, i) => {
            const dirColor = s.direction === 'YES' ? theme.green : s.direction === 'NO' ? theme.red : theme.yellow;
            const DirIcon = s.direction === 'YES' ? TrendingUp : s.direction === 'NO' ? TrendingDown : Minus;
            const score = s.signal_score != null ? Math.round(s.signal_score * 100) : null;
            const isStrong = score != null && score > 70;

            return (
              <SignalCard key={`${s.source}-${s.market_id || i}`}
                signal={s} index={i} dirColor={dirColor} DirIcon={DirIcon}
                score={score} isStrong={isStrong} />
            );
          })}
          {signals.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '4rem 2rem', color: theme.textMuted,
              background: theme.card, borderRadius: 16, border: `1px solid ${theme.border}`,
            }}>
              <Brain size={32} color={theme.textMuted} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontSize: '0.9rem', marginBottom: 4 }}>Nenhum sinal detectado agora</p>
              <p style={{ fontSize: '0.75rem' }}>A IA está analisando os mercados. Volte em breve.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SignalCard: React.FC<{
  signal: Signal; index: number; dirColor: string;
  DirIcon: React.FC<any>; score: number | null; isStrong: boolean;
}> = ({ signal: s, index, dirColor, DirIcon, score, isStrong }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '0.85rem 1.1rem',
        background: hovered ? theme.cardHover : theme.card,
        border: `1px solid ${hovered ? theme.borderHover : theme.border}`,
        borderRadius: 14,
        borderLeft: `3px solid ${dirColor}`,
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateX(4px)' : 'translateX(0)',
        animation: `fadeIn 0.35s ease ${Math.min(index * 0.06, 0.6)}s both`,
      }}
    >
      {/* Direction icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: `${dirColor}12`, color: dirColor,
        transition: 'transform 0.2s',
        transform: hovered ? 'scale(1.1)' : 'scale(1)',
      }}><DirIcon size={16} /></div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.83rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.question}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: '0.68rem', color: theme.textMuted }}>
          <span>{s.source}</span>
          {s.signal_type && <span>· {s.signal_type}</span>}
          {s.volume_24h ? <span>· {fmtVol(s.volume_24h)} 24h</span> : null}
          {isStrong && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 3,
              ...badgeStyle(theme.yellow, theme.yellowBg),
              animation: 'pulse 2s infinite',
            }}>
              <Flame size={8} /> FORTE
            </span>
          )}
        </div>
      </div>

      {/* Direction + Score */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: dirColor }}>{s.direction}</div>
        {score != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
            {/* Mini confidence bar */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: theme.border, overflow: 'hidden' }}>
              <div style={{
                width: `${score}%`, height: '100%', borderRadius: 2,
                background: `linear-gradient(90deg, ${dirColor}80, ${dirColor})`,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <span style={{ fontSize: '0.65rem', color: theme.textMuted }}>{score}</span>
          </div>
        )}
      </div>

      {/* Price */}
      {s.yes_price != null && (
        <div style={{
          fontSize: '0.82rem', fontWeight: 600, color: theme.textSecondary,
          flexShrink: 0, width: 50, textAlign: 'right',
        }}>
          {(s.yes_price * 100).toFixed(1)}¢
        </div>
      )}
    </div>
  );
};

function fmtVol(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
