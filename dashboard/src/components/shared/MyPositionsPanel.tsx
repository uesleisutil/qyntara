import React, { useState, useEffect, useCallback } from 'react';
import { Star, Trash2, TrendingUp, TrendingDown, Briefcase, Clock } from 'lucide-react';
import { getFollowedPositions, setFollowedPositions, FollowedPosition } from './FollowButton';
import InfoTooltip from './InfoTooltip';
import { API_BASE_URL, API_KEY } from '../../config';

interface MyPositionsPanelProps {
  darkMode: boolean;
  theme: Record<string, string>;
}

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const MyPositionsPanel: React.FC<MyPositionsPanelProps> = ({ darkMode, theme }) => {
  const [positions, setPositions] = useState<FollowedPosition[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const refresh = useCallback(() => {
    setPositions(getFollowedPositions());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('b3tr_follow_changed', refresh);
    return () => window.removeEventListener('b3tr_follow_changed', refresh);
  }, [refresh]);

  // Fetch current prices from recommendations
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, {
          headers: { 'x-api-key': API_KEY },
        });
        if (res.ok) {
          const data = await res.json();
          const prices: Record<string, number> = {};
          (data.recommendations || []).forEach((r: any) => { prices[r.ticker] = r.last_close; });
          setCurrentPrices(prices);
        }
      } catch { /* silent */ }
    })();
  }, []);

  const removePosition = (ticker: string) => {
    const updated = positions.filter(p => p.ticker !== ticker);
    setFollowedPositions(updated);
    setPositions(updated);
    window.dispatchEvent(new Event('b3tr_follow_changed'));
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1rem',
  };

  if (positions.length === 0) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '1.5rem' }}>
        <Briefcase size={28} color={theme.textSecondary} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: '0.3rem' }}>
          Nenhuma posição seguida
        </div>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary }}>
          Clique em <Star size={12} style={{ verticalAlign: 'middle' }} fill="#f59e0b" color="#f59e0b" /> nas recomendações para acompanhar ações e ver seu retorno pessoal aqui.
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalInvested = positions.length * 1000; // Simulated R$1000 per position
  const totalCurrent = positions.reduce((sum, p) => {
    const current = currentPrices[p.ticker] || p.entryPrice;
    return sum + (1000 * current / p.entryPrice);
  }, 0);
  const totalReturn = totalCurrent - totalInvested;
  const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  return (
    <div>
      {/* Summary card */}
      <div style={{
        ...cardStyle, marginBottom: '1rem',
        background: totalReturn >= 0
          ? (darkMode ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))' : 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.01))')
          : (darkMode ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))' : 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.01))'),
        border: `1px solid ${totalReturn >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Briefcase size={18} color={totalReturn >= 0 ? '#10b981' : '#ef4444'} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: theme.text }}>Suas Posições</span>
          <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 10, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 600 }}>
            {positions.length} ação{positions.length !== 1 ? 'ões' : ''}
          </span>
          <InfoTooltip text="Retorno simulado baseado no preço de entrada (quando você clicou 'Seguir') vs preço atual. Simulação com R$ 1.000 por posição." darkMode={darkMode} size={12} />
        </div>
        <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Clock size={10} /> Preços atualizados 1×/dia (fechamento). Variações intraday não são refletidas.
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: theme.textSecondary }}>
            R$ {totalInvested.toLocaleString('pt-BR')}
          </span>
          <span style={{ color: theme.textSecondary }}>→</span>
          <span style={{ fontSize: 'clamp(1.3rem, 4vw, 1.8rem)', fontWeight: 800, color: totalReturn >= 0 ? '#10b981' : '#ef4444' }}>
            R$ {Math.round(totalCurrent).toLocaleString('pt-BR')}
          </span>
          <span style={{
            padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
            background: totalReturn >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: totalReturn >= 0 ? '#10b981' : '#ef4444',
          }}>
            {totalReturn >= 0 ? '+' : ''}{fmt(totalReturnPct, 1)}%
          </span>
        </div>
      </div>

      {/* Positions list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {positions.map(p => {
          const current = currentPrices[p.ticker] || p.entryPrice;
          const ret = ((current - p.entryPrice) / p.entryPrice) * 100;
          const isUp = ret >= 0;
          return (
            <div key={p.ticker} style={{
              ...cardStyle, padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
              flexWrap: 'wrap', transition: 'background 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = theme.card || (darkMode ? '#1e293b' : '#fff'); }}
            >
              <Star size={16} fill="#f59e0b" color="#f59e0b" />
              <div style={{ flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text }}>{p.ticker}</div>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                  Entrada: R$ {fmt(p.entryPrice)} · {new Date(p.followedAt).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 80 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>
                  R$ {fmt(current)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', justifyContent: 'flex-end', fontSize: '0.75rem', fontWeight: 600, color: isUp ? '#10b981' : '#ef4444' }}>
                  {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {isUp ? '+' : ''}{fmt(ret, 1)}%
                </div>
              </div>
              <button onClick={() => removePosition(p.ticker)} title="Remover" style={{
                background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer',
                padding: 4, opacity: 0.5, transition: 'opacity 0.2s', WebkitAppearance: 'none' as any,
              }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = theme.textSecondary; }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyPositionsPanel;
