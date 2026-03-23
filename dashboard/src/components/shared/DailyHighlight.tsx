import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD } from '../../constants';

interface Props {
  darkMode: boolean;
  theme: Record<string, string>;
  topTicker: { ticker: string; score: number; exp_return_20: number; last_close: number; pred_price_t_plus_20: number } | null;
  totalBuy: number;
  totalSell: number;
  totalNeutral: number;
  date: string;
  isPro?: boolean;
}

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const DailyHighlight: React.FC<Props> = ({ theme, topTicker, isPro = false }) => {
  if (!topTicker) return null;
  const signal = topTicker.score >= SCORE_BUY_THRESHOLD ? 'Compra' : topTicker.score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';
  const color = signal === 'Compra' ? '#10b981' : signal === 'Venda' ? '#ef4444' : '#f59e0b';
  const Icon = signal === 'Compra' ? ArrowUpRight : signal === 'Venda' ? ArrowDownRight : Minus;
  const retPct = topTicker.exp_return_20 * 100;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '1rem', flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={color} />
        </div>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: theme.text, letterSpacing: '-0.01em' }}>
            {topTicker.ticker}
          </div>
          <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
            <span style={{ color, fontWeight: 600 }}>{signal}</span> · Score {fmt(topTicker.score, 2)}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color, filter: isPro ? 'none' : 'blur(6px)', userSelect: isPro ? 'auto' : 'none' }}>
          {retPct >= 0 ? '+' : ''}{fmt(retPct, 1)}%
        </div>
        <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
          R$ {fmt(topTicker.last_close)} → <span style={{ filter: isPro ? 'none' : 'blur(6px)', userSelect: isPro ? 'auto' : 'none' }}>R$ {fmt(topTicker.pred_price_t_plus_20)}</span>
        </div>
      </div>
    </div>
  );
};

export default DailyHighlight;
