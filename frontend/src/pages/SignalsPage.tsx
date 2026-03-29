import React from 'react';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { UpgradeWall } from '../components/UpgradeWall';
import { Zap, TrendingUp, TrendingDown, Minus, Brain, Lock } from 'lucide-react';

interface Signal {
  market_id: string; source: string; question: string; yes_price: number;
  volume_24h: number; signal_score: number; signal_type: string; direction: string;
}

interface Props { dark: boolean; onAuthRequired: () => void; }

export const SignalsPage: React.FC<Props> = ({ dark, onAuthRequired }) => {
  const user = useAuthStore(s => s.user);
  const tier = user?.tier || 'free';
  const isPro = tier === 'pro' || tier === 'quant' || tier === 'enterprise';

  const { data, loading, error } = useApi<{ signals: Signal[] }>(
    isPro ? '/signals?limit=30' : '/signals/preview', 30000
  );

  const card = dark ? '#12141c' : '#fff';
  const border = dark ? '#1e2130' : '#e2e8f0';
  const textSec = dark ? '#8892a4' : '#64748b';

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Lock size={32} color={textSec} style={{ marginBottom: '1rem' }} />
        <p style={{ color: textSec, marginBottom: '1rem' }}>Sign in to access AI Signals</p>
        <button onClick={onAuthRequired} style={{
          padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none',
          background: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer',
        }}>Sign in</button>
      </div>
    );
  }

  if (error === 'upgrade_required' || (!isPro && data)) {
    return <UpgradeWall requiredTier="pro" currentTier={tier} dark={dark} />;
  }

  const signals = data?.signals || [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
        <Brain size={18} color="#6366f1" />
        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>AI Edge Finder</span>
        {!isPro && (
          <span style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: 4,
            background: '#f59e0b20', color: '#f59e0b', fontWeight: 600 }}>PRO</span>
        )}
      </div>

      <p style={{ fontSize: '0.78rem', color: textSec, marginBottom: '1rem', lineHeight: 1.5 }}>
        Markets where AI detects potential edge — price divergence from estimated probability.
      </p>

      {loading && !signals.length ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: textSec }}>Analyzing markets...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {signals.map((s, i) => {
            const dirColor = s.direction === 'YES' ? '#10b981' : s.direction === 'NO' ? '#ef4444' : '#f59e0b';
            const DirIcon = s.direction === 'YES' ? TrendingUp : s.direction === 'NO' ? TrendingDown : Minus;
            return (
              <div key={`${s.source}-${s.market_id || i}`} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem',
                background: card, border: `1px solid ${border}`, borderRadius: 10,
                borderLeft: `3px solid ${dirColor}`,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: `${dirColor}15`, color: dirColor,
                }}><DirIcon size={14} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.question}</div>
                  <div style={{ fontSize: '0.68rem', color: textSec, marginTop: 2 }}>
                    {s.source} {s.signal_type ? `· ${s.signal_type}` : ''} {s.volume_24h ? `· $${fmtVol(s.volume_24h)} 24h` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: dirColor }}>{s.direction}</div>
                  {s.signal_score != null && (
                    <div style={{ fontSize: '0.65rem', color: textSec }}>Score: {(s.signal_score * 100).toFixed(0)}</div>
                  )}
                </div>
                {s.yes_price != null && (
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: textSec, flexShrink: 0, width: 50, textAlign: 'right' }}>
                    {(s.yes_price * 100).toFixed(1)}¢
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function fmtVol(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}
