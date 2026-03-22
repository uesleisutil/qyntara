import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, ArrowUp, ArrowDown, X, Zap, Calendar } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD, getSignal, getSignalColor } from '../../constants';

interface Props { darkMode: boolean; theme: Record<string, string>; }

interface Change { ticker: string; prevSignal: string; newSignal: string; prevScore: number; newScore: number; }
interface RankDiff { ticker: string; currentRank: number; diff: number; currentSignal: string; }

const DISMISSED_KEY = 'b3tr_signal_changes_dismissed';

const signalColor = (s: string) => s === 'Compra' ? '#10b981' : s === 'Venda' ? '#ef4444' : '#94a3b8';

const SignalChangesDropdown: React.FC<Props> = ({ darkMode, theme }) => {
  const [changes, setChanges] = useState<Change[]>([]);
  const [diffs, setDiffs] = useState<RankDiff[]>([]);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [tab, setTab] = useState<'signals' | 'ranking'>('signals');
  const [daysBack, setDaysBack] = useState(1);
  const [maxDays, setMaxDays] = useState(1);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch signal changes
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
        setMaxDays(Math.min(sorted.length - 1, 10));
        if (sorted.length < 2) return;
        const today = sorted[sorted.length - 1];
        const yesterday = sorted[sorted.length - 2];

        // Check if already dismissed for today
        const dismissedDate = localStorage.getItem(DISMISSED_KEY);
        if (dismissedDate === today) setDismissed(true);

        // Signal changes
        const result: Change[] = [];
        Object.entries(history).forEach(([ticker, entries]) => {
          const todayEntry = entries.find(e => e.date === today);
          const yesterdayEntry = entries.find(e => e.date === yesterday);
          if (!todayEntry || !yesterdayEntry) return;
          const prevSig = todayEntry.score >= SCORE_BUY_THRESHOLD ? 'Compra' : todayEntry.score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';
          const prevSigY = yesterdayEntry.score >= SCORE_BUY_THRESHOLD ? 'Compra' : yesterdayEntry.score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';
          if (prevSig !== prevSigY) {
            result.push({ ticker, prevSignal: prevSigY, newSignal: prevSig, prevScore: yesterdayEntry.score, newScore: todayEntry.score });
          }
        });
        result.sort((a, b) => Math.abs(b.newScore - b.prevScore) - Math.abs(a.newScore - a.prevScore));
        setChanges(result);

        // Ranking diffs
        buildRankingDiffs(history, sorted, 1);
      } catch { /* silent */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildRankingDiffs = (history: Record<string, { date: string; score: number }[]>, sorted: string[], days: number) => {
    const todayDate = sorted[sorted.length - 1];
    const compareIdx = Math.max(0, sorted.length - 1 - days);
    const compareDate = sorted[compareIdx];
    if (todayDate === compareDate) { setDiffs([]); return; }

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

    const result: RankDiff[] = todayScores.map(s => ({
      ticker: s.ticker,
      currentRank: todayRank[s.ticker],
      diff: (compareRank[s.ticker] || todayScores.length) - todayRank[s.ticker],
      currentSignal: getSignal(s.score),
    })).filter(d => d.diff !== 0).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    setDiffs(result);
  };

  // Refetch ranking when daysBack changes
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
        buildRankingDiffs(history, sorted, daysBack);
      } catch {}
    })();
  }, [daysBack]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleDismiss = () => {
    setDismissed(true);
    setOpen(false);
    // Store today's date so it doesn't show again today
    const now = new Date().toISOString().slice(0, 10);
    localStorage.setItem(DISMISSED_KEY, now);
  };

  // Don't render if no changes at all
  if (changes.length === 0 && diffs.length === 0) return null;

  const hasNews = changes.length > 0 && !dismissed;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', marginBottom: '0.75rem' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
        padding: '0.4rem 0.75rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
        background: hasNews ? 'rgba(245,158,11,0.12)' : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
        border: `1px solid ${hasNews ? 'rgba(245,158,11,0.3)' : theme.border}`,
        color: hasNews ? '#f59e0b' : theme.textSecondary,
        cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
      }}>
        <Zap size={13} />
        Novidades
        {hasNews && (
          <span style={{
            width: 18, height: 18, borderRadius: '50%', background: '#f59e0b', color: '#0f172a',
            fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{changes.length}</span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', left: 0, top: '100%', marginTop: 6, zIndex: 99,
            width: 'min(380px, 90vw)', background: theme.card || (darkMode ? '#1e293b' : '#fff'),
            border: `1px solid ${theme.border}`, borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={() => setTab('signals')} style={{
                  padding: '0.3rem 0.6rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                  background: tab === 'signals' ? 'rgba(245,158,11,0.15)' : 'transparent',
                  border: `1px solid ${tab === 'signals' ? 'rgba(245,158,11,0.3)' : 'transparent'}`,
                  color: tab === 'signals' ? '#f59e0b' : theme.textSecondary,
                  display: 'flex', alignItems: 'center', gap: '0.2rem',
                }}>
                  <Zap size={11} /> Sinais ({changes.length})
                </button>
                <button onClick={() => setTab('ranking')} style={{
                  padding: '0.3rem 0.6rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                  background: tab === 'ranking' ? 'rgba(139,92,246,0.15)' : 'transparent',
                  border: `1px solid ${tab === 'ranking' ? 'rgba(139,92,246,0.3)' : 'transparent'}`,
                  color: tab === 'ranking' ? '#8b5cf6' : theme.textSecondary,
                  display: 'flex', alignItems: 'center', gap: '0.2rem',
                }}>
                  <Calendar size={11} /> Ranking
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {hasNews && (
                  <button onClick={handleDismiss} style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.65rem',
                    color: theme.textSecondary, padding: '0.2rem 0.4rem',
                  }}>Dispensar</button>
                )}
                <button onClick={() => setOpen(false)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary, padding: 2,
                }}><X size={14} /></button>
              </div>
            </div>

            {/* Content */}
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: '0.5rem' }}>
              {tab === 'signals' ? (
                changes.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.8rem' }}>
                    Nenhuma mudança de sinal hoje.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {changes.map(c => (
                      <div key={c.ticker} style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.5rem',
                        borderRadius: 6, fontSize: '0.78rem',
                        background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      }}>
                        <span style={{ fontWeight: 700, color: theme.text, minWidth: 48 }}>{c.ticker}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.1rem', color: signalColor(c.prevSignal), fontSize: '0.72rem' }}>
                          {c.prevSignal === 'Compra' ? <ArrowUpRight size={10} /> : c.prevSignal === 'Venda' ? <ArrowDownRight size={10} /> : <Minus size={10} />}
                          {c.prevSignal}
                        </span>
                        <span style={{ color: theme.textSecondary, fontSize: '0.7rem' }}>→</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.1rem', color: signalColor(c.newSignal), fontWeight: 600, fontSize: '0.72rem' }}>
                          {c.newSignal === 'Compra' ? <ArrowUpRight size={10} /> : c.newSignal === 'Venda' ? <ArrowDownRight size={10} /> : <Minus size={10} />}
                          {c.newSignal}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: theme.textSecondary }}>
                          {c.prevScore.toFixed(1)} → {c.newScore.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.4rem', padding: '0 0.25rem' }}>
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
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.8rem' }}>
                      Sem mudanças no ranking.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {diffs.slice(0, 15).map(d => {
                        const sc = getSignalColor(d.currentSignal);
                        return (
                          <div key={d.ticker} style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.5rem',
                            borderRadius: 6, fontSize: '0.78rem',
                            background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                          }}>
                            <span style={{ fontWeight: 700, color: theme.text, minWidth: 48 }}>{d.ticker}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.1rem', padding: '0.08rem 0.3rem', borderRadius: 5, fontSize: '0.65rem', fontWeight: 600, background: sc.bg, color: sc.text }}>
                              {d.currentSignal}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>#{d.currentRank}</span>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.05rem', marginLeft: 'auto',
                              fontWeight: 600, fontSize: '0.72rem',
                              color: d.diff > 0 ? '#10b981' : '#ef4444',
                            }}>
                              {d.diff > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                              {d.diff > 0 ? `+${d.diff}` : d.diff}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SignalChangesDropdown;
