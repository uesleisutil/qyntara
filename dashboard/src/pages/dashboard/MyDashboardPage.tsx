import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  RefreshCw, Clock, Settings2,
  Trophy, Sparkles, Briefcase, BarChart3, Target,
  Bell, GitCompareArrows, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Minus, AlertCircle,
  PieChart, Activity, Zap,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD, getSignal, getSignalColor } from '../../constants';
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
import { markChecklistItem } from '../../components/shared/ActivationChecklist';
import { getFollowedPositions } from '../../components/shared/FollowButton';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }
interface Rec {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

const PREFS_KEY = 'b3tr_dashboard_widgets';
const COLLAPSED_KEY = 'b3tr_dashboard_collapsed';

const WIDGETS = [
  { id: 'market-pulse', label: 'Pulso do Mercado', proOnly: false },
  { id: 'highlight', label: 'Destaque do Dia', proOnly: false },
  { id: 'positions', label: 'Minhas Posições', proOnly: false },
  { id: 'performance', label: 'Performance', proOnly: true },
  { id: 'goal', label: 'Meta', proOnly: true },
  { id: 'signals', label: 'Novidades', proOnly: false },
  { id: 'top-movers', label: 'Maiores Movimentos', proOnly: false },
  { id: 'alerts', label: 'Alertas de Preço', proOnly: true },
  { id: 'comparator', label: 'Comparar Ações', proOnly: false },
];

const TOOLTIPS: Record<string, string> = {
  'market-pulse': 'Visão geral do mercado: distribuição de sinais, retorno médio previsto e volatilidade média do universo de ações.',
  highlight: 'Ação com maior score do dia, incluindo sinal, preço atual e previsão de retorno em 20 dias.',
  signals: 'Mudanças recentes de sinal (Compra/Venda/Neutro) e variações no ranking das ações.',
  positions: 'Ações que você está seguindo com P&L total e retorno individual.',
  performance: 'Resumo da sua carteira: P&L acumulado, taxa de acerto e total de posições.',
  goal: 'Defina uma meta de rentabilidade e acompanhe seu progresso.',
  'top-movers': 'Ações com maior retorno previsto (positivo e negativo) nos próximos 20 pregões.',
  alerts: 'Configure alertas de preço para ser notificado quando uma ação atingir o valor desejado.',
  comparator: 'Compare duas ações lado a lado: score, retorno esperado e volatilidade.',
};

const ICONS: Record<string, (c: string) => React.ReactNode> = {
  'market-pulse': c => <Activity size={13} color={c} />,
  highlight: c => <Trophy size={13} color={c} />,
  signals: c => <Sparkles size={13} color={c} />,
  positions: c => <Briefcase size={13} color={c} />,
  performance: c => <BarChart3 size={13} color={c} />,
  goal: c => <Target size={13} color={c} />,
  'top-movers': c => <Zap size={13} color={c} />,
  alerts: c => <Bell size={13} color={c} />,
  comparator: c => <GitCompareArrows size={13} color={c} />,
};

const COLORS: Record<string, string> = {
  'market-pulse': '#6366f1',
  highlight: '#f59e0b', signals: '#8b5cf6', positions: '#3b82f6',
  performance: '#10b981', goal: '#f59e0b', 'top-movers': '#ec4899',
  alerts: '#ef4444', comparator: '#06b6d4',
};

const GRID = new Set(['performance', 'goal']);

function load<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

/* ─── Skeleton Loader ─── */
const SkeletonBlock: React.FC<{ darkMode: boolean; height: number; width?: string; mb?: number }> = ({ darkMode, height, width = '100%', mb = 0 }) => (
  <div style={{
    background: `linear-gradient(90deg, ${darkMode ? '#1e293b' : '#e2e8f0'} 25%, ${darkMode ? '#334155' : '#f1f5f9'} 50%, ${darkMode ? '#1e293b' : '#e2e8f0'} 75%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 12,
    height, width, marginBottom: mb,
  }} />
);

/* ─── Market Pulse Widget ─── */
const MarketPulse: React.FC<{
  recs: Rec[]; darkMode: boolean; theme: Record<string, string>; navigate: (path: string) => void;
}> = ({ recs, darkMode, theme, navigate }) => {
  if (!recs.length) return null;

  const totalBuy = recs.filter(r => r.score >= SCORE_BUY_THRESHOLD).length;
  const totalSell = recs.filter(r => r.score <= SCORE_SELL_THRESHOLD).length;
  const totalNeutral = recs.length - totalBuy - totalSell;
  const avgReturn = recs.reduce((s, r) => s + r.exp_return_20, 0) / recs.length * 100;
  const avgVol = recs.reduce((s, r) => s + r.vol_20d, 0) / recs.length * 100;
  const total = recs.length;
  const buyPct = (totalBuy / total) * 100;
  const sellPct = (totalSell / total) * 100;
  const neutralPct = (totalNeutral / total) * 100;

  const signalBar = (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
      {buyPct > 0 && <div style={{ width: `${buyPct}%`, background: '#10b981', borderRadius: 4, transition: 'width 0.5s' }} />}
      {neutralPct > 0 && <div style={{ width: `${neutralPct}%`, background: '#94a3b8', borderRadius: 4, transition: 'width 0.5s' }} />}
      {sellPct > 0 && <div style={{ width: `${sellPct}%`, background: '#ef4444', borderRadius: 4, transition: 'width 0.5s' }} />}
    </div>
  );

  const chip = (label: string, count: number, color: string) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.25rem 0.55rem', borderRadius: 6,
      background: `${color}12`, fontSize: '0.75rem',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: theme.textSecondary }}>{label}</span>
      <span style={{ fontWeight: 700, color }}>{count}</span>
    </div>
  );

  const metric = (label: string, value: string, color: string, icon: React.ReactNode) => (
    <div style={{
      flex: '1 1 0', minWidth: 100, padding: '0.6rem',
      borderRadius: 8, background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      textAlign: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
        {icon}
        <span style={{ fontSize: '0.65rem', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );

  return (
    <div>
      {/* Signal distribution bar */}
      <div style={{ marginBottom: '0.75rem' }}>
        {signalBar}
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {chip('Compra', totalBuy, '#10b981')}
          {chip('Neutro', totalNeutral, '#94a3b8')}
          {chip('Venda', totalSell, '#ef4444')}
        </div>
      </div>

      {/* Key metrics */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {metric(
          'Retorno Médio',
          `${avgReturn >= 0 ? '+' : ''}${fmt(avgReturn, 1)}%`,
          avgReturn >= 0 ? '#10b981' : '#ef4444',
          avgReturn >= 0 ? <TrendingUp size={11} color={avgReturn >= 0 ? '#10b981' : '#ef4444'} /> : <TrendingDown size={11} color="#ef4444" />,
        )}
        {metric(
          'Volatilidade',
          `${fmt(avgVol, 1)}%`,
          theme.textSecondary,
          <Activity size={11} color={theme.textSecondary} />,
        )}
        {metric(
          'Ações Analisadas',
          `${total}`,
          theme.text,
          <PieChart size={11} color={theme.textSecondary} />,
        )}
      </div>

      {/* CTA */}
      <button
        onClick={() => navigate('/dashboard/recommendations')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          width: '100%', marginTop: '0.75rem', padding: '0.5rem',
          borderRadius: 8, border: `1px solid ${theme.border}`,
          background: 'transparent', color: '#3b82f6',
          fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.06)'; e.currentTarget.style.borderColor = '#3b82f6'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = theme.border; }}
      >
        Ver todas as recomendações <ArrowUpRight size={13} />
      </button>
    </div>
  );
};

/* ─── Top Movers Widget ─── */
const TopMovers: React.FC<{
  recs: Rec[]; darkMode: boolean; theme: Record<string, string>;
}> = ({ recs, darkMode, theme }) => {
  const [tab, setTab] = useState<'gainers' | 'losers'>('gainers');

  if (!recs.length) return null;

  const sorted = [...recs].sort((a, b) => b.exp_return_20 - a.exp_return_20);
  const gainers = sorted.slice(0, 5);
  const losers = sorted.slice(-5).reverse();
  const list = tab === 'gainers' ? gainers : losers;

  const tabBtn = (id: 'gainers' | 'losers', label: string, color: string, icon: React.ReactNode) => (
    <button onClick={() => setTab(id)} style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '0.3rem 0.6rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
      background: tab === id ? `${color}15` : 'transparent',
      border: `1px solid ${tab === id ? `${color}40` : 'transparent'}`,
      color: tab === id ? color : theme.textSecondary,
      transition: 'all 0.15s',
    }}>
      {icon} {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
        {tabBtn('gainers', 'Maiores Altas', '#10b981', <TrendingUp size={11} />)}
        {tabBtn('losers', 'Maiores Baixas', '#ef4444', <TrendingDown size={11} />)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {list.map((r, i) => {
          const retPct = r.exp_return_20 * 100;
          const isUp = retPct >= 0;
          const signal = getSignal(r.score);
          const sc = getSignalColor(signal);
          return (
            <div key={r.ticker} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.45rem 0.3rem', borderRadius: 6,
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontWeight: 700, color: theme.textSecondary,
                background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              }}>{i + 1}</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: theme.text, minWidth: 52 }}>{r.ticker}</span>
              <span style={{
                fontSize: '0.65rem', fontWeight: 600, padding: '0.08rem 0.3rem', borderRadius: 4,
                background: sc.bg, color: sc.text,
              }}>{signal}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>R$ {fmt(r.last_close)}</span>
              <span style={{
                fontSize: '0.78rem', fontWeight: 700, color: isUp ? '#10b981' : '#ef4444',
                display: 'flex', alignItems: 'center', gap: 2, minWidth: 60, justifyContent: 'flex-end',
              }}>
                {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {isUp ? '+' : ''}{fmt(retPct, 1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Greeting Header ─── */
const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

/* ─── Main Page Component ─── */
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

  // Sync new widgets that may have been added
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { markChecklistItem('viewedDashboard'); }, []);

  const topTicker = recs.length ? recs.reduce((a, b) => a.score > b.score ? a : b) : null;
  const totalBuy = recs.filter(r => r.score >= SCORE_BUY_THRESHOLD).length;
  const totalSell = recs.filter(r => r.score <= SCORE_SELL_THRESHOLD).length;
  const totalNeutral = recs.length - totalBuy - totalSell;
  const followedCount = getFollowedPositions().length;

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
      case 'market-pulse': return recs.length ? <MarketPulse recs={recs} darkMode={darkMode} theme={theme} navigate={navigate} /> : null;
      case 'highlight': return topTicker ? <DailyHighlight darkMode={darkMode} theme={theme} topTicker={topTicker} totalBuy={totalBuy} totalSell={totalSell} totalNeutral={totalNeutral} date={date} isPro={isPro} /> : null;
      case 'signals': return <SignalChangesDropdown darkMode={darkMode} theme={theme} />;
      case 'positions': return <MyPositionsPanel darkMode={darkMode} theme={theme} />;
      case 'performance': return <PersonalPerformance darkMode={darkMode} theme={theme} />;
      case 'goal': return <GoalTracker darkMode={darkMode} theme={theme} />;
      case 'top-movers': return recs.length ? <TopMovers recs={recs} darkMode={darkMode} theme={theme} /> : null;
      case 'alerts': return <PriceAlerts darkMode={darkMode} theme={theme} />;
      case 'comparator': return recs.length ? <StockComparator tickers={recs} darkMode={darkMode} /> : null;
      default: return null;
    }
  };

  /* ─── Loading State ─── */
  if (loading) {
    return (
      <div>
        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <SkeletonBlock darkMode={darkMode} height={28} width="200px" mb={8} />
        <SkeletonBlock darkMode={darkMode} height={14} width="140px" mb={20} />
        <SkeletonBlock darkMode={darkMode} height={120} mb={12} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          <SkeletonBlock darkMode={darkMode} height={70} />
          <SkeletonBlock darkMode={darkMode} height={70} />
          <SkeletonBlock darkMode={darkMode} height={70} />
        </div>
        <SkeletonBlock darkMode={darkMode} height={160} mb={12} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <SkeletonBlock darkMode={darkMode} height={100} />
          <SkeletonBlock darkMode={darkMode} height={100} />
        </div>
      </div>
    );
  }

  /* ─── Error State ─── */
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
        <div style={{ fontSize: '0.82rem', color: theme.textSecondary, marginBottom: '1.25rem' }}>
          {error}
        </div>
        <button onClick={fetchData} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '0.5rem 1.2rem', borderRadius: 8, border: 'none',
          background: '#3b82f6', color: 'white', fontSize: '0.82rem',
          fontWeight: 600, cursor: 'pointer',
        }}>
          <RefreshCw size={14} /> Tentar novamente
        </button>
      </div>
    );
  }

  /* ─── Build render blocks ─── */
  const blocks: Array<{ type: 'full'; id: string } | { type: 'grid'; ids: string[] }> = [];
  let batch: string[] = [];
  visible.forEach(id => {
    if (GRID.has(id)) { batch.push(id); }
    else { if (batch.length) { blocks.push({ type: 'grid', ids: [...batch] }); batch = []; } blocks.push({ type: 'full', id }); }
  });
  if (batch.length) blocks.push({ type: 'grid', ids: batch });

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
            {error && recs.length > 0 && (
              <span style={{ fontSize: '0.65rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 2 }}>
                <AlertCircle size={9} /> Dados podem estar desatualizados
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
            display: 'flex', alignItems: 'center', gap: 4, padding: '0.4rem 0.65rem', borderRadius: 8,
            border: 'none', background: '#3b82f6', color: 'white',
            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
          }}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* ─── Quick Stats Bar ─── */}
      {recs.length > 0 && (
        <div style={{
          display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap',
        }}>
          {[
            { label: 'Compra', value: totalBuy, color: '#10b981', icon: <ArrowUpRight size={11} /> },
            { label: 'Neutro', value: totalNeutral, color: '#94a3b8', icon: <Minus size={11} /> },
            { label: 'Venda', value: totalSell, color: '#ef4444', icon: <ArrowDownRight size={11} /> },
            ...(followedCount > 0 ? [{ label: 'Seguindo', value: followedCount, color: '#f59e0b', icon: <Briefcase size={11} /> }] : []),
          ].map(s => (
            <div key={s.label} style={{
              flex: '1 1 0', minWidth: 80, padding: '0.55rem 0.65rem',
              borderRadius: 10, background: theme.card || (darkMode ? '#1e293b' : '#ffffff'),
              border: `1px solid ${theme.border}`,
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${s.color}12`, flexShrink: 0, color: s.color,
              }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
                <div style={{ fontSize: '0.62rem', color: theme.textSecondary, fontWeight: 500 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Widgets ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {blocks.map((b, i) => {
          if (b.type === 'grid') {
            return (
              <div key={`g${i}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '0.65rem' }}>
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
          <Settings2 size={32} style={{ opacity: 0.2, marginBottom: 12 }} color={theme.textSecondary} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: 4 }}>
            Nenhum widget ativo
          </div>
          <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '1rem' }}>
            Personalize seu dashboard escolhendo os widgets que mais importam para você.
          </div>
          <button onClick={() => setPrefsOpen(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
            background: '#3b82f6', color: 'white', fontSize: '0.8rem',
            fontWeight: 600, cursor: 'pointer',
          }}>
            <Settings2 size={14} /> Personalizar
          </button>
        </div>
      )}

      {/* ─── Widget Preferences Panel ─── */}
      <WidgetPreferences open={prefsOpen} onClose={() => setPrefsOpen(false)} widgets={configs}
        onToggle={id => setEnabled(p => ({ ...p, [id]: !p[id] }))}
        onReorder={(f, t) => setOrder(p => { const n = [...p]; const [x] = n.splice(f, 1); n.splice(t, 0, x); return n; })}
        darkMode={darkMode} theme={theme} isPro={isPro} />
    </div>
  );
};

export default MyDashboardPage;
