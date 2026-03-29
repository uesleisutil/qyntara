import React from 'react';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { UpgradeWall } from '../components/UpgradeWall';
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

  const { data, loading, error } = useApi<{ opportunities: ArbOpp[] }>(
    isPro ? '/arbitrage' : '', isPro ? 30000 : undefined
  );

  const card = dark ? '#12141c' : '#fff';
  const border = dark ? '#1e2130' : '#e2e8f0';
  const textSec = dark ? '#8892a4' : '#64748b';

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Lock size={32} color={textSec} style={{ marginBottom: '1rem' }} />
        <p style={{ color: textSec, marginBottom: '1rem' }}>Sign in to access Arbitrage Scanner</p>
        <button onClick={onAuthRequired} style={{
          padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none',
          background: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer',
        }}>Sign in</button>
      </div>
    );
  }

  if (!isPro) {
    return <UpgradeWall requiredTier="pro" currentTier={tier} dark={dark} />;
  }

  const opps = data?.opportunities || [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
        <GitCompare size={18} color="#10b981" />
        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Cross-Platform Arbitrage</span>
      </div>
      <p style={{ fontSize: '0.78rem', color: textSec, marginBottom: '1rem', lineHeight: 1.5 }}>
        Same event priced differently across platforms. Spread &gt; 3% = potential arbitrage.
      </p>

      {loading && !opps.length ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: textSec }}>Scanning...</div>
      ) : opps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: textSec,
          background: card, borderRadius: 12, border: `1px solid ${border}` }}>
          No arbitrage opportunities right now. Markets are efficiently priced.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opps.map((o, i) => (
            <div key={i} style={{
              padding: '1rem', background: card, border: `1px solid ${border}`,
              borderRadius: 10, borderLeft: '3px solid #10b981',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#10b981' }}>
                  +{(o.spread * 100).toFixed(1)}% spread
                </span>
                <span style={{ fontSize: '0.68rem', color: textSec }}>Match: {(o.similarity * 100).toFixed(0)}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, padding: '0.5rem 0.75rem',
                  background: dark ? '#0f1017' : '#f8fafc', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.62rem', color: '#8b5cf6', fontWeight: 600, marginBottom: 4 }}>🟣 POLYMARKET</div>
                  <div style={{ fontSize: '0.75rem', lineHeight: 1.3, marginBottom: 4 }}>{o.polymarket.question}</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{(o.polymarket.yes_price * 100).toFixed(1)}¢</div>
                </div>
                <ArrowRight size={16} color={textSec} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 200, padding: '0.5rem 0.75rem',
                  background: dark ? '#0f1017' : '#f8fafc', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.62rem', color: '#3b82f6', fontWeight: 600, marginBottom: 4 }}>🔵 KALSHI</div>
                  <div style={{ fontSize: '0.75rem', lineHeight: 1.3, marginBottom: 4 }}>{o.kalshi.question}</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{(o.kalshi.yes_price * 100).toFixed(1)}¢</div>
                </div>
              </div>
              <div style={{ fontSize: '0.68rem', color: textSec, marginTop: 8 }}>
                Strategy: Buy YES on {o.direction === 'buy_poly' ? 'Polymarket' : 'Kalshi'} (cheaper)
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
