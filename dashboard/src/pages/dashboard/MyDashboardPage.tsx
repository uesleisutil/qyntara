import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  RefreshCw, Clock, Settings2,
  Trophy, Sparkles, Briefcase, BarChart3, Target,
  Bell, ArrowUpRight, ArrowDownRight, AlertCircle,
  TrendingUp, TrendingDown, Layers, Crown,
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
import ProValue from '../../components/shared/ProValue';
import Sparkline from '../../components/shared/Sparkline';
import { markChecklistItem } from '../../components/shared/ActivationChecklist';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }
interface Rec {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}
interface Carteira {
  carteiraId: string; name: string; color: string; icon: string;
  tickers: string[]; createdAt: string;
}

const PREFS_KEY = 'b3tr_dashboard_widgets_v3';
const COLLAPSED_KEY = 'b3tr_dashboard_collapsed';

const WIDGETS = [
  { id: 'highlight', label: 'Destaque do Dia', proOnly: false },
  { id: 'marketPulse', label: 'Pulso do Mercado', proOnly: false },
  { id: 'topPicks', label: 'Top Recomendações', proOnly: false },
  { id: 'positions', label: 'Minhas Posições', proOnly: false },
  { id: 'signals', label: 'Novidades', proOnly: false },
  { id: 'performance', label: 'Performance', proOnly: true },
  { id: 'carteiras', label: 'Minhas Carteiras', proOnly: true },
  { id: 'goal', label: 'Meta', proOnly: true },
  { id: 'alerts', label: 'Alertas de Preço', proOnly: true },
];

const TOOLTIPS: Record<string, string> = {
  highlight: 'Ação com maior score do dia e previsão de retorno em 20 dias.',
  marketPulse: 'Visão geral do mercado: sinais, retorno médio e volatilidade.',
  topPicks: 'As 5 ações com maior score de compra do dia.',
  positions: 'Ações que você segue com retorno individual.',
  signals: 'Mudanças recentes de sinal e variações no ranking.',
  performance: 'P&L acumulado, taxa de acerto e posições.',
  carteiras: 'Resumo das suas carteiras personalizadas.',
  goal: 'Defina e acompanhe sua meta de rentabilidade.',
  alerts: 'Alertas de preço para suas ações.',
};

const ICONS: Record<string, (c: string) => React.ReactNode> = {
  highlight: c => <Trophy size={13} color={c} />,
  marketPulse: c => <BarChart3 size={13} color={c} />,
  topPicks: c => <TrendingUp size={13} color={c} />,
  positions: c => <Briefcase size={13} color={c} />,
  signals: c => <Sparkles size={13} color={c} />,
  performance: c => <BarChart3 size={13} color={c} />,
  carteiras: c => <Layers size={13} color={c} />,
  goal: c => <Target size={13} color={c} />,
  alerts: c => <Bell size={13} color={c} />,
};

const COLORS: Record<string, string> = {
  highlight: '#d4a84b', marketPulse: '#5a9e87', topPicks: '#4ead8a',
  positions: '#5a9e87', signals: '#5a9e87',
  performance: '#4ead8a', carteiras: '#5a9e87', goal: '#d4a84b', alerts: '#e07070',
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

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
};

