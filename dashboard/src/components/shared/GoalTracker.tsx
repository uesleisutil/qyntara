import React, { useState, useEffect } from 'react';
import { Edit3, Check, X } from 'lucide-react';
import { getFollowedPositions } from './FollowButton';
import { API_BASE_URL, API_KEY } from '../../config';
import { useIsPro } from './ProGate';

interface Props { darkMode: boolean; theme: Record<string, string>; }
const STORAGE_KEY = 'b3tr_goal';
const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const GoalTracker: React.FC<Props> = ({ darkMode, theme }) => {
  const isPro = useIsPro();
  const [goalPct, setGoalPct] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [currentReturn, setCurrentReturn] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setGoalPct(parseFloat(saved));
  }, []);

  useEffect(() => {
    (async () => {
      const pos = getFollowedPositions();
      if (!pos.length) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } });
        if (!res.ok) return;
        const data = await res.json();
        const p: Record<string, number> = {};
        (data.recommendations || []).forEach((r: any) => { p[r.ticker] = r.last_close; });
        const avg = pos.reduce((s, x) => s + ((p[x.ticker] || x.entryPrice) - x.entryPrice) / x.entryPrice * 100, 0) / pos.length;
        setCurrentReturn(avg);
      } catch {}
    })();
  }, []);

  if (!isPro) return null;

  const save = () => {
    const v = parseFloat(input);
    if (!isNaN(v) && v > 0) { setGoalPct(v); localStorage.setItem(STORAGE_KEY, v.toString()); }
    setEditing(false);
  };

  const progress = goalPct ? Math.min(100, Math.max(0, (currentReturn / goalPct) * 100)) : 0;
  const reached = goalPct !== null && currentReturn >= goalPct;

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <input type="number" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Ex: 5" autoFocus
          style={{
            flex: 1, padding: '0.4rem 0.6rem', borderRadius: 6,
            border: `1px solid ${theme.border}`, background: darkMode ? '#121a1a' : '#f6faf8',
            color: theme.text, fontSize: '0.85rem', outline: 'none',
          }} />
        <span style={{ fontSize: '0.85rem', color: theme.textSecondary }}>%</span>
        <button onClick={save} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ead8a', padding: 4 }}>
          <Check size={16} />
        </button>
        <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e07070', padding: 4 }}>
          <X size={16} />
        </button>
      </div>
    );
  }

  if (goalPct === null) {
    return (
      <div style={{ textAlign: 'center', padding: '0.5rem' }}>
        <button onClick={() => { setEditing(true); setInput(''); }} style={{
          background: 'none', border: `1px dashed ${theme.border}`, borderRadius: 8,
          padding: '0.6rem 1rem', cursor: 'pointer', color: theme.textSecondary,
          fontSize: '0.78rem', width: '100%',
        }}>
          Definir meta de rentabilidade
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '1.15rem', fontWeight: 700, color: reached ? '#4ead8a' : theme.text, letterSpacing: '-0.02em' }}>
          {fmt(currentReturn, 1)}%
        </span>
        <button onClick={() => { setEditing(true); setInput(goalPct.toString()); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary, padding: 2, display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem' }}>
          <Edit3 size={11} /> {fmt(goalPct, 1)}%
        </button>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: darkMode ? '#2a3d36' : '#d4e5dc', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, width: `${progress}%`,
          background: reached ? '#4ead8a' : '#5a9e87',
          transition: 'width 0.5s ease',
        }} />
      </div>
      {reached && (
        <div style={{ fontSize: '0.7rem', color: '#4ead8a', fontWeight: 600, marginTop: '0.3rem', textAlign: 'center' }}>
          🎉 Meta atingida
        </div>
      )}
    </div>
  );
};

export default GoalTracker;
