import React, { useState, useEffect } from 'react';
import { TrendingUp, Award, Target, BarChart3 } from 'lucide-react';
import { getFollowedPositions, FollowedPosition } from './FollowButton';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from './InfoTooltip';

interface Props { darkMode: boolean; theme: Record<string, string>; }

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const PersonalPerformance: React.FC<Props> = ({ darkMode, theme }) => {
  const [positions, setPositions] = useState<FollowedPosition[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    setPositions(getFollowedPositions());
    const handler = () => setPositions(getFollowedPositions());
    window.addEventListener('b3tr_follow_changed', handler);
    return () => window.removeEventListener('b3tr_follow_changed', handler);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, {
          headers: { 'x-api-key': API_KEY },
        });
        if (!res.ok) return;
        const data = await res.json();
        const p: Record<string, number> = {};
        (data.recommendations || []).forEach((r: any) => { p[r.ticker] = r.last_close; });
        setPrices(p);
      } catch { /* silent */ }
    })();
  }, []);

  if (positions.length === 0) return null;

  const stats = positions.map(p => {
    const current = prices[p.ticker] || p.entryPrice;
    const ret = ((current - p.entryPrice) / p.entryPrice) * 100;
    const days = Math.max(1, Math.round((Date.now() - new Date(p.followedAt).getTime()) / 86400000));
    return { ...p, current, ret, days };
  });

  const winners = stats.filter(s => s.ret > 0).length;
  const losers = stats.filter(s => s.ret < 0).length;
  const winRate = stats.length > 0 ? (winners / stats.length) * 100 : 0;
  const avgReturn = stats.reduce((s, p) => s + p.ret, 0) / stats.length;
  const best = stats.reduce((a, b) => a.ret > b.ret ? a : b);
  const worst = stats.reduce((a, b) => a.ret < b.ret ? a : b);
  const totalInvested = stats.length * 1000;
  const totalCurrent = stats.reduce((s, p) => s + (1000 * p.current / p.entryPrice), 0);
  const totalPnl = totalCurrent - totalInvested;

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '0.75rem',
    marginBottom: '0.75rem',
  };

  const metricBox = (label: string, value: string, color: string, icon: React.ReactNode) => (
    <div style={{
      flex: '1 1 100px', padding: '0.5rem', borderRadius: 8,
      background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: '0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
        <BarChart3 size={14} color="#3b82f6" />
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>Minha Performance</span>
        <InfoTooltip text="Resumo da performance das ações que você está seguindo. Baseado no preço de entrada vs preço atual." darkMode={darkMode} size={11} />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {metricBox('P&L Total', `${totalPnl >= 0 ? '+' : ''}R$ ${Math.round(totalPnl).toLocaleString('pt-BR')}`, totalPnl >= 0 ? '#10b981' : '#ef4444', <TrendingUp size={10} />)}
        {metricBox('Ret. Médio', `${avgReturn >= 0 ? '+' : ''}${fmt(avgReturn, 1)}%`, avgReturn >= 0 ? '#10b981' : '#ef4444', <Target size={10} />)}
        {metricBox('Win Rate', `${fmt(winRate, 0)}%`, winRate >= 50 ? '#10b981' : '#f59e0b', <Award size={10} />)}
        {metricBox('W/L', `${winners}/${losers}`, theme.text, <BarChart3 size={10} />)}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', flexWrap: 'wrap' }}>
        <span style={{ color: theme.textSecondary }}>
          Melhor: <strong style={{ color: '#10b981' }}>{best.ticker} +{fmt(best.ret, 1)}%</strong>
        </span>
        <span style={{ color: theme.textSecondary }}>
          Pior: <strong style={{ color: '#ef4444' }}>{worst.ticker} {fmt(worst.ret, 1)}%</strong>
        </span>
      </div>
    </div>
  );
};

export default PersonalPerformance;
