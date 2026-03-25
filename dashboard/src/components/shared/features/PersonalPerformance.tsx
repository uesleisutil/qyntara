import React, { useState, useEffect } from 'react';
import { getFollowedPositions, FollowedPosition } from './FollowButton';
import { API_BASE_URL, API_KEY } from '../../../config';
import { fmt } from '../../../lib/formatters';

interface Props { darkMode: boolean; theme: Record<string, string>; }

const PersonalPerformance: React.FC<Props> = ({ theme }) => {
  const [positions, setPositions] = useState<FollowedPosition[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    setPositions(getFollowedPositions());
    const h = () => setPositions(getFollowedPositions());
    window.addEventListener('b3tr_follow_changed', h);
    return () => window.removeEventListener('b3tr_follow_changed', h);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } });
        if (!res.ok) return;
        const data = await res.json();
        const p: Record<string, number> = {};
        (data.recommendations || []).forEach((r: any) => { p[r.ticker] = r.last_close; });
        setPrices(p);
      } catch {}
    })();
  }, []);

  if (positions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem', color: theme.textSecondary, fontSize: '0.78rem' }}>
        Siga ações para ver sua performance.
      </div>
    );
  }

  const stats = positions.map(p => {
    const cur = prices[p.ticker] || p.entryPrice;
    return { ticker: p.ticker, ret: ((cur - p.entryPrice) / p.entryPrice) * 100, invested: 1000, current: 1000 * cur / p.entryPrice };
  });
  const winners = stats.filter(s => s.ret > 0).length;
  const winRate = (winners / stats.length) * 100;
  const totalPnl = stats.reduce((s, p) => s + p.current, 0) - stats.reduce((s, p) => s + p.invested, 0);

  const metric = (label: string, value: string, color: string) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {metric('P&L', `${totalPnl >= 0 ? '+' : ''}R$${Math.round(totalPnl)}`, totalPnl >= 0 ? '#10b981' : '#ef4444')}
      {metric('Win Rate', `${fmt(winRate, 0)}%`, winRate >= 55 ? '#10b981' : '#f59e0b')}
      {metric('Posições', `${winners}/${stats.length}`, theme.text)}
    </div>
  );
};

export default PersonalPerformance;
