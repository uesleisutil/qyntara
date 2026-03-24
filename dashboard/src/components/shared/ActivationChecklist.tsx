import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';

interface ActivationChecklistProps {
  darkMode: boolean;
  theme: Record<string, string>;
}

const CHECKLIST_KEY = 'b3tr_checklist';
const CHECKLIST_DISMISSED_KEY = 'b3tr_checklist_dismissed';

interface ChecklistState {
  viewedDashboard: boolean;
  viewedRecommendations: boolean;
  viewedExplainability: boolean;
  ranBacktest: boolean;
  viewedPerformance: boolean;
}

const defaultState: ChecklistState = {
  viewedDashboard: false,
  viewedRecommendations: false,
  viewedExplainability: false,
  ranBacktest: false,
  viewedPerformance: false,
};

export const getChecklistState = (): ChecklistState => {
  try {
    const saved = localStorage.getItem(CHECKLIST_KEY);
    return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
  } catch { return defaultState; }
};

export const markChecklistItem = (key: keyof ChecklistState) => {
  const state = getChecklistState();
  state[key] = true;
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
};

export const isChecklistDismissed = (): boolean => !!localStorage.getItem(CHECKLIST_DISMISSED_KEY);

const items: { key: keyof ChecklistState; label: string; emoji: string }[] = [
  { key: 'viewedDashboard', label: 'Personalize seu dashboard', emoji: '🏠' },
  { key: 'viewedRecommendations', label: 'Veja as recomendações do dia', emoji: '📊' },
  { key: 'viewedExplainability', label: 'Explore a explicabilidade de uma ação', emoji: '🧠' },
  { key: 'ranBacktest', label: 'Rode seu primeiro backtest', emoji: '🧪' },
  { key: 'viewedPerformance', label: 'Confira a performance do modelo', emoji: '📈' },
];

const ActivationChecklist: React.FC<ActivationChecklistProps> = ({ darkMode, theme }) => {
  const [state, setState] = useState<ChecklistState>(getChecklistState);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(isChecklistDismissed);

  useEffect(() => {
    const interval = setInterval(() => {
      setState(getChecklistState());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const completed = items.filter(i => state[i.key]).length;
  const total = items.length;
  const allDone = completed === total;

  if (dismissed || allDone) return null;

  const handleDismiss = () => {
    localStorage.setItem(CHECKLIST_DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div style={{
      background: darkMode ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.03)',
      border: `1px solid ${darkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}`,
      borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '0.75rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
          <Sparkles size={15} color="#8b5cf6" />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>
            Primeiros passos
          </span>
          <span style={{
            fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 10,
            background: '#8b5cf6', color: 'white', fontWeight: 600,
          }}>
            {completed}/{total}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button onClick={() => setCollapsed(!collapsed)} style={{
            background: 'none', border: 'none', color: theme.textSecondary,
            cursor: 'pointer', padding: 2,
          }} aria-label={collapsed ? 'Expandir' : 'Recolher'}>
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button onClick={handleDismiss} style={{
            background: 'none', border: 'none', color: theme.textSecondary,
            cursor: 'pointer', padding: 2, opacity: 0.6,
          }} aria-label="Fechar">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, borderRadius: 2, background: darkMode ? '#2a2745' : '#e2e8f0', marginTop: '0.5rem', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2, width: `${(completed / total) * 100}%`,
          background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', transition: 'width 0.5s ease',
        }} />
      </div>

      {!collapsed && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {items.map(item => (
            <div key={item.key} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.78rem', color: state[item.key] ? '#10b981' : theme.textSecondary,
              opacity: state[item.key] ? 0.7 : 1,
            }}>
              {state[item.key]
                ? <CheckCircle size={14} color="#10b981" />
                : <Circle size={14} color={theme.textSecondary} />
              }
              <span style={{ textDecoration: state[item.key] ? 'line-through' : 'none' }}>
                {item.emoji} {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivationChecklist;
