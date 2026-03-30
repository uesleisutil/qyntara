import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { Blurred } from '../components/Blurred';
import { theme } from '../styles';
import { TrendingUp, TrendingDown, Minus, Brain, Lock, AlertTriangle } from 'lucide-react';

interface Signal {
  market_id: string; source: string; question: string; yes_price: number;
  volume_24h: number; signal_score: number; signal_type: string; direction: string;
  ai_estimated_price?: number; edge?: number;
  is_anomaly?: boolean; anomaly_score?: number;
  category?: string;
}
interface Props { dark?: boolean; onAuthRequired: () => void; }

export const SignalsPage: React.FC<Props> = ({ onAuthRequired }) => {
  const user = useAuthStore(s => s.user);
  const tier = user?.tier || 'free';
  const isPro = tier === 'pro' || tier === 'quant' || tier === 'enterprise';
  const isQuant = tier === 'quant' || tier === 'enterprise';
  const { data, loading, error } = useApi<{ signals: Signal[] }>(isPro ? '/signals?limit=30' : '/signals/preview', 30000);

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Lock size={24} color={theme.textMuted} style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>Sinais de IA</h3>
        <p style={{ color: theme.textMuted, marginBottom: '1.5rem', fontSize: '0.82rem' }}>Entre para acessar</p>
        <button onClick={onAuthRequired} style={{
          padding: '0.65rem 1.5rem', borderRadius: 8, border: 'none',
          background: theme.text, color: theme.bg, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
        }}>Entrar</button>
      </div>
    );
  }

  if (error === 'upgrade_required' || (!isPro && data)) {
    const preview = data?.signals || [];
    const totalAvailable = (data as any)?.total_available || 0;
    return (
      <div>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Sinais de IA</h2>
          <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>
            Mostrando 3 de {totalAvailable} sinais · <span style={{ color: theme.accent }}>Upgrade pro Pro pra ver todos</span>
          </p>
        </div>

        {preview.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '1.5rem' }}>
            {preview.map((s: any, i: number) => {
              const color = s.direction === 'YES' ? theme.green : s.direction === 'NO' ? theme.red : theme.yellow;
              const Icon = s.direction === 'YES' ? TrendingUp : s.direction === 'NO' ? TrendingDown : Minus;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '0.7rem 1rem',
                  borderRadius: 10, borderLeft: `3px solid ${color}`, background: theme.card,
                }}>
                  <Icon size={15} color={color} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.question}</div>
                    <div style={{ fontSize: '0.62rem', color: theme.textMuted, marginTop: 2 }}>{s.source} {s.signal_type ? `· ${s.signal_type}` : ''}</div>
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color }}>{s.direction}</span>
                  <span aria-hidden style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none', fontSize: '0.75rem', color: theme.textMuted, width: 40, textAlign: 'right' }} onCopy={e => e.preventDefault()}>██</span>
                </div>
              );
            })}
          </div>
        ) : null}

        <Blurred locked label={`+${Math.max(0, totalAvailable - 3)} sinais disponíveis no Pro`} height={180}><div /></Blurred>
      </div>
    );
  }

  const signals = data?.signals || [];
  const hasAI = signals.some(s => s.signal_type === 'ai_edge');
  const anomalyCount = signals.filter(s => s.is_anomaly).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Sinais de IA</h2>
          <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>
            {signals.length} sinais ativos · {hasAI ? 'Modelo treinado' : 'Heurística'}
            {isQuant && anomalyCount > 0 && (
              <span style={{ color: theme.yellow, marginLeft: 8 }}>
                <AlertTriangle size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                {anomalyCount} anomalia{anomalyCount > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </div>

      {loading && !signals.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ height: 64, borderRadius: 10, border: `1px solid ${theme.border}`, background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`, backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.08}s` }} />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: theme.textMuted }}>
          <Brain size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
          <p style={{ fontSize: '0.85rem' }}>Nenhum sinal agora. A IA está analisando.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {signals.map((s, i) => <SignalRow key={`${s.source}-${s.market_id || i}`} s={s} i={i} isQuant={isQuant} />)}
        </div>
      )}
    </div>
  );
};

const SignalRow: React.FC<{ s: Signal; i: number; isQuant: boolean }> = ({ s, i, isQuant }) => {
  const [hov, setHov] = useState(false);
  const color = s.direction === 'YES' ? theme.green : s.direction === 'NO' ? theme.red : theme.yellow;
  const Icon = s.direction === 'YES' ? TrendingUp : s.direction === 'NO' ? TrendingDown : Minus;
  const score = s.signal_score != null ? Math.round(s.signal_score * 100) : null;
  const hasEdge = s.edge != null && s.ai_estimated_price != null;
  const edgePct = s.edge != null ? (s.edge * 100).toFixed(1) : null;

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '0.7rem 1rem',
      borderRadius: 10, borderLeft: `3px solid ${color}`,
      background: hov ? theme.card : 'transparent', transition: 'background 0.15s',
      animation: `fadeIn 0.3s ease ${Math.min(i * 0.04, 0.5)}s both`,
    }}>
      <Icon size={15} color={color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.question}</div>
        <div style={{ fontSize: '0.62rem', color: theme.textMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>{s.source}</span>
          {s.signal_type && <span>· {s.signal_type === 'ai_edge' ? 'IA' : s.signal_type}</span>}
          {hasEdge && (
            <>
              <span style={{ color: theme.accent }}>· Mercado {(s.yes_price * 100).toFixed(0)}¢</span>
              <span style={{ color: theme.cyan }}>→ IA {(s.ai_estimated_price! * 100).toFixed(0)}¢</span>
            </>
          )}
          {isQuant && s.is_anomaly && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: theme.yellow, fontWeight: 700 }}>
              <AlertTriangle size={9} /> Anomalia
            </span>
          )}
        </div>
      </div>

      {/* Edge badge */}
      {hasEdge && edgePct && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '2px 8px', borderRadius: 6,
          background: s.edge! > 0 ? theme.greenBg : theme.redBg,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: s.edge! > 0 ? theme.green : theme.red }}>
            {s.edge! > 0 ? '+' : ''}{edgePct}%
          </div>
          <div style={{ fontSize: '0.5rem', color: theme.textMuted }}>edge</div>
        </div>
      )}

      <span style={{ fontSize: '0.82rem', fontWeight: 700, color, flexShrink: 0 }}>{s.direction}</span>
      {score != null && (
        <div style={{ width: 36, flexShrink: 0 }}>
          <div style={{ height: 3, borderRadius: 2, background: theme.border, overflow: 'hidden' }}>
            <div style={{ width: `${score}%`, height: '100%', borderRadius: 2, background: color }} />
          </div>
          <div style={{ fontSize: '0.55rem', color: theme.textMuted, textAlign: 'right', marginTop: 2 }}>{score}</div>
        </div>
      )}
      {!hasEdge && s.yes_price != null && (
        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: theme.textSecondary, flexShrink: 0, width: 42, textAlign: 'right' }}>
          {(s.yes_price * 100).toFixed(1)}¢
        </span>
      )}
    </div>
  );
};
