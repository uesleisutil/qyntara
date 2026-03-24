import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Minus, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { getSignal, getSignalColor } from '../../constants';
import InfoTooltip from './InfoTooltip';

interface Props { darkMode: boolean; theme: Record<string, string>; }

interface RankDiff {
  ticker: string;
  currentRank: number;
  previousRank: number;
  diff: number;
  currentScore: number;
  previousScore: number;
  currentSignal: string;
  previousSignal: string;
}

const TemporalComparison: React.FC<Props> = ({ darkMode, theme }) => {
  const [diffs, setDiffs] = useState<RankDiff[]>([]);
  const [daysBack, setDaysBack] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const headers = { 'x-api-key': API_KEY };
        const res = await fetch(`${API_BASE_URL}/api/recommendations/history`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        const history: Record<string, { date: string; score: number }[]> = data.data || {};
        const allDates = new Set<string>();
        Object.values(history).forEach(entries => entries.forEach(e => allDates.add(e.date)));
        const sorted = Array.from(allDates).sort();
        setDates(sorted);
        if (sorted.length < 2) return;

        const todayDate = sorted[sorted.length - 1];
        const compareIdx = Math.max(0, sorted.length - 1 - daysBack);
        const compareDate = sorted[compareIdx];
        if (todayDate === compareDate) return;

        // Build rankings for both dates
        const todayScores: { ticker: string; score: number }[] = [];
        const compareScores: { ticker: string; score: number }[] = [];
        Object.entries(history).forEach(([ticker, entries]) => {
          const t = entries.find(e => e.date === todayDate);
          const c = entries.find(e => e.date === compareDate);
          if (t) todayScores.push({ ticker, score: t.score });
          if (c) compareScores.push({ ticker, score: c.score });
        });
        todayScores.sort((a, b) => b.score - a.score);
        compareScores.sort((a, b) => b.score - a.score);

        const todayRank: Record<string, number> = {};
        todayScores.forEach((s, i) => { todayRank[s.ticker] = i + 1; });
        const compareRank: Record<string, number> = {};
        compareScores.forEach((s, i) => { compareRank[s.ticker] = i + 1; });
        const compareScoreMap: Record<string, number> = {};
        compareScores.forEach(s => { compareScoreMap[s.ticker] = s.score; });

        const result: RankDiff[] = todayScores.map(s => ({
          ticker: s.ticker,
          currentRank: todayRank[s.ticker],
          previousRank: compareRank[s.ticker] || todayScores.length,
          diff: (compareRank[s.ticker] || todayScores.length) - todayRank[s.ticker],
          currentScore: s.score,
          previousScore: compareScoreMap[s.ticker] || 0,
          currentSignal: getSignal(s.score),
          previousSignal: getSignal(compareScoreMap[s.ticker] || 0),
        }));
        // Show biggest movers first
        result.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
        setDiffs(result.filter(d => d.diff !== 0));
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [daysBack]);

  if (loading || diffs.length === 0) return null;

  const visible = expanded ? diffs.slice(0, 20) : diffs.slice(0, 5);
  const maxDays = Math.min(dates.length - 1, 10);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a2626' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '0.75rem',
    marginBottom: '0.75rem',
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Calendar size={14} color="#5a9e87" />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>Comparação Temporal</span>
          <InfoTooltip text="Mostra como o ranking mudou em relação a dias anteriores. Setas indicam posições ganhas/perdidas." darkMode={darkMode} size={11} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {[1, 3, 5, 7].filter(d => d <= maxDays).map(d => (
            <button key={d} onClick={() => setDaysBack(d)} style={{
              padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
              border: `1px solid ${daysBack === d ? '#5a9e87' : theme.border}`,
              background: daysBack === d ? 'rgba(90,158,135,0.15)' : 'transparent',
              color: daysBack === d ? '#5a9e87' : theme.textSecondary, cursor: 'pointer',
            }}>
              {d}d
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {visible.map(d => {
          const sc = getSignalColor(d.currentSignal);
          return (
            <div key={d.ticker} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem',
              borderRadius: 8, background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              fontSize: '0.78rem',
            }}>
              <span style={{ fontWeight: 700, color: theme.text, minWidth: 50 }}>{d.ticker}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.15rem',
                padding: '0.1rem 0.35rem', borderRadius: 6, fontSize: '0.68rem', fontWeight: 600,
                background: sc.bg, color: sc.text,
              }}>
                {d.currentSignal}
              </span>
              <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>#{d.currentRank}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.1rem', marginLeft: 'auto',
                fontWeight: 600, fontSize: '0.75rem',
                color: d.diff > 0 ? '#4ead8a' : d.diff < 0 ? '#e07070' : '#8fa89c',
              }}>
                {d.diff > 0 ? <ArrowUp size={12} /> : d.diff < 0 ? <ArrowDown size={12} /> : <Minus size={12} />}
                {d.diff > 0 ? `+${d.diff}` : d.diff}
              </span>
            </div>
          );
        })}
      </div>
      {diffs.length > 5 && (
        <button onClick={() => setExpanded(!expanded)} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary,
          fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.2rem',
          marginTop: '0.4rem', padding: 0,
        }}>
          {expanded ? 'Menos' : `Ver todos (${diffs.length})`}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}
    </div>
  );
};

export default TemporalComparison;