/* ─── Market Pulse Widget ─── */
const MarketPulse: React.FC<{
  recs: Rec[]; darkMode: boolean; theme: Record<string, string>; isPro: boolean;
}> = ({ recs, theme, isPro }) => {
  const buys = recs.filter(r => r.score >= SCORE_BUY_THRESHOLD);
  const sells = recs.filter(r => r.score <= SCORE_SELL_THRESHOLD);
  const neutrals = recs.length - buys.length - sells.length;
  const avgBuyReturn = buys.length
    ? (buys.reduce((s, r) => s + r.exp_return_20, 0) / buys.length) * 100 : 0;
  const avgVol = recs.length
    ? recs.reduce((s, r) => s + r.vol_20d, 0) / recs.length * 100 : 0;
  const avgScore = buys.length
    ? buys.reduce((s, r) => s + r.score, 0) / buys.length : 0;

  const stat = (label: string, value: string, sub: string, color: string) => (
    <div style={{ flex: '1 1 0', minWidth: 70, textAlign: 'center' }}>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: '0.6rem', color: theme.textSecondary, opacity: 0.7, marginTop: 1 }}>{sub}</div>
    </div>
  );

  return (
    <div>
      {/* Signal bars */}
      <div style={{ display: 'flex', gap: 2, height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: '0.75rem' }}>
        {buys.length > 0 && <div style={{ flex: buys.length, background: '#4ead8a', borderRadius: 3 }} />}
        {neutrals > 0 && <div style={{ flex: neutrals, background: '#8fa89c', borderRadius: 3 }} />}
        {sells.length > 0 && <div style={{ flex: sells.length, background: '#e07070', borderRadius: 3 }} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.68rem' }}>
        <span style={{ color: '#4ead8a', fontWeight: 600 }}>
          <ArrowUpRight size={10} style={{ verticalAlign: 'middle' }} /> {buys.length} Compra
        </span>
        <span style={{ color: '#8fa89c' }}>{neutrals} Neutro</span>
        <span style={{ color: '#e07070', fontWeight: 600 }}>
          <ArrowDownRight size={10} style={{ verticalAlign: 'middle' }} /> {sells.length} Venda
        </span>
      </div>
      {/* Key metrics */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {stat('Ret. Médio (Compra)', <ProValue isPro={isPro} placeholder="+0.0%">{`${avgBuyReturn >= 0 ? '+' : ''}${fmt(avgBuyReturn, 1)}%`}</ProValue> as any, '20 dias', avgBuyReturn >= 0 ? '#4ead8a' : '#e07070')}
        {stat('Score Médio', fmt(avgScore, 1), 'sinais compra', '#5a9e87')}
        {stat('Vol. Média', <ProValue isPro={isPro} placeholder="0.0%">{`${fmt(avgVol, 1)}%`}</ProValue> as any, '20 dias', '#d4a84b')}
      </div>
    </div>
  );
};

/* ─── Top Picks Widget ─── */
const TopPicks: React.FC<{
  recs: Rec[]; darkMode: boolean; theme: Record<string, string>; isPro: boolean;
  sparklines: Record<string, number[]>;
  onNavigate: () => void;
}> = ({ recs, darkMode, theme, isPro, sparklines, onNavigate }) => {
  const topBuys = useMemo(() =>
    recs.filter(r => r.score >= SCORE_BUY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
  [recs]);

  if (!topBuys.length) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem', color: theme.textSecondary, fontSize: '0.78rem' }}>
        Nenhum sinal de compra hoje.
      </div>
    );
  }

  const thS: React.CSSProperties = {
    padding: '0.35rem 0.4rem', fontSize: '0.65rem', fontWeight: 600,
    color: theme.textSecondary, textAlign: 'left',
    borderBottom: `1px solid ${theme.border}`,
  };
  const tdS: React.CSSProperties = {
    padding: '0.4rem 0.4rem', fontSize: '0.78rem',
    borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
  };

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thS}>Ação</th>
              <th style={{ ...thS, textAlign: 'center' }}>Gráfico</th>
              <th style={{ ...thS, textAlign: 'right' }}>Score</th>
              <th style={{ ...thS, textAlign: 'right' }}>Ret. Esp.</th>
              <th style={{ ...thS, textAlign: 'right' }}>Preço</th>
            </tr>
          </thead>
          <tbody>
            {topBuys.map(r => {
              const retPct = r.exp_return_20 * 100;
              return (
                <tr key={r.ticker}>
                  <td style={{ ...tdS, fontWeight: 700, color: theme.text }}>{r.ticker}</td>
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    {sparklines[r.ticker]?.length > 1
                      ? <Sparkline data={sparklines[r.ticker]} width={50} height={16} />
                      : <span style={{ color: theme.textSecondary, fontSize: '0.65rem' }}>—</span>
                    }
                  </td>
                  <td style={{ ...tdS, textAlign: 'right', fontWeight: 600, color: '#5a9e87' }}>
                    {fmt(r.score, 1)}
                  </td>
                  <td style={{ ...tdS, textAlign: 'right' }}>
                    <ProValue isPro={isPro} style={{ fontWeight: 600, color: retPct >= 0 ? '#4ead8a' : '#e07070', fontSize: '0.78rem' }} placeholder="+0.0%">
                      {retPct >= 0 ? '+' : ''}{fmt(retPct, 1)}%
                    </ProValue>
                  </td>
                  <td style={{ ...tdS, textAlign: 'right', color: theme.textSecondary, fontSize: '0.75rem' }}>
                    R$ {fmt(r.last_close)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button onClick={onNavigate} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        width: '100%', padding: '0.45rem', marginTop: '0.5rem', borderRadius: 8,
        border: `1px solid ${theme.border}`, background: 'transparent',
        color: theme.textSecondary, fontSize: '0.72rem', cursor: 'pointer',
        transition: 'all 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#5a9e87'; e.currentTarget.style.color = '#5a9e87'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.textSecondary; }}
      >
        Ver todas as recomendações <ArrowUpRight size={12} />
      </button>
    </div>
  );
};

/* ─── Carteiras Summary Widget ─── */
const CarteirasSummary: React.FC<{
  darkMode: boolean; theme: Record<string, string>;
  onNavigate: () => void;
}> = ({ darkMode, theme, onNavigate }) => {
  const [carteiras, setCarteiras] = useState<Carteira[]>([]);
  const [tickerData, setTickerData] = useState<Record<string, { exp_return_20: number; score: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [recsRes, cartRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } }),
          fetch(`${API_BASE_URL}/carteiras`, { headers: authHeaders() }),
        ]);
        if (recsRes.ok) {
          const data = await recsRes.json();
          const map: Record<string, { exp_return_20: number; score: number }> = {};
          (data.recommendations || []).forEach((r: any) => {
            map[r.ticker] = { exp_return_20: r.exp_return_20 || 0, score: r.score || 0 };
          });
          setTickerData(map);
        }
        if (cartRes.ok) {
          const data = await cartRes.json();
          setCarteiras(data.carteiras || []);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return <div style={{ padding: '0.75rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.78rem' }}>Carregando...</div>;
  }

  if (!carteiras.length) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem' }}>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>
          Nenhuma carteira criada ainda.
        </div>
        <button onClick={onNavigate} style={{
          padding: '0.35rem 0.75rem', borderRadius: 6, border: `1px solid ${theme.border}`,
          background: 'transparent', color: '#5a9e87', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
        }}>
          Criar Carteira
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {carteiras.slice(0, 4).map(c => {
        const tds = c.tickers.map(t => tickerData[t]).filter(Boolean);
        const avgRet = tds.length ? (tds.reduce((s, q) => s + q.exp_return_20, 0) / tds.length) * 100 : 0;
        const buys = tds.filter(q => q.score >= SCORE_BUY_THRESHOLD).length;
        const isUp = avgRet >= 0;
        return (
          <div key={c.carteiraId} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.45rem 0.35rem', borderRadius: 8,
            borderLeft: `3px solid ${c.color}`,
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </div>
              <div style={{ fontSize: '0.65rem', color: theme.textSecondary }}>
                {c.tickers.length} {c.tickers.length === 1 ? 'ação' : 'ações'}
                {buys > 0 && <span style={{ color: '#4ead8a', marginLeft: '0.3rem' }}>· {buys} compra</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '0.85rem', fontWeight: 700,
                color: tds.length ? (isUp ? '#4ead8a' : '#e07070') : theme.textSecondary,
                display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end',
              }}>
                {tds.length > 0 && (isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
                {tds.length ? `${isUp ? '+' : ''}${fmt(avgRet, 1)}%` : '—'}
              </div>
              <div style={{ fontSize: '0.6rem', color: theme.textSecondary }}>ret. esperado</div>
            </div>
          </div>
        );
      })}
      {carteiras.length > 4 && (
        <div style={{ fontSize: '0.7rem', color: theme.textSecondary, textAlign: 'center', padding: '0.25rem' }}>
          +{carteiras.length - 4} carteira{carteiras.length - 4 > 1 ? 's' : ''}
        </div>
      )}
      <button onClick={onNavigate} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        width: '100%', padding: '0.4rem', marginTop: '0.25rem', borderRadius: 8,
        border: `1px solid ${theme.border}`, background: 'transparent',
        color: theme.textSecondary, fontSize: '0.72rem', cursor: 'pointer',
        transition: 'all 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#5a9e87'; e.currentTarget.style.color = '#5a9e87'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.textSecondary; }}
      >
        Gerenciar carteiras <ArrowUpRight size={12} />
      </button>
    </div>
  );
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
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
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

  // Sync new widgets into order
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

  // Fetch sparkline data
  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const key = `prices/year=${now.getFullYear()}/month=${String(now.getMonth() + 1).padStart(2, '0')}/daily_prices.json`;
        const res = await fetch(`${API_BASE_URL}/s3-proxy?key=${key}`, { headers: { 'x-api-key': API_KEY } });
        if (!res.ok) return;
        const rows: { date: string; ticker: string; close: string }[] = await res.json();
        const map: Record<string, { date: string; close: number }[]> = {};
        rows.forEach(r => {
          if (!map[r.ticker]) map[r.ticker] = [];
          map[r.ticker].push({ date: r.date, close: parseFloat(r.close) });
        });
        const sp: Record<string, number[]> = {};
        Object.entries(map).forEach(([ticker, entries]) => {
          entries.sort((a, b) => a.date.localeCompare(b.date));
          sp[ticker] = entries.slice(-20).map(e => e.close);
        });
        setSparklines(sp);
      } catch { /* silent */ }
    })();
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
    return { id, label: w.label, icon: ICONS[id]?.(COLORS[id] || '#5a9e87'), enabled: enabled[id] !== false, proOnly: w.proOnly };
  }).filter(Boolean) as WidgetConfig[], [order, enabled]);

  const renderWidget = (id: string) => {
    switch (id) {
      case 'highlight':
        return topTicker ? <DailyHighlight darkMode={darkMode} theme={theme} topTicker={topTicker} totalBuy={totalBuy} totalSell={totalSell} totalNeutral={totalNeutral} date={date} isPro={isPro} /> : null;
      case 'marketPulse':
        return recs.length ? <MarketPulse recs={recs} darkMode={darkMode} theme={theme} isPro={isPro} /> : null;
      case 'topPicks':
        return recs.length ? <TopPicks recs={recs} darkMode={darkMode} theme={theme} isPro={isPro} sparklines={sparklines} onNavigate={() => navigate('/dashboard/recommendations')} /> : null;
      case 'positions':
        return <MyPositionsPanel darkMode={darkMode} theme={theme} />;
      case 'signals':
        return <SignalChangesDropdown darkMode={darkMode} theme={theme} />;
      case 'performance':
        return <PersonalPerformance darkMode={darkMode} theme={theme} />;
      case 'carteiras':
        return <CarteirasSummary darkMode={darkMode} theme={theme} onNavigate={() => navigate('/dashboard/carteiras')} />;
      case 'goal':
        return <GoalTracker darkMode={darkMode} theme={theme} />;
      case 'alerts':
        return <PriceAlerts darkMode={darkMode} theme={theme} />;
      default: return null;
    }
  };

  /* ─── Loading ─── */
  if (loading) {
    const sk: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1a2626' : '#d4e5dc'} 25%, ${darkMode ? '#2a3d36' : '#e8f0ed'} 50%, ${darkMode ? '#1a2626' : '#d4e5dc'} 75%)`,
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
        background: theme.card || (darkMode ? '#1a2626' : '#ffffff'),
        borderRadius: 16, border: `1px solid ${theme.border}`,
      }}>
        <AlertCircle size={36} color="#e07070" style={{ marginBottom: '0.75rem', opacity: 0.7 }} />
        <div style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '0.4rem' }}>
          Não foi possível carregar os dados
        </div>
        <div style={{ fontSize: '0.82rem', color: theme.textSecondary, marginBottom: '1.25rem' }}>{error}</div>
        <button onClick={fetchData} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '0.5rem 1.2rem', borderRadius: 8, border: 'none',
          background: '#5a9e87', color: 'white', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
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
              <span style={{ fontSize: '0.65rem', color: '#4ead8a', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Clock size={9} /> {relTime(lastUpdated)}
              </span>
            )}
            {isPro && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '0.1rem 0.4rem', borderRadius: 10,
                background: 'linear-gradient(135deg, #d4a84b, #b08a30)',
                color: 'white', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.03em',
              }}>
                <Crown size={9} /> PRO
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
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#5a9e87'; e.currentTarget.style.color = '#5a9e87'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.textSecondary; }}
          >
            <Settings2 size={13} /> Personalizar
          </button>
          <button onClick={fetchData} style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.5rem', borderRadius: 8,
            border: 'none', background: '#5a9e87', color: 'white', cursor: 'pointer',
          }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

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
          background: theme.card || (darkMode ? '#1a2626' : '#ffffff'),
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
