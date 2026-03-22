import React from 'react';
import { Trophy, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';

interface DailyHighlightProps {
  darkMode: boolean;
  theme: Record<string, string>;
  topTicker: { ticker: string; score: number; exp_return_20: number; last_close: number; pred_price_t_plus_20: number } | null;
  totalBuy: number;
  totalSell: number;
  totalNeutral: number;
  date: string;
}

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const DailyHighlight: React.FC<DailyHighlightProps> = ({ darkMode, theme, topTicker, totalBuy, totalSell, totalNeutral }) => {
  if (!topTicker) return null;

  const signal = topTicker.score >= 1.5 ? 'Compra' : topTicker.score <= -1.5 ? 'Venda' : 'Neutro';
  const signalColor = signal === 'Compra' ? '#10b981' : signal === 'Venda' ? '#ef4444' : '#f59e0b';
  const SignalIcon = signal === 'Compra' ? ArrowUpRight : signal === 'Venda' ? ArrowDownRight : Minus;

  return (
    <div data-tour="highlight-card" style={{
      background: darkMode
        ? 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.05))'
        : 'linear-gradient(135deg, rgba(59,130,246,0.04), rgba(139,92,246,0.02))',
      border: `1px solid ${darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)'}`,
      borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '0.75rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
    }}>
      {/* Trophy + Top ticker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 200px', minWidth: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Trophy size={18} color="white" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', color: theme.textSecondary }}>Destaque do dia</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: theme.text }}>{topTicker.ticker}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              padding: '0.1rem 0.4rem', borderRadius: 8, fontSize: '0.68rem', fontWeight: 600,
              background: `${signalColor}15`, color: signalColor,
            }}>
              <SignalIcon size={11} /> {signal}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6' }}>
              Score {fmt(topTicker.score, 2)}
            </span>
          </div>
        </div>
      </div>

      {/* Price prediction */}
      <div style={{ fontSize: '0.78rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        R$ {fmt(topTicker.last_close)} →{' '}
        <span style={{ color: topTicker.exp_return_20 >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
          R$ {fmt(topTicker.pred_price_t_plus_20)}
        </span>
        <span style={{
          fontSize: '0.72rem', fontWeight: 600,
          color: topTicker.exp_return_20 >= 0 ? '#10b981' : '#ef4444',
        }}>
          ({topTicker.exp_return_20 >= 0 ? '+' : ''}{fmt(topTicker.exp_return_20 * 100, 1)}%)
        </span>
      </div>

      {/* Summary counts */}
      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#10b981' }}>
          <TrendingUp size={12} /> {totalBuy}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#ef4444' }}>
          <TrendingDown size={12} /> {totalSell}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#f59e0b' }}>
          <Minus size={12} /> {totalNeutral}
        </span>
      </div>

      {/* CTA to explainability */}
      <a href={`#/dashboard/explainability`} style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
        fontSize: '0.72rem', fontWeight: 600, color: '#3b82f6',
        textDecoration: 'none', whiteSpace: 'nowrap',
      }}>
        Ver por quê <ChevronRight size={13} />
      </a>
    </div>
  );
};

export default DailyHighlight;
