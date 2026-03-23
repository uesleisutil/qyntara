import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  RefreshCw, Clock, Settings2,
  Trophy, Sparkles, Briefcase, BarChart3, Target,
  Bell, ArrowUpRight, ArrowDownRight, Minus, AlertCircle,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD } from '../../constants';
import DailyHighlight from '../../components/shared/DailyHighlight';
import SignalChangesDropdown from '../../components/shared/SignalChangesDropdown';
import MyPositionsPanel from '../../components/shared/MyPositionsPanel';
import PersonalPerformance from '../../components/shared/PersonalPerformance';
import GoalTracker from '../../components/shared/GoalTracker';
import PriceAlerts from '../../components/shared/PriceAlerts';
import WidgetCard from '../../components/shared/WidgetCard';
import WidgetPreferences, { WidgetConfig } from '../../components/shared/WidgetPreferences';
import { useIsPro } from '../../components/shared/ProGate';
import { markChecklistItem } from '../../components/shared/ActivationChecklist';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }
interface Rec {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

const PREFS_KEY = 'b3tr_dashboard_widgets_v2';
const COLLAPSED_KEY = 'b3tr_dashboard_collapsed';

const WIDGETS = [
  { id: 'highlight', label: 'Destaque do Dia', proOnly: false },
  { id: 'positions', label: 'Minhas Posições', proOnly: false },
  { id: 'signals', label: 'Novidades', proOnly: false },
  { id: 'performance', label: 'Performance', proOnly: true },
  { id: 'goal', label: 'Meta', proOnly: true },
  { id: 'alerts', label: 'Alertas de Preço', proOnly: true },
];

const TOOLTIPS: Record<string, string> = {
  highlight: 'Ação com maior score do dia e previsão de retorno em 20 dias.',
  positions: 'Ações que você segue com retorno individual.',
  signals: 'Mudanças recentes de sinal e variações no ranking.',
  performance: 'P&L acumulado, taxa de acerto e posições.',
  goal: 'Defina e acompanhe sua meta de rentabilidade.',
  alerts: 'Alertas de preço para suas ações.',
};

const ICONS: Record<string, (c: string) => React.ReactNode> = {
  highlight: c => <Trophy size={13} color={c} />,
  positions: c => <Briefcase size={13} color={c} />,
  signals: c => <Sparkles size={13} color={c} />,
  performance: c => <BarChart3 size={13} color={c} />,
  goal: c => <Target size={13} color={c} />,
  alerts: c => <Bell size={13} color={c} />,
};

const COLORS: Record<string, string> = {
  highlight: '#f59e0b', positions: '#3b82f6', signals: '#8b5cf6',
  performance: '#10b981', goal: '#f59e0b', alerts: '#ef4444',
};

const GRID = new Set(['performance', 'goal']);

function load<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

/* ─── Main Component ─── */
const MyDashboardPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const isPro = useIsPro();
  const navigate = useNavigate();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => load(COLLAPSED_KEY, {}));
  const [order, setOrder] = useState<string[]>(() =>
    load<{ order: string[] } | null>(PREFS_KEY, null)?.order || WIDGETS.map(w => w.id),
  );
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
    const s = load<{ enabled: Record<string, boolean> } | null>(PREFS_KEY, null);
    if (s?.enabled) return s.enabled;
    const d: Record<string, boolean> = {};
    WIDGETS.forEach(w => { d[w.id] = true; });
    return d;
  });

  useEffect(() => {
    const allIds = WIDGETS.map(w => w.id);
    const missing = allIds.filter(id => !order.includes(id));
    if (missing.length) setOrder(prev => [...prev, ...missing]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { localStorage.setItem(PREFS_KEY, JSON.stringify({ order, enabled })); }, [order, enabled]);
  useEffect(() => { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed)); }, [collapsed]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const d = await res.json();
      setRecs(d.recommendations || []);
      setDate(d.date || '');
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar dados');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { markChecklistItem('viewedDashboard'); }, []);

  const topTicker = recs.length ? recs.reduce((a, b) => a.score > b.score ? a : b) : null;
  const totalBuy = recs.filter(r => r.score >= SCORE_BUY_THRESHOLD).length;
  const totalSell = recs.filter(r => r.score <= SCORE_SELL_THRESHOLD).length;
  const totalNeutral = recs.length - totalBuy - totalSell;

  const relTime = (d: Date) => {
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'agora';
    if (s < 3600) return `${Math.floor(s / 60)}min`;
    return `${Math.floor(s / 3600)}h`;
  };

  const visible = useMemo(() => order.filter(id => {
    if (enabled[id] === false) return false;
    const w = WIDGETS.find(x => x.id === id);
    return !(w?.proOnly && !isPro);
  }), [order, enabled, isPro]);

  const configs: WidgetConfig[] = useMemo(() => order.map(id => {
    const w = WIDGETS.find(x => x.id === id)!;
    if (!w) return null;
    return { id, label: w.label, icon: ICONS[id]?.(COLORS[id] || '#3b82f6'), enabled: enabled[id] !== false, proOnly: w.proOnly };
  }).filter(Boolean) as WidgetConfig[], [order, enabled]);

  const renderWidget = (id: string) => {
    switch (id) {
      case 'highlight': return topTicker ? <DailyHighlight darkMode={darkMode} theme={theme} topTicker={topTicker} totalBuy={totalBuy} totalSell={totalSell} totalNeutral={totalNeutral} date={date} isPro={isPro} /> : null;
      case 'positions': return <MyPositionsPanel darkMode={darkMode} theme={theme} />;
      case 'signals': return <SignalChangesDropdown darkMode={darkMode} theme={theme} />;
      case 'performance': return <PersonalPerformance darkMode={darkMode} theme={theme} />;
      case 'goal': return <GoalTracker darkMode={darkMode} theme={theme} />;
      case 'alerts': return <PriceAlerts darkMode={darkMode} theme={theme} />;
      default: return null;
    }
  };

  /* ─── Loading ─── */
  if (loading) {
    const sk: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1e293b' : '#e2e8f0'} 25%, ${darkMode ? '#334155' : '#f1f5f9'} 50%, ${darkMode ? '#1e293b' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 12,
    };
    return (
      <div>
        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <div style={{ ...sk, height: 28, width: 180, marginBottom: 8 }} />
        <div style={{ ...sk, height: 14, width: 120, marginBottom: 24 }} />
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[1, 2, 3].map(n => <div key={n} style={{ ...sk, height: 56, flex: 1 }} />)}
        </div>
        <div style={{ ...sk, height: 80, marginBottom: 12 }} />
        <div style={{ ...sk, height: 140 }} />
      </div>
    );
  }

  /* ─── Error ─── */
  if (error && !recs.length) {
    return (
      <div style={{
        textAlign: 'center', padding: '3rem 1.5rem',
        background: theme.card || (darkMode ? '#1e293b' : '#ffffff'),
        borderRadius: 16, border: `1px solid ${theme.border}`,
      }}>
        <AlertCircle size={36} color="#ef4444" style={{ marginBottom: '0.75rem', opacity: 0.7 }} />
        <div style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '0.4rem' }}>
          Não foi possível carregar os dados
        </div>
        <div style={{ fontSize: '0.82rem', color: theme.textSecondary, marginBottom: '1.25rem' }}>{error}</div>
        <button onClick={fetchData} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '0.5rem 1.2rem', borderRadius: 8, border: 'none',
          background: '#3b82f6', color: 'white', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
        }}>
          <RefreshCw size={14} /> Tentar novamente
        </button>
      </div>
    );
  }

  /* ─── Build layout blocks ─── */
  const blocks: Array<{ type: 'full'; id: string } | { type: 'grid'; ids: string[] }> = [];
  let batch: string[] = [];
  visible.forEach(id => {
    if (GRID.has(id)) { batch.push(id); }
    else { if (batch.length) { blocks.push({ type: 'grid', ids: [...batch] }); batch = []; } blocks.push({ type: 'full', id }); }
  });
  if (batch.length) blocks.push({ type: 'grid', ids: batch });

  /* ─── Signal summary chips ─── */
  const signalChip = (label: string, count: number, color: string, icon: React.ReactNode) => (
    <div key={label} style={{
      flex: '1 1 0', minWidth: 80, padding: '0.5rem 0.6rem',
      borderRadius: 10, background: theme.card || (darkMode ? '#1e293b' : '#ffffff'),
      border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: '0.4rem',
      cursor: 'pointer', transition: 'border-color 0.15s',
    }}
      onClick={() => navigate('/dashboard/recommendations')}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}12`, color, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color, lineHeight: 1.1 }}>{count}</div>
        <div style={{ fontSize: '0.62rem', color: theme.textSecondary }}>{label}</div>
      </div>
    </div>
  );

  return (
    <div>
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: theme.text, margin: 0, letterSpacing: '-0.02em' }}>
            {getGreeting()} 👋
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 4, flexWrap: 'wrap' }}>
            {date && <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{date}</span>}
            {lastUpdated && (
              <span style={{ fontSize: '0.65rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Clock size={9} /> {relTime(lastUpdated)}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button onClick={() => setPrefsOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '0.4rem 0.65rem', borderRadius: 8,
            border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textSecondary,
            fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.textSecondary; }}
          >
            <Settings2 size={13} /> Personalizar
          </button>
          <button onClick={fetchData} style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.5rem', borderRadius: 8,
            border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer',
          }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ─── Signal Summary (the only top-level overview) ─── */}
      {recs.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {signalChip('Compra', totalBuy, '#10b981', <ArrowUpRight size={14} />)}
          {signalChip('Neutro', totalNeutral, '#94a3b8', <Minus size={14} />)}
          {signalChip('Venda', totalSell, '#ef4444', <ArrowDownRight size={14} />)}
        </div>
      )}

      {/* ─── Widgets ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {blocks.map((b, i) => {
          if (b.type === 'grid') {
            return (
              <div key={`g${i}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '0.65rem' }}>
                {b.ids.map(id => {
                  const w = WIDGETS.find(x => x.id === id)!;
                  const c = renderWidget(id);
                  if (!c) return null;
                  return (
                    <WidgetCard key={id} id={id} title={w.label} tooltip={TOOLTIPS[id]}
                      icon={ICONS[id]?.(COLORS[id])} accentColor={COLORS[id]}
                      darkMode={darkMode} theme={theme}
                      collapsed={collapsed[id]}
                      onToggleCollapse={() => setCollapsed(p => ({ ...p, [id]: !p[id] }))}
                    >{c}</WidgetCard>
                  );
                })}
              </div>
            );
          }
          const { id } = b;
          const w = WIDGETS.find(x => x.id === id)!;
          const c = renderWidget(id);
          if (!c) return null;
          return (
            <WidgetCard key={id} id={id} title={w.label} tooltip={TOOLTIPS[id]}
              icon={ICONS[id]?.(COLORS[id])} accentColor={COLORS[id]}
              darkMode={darkMode} theme={theme}
              collapsed={collapsed[id]}
              onToggleCollapse={() => setCollapsed(p => ({ ...p, [id]: !p[id] }))}
            >{c}</WidgetCard>
          );
        })}
      </div>

      {/* ─── Empty State ─── */}
      {visible.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          background: theme.card || (darkMode ? '#1e293b' : '#ffffff'),
          borderRadius: 16, border: `1px dashed ${theme.border}`,
        }}>
          <Settings2 size={28} style={{ opacity: 0.2, marginBottom: 10 }} color={theme.textSecondary} />
          <div style={{ fontSize: '0.85rem', color: theme.textSecondary }}>
            Clique em <span style={{ fontWeight: 600, color: theme.text }}>Personalizar</span> para escolher seus widgets.
          </div>
        </div>
      )}

      <WidgetPreferences open={prefsOpen} onClose={() => setPrefsOpen(false)} widgets={configs}
        onToggle={id => setEnabled(p => ({ ...p, [id]: !p[id] }))}
        onReorder={(f, t) => setOrder(p => { const n = [...p]; const [x] = n.splice(f, 1); n.splice(t, 0, x); return n; })}
        darkMode={darkMode} theme={theme} isPro={isPro} />
    </div>
  );
};

export default MyDashboardPage;
