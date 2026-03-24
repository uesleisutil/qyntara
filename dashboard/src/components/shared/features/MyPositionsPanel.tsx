import React, { useState, useEffect, useCallback } from 'react';
import { Star, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { getFollowedPositions, setFollowedPositions, FollowedPosition } from './FollowButton';
import { API_BASE_URL, API_KEY } from '../../../config';
import { fmt } from '../../../lib/formatters';

interface Props { darkMode: boolean; theme: Record<string, string>; }

const MyPositionsPanel: React.FC<Props> = ({ darkMode, theme }) => {
  const [positions, setPositions] = useState<FollowedPosition[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const refresh = useCallback(() => setPositions(getFollowedPositions()), []);

  useEffect(() => {
    refresh();
    window.addEventListener('b3tr_follow_changed', refresh);
    return () => window.removeEventListener('b3tr_follow_changed', refresh);
  }, [refresh]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } });
        if (res.ok) {
          const data = await res.json();
          const p: Record<string, number> = {};
          (data.recommendations || []).forEach((r: any) => { p[r.ticker] = r.last_close; });
          setPrices(p);
        }
      } catch {}
    })();
  }, []);

  const remove = (ticker: string) => {
    const updated = positions.filter(p => p.ticker !== ticker);
    setFollowedPositions(updated);
    setPositions(updated);
    window.dispatchEvent(new Event('b3tr_follow_changed'));
  };

  if (positions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: theme.textSecondary, fontSize: '0.8rem' }}>
        Siga ações nas recomendações clicando em <Star size={11} fill="#f59e0b" color="#f59e0b" style={{ verticalAlign: 'middle' }} />
      </div>
    );
  }

  const totalInvested = positions.length * 1000;
  const totalCurrent = positions.reduce((s, p) => s + (1000 * (prices[p.ticker] || p.entryPrice) / p.entryPrice), 0);
  const totalPnl = totalCurrent - totalInvested;
  const totalPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const isUp = totalPnl >= 0;

  return (
    <div>
      {/* Total */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: isUp ? '#10b981' : '#ef4444', letterSpacing: '-0.02em' }}>
          {isUp ? '+' : ''}R$ {Math.round(totalPnl).toLocaleString('pt-BR')}
        </span>
        <span style={{
          fontSize: '0.75rem', fontWeight: 600, color: isUp ? '#10b981' : '#ef4444',
          padding: '0.1rem 0.4rem', borderRadius: 6, background: isUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        }}>
          {isUp ? '+' : ''}{fmt(totalPct, 1)}%
        </span>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {positions.map(p => {
          const cur = prices[p.ticker] || p.entryPrice;
          const ret = ((cur - p.entryPrice) / p.entryPrice) * 100;
          const up = ret >= 0;
          return (
            <div key={p.ticker} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.55rem 0.25rem', borderRadius: 6,
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: theme.text, minWidth: 52 }}>{p.ticker}</span>
              <span style={{ fontSize: '0.7rem', color: theme.textSecondary, flex: 1 }}>
                R$ {fmt(p.entryPrice)}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, minWidth: 65, textAlign: 'right' }}>
                R$ {fmt(cur)}
              </span>
              <span style={{
                fontSize: '0.75rem', fontWeight: 600, color: up ? '#10b981' : '#ef4444',
                minWidth: 52, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2,
              }}>
                {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {up ? '+' : ''}{fmt(ret, 1)}%
              </span>
              <button onClick={() => remove(p.ticker)} style={{
                background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer',
                padding: 2, opacity: 0, transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.color = theme.textSecondary; }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyPositionsPanel;
