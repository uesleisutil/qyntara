import React, { useState } from 'react';
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD } from '../../constants';

interface RetroactiveValidationProps {
  darkMode: boolean;
  theme: Record<string, string>;
  history: Record<string, { date: string; score: number; exp_return_20?: number }[]>;
  prices: Record<string, Record<string, number>>;
}

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const RetroactiveValidation: React.FC<RetroactiveValidationProps> = ({ darkMode, theme, history, prices }) => {
  const [expanded, setExpanded] = useState(false);

  if (!Object.keys(history).length || !Object.keys(prices).length) return null;

  // Get all prediction dates
  const allDates = new Set<string>();
  Object.values(history).forEach(entries => entries.forEach(e => allDates.add(e.date)));
  const sortedDates = Array.from(allDates).sort();

  // We want to show predictions from ~20 days ago and compare with today
  // Find dates that are at least 15 days old
  const today = new Date();
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - 15);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const oldDates = sortedDates.filter(d => d <= cutoffStr);
  if (oldDates.length === 0) return null;

  const targetDate = oldDates[oldDates.length - 1]; // most recent "old" date
  const latestPriceDate = sortedDates[sortedDates.length - 1];

  // Build validation rows
  const validations: {
    ticker: string; signal: string; score: number;
    priceAtPred: number; priceNow: number;
    actualReturn: number; predictedReturn: number;
    correct: boolean;
  }[] = [];

  Object.entries(history).forEach(([ticker, entries]) => {
    const entry = entries.find(e => e.date === targetDate);
    if (!entry) return;
    const tp = prices[ticker];
    if (!tp || !tp[targetDate] || !tp[latestPriceDate]) return;

    const priceAtPred = tp[targetDate];
    const priceNow = tp[latestPriceDate];
    const actualReturn = (priceNow - priceAtPred) / priceAtPred;
    const signal = entry.score >= SCORE_BUY_THRESHOLD ? 'Compra' : entry.score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';
    const correct = signal === 'Compra' ? actualReturn > 0 : signal === 'Venda' ? actualReturn < 0 : true;

    validations.push({
      ticker, signal, score: entry.score,
      priceAtPred, priceNow, actualReturn,
      predictedReturn: entry.exp_return_20 || 0,
      correct,
    });
  });

  if (validations.length === 0) return null;

  const buyValidations = validations.filter(v => v.signal === 'Compra');
  const sellValidations = validations.filter(v => v.signal === 'Venda');
  const buyCorrect = buyValidations.filter(v => v.correct).length;
  const sellCorrect = sellValidations.filter(v => v.correct).length;
  const totalCorrect = buyCorrect + sellCorrect;
  const totalSignals = buyValidations.length + sellValidations.length;
  const accuracy = totalSignals > 0 ? (totalCorrect / totalSignals) * 100 : 0;

  const daysAgo = Math.round((today.getTime() - new Date(targetDate + 'T12:00:00').getTime()) / 86400000);
  const topBuys = buyValidations.sort((a, b) => b.score - a.score).slice(0, 5);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12,
    padding: 'clamp(0.75rem, 3vw, 1rem)', marginBottom: '1rem',
  };

  return (
    <div style={cardStyle}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            🔍 O modelo acertou? — Validação de {daysAgo} dias atrás
          </div>
          <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: 2 }}>
            Previsões de {new Date(targetDate + 'T12:00:00').toLocaleDateString('pt-BR')} vs preços reais de hoje ·{' '}
            <span style={{ color: accuracy >= 60 ? '#10b981' : accuracy >= 45 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
              {fmt(accuracy, 0)}% de acerto
            </span>
            {' '}({totalCorrect}/{totalSignals} sinais)
          </div>
        </div>
        {expanded ? <ChevronUp size={16} color={theme.textSecondary} /> : <ChevronDown size={16} color={theme.textSecondary} />}
      </div>

      {expanded && (
        <div style={{ marginTop: '0.75rem' }}>
          {/* Summary KPIs */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
              Compra: <strong style={{ color: '#10b981' }}>{buyCorrect}/{buyValidations.length}</strong> acertaram
            </div>
            {sellValidations.length > 0 && (
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                Venda: <strong style={{ color: '#ef4444' }}>{sellCorrect}/{sellValidations.length}</strong> acertaram
              </div>
            )}
          </div>

          {/* Top buy validations */}
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: theme.textSecondary, marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Top sinais de Compra
          </div>
          {topBuys.map(v => (
            <div key={v.ticker} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0',
              borderBottom: `1px solid ${theme.border}`, fontSize: '0.78rem',
            }}>
              {v.correct
                ? <CheckCircle size={14} color="#10b981" />
                : <XCircle size={14} color="#ef4444" />
              }
              <span style={{ fontWeight: 600, color: theme.text, width: 50 }}>{v.ticker}</span>
              <span style={{ color: theme.textSecondary }}>Score {fmt(v.score, 1)}</span>
              <span style={{ color: theme.textSecondary }}>R$ {fmt(v.priceAtPred)} → R$ {fmt(v.priceNow)}</span>
              <span style={{
                marginLeft: 'auto', fontWeight: 600,
                color: v.actualReturn >= 0 ? '#10b981' : '#ef4444',
              }}>
                {v.actualReturn >= 0 ? '+' : ''}{fmt(v.actualReturn * 100, 1)}%
              </span>
            </div>
          ))}
          <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginTop: '0.5rem', lineHeight: 1.5 }}>
            Comparação entre o sinal emitido há {daysAgo} dias e o retorno real observado até hoje.
            Resultados passados não garantem resultados futuros.
          </div>
        </div>
      )}
    </div>
  );
};

export default RetroactiveValidation;
