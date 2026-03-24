import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, ArrowUp, ArrowDown } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD, getSignal, getSignalColor } from '../../constants';

interface Props { darkMode: boolean; theme: Record<string, string>; }
interface Change { ticker: string; prevSignal: string; newSignal: string; prevScore: number; newScore: number; }
interface RankDiff { ticker: string; currentRank: number; diff: number; currentSignal: string; }

const sigColor = (s: string) => s === 'Compra' ? '#10b981' : s === 'Venda' ? '#ef4444' : '#9895b0';
const SigIcon = ({ s, sz = 10 }: { s: string; sz?: number }) =>
  s === 'Compra' ? <ArrowUpRight size={sz} /> : s === 'Venda' ? <ArrowDownRight size={sz} /> : <Minus size={sz} />;

const SignalChangesDropdown: React.FC<Props> = ({ darkMode, theme }) => {
  const [changes, setChanges] = useState<Change[]>([]);
  const [diffs, setDiffs] = useState<RankDiff[]>([]);
  const [tab, setTab] = useState<'signals' | 'ranking'>('signals');
  const [daysBack, setDaysBack] = useState(1);
  const [maxDays, setMaxDays] = useState(1);
  const [history, setHistory] = useState<Record<string, { date: string; score: number }[]>>({});
  const [sortedDates, setSortedDates] = useState<string[]>([]);

  // Fetch once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/recommendations/history`, { headers: { 'x-api-key': API_KEY } });
        if (!res.ok) return;
        const data = await res.json();
        const h: Record<string, { date: string; score: number }[]> = data.data || {};
        const dates = new Set<string>();
        Object.values(h).forEach(entries => entries.forEach(e => dates.add(e.date)));
        const sorted = Array.from(dates).sort();
        setHistory(h);
        setSortedDates(sorted);
        setMaxDays(Math.min(sorted.length - 1, 10));

        if (sorted.length < 2) return;
        const today = sorted[sorted.length - 1];
        const yesterday = sorted[sorted.length - 2];
        const result: Change[] = [];
        Object.entries(h).forEach(([ticker, entries]) => {
          const t = entries.find(e => e.date === today);
          const y = entries.find(e => e.date === yesterday);
          if (!t || !y) return;
          const ns = t.score >= SCORE_BUY_THRESHOLD ? 'Compra' : t.score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';
          const ps = y.score >= SCORE_BUY_THRESHOLD ? 'Compra' : y.score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';
          if (ns !== ps) result.push({ ticker, prevSignal: ps, newSignal: ns, prevScore: y.score, newScore: t.score });
        });
        result.sort((a, b) => Math.abs(b.newScore - b.prevScore) - Math.abs(a.newScore - a.prevScore));
        setChanges(result);
        buildDiffs(h, sorted, 1);
      } catch {}
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildDiffs = (h: Record<string, { date: string; score: number }[]>, sorted: string[], days: number) => {
    const todayDate = sorted[sorted.length - 1];
    const cmpDate = sorted[Math.max(0, sorted.length - 1 - days)];
    if (todayDate === cmpDate) { setDiffs([]); return; }
    const todayS: { ticker: string; score: number }[] = [];
    const cmpS: { ticker: string; score: number }[] = [];
    Object.entries(h).forEach(([ticker, entries]) => {
      const t = entries.find(e => e.date === todayDate);
      const c = entries.find(e => e.date === cmpDate);
      if (t) todayS.push({ ticker, score: t.score });
      if (c) cmpS.push({ ticker, score: c.score });
    });
    todayS.sort((a, b) => b.score - a.score);
    cmpS.sort((a, b) => b.score - a.score);
    const tr: Record<string, number> = {}; todayS.forEach((s, i) => { tr[s.ticker] = i + 1; });
    const cr: Record<string, number> = {}; cmpS.forEach((s, i) => { cr[s.ticker] = i + 1; });
    const r: RankDiff[] = todayS.map(s => ({
      ticker: s.ticker, currentRank: tr[s.ticker],
      diff: (cr[s.ticker] || todayS.length) - tr[s.ticker],
      currentSignal: getSignal(s.score),
    })).filter(d => d.diff !== 0).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    setDiffs(r);
  };

  useEffect(() => {
    if (sortedDates.length > 1) buildDiffs(history, sortedDates, daysBack);
  }, [daysBack]); // eslint-disable-line react-hooks/exhaustive-deps

  if (changes.length === 0 && diffs.length === 0) {
    return <div style={{ textAlign: 'center', padding: '1rem', color: theme.textSecondary, fontSize: '0.78rem' }}>Sem novidades hoje.</div>;
  }

  const thS: React.CSSProperties = {
    padding: '0.35rem 0.5rem', fontSize: '0.68rem', fontWeight: 600,
    color: theme.textSecondary, textAlign: 'left', borderBottom: `1px solid ${theme.border}`,
  };
  const tdS: React.CSSProperties = {
    padding: '0.4rem 0.5rem', fontSize: '0.78rem',
    borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
  };
  const tabBtn = (id: 'signals' | 'ranking', label: string, count: number, color: string) => (
    <button key={id} onClick={() => setTab(id)} style={{
      padding: '0.3rem 0.6rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
      background: tab === id ? `${color}18` : 'transparent',
      border: `1px solid ${tab === id ? `${color}40` : 'transparent'}`,
      color: tab === id ? color : theme.textSecondary,
    }}>{label} ({count})</button>
  );

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
        {tabBtn('signals', 'Sinais', changes.length, '#f59e0b')}
        {tabBtn('ranking', 'Ranking', diffs.length, '#8b5cf6')}
      </div>

      {tab === 'signals' ? (
        changes.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.78rem' }}>Nenhuma mudança de sinal.</div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 190, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: theme.card || (darkMode ? '#1a1836' : '#ffffff'), zIndex: 1 }}>
                <tr>
                  <th style={thS}>Ação</th>
                  <th style={thS}>Anterior</th>
                  <th style={thS}></th>
                  <th style={thS}>Novo</th>
                  <th style={{ ...thS, textAlign: 'right' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {changes.map(c => (
                  <tr key={c.ticker}>
                    <td style={{ ...tdS, fontWeight: 700, color: theme.text }}>{c.ticker}</td>
                    <td style={tdS}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: sigColor(c.prevSignal), fontSize: '0.75rem' }}>
                        <SigIcon s={c.prevSignal} /> {c.prevSignal}
                      </span>
                    </td>
                    <td style={{ ...tdS, color: theme.textSecondary, fontSize: '0.7rem', textAlign: 'center' }}>→</td>
                    <td style={tdS}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: sigColor(c.newSignal), fontWeight: 600, fontSize: '0.75rem' }}>
                        <SigIcon s={c.newSignal} /> {c.newSignal}
                      </span>
                    </td>
                    <td style={{ ...tdS, textAlign: 'right', fontSize: '0.72rem', color: theme.textSecondary }}>
                      {c.prevScore.toFixed(1)} → {c.newScore.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.4rem' }}>
            {[1, 3, 5, 7].filter(d => d <= maxDays).map(d => (
              <button key={d} onClick={() => setDaysBack(d)} style={{
                padding: '0.15rem 0.45rem', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600,
                border: `1px solid ${daysBack === d ? '#8b5cf6' : theme.border}`,
                background: daysBack === d ? 'rgba(139,92,246,0.15)' : 'transparent',
                color: daysBack === d ? '#8b5cf6' : theme.textSecondary, cursor: 'pointer',
              }}>{d}d</button>
            ))}
          </div>
          {diffs.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.78rem' }}>Sem mudanças no ranking.</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 190, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: theme.card || (darkMode ? '#1a1836' : '#ffffff'), zIndex: 1 }}>
                  <tr>
                    <th style={thS}>Ação</th>
                    <th style={thS}>Sinal</th>
                    <th style={{ ...thS, textAlign: 'center' }}>#</th>
                    <th style={{ ...thS, textAlign: 'right' }}>Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {diffs.slice(0, 15).map(d => {
                    const sc = getSignalColor(d.currentSignal);
                    return (
                      <tr key={d.ticker}>
                        <td style={{ ...tdS, fontWeight: 700, color: theme.text }}>{d.ticker}</td>
                        <td style={tdS}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.08rem 0.35rem', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600, background: sc.bg, color: sc.text }}>
                            {d.currentSignal}
                          </span>
                        </td>
                        <td style={{ ...tdS, textAlign: 'center', fontSize: '0.75rem', color: theme.textSecondary }}>
                          {d.currentRank}
                        </td>
                        <td style={{ ...tdS, textAlign: 'right' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600, fontSize: '0.75rem', color: d.diff > 0 ? '#10b981' : '#ef4444' }}>
                            {d.diff > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                            {d.diff > 0 ? `+${d.diff}` : d.diff}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SignalChangesDropdown;
