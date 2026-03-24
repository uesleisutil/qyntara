import React, { useState } from 'react';
import { Columns, X, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import InfoTooltip from '../shared/InfoTooltip';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD } from '../../constants';

interface TickerData {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

interface StockComparatorProps {
  tickers: TickerData[];
  darkMode?: boolean;
}

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const StockComparator: React.FC<StockComparatorProps> = ({ tickers, darkMode = false }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const theme = {
    cardBg: darkMode ? '#1a2626' : 'white',
    text: darkMode ? '#e8f0ed' : '#121a1a',
    textSecondary: darkMode ? '#8fa89c' : '#5a7268',
    border: darkMode ? '#2a3d36' : '#d4e5dc',
  };

  const addTicker = (t: string) => {
    if (selected.length < 3 && !selected.includes(t)) setSelected([...selected, t]);
  };
  const removeTicker = (t: string) => setSelected(selected.filter(s => s !== t));

  const selectedData = selected.map(s => tickers.find(t => t.ticker === s)).filter(Boolean) as TickerData[];

  const getSignal = (score: number) => score >= SCORE_BUY_THRESHOLD ? 'Compra' : score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';
  const getColor = (score: number) => score >= SCORE_BUY_THRESHOLD ? '#4ead8a' : score <= SCORE_SELL_THRESHOLD ? '#e07070' : '#d4a84b';

  const metrics = [
    { label: 'Score', key: 'score', format: (v: number) => fmt(v, 2), color: (v: number) => getColor(v), tip: 'Score do modelo — quanto maior, mais forte o sinal de compra.' },
    { label: 'Sinal', key: 'signal', format: (_: number, d: TickerData) => getSignal(d.score), color: (_: number, d: TickerData) => getColor(d.score), tip: 'Sinal derivado do score.' },
    { label: 'Preço Atual', key: 'last_close', format: (v: number) => `R$ ${fmt(v)}`, color: () => theme.text, tip: 'Último preço de fechamento.' },
    { label: 'Preço Previsto', key: 'pred_price_t_plus_20', format: (v: number) => `R$ ${fmt(v)}`, color: () => theme.text, tip: 'Preço previsto pelo modelo em 20 pregões.' },
    { label: 'Retorno Previsto', key: 'exp_return_20', format: (v: number) => `${v >= 0 ? '+' : ''}${fmt(v * 100)}%`, color: (v: number) => v >= 0 ? '#4ead8a' : '#e07070', tip: 'Retorno esperado em 20 pregões.' },
    { label: 'Volatilidade', key: 'vol_20d', format: (v: number) => `${fmt(v * 100, 1)}%`, color: () => theme.textSecondary, tip: 'Volatilidade dos últimos 20 dias.' },
    { label: 'Risco/Retorno', key: 'rr', format: (_: number, d: TickerData) => d.vol_20d > 0 ? fmt(d.exp_return_20 / d.vol_20d, 2) : '—', color: (_: number, d: TickerData) => (d.vol_20d > 0 && d.exp_return_20 / d.vol_20d > 0.5) ? '#4ead8a' : '#d4a84b', tip: 'Razão retorno/volatilidade — quanto maior, melhor o risco-retorno.' },
  ];

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem',
        borderRadius: 8, border: `1px solid ${theme.border}`, background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
        color: '#5a9e87', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
        transition: 'all 0.2s', WebkitAppearance: 'none' as any,
      }}
        onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)'; }}
      >
        <Columns size={16} /> Comparar Ações
      </button>
    );
  }

  // Find best value for each metric to highlight
  const getBest = (key: string): string => {
    if (!selectedData.length) return '';
    if (key === 'score' || key === 'exp_return_20') {
      const best = selectedData.reduce((a, b) => ((a as any)[key] > (b as any)[key] ? a : b));
      return best.ticker;
    }
    if (key === 'vol_20d') {
      const best = selectedData.reduce((a, b) => (a.vol_20d < b.vol_20d ? a : b));
      return best.ticker;
    }
    if (key === 'rr') {
      const rr = (d: TickerData) => d.vol_20d > 0 ? d.exp_return_20 / d.vol_20d : -999;
      const best = selectedData.reduce((a, b) => (rr(a) > rr(b) ? a : b));
      return best.ticker;
    }
    return '';
  };

  return (
    <div style={{
      background: theme.cardBg, borderRadius: 12, padding: 'clamp(0.75rem, 3vw, 1.25rem)',
      border: `1px solid ${theme.border}`, marginBottom: '1.25rem',
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Columns size={18} color="#5a9e87" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: theme.text }}>Comparador de Ações</h3>
          <InfoTooltip text="Compare até 3 ações lado a lado para facilitar sua decisão. O melhor valor de cada métrica é destacado." darkMode={darkMode} size={12} />
        </div>
        <button onClick={() => { setOpen(false); setSelected([]); }} style={{
          background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', padding: 4,
          WebkitAppearance: 'none' as any,
        }}><X size={18} /></button>
      </div>

      {/* Ticker selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {selected.map(s => (
          <span key={s} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.3rem 0.6rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
            background: darkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
            color: '#5a9e87', border: '1px solid rgba(59,130,246,0.3)',
          }}>
            {s}
            <button onClick={() => removeTicker(s)} style={{
              background: 'none', border: 'none', color: '#5a9e87', cursor: 'pointer', padding: 0,
              display: 'flex', WebkitAppearance: 'none' as any,
            }}><X size={14} /></button>
          </span>
        ))}
        {selected.length < 3 && (
          <select
            value="" onChange={e => { if (e.target.value) addTicker(e.target.value); }}
            style={{
              padding: '0.35rem 0.6rem', borderRadius: 8, border: `1px solid ${theme.border}`,
              background: theme.cardBg, color: theme.text, fontSize: '0.82rem', cursor: 'pointer',
              WebkitAppearance: 'none' as any,
            }}
          >
            <option value="">+ Adicionar ação ({3 - selected.length} restante{3 - selected.length !== 1 ? 's' : ''})</option>
            {tickers.filter(t => !selected.includes(t.ticker)).map(t => (
              <option key={t.ticker} value={t.ticker}>{t.ticker} (Score: {fmt(t.score, 2)})</option>
            ))}
          </select>
        )}
      </div>

      {selectedData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: theme.textSecondary, fontSize: '0.85rem' }}>
          <Plus size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} /><br />
          Selecione 2 ou 3 ações acima para comparar lado a lado.
        </div>
      ) : selectedData.length === 1 ? (
        <div style={{ textAlign: 'center', padding: '1rem', color: theme.textSecondary, fontSize: '0.82rem' }}>
          Adicione mais uma ação para iniciar a comparação.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                <th style={{ padding: '0.5rem', textAlign: 'left', color: theme.textSecondary, fontWeight: 600, fontSize: '0.72rem' }}>Métrica</th>
                {selectedData.map(d => (
                  <th key={d.ticker} style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: theme.text, fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                      {d.ticker}
                      {d.score >= SCORE_BUY_THRESHOLD ? <ArrowUpRight size={14} color="#4ead8a" /> : d.score <= SCORE_SELL_THRESHOLD ? <ArrowDownRight size={14} color="#e07070" /> : null}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => {
                const best = getBest(m.key);
                return (
                  <tr key={m.key} style={{ borderBottom: `1px solid ${theme.border}`, background: i % 2 === 0 ? 'transparent' : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)') }}>
                    <td style={{ padding: '0.55rem 0.5rem', color: theme.textSecondary, fontWeight: 500, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      {m.label} <InfoTooltip text={m.tip} darkMode={darkMode} size={10} />
                    </td>
                    {selectedData.map(d => {
                      const val = (d as any)[m.key];
                      const colorFn = m.color as any;
                      const formatFn = m.format as any;
                      const isBest = best === d.ticker && selectedData.length > 1;
                      return (
                        <td key={d.ticker} style={{
                          padding: '0.55rem 0.5rem', textAlign: 'center', fontWeight: 600,
                          color: colorFn(val, d),
                          background: isBest ? (darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)') : 'transparent',
                          borderLeft: isBest ? '2px solid rgba(59,130,246,0.4)' : 'none',
                          borderRight: isBest ? '2px solid rgba(59,130,246,0.4)' : 'none',
                        }}>
                          {formatFn(val, d)}
                          {isBest && <span style={{ marginLeft: 4, fontSize: '0.65rem', color: '#5a9e87' }}>★</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Verdict */}
          {selectedData.length >= 2 && (() => {
            const sorted = [...selectedData].sort((a, b) => b.score - a.score);
            const winner = sorted[0];
            return (
              <div style={{
                marginTop: '0.75rem', padding: '0.75rem', borderRadius: 8,
                background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
                border: '1px solid rgba(59,130,246,0.2)',
                fontSize: '0.82rem', color: theme.textSecondary, lineHeight: 1.6,
              }}>
                🏆 <strong style={{ color: '#5a9e87' }}>{winner.ticker}</strong> tem o melhor score ({fmt(winner.score, 2)}) com retorno previsto de{' '}
                <strong style={{ color: winner.exp_return_20 >= 0 ? '#4ead8a' : '#e07070' }}>
                  {winner.exp_return_20 >= 0 ? '+' : ''}{fmt(winner.exp_return_20 * 100, 1)}%
                </strong> e volatilidade de {fmt(winner.vol_20d * 100, 1)}%.
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default StockComparator;
