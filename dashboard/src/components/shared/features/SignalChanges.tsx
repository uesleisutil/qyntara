import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../../config';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD } from '../../../constants';
import InfoTooltip from '../ui/InfoTooltip';

interface SignalChangesProps {
  darkMode: boolean;
  theme: Record<string, string>;
}

interface Change {
  ticker: string;
  prevSignal: string;
  newSignal: string;
  prevScore: number;
  newScore: number;
}

const getSignal = (score: number) =>
  score >= SCORE_BUY_THRESHOLD ? 'Compra' : score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';

const signalColor = (s: string) =>
  s === 'Compra' ? '#10b981' : s === 'Venda' ? '#ef4444' : '#6b7280';

const SignalIcon: React.FC<{ signal: string }> = ({ signal }) =>
  signal === 'Compra' ? <ArrowUpRight size={12} /> : signal === 'Venda' ? <ArrowDownRight size={12} /> : <Minus size={12} />;

const SignalChanges: React.FC<SignalChangesProps> = ({ darkMode, theme }) => {
  const [changes, setChanges] = useState<Change[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const headers = { 'x-api-key': API_KEY };
        const res = await fetch(`${API_BASE_URL}/api/recommendations/history`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        const history: Record<string, { date: string; score: number }[]> = data.data || {};
        const allDates = new Set<string>();
        Object.values(history).forEach(entries => entries.forEach(e => allDates.add(e.date)));
        const sorted = Array.from(allDates).sort();
        if (sorted.length < 2) return;
        const today = sorted[sorted.length - 1];
        const yesterday = sorted[sorted.length - 2];

        const result: Change[] = [];
        Object.entries(history).forEach(([ticker, entries]) => {
          const todayEntry = entries.find(e => e.date === today);
          const yesterdayEntry = entries.find(e => e.date === yesterday);
          if (!todayEntry || !yesterdayEntry) return;
          const prevSignal = getSignal(yesterdayEntry.score);
          const newSignal = getSignal(todayEntry.score);
          if (prevSignal !== newSignal) {
            result.push({ ticker, prevSignal, newSignal, prevScore: yesterdayEntry.score, newScore: todayEntry.score });
          }
        });
        result.sort((a, b) => Math.abs(b.newScore - b.prevScore) - Math.abs(a.newScore - a.prevScore));
        setChanges(result);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return null;
  if (changes.length === 0) return null;

  const visible = expanded ? changes : changes.slice(0, 3);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1d27' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '0.75rem',
    marginBottom: '0.75rem',
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={14} color="#f59e0b" />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>
            Mudanças de Sinal Hoje
          </span>
          <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 8, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600 }}>
            {changes.length}
          </span>
          <InfoTooltip text="Ações que mudaram de sinal entre ontem e hoje. Ex: Neutro → Compra." darkMode={darkMode} size={11} />
        </div>
        {changes.length > 3 && (
          <button onClick={() => setExpanded(!expanded)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary,
            fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.2rem',
          }}>
            {expanded ? 'Menos' : `+${changes.length - 3} mais`}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {visible.map(c => (
          <div key={c.ticker} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem',
            borderRadius: 8, background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            fontSize: '0.78rem',
          }}>
            <span style={{ fontWeight: 700, color: theme.text, minWidth: 50 }}>{c.ticker}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', color: signalColor(c.prevSignal) }}>
              <SignalIcon signal={c.prevSignal} /> {c.prevSignal}
            </span>
            <span style={{ color: theme.textSecondary }}>→</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', color: signalColor(c.newSignal), fontWeight: 600 }}>
              <SignalIcon signal={c.newSignal} /> {c.newSignal}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: theme.textSecondary }}>
              {c.prevScore.toFixed(1)} → {c.newScore.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SignalChanges;
