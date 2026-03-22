import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  LayoutDashboard, RefreshCw, Clock, Settings2,
  Trophy, Sparkles, Briefcase, BarChart3, Target,
  Bell, GitCompareArrows, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD } from '../../constants';
import DailyHighlight from '../../components/shared/DailyHighlight';
import SignalChangesDropdown from '../../components/shared/SignalChangesDropdown';
import MyPositionsPanel from '../../components/shared/MyPositionsPanel';
import PersonalPerformance from '../../components/shared/PersonalPerformance';
import GoalTracker from '../../components/shared/GoalTracker';
import PriceAlerts from '../../components/shared/PriceAlerts';
import StockComparator from '../../components/explainability/StockComparator';
import WidgetCard from '../../components/shared/WidgetCard';
import WidgetPreferences, { WidgetConfig } from '../../components/shared/WidgetPreferences';
import { useIsPro } from '../../components/shared/ProGate';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }
interface Rec {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

const PREFS_KEY = 'b3tr_dashboard_widgets';
const COLLAPSED_KEY = 'b3tr_dashboard_collapsed';

// Default widget order & visibility
const DEFAULT_WIDGETS = [
  { id: 'highlight', label: 'Destaque do Dia', proOnly: false },
  { id: 'signals', label: 'Novidades', proOnly: false },
  { id: 'positions', label: 'Minhas Posições', proOnly: false },
  { id: 'performance', label: 'Minha Performance', proOnly: true },
  { id: 'goal', label: 'Meta de Rentabilidade', proOnly: true },
  { id: 'alerts', label: 'Alertas de Preço', proOnly: true },
  { id: 'comparator', label: 'Comparar Ações', proOnly: false },
];

const WIDGET_ICONS: Record<string, (color: string) => React.ReactNode> = {
  highlight: (c) => <Trophy size={14} color={c} />,
  signals: (c) => <Sparkles size={14} color={c} />,
  positions: (c) => <Briefcase size={14} color={c} />,
  performance: (c) => <BarChart3 size={14} color={c} />,
  goal: (c) => <Target size={14} color={c} />,
  alerts: (c) => <Bell size={14} color={c} />,
  comparator: (c) => <GitCompareArrows size={14} color={c} />,
};

const WIDGET_COLORS: Record<string, string> = {
  highlight: '#f59e0b',
  signals: '#8b5cf6',
  positions: '#3b82f6',
  performance: '#10b981',
  goal: '#f59e0b',
  alerts: '#ef4444',
  comparator: '#06b6d4',
};

function loadPrefs(): { order: string[]; enabled: Record<string, boolean> } | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePrefs(order: string[], enabled: Record<string, boolean>) {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ order, enabled }));
}

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCollapsed(c: Record<string, boolean>) {
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify(c));
}

const MyDashboardPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const isPro = useIsPro();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  // Widget order & enabled state
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    const saved = loadPrefs();
    return saved?.order || DEFAULT_WIDGETS.map(w => w.id);
  });
  const [widgetEnabled, setWidgetEnabled] = useState<Record<string, boolean>>(() => {
    const saved = loadPrefs();
    if (saved?.enabled) return saved.enabled;
    const defaults: Record<string, boolean> = {};
    DEFAULT_WIDGETS.forEach(w => { defaults[w.id] = true; });
    return defaults;
  });

  // Persist prefs
  useEffect(() => { savePrefs(widgetOrder, widgetEnabled); }, [widgetOrder, widgetEnabled]);
  useEffect(() => { saveCollapsed(collapsed); }, [collapsed]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, {
        headers: { 'x-api-key': API_KEY },
      });
      if (res.ok) {
        const data = await res.json();
        setRecs(data.recommendations || []);
        setDate(data.date || '');
        setLastUpdated(new Date());
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const topTicker = recs.length ? recs.reduce((a, b) => a.score > b.score ? a : b) : null;
  const totalBuy = recs.filter(r => r.score >= SCORE_BUY_THRESHOLD).length;
  const totalSell = recs.filter(r => r.score <= SCORE_SELL_THRESHOLD).length;
  const totalNeutral = recs.length - totalBuy - totalSell;

  const getRelativeTime = (d: Date) => {
    const diff = Math.round((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'agora mesmo';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    return `há ${Math.floor(diff / 86400)}d`;
  };

  // Toggle widget
  const handleToggle = useCallback((id: string) => {
    setWidgetEnabled(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Reorder
  const handleReorder = useCallback((from: number, to: number) => {
    setWidgetOrder(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  // Toggle collapse
  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Build widget config for preferences panel
  const widgetConfigs: WidgetConfig[] = useMemo(() =>
    widgetOrder.map(id => {
      const def = DEFAULT_WIDGETS.find(w => w.id === id)!;
      return {
        id,
        label: def.label,
        icon: WIDGET_ICONS[id]?.(WIDGET_COLORS[id] || '#3b82f6'),
        enabled: widgetEnabled[id] !== false,
        proOnly: def.proOnly,
      };
    }),
  [widgetOrder, widgetEnabled]);

  // Visible widgets (respecting pro gate)
  const visibleWidgets = useMemo(() =>
    widgetOrder.filter(id => {
      if (widgetEnabled[id] === false) return false;
      const def = DEFAULT_WIDGETS.find(w => w.id === id);
      if (def?.proOnly && !isPro) return false;
      return true;
    }),
  [widgetOrder, widgetEnabled, isPro]);

  // Summary stats for header
  const activeCount = visibleWidgets.length;

  // Render widget content by id
  const renderWidget = (id: string) => {
    switch (id) {
      case 'highlight':
        if (!topTicker || recs.length === 0) return null;
        return (
          <DailyHighlight
            darkMode={darkMode} theme={theme}
            topTicker={topTicker}
            totalBuy={totalBuy} totalSell={totalSell} totalNeutral={totalNeutral}
            date={date}
          />
        );
      case 'signals':
        return <SignalChangesDropdown darkMode={darkMode} theme={theme} />;
      case 'positions':
        return <MyPositionsPanel darkMode={darkMode} theme={theme} />;
      case 'performance':
        return <PersonalPerformance darkMode={darkMode} theme={theme} />;
      case 'goal':
        return <GoalTracker darkMode={darkMode} theme={theme} />;
      case 'alerts':
        return <PriceAlerts darkMode={darkMode} theme={theme} />;
      case 'comparator':
        if (recs.length === 0) return null;
        return <StockComparator tickers={recs} darkMode={darkMode} />;
      default:
        return null;
    }
  };

  // Determine which widgets go in the 2-col grid (small cards) vs full width
  const GRID_WIDGETS = new Set(['performance', 'goal']);

  if (loading) {
    const pulse: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1e293b' : '#e2e8f0'} 25%, ${darkMode ? '#334155' : '#f1f5f9'} 50%, ${darkMode ? '#1e293b' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 14,
    };
    return (
      <div style={{ padding: '0.5rem 0' }}>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ ...pulse, height: 32, width: 200 }} />
          <div style={{ ...pulse, height: 32, width: 100, marginLeft: 'auto' }} />
        </div>
        <div style={{ ...pulse, height: 72, marginBottom: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ ...pulse, height: 140 }} />
          <div style={{ ...pulse, height: 140 }} />
        </div>
        <div style={{ ...pulse, height: 180, marginBottom: 12 }} />
        <div style={{ ...pulse, height: 120 }} />
      </div>
    );
  }

  // Group visible widgets: full-width and grid pairs
  const fullWidgets: string[] = [];
  const gridWidgets: string[] = [];
  visibleWidgets.forEach(id => {
    if (GRID_WIDGETS.has(id)) gridWidgets.push(id);
    else fullWidgets.push(id);
  });

  // Interleave: render in order, but batch grid widgets together
  const renderOrder: Array<{ type: 'full'; id: string } | { type: 'grid'; ids: string[] }> = [];
  let gridBatch: string[] = [];

  visibleWidgets.forEach(id => {
    if (GRID_WIDGETS.has(id)) {
      gridBatch.push(id);
    } else {
      if (gridBatch.length > 0) {
        renderOrder.push({ type: 'grid', ids: [...gridBatch] });
        gridBatch = [];
      }
      renderOrder.push({ type: 'full', id });
    }
  });
  if (gridBatch.length > 0) {
    renderOrder.push({ type: 'grid', ids: gridBatch });
  }

  return (
    <div style={{ padding: '0.25rem 0' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
            <LayoutDashboard size={20} color="#3b82f6" />
            <h1 style={{ fontSize: 'clamp(1.15rem, 4vw, 1.4rem)', fontWeight: 700, color: theme.text, margin: 0 }}>
              Meu Dashboard
            </h1>
          </div>
          <p style={{
            color: theme.textSecondary, fontSize: '0.75rem', margin: 0,
            display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap',
          }}>
            {date && <span>{date}</span>}
            {lastUpdated && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                fontSize: '0.68rem', color: '#10b981',
                background: 'rgba(16,185,129,0.08)', padding: '0.1rem 0.4rem', borderRadius: 10,
              }}>
                <Clock size={9} /> {getRelativeTime(lastUpdated)}
              </span>
            )}
            <span style={{ fontSize: '0.68rem', color: theme.textSecondary, opacity: 0.6 }}>
              · {activeCount} widgets
            </span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button onClick={() => setPrefsOpen(true)} title="Personalizar widgets" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.45rem 0.75rem', borderRadius: 8,
            border: `1px solid ${theme.border}`,
            background: 'transparent', color: theme.textSecondary,
            fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.textSecondary; }}
          >
            <Settings2 size={14} /> Personalizar
          </button>
          <button onClick={fetchData} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.45rem 0.75rem', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: 'white',
            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(37,99,235,0.2)',
          }}>
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>
      </div>

      {/* Quick stats bar */}
      {recs.length > 0 && (
        <div style={{
          display: 'flex', gap: '0.75rem', marginBottom: '1rem',
          padding: '0.6rem 0.85rem', borderRadius: 12,
          background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
          flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 500 }}>Resumo:</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
            <TrendingUp size={13} /> {totalBuy} compra
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
            <TrendingDown size={13} /> {totalSell} venda
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>
            <Minus size={13} /> {totalNeutral} neutro
          </span>
          <span style={{ fontSize: '0.72rem', color: theme.textSecondary, marginLeft: 'auto' }}>
            {recs.length} ações analisadas
          </span>
        </div>
      )}

      {/* Widgets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {renderOrder.map((block, i) => {
          if (block.type === 'grid') {
            return (
              <div key={`grid-${i}`} style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
                gap: '0.75rem',
              }}>
                {block.ids.map(id => {
                  const def = DEFAULT_WIDGETS.find(w => w.id === id)!;
                  const content = renderWidget(id);
                  if (content === null) return null;
                  return (
                    <WidgetCard
                      key={id} id={id}
                      title={def.label}
                      icon={WIDGET_ICONS[id]?.(WIDGET_COLORS[id] || '#3b82f6')}
                      accentColor={WIDGET_COLORS[id]}
                      darkMode={darkMode} theme={theme}
                      collapsed={collapsed[id]}
                      onToggleCollapse={() => toggleCollapse(id)}
                    >
                      {content}
                    </WidgetCard>
                  );
                })}
              </div>
            );
          }

          const { id } = block;
          const def = DEFAULT_WIDGETS.find(w => w.id === id)!;

          // Highlight and signals render without WidgetCard wrapper (they have their own styling)
          if (id === 'highlight') {
            const content = renderWidget(id);
            return content ? <div key={id}>{content}</div> : null;
          }

          const content = renderWidget(id);
          if (content === null) return null;

          return (
            <WidgetCard
              key={id} id={id}
              title={def.label}
              icon={WIDGET_ICONS[id]?.(WIDGET_COLORS[id] || '#3b82f6')}
              accentColor={WIDGET_COLORS[id]}
              darkMode={darkMode} theme={theme}
              collapsed={collapsed[id]}
              onToggleCollapse={() => toggleCollapse(id)}
            >
              {content}
            </WidgetCard>
          );
        })}
      </div>

      {/* Empty state */}
      {visibleWidgets.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          color: theme.textSecondary, fontSize: '0.85rem',
        }}>
          <Settings2 size={32} color={theme.textSecondary} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <div style={{ fontWeight: 600, color: theme.text, marginBottom: '0.3rem' }}>
            Nenhum widget ativo
          </div>
          <div>
            Clique em <strong>Personalizar</strong> para escolher quais widgets exibir.
          </div>
        </div>
      )}

      {/* Preferences drawer */}
      <WidgetPreferences
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        widgets={widgetConfigs}
        onToggle={handleToggle}
        onReorder={handleReorder}
        darkMode={darkMode}
        theme={theme}
        isPro={isPro}
      />
    </div>
  );
};

export default MyDashboardPage;
