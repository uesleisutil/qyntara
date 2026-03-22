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
      const positions = getFollowedPositions();
      if (positions.length === 0) { setCurrentReturn(0); return; }
      try {
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, {
          headers: { 'x-api-key': API_KEY },
        });
        if (!res.ok) return;
        const data = await res.json();
        const prices: Record<string, number> = {};
        (data.recommendations || []).forEach((r: any) => { prices[r.ticker] = r.last_close; });
        const returns = positions.map(p => {
          const cur = prices[p.ticker] || p.entryPrice;
          return ((cur - p.entryPrice) / p.entryPrice) * 100;
        });
        const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
        setCurrentReturn(avg);
      } catch { /* silent */ }
    })();
  }, []);

  if (!isPro) return null;

  const saveGoal = () => {
    const val = parseFloat(input);
    if (!isNaN(val) && val > 0) {
      setGoalPct(val);
      localStorage.setItem(STORAGE_KEY, val.toString());
    }
    setEditing(false);
  };

  const clearGoal = () => {
    setGoalPct(null);
    localStorage.removeItem(STORAGE_KEY);
    setEditing(false);
  };

  const progress = goalPct ? Math.min(100, Math.max(0, (currentReturn / goalPct) * 100)) : 0;
  const reached = goalPct !== null && currentReturn >= goalPct;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        {!editing && (
          <button onClick={() => { setEditing(true); setInput(goalPct?.toString() || ''); }} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary,
            display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', marginLeft: 'auto',
          }}>
            <Edit3 size={12} /> {goalPct !== null ? 'Editar' : 'Definir meta'}
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <input
            type="number" value={input} onChange={e => setInput(e.target.value)}
            placeholder="Ex: 5" autoFocus
            style={{
              flex: 1, padding: '0.4rem 0.6rem', borderRadius: 6,
              border: `1px solid ${theme.border}`, background: darkMode ? '#0f172a' : '#f8fafc',
              color: theme.text, fontSize: '0.82rem', outline: 'none',
            }}
          />
          <span style={{ fontSize: '0.82rem', color: theme.textSecondary }}>%</span>
          <button onClick={saveGoal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: 4 }}>
            <Check size={16} />
          </button>
          {goalPct !== null && (
            <button onClick={clearGoal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
              <X size={16} />
            </button>
          )}
        </div>
      ) : goalPct !== null ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.3rem' }}>
            <span style={{ color: theme.textSecondary }}>Progresso</span>
            <span style={{ color: reached ? '#10b981' : theme.text, fontWeight: 600 }}>
              {fmt(currentReturn, 1)}% / {fmt(goalPct, 1)}%
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: darkMode ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4, width: `${progress}%`,
              background: reached ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
              transition: 'width 0.5s ease',
            }} />
          </div>
          {reached && (
            <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, marginTop: '0.3rem', textAlign: 'center' }}>
              🎉 Meta atingida!
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '0.75rem', color: theme.textSecondary, textAlign: 'center', padding: '0.3rem 0' }}>
          Defina uma meta para acompanhar seu progresso.
        </div>
      )}
    </div>
  );
};

export default GoalTracker;
