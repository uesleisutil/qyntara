import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, TrendingUp, TrendingDown, BarChart3, Target, ChevronDown, ChevronRight, Activity, Calendar, ArrowUpRight, ArrowDownRight, Minus, Search, Filter, Award, SlidersHorizontal } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../shared/InfoTooltip';

interface TrackingTabProps { darkMode?: boolean; }

interface PriceRow { date: string; ticker: string; close: string; }
interface HistoryEntry { date: string; exp_return_20: number; score: number; }
interface Validation { ticker: string; prediction_date: string; target_date: string; predicted_return: number; actual_return: number | null; error: number | null; direction_correct: boolean | null; days_elapsed: number; }

interface TickerProgress {
  ticker: string;
  basePrice: number;
  currentPrice: number;
  predictedReturn: number;
  partialReturn: number;
  score: number;
  signal: 'Compra' | 'Venda' | 'Neutro';
  dailyPrices: { date: string; close: number; partialReturn: number }[];
  daysElapsed: number;
  totalDays: number;
  trackingPrediction: boolean;
}

interface SafraProgress {
  predictionDate: string;
  targetDate: string;
  daysElapsed: number;
  totalDays: number;
  progress: number;
  tickers: TickerProgress[];
  avgPredicted: number;
  avgPartialReturn: number;
  buyTickers: TickerProgress[];
  sellTickers: TickerProgress[];
  trackingRate: number;
}

type SortKey = 'date' | 'tracking' | 'return' | 'progress';
type ViewMode = 'safras' | 'ranking';

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const TrackingTab: React.FC<TrackingTabProps> = ({ darkMode = false }) => {
  const [prices, setPrices] = useState<Record<string, Record<string, number>>>({});
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [validations, setValidations] = useState<Validation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSafra, setExpandedSafra] = useState<string | null>(null);

  // Filters
  const [filterSignal, setFilterSignal] = useState<'all' | 'Compra' | 'Venda'>('all');
  const [dateRange, setDateRange] = useState<'all' | '7d' | '14d' | '30d'>('all');
  const [searchTicker, setSearchTicker] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [viewMode, setViewMode] = useState<ViewMode>('safras');
  const [showFilters, setShowFilters] = useState(false);

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    hover: darkMode ? '#334155' : '#f1f5f9',
    green: '#10b981', red: '#ef4444', yellow: '#f59e0b', blue: '#3b82f6', purple: '#8b5cf6',
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`,
    borderRadius: 12, padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  const chipStyle = (active: boolean, color?: string): React.CSSProperties => ({
    padding: '0.35rem 0.7rem', borderRadius: 20, fontSize: '0.76rem', fontWeight: active ? 600 : 400,
    border: `1px solid ${active ? (color || theme.blue) : theme.border}`,
    background: active ? (color || theme.blue) : 'transparent',
    color: active ? 'white' : theme.textSecondary,
    cursor: 'pointer', transition: 'all 0.15s', WebkitAppearance: 'none' as any, appearance: 'none' as any,
    whiteSpace: 'nowrap' as const,
  });

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true); setError(null);
    try {
      const headers = { 'x-api-key': API_KEY };
      const [histRes, valRes, mar, feb] = await Promise.all([
        fetch(`${API_BASE_URL}/api/recommendations/history`, { headers }),
        fetch(`${API_BASE_URL}/api/recommendations/validation`, { headers }),
        fetch(`${API_BASE_URL}/s3-proxy?key=curated/daily_monthly/year=2026/month=03/daily.csv`, { headers }),
        fetch(`${API_BASE_URL}/s3-proxy?key=curated/daily_monthly/year=2026/month=02/daily.csv`, { headers }),
      ]);
      if (!histRes.ok || !valRes.ok) throw new Error('Falha ao carregar dados');
      const histData = await histRes.json();
      const valData = await valRes.json();
      const marData: PriceRow[] = mar.ok ? await mar.json() : [];
      const febData: PriceRow[] = feb.ok ? await feb.json() : [];
      setHistory(histData.data || {});
      setValidations(valData.validations || []);
      const priceMap: Record<string, Record<string, number>> = {};
      [...febData, ...marData].forEach(row => {
        if (!priceMap[row.ticker]) priceMap[row.ticker] = {};
        priceMap[row.ticker][row.date] = parseFloat(row.close);
      });
      setPrices(priceMap);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  // Build safra progress data
  const safras: SafraProgress[] = useMemo(() => {
    if (!Object.keys(prices).length || !Object.keys(history).length) return [];
    const allDates = new Set<string>();
    Object.values(history).forEach(entries => entries.forEach(e => allDates.add(e.date)));
    const sortedDates = Array.from(allDates).sort();
    const allPriceDates = new Set<string>();
    Object.values(prices).forEach(tp => Object.keys(tp).forEach(d => allPriceDates.add(d)));
    const tradingDays = Array.from(allPriceDates).sort();

    return sortedDates.map(predDate => {
      const valForDate = validations.find(v => v.prediction_date === predDate);
      const targetDate = valForDate?.target_date || '';
      const futureDays = tradingDays.filter(d => d > predDate);
      const daysElapsed = futureDays.length;
      const totalDays = 20;
      const progress = Math.min(daysElapsed / totalDays, 1);
      const latestPriceDate = tradingDays[tradingDays.length - 1] || predDate;

      const tickers: TickerProgress[] = [];
      Object.entries(history).forEach(([ticker, entries]) => {
        const predEntry = entries.find(e => e.date === predDate);
        if (!predEntry) return;
        const tickerPrices = prices[ticker];
        if (!tickerPrices) return;
        let basePrice = tickerPrices[predDate];
        if (!basePrice) {
          const priorDates = Object.keys(tickerPrices).filter(d => d <= predDate).sort();
          if (priorDates.length) basePrice = tickerPrices[priorDates[priorDates.length - 1]];
        }
        if (!basePrice) return;
        const currentPrice = tickerPrices[latestPriceDate] || basePrice;
        const partialReturn = (currentPrice - basePrice) / basePrice;
        const dailyPrices = futureDays.filter(d => tickerPrices[d]).map(d => ({
          date: d, close: tickerPrices[d], partialReturn: (tickerPrices[d] - basePrice) / basePrice,
        }));
        const signal: 'Compra' | 'Venda' | 'Neutro' =
          predEntry.score >= 1.5 ? 'Compra' : predEntry.score <= -1.5 ? 'Venda' : 'Neutro';
        const trackingPrediction = predEntry.exp_return_20 >= 0 ? partialReturn >= 0 : partialReturn <= 0;
        tickers.push({ ticker, basePrice, currentPrice, predictedReturn: predEntry.exp_return_20,
          partialReturn, score: predEntry.score, signal, dailyPrices, daysElapsed, totalDays, trackingPrediction });
      });
      if (!tickers.length) return null;
      tickers.sort((a, b) => Math.abs(b.predictedReturn) - Math.abs(a.predictedReturn));
      const avgPredicted = tickers.reduce((s, t) => s + t.predictedReturn, 0) / tickers.length;
      const avgPartialReturn = tickers.reduce((s, t) => s + t.partialReturn, 0) / tickers.length;
      const buyTickers = tickers.filter(t => t.signal === 'Compra');
      const sellTickers = tickers.filter(t => t.signal === 'Venda');
      const trackingRate = tickers.filter(t => t.trackingPrediction).length / tickers.length;
      return { predictionDate: predDate, targetDate, daysElapsed, totalDays, progress,
        tickers, avgPredicted, avgPartialReturn, buyTickers, sellTickers, trackingRate };
    }).filter(Boolean).reverse() as SafraProgress[];
  }, [prices, history, validations]);

  // Filtered safras (date range + ticker search)
  const filteredSafras = useMemo(() => {
    let result = [...safras];

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      const daysBack = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : 30;
      const cutoff = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      result = result.filter(s => s.predictionDate >= cutoff);
    }

    // Ticker search — filter safras to only include matching tickers
    if (searchTicker.trim()) {
      const q = searchTicker.trim().toUpperCase();
      result = result.map(s => {
        const matched = s.tickers.filter(t => t.ticker.includes(q));
        if (!matched.length) return null;
        return { ...s, tickers: matched,
          buyTickers: matched.filter(t => t.signal === 'Compra'),
          sellTickers: matched.filter(t => t.signal === 'Venda'),
          avgPredicted: matched.reduce((a, t) => a + t.predictedReturn, 0) / matched.length,
          avgPartialReturn: matched.reduce((a, t) => a + t.partialReturn, 0) / matched.length,
          trackingRate: matched.filter(t => t.trackingPrediction).length / matched.length,
        };
      }).filter(Boolean) as SafraProgress[];
    }

    // Sort
    if (sortBy === 'tracking') result.sort((a, b) => b.trackingRate - a.trackingRate);
    else if (sortBy === 'return') result.sort((a, b) => b.avgPartialReturn - a.avgPartialReturn);
    else if (sortBy === 'progress') result.sort((a, b) => b.progress - a.progress);
    // 'date' is already default (reverse chronological)

    return result;
  }, [safras, dateRange, searchTicker, sortBy]);

  // Global stats (computed from filtered safras)
  const globalStats = useMemo(() => {
    const src = filteredSafras;
    if (!src.length) return null;
    const allTickers = src.flatMap(s => s.tickers);
    const totalPredictions = allTickers.length;
    const avgTracking = src.reduce((s, sf) => s + sf.trackingRate, 0) / src.length;
    const buyTickers = allTickers.filter(t => t.signal === 'Compra');
    const sellTickers = allTickers.filter(t => t.signal === 'Venda');
    const avgBuyReturn = buyTickers.length ? buyTickers.reduce((s, t) => s + t.partialReturn, 0) / buyTickers.length : 0;
    const avgSellReturn = sellTickers.length ? sellTickers.reduce((s, t) => s + t.partialReturn, 0) / sellTickers.length : 0;
    return { totalPredictions, avgTracking, avgBuyReturn, avgSellReturn, safraCount: src.length, buyCount: buyTickers.length, sellCount: sellTickers.length };
  }, [filteredSafras]);

  // Ticker ranking — aggregate performance across all filtered safras
  const tickerRanking = useMemo(() => {
    const map: Record<string, { ticker: string; appearances: number; avgPartial: number; avgPredicted: number; trackingCount: number; totalCount: number; signals: { Compra: number; Venda: number; Neutro: number }; bestReturn: number; worstReturn: number }> = {};
    filteredSafras.forEach(s => {
      s.tickers.forEach(t => {
        if (!map[t.ticker]) map[t.ticker] = { ticker: t.ticker, appearances: 0, avgPartial: 0, avgPredicted: 0, trackingCount: 0, totalCount: 0, signals: { Compra: 0, Venda: 0, Neutro: 0 }, bestReturn: -Infinity, worstReturn: Infinity };
        const m = map[t.ticker];
        m.appearances++;
        m.avgPartial += t.partialReturn;
        m.avgPredicted += t.predictedReturn;
        if (t.trackingPrediction) m.trackingCount++;
        m.totalCount++;
        m.signals[t.signal]++;
        if (t.partialReturn > m.bestReturn) m.bestReturn = t.partialReturn;
        if (t.partialReturn < m.worstReturn) m.worstReturn = t.partialReturn;
      });
    });
    return Object.values(map).map(m => ({
      ...m,
      avgPartial: m.avgPartial / m.appearances,
      avgPredicted: m.avgPredicted / m.appearances,
      trackingRate: m.trackingCount / m.totalCount,
    })).sort((a, b) => b.avgPartial - a.avgPartial);
  }, [filteredSafras]);

  // Sparkline component
  const Sparkline: React.FC<{ data: { partialReturn: number }[]; predicted: number; width?: number; height?: number }> = ({ data, predicted, width = 120, height = 32 }) => {
    if (!data.length) return <span style={{ color: theme.textSecondary, fontSize: '0.7rem' }}>—</span>;
    const values = data.map(d => d.partialReturn);
    const allVals = [...values, predicted, 0];
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const range = max - min || 0.01;
    const toY = (v: number) => height - ((v - min) / range) * height;
    const toX = (i: number) => (i / Math.max(values.length - 1, 1)) * width;
    const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <line x1={0} y1={toY(0)} x2={width} y2={toY(0)} stroke={theme.textSecondary} strokeWidth={0.5} strokeDasharray="2,2" opacity={0.5} />
        <line x1={0} y1={toY(predicted)} x2={width} y2={toY(predicted)} stroke={theme.blue} strokeWidth={0.8} strokeDasharray="3,2" opacity={0.6} />
        <polyline points={points} fill="none" stroke={values[values.length - 1] >= 0 ? theme.green : theme.red} strokeWidth={1.5} />
        <circle cx={toX(values.length - 1)} cy={toY(values[values.length - 1])} r={2.5} fill={values[values.length - 1] >= 0 ? theme.green : theme.red} />
      </svg>
    );
  };

  // Progress bar
  const ProgressBar: React.FC<{ progress: number; daysElapsed: number; totalDays: number; trackingRate: number }> = ({ progress, daysElapsed, totalDays, trackingRate }) => {
    const barColor = trackingRate >= 0.6 ? theme.green : trackingRate >= 0.4 ? theme.yellow : theme.red;
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: theme.textSecondary, marginBottom: 3 }}>
          <span>Dia {Math.min(daysElapsed, totalDays)} de {totalDays}</span>
          <span>{fmt(progress * 100, 0)}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: darkMode ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(progress * 100, 100)}%`,
            background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`, transition: 'width 0.5s ease' }} />
        </div>
      </div>
    );
  };

  // Maturity badge
  const MaturityBadge: React.FC<{ progress: number }> = ({ progress }) => {
    const pct = progress * 100;
    let label: string, color: string, bg: string;
    if (pct >= 90) { label = 'Madura'; color = theme.green; bg = `${theme.green}15`; }
    else if (pct >= 50) { label = 'Em andamento'; color = theme.blue; bg = `${theme.blue}15`; }
    else { label = 'Recente'; color = theme.purple; bg = `${theme.purple}15`; }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0.12rem 0.45rem', borderRadius: 10, fontSize: '0.65rem', fontWeight: 600, background: bg, color }}>{label}</span>
    );
  };

  if (loading) {
    const skeletonPulse: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1e293b' : '#e2e8f0'} 25%, ${darkMode ? '#334155' : '#f1f5f9'} 50%, ${darkMode ? '#1e293b' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ ...skeletonPulse, height: 28, width: 250, marginBottom: 8 }} />
          <div style={{ ...skeletonPulse, height: 16, width: 350 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ ...cardStyle, padding: '1rem' }}>
              <div style={{ ...skeletonPulse, height: 14, width: 80, marginBottom: 8 }} />
              <div style={{ ...skeletonPulse, height: 28, width: 60 }} />
            </div>
          ))}
        </div>
        {[1,2,3].map(i => <div key={i} style={{ ...skeletonPulse, height: 100, marginBottom: 8 }} />)}
      </div>
    );
  }

  const activeFilterCount = (dateRange !== 'all' ? 1 : 0) + (filterSignal !== 'all' ? 1 : 0) + (searchTicker ? 1 : 0) + (sortBy !== 'date' ? 1 : 0);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>
          Acompanhamento por Safra
        </h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0 }}>
          Acompanhe dia a dia como cada safra de previsões está evoluindo em relação à realidade do mercado
        </p>
      </div>

      {error && (
        <div style={{ ...cardStyle, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* View mode toggle + filter toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {/* View mode */}
        <div style={{ display: 'flex', borderRadius: 8, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
          {([
            { key: 'safras' as ViewMode, label: 'Por Safra', icon: <Calendar size={13} /> },
            { key: 'ranking' as ViewMode, label: 'Ranking', icon: <Award size={13} /> },
          ]).map(v => (
            <button key={v.key} onClick={() => setViewMode(v.key)} style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.7rem',
              border: 'none', fontSize: '0.76rem', fontWeight: viewMode === v.key ? 600 : 400,
              background: viewMode === v.key ? (darkMode ? '#334155' : '#e2e8f0') : 'transparent',
              color: viewMode === v.key ? theme.text : theme.textSecondary,
              cursor: 'pointer', transition: 'all 0.15s', WebkitAppearance: 'none' as any,
            }}>{v.icon} {v.label}</button>
          ))}
        </div>

        {/* Filter toggle */}
        <button onClick={() => setShowFilters(!showFilters)} style={{
          ...chipStyle(showFilters || activeFilterCount > 0),
          display: 'flex', alignItems: 'center', gap: '0.3rem',
        }}>
          <SlidersHorizontal size={13} /> Filtros {activeFilterCount > 0 && <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 10, padding: '0 5px', fontSize: '0.65rem' }}>{activeFilterCount}</span>}
        </button>

        {/* Quick date chips (always visible) */}
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
          {([
            { key: '7d' as const, label: '7 dias' },
            { key: '14d' as const, label: '14 dias' },
            { key: 'all' as const, label: 'Todas' },
          ]).map(d => (
            <button key={d.key} onClick={() => setDateRange(d.key)} style={chipStyle(dateRange === d.key)}>{d.label}</button>
          ))}
        </div>
      </div>

      {/* Expanded filters panel */}
      {showFilters && (
        <div style={{ ...cardStyle, marginBottom: '0.75rem', padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Ticker search */}
          <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 140 }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: theme.textSecondary }} />
            <input type="text" placeholder="Buscar ticker..." value={searchTicker}
              onChange={e => setSearchTicker(e.target.value)}
              style={{
                width: '100%', padding: '0.45rem 0.5rem 0.45rem 1.8rem', borderRadius: 8,
                border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text,
                fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
              }} />
          </div>

          {/* Signal filter */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {([
              { key: 'all' as const, label: 'Todas' },
              { key: 'Compra' as const, label: 'Compra', color: theme.green },
              { key: 'Venda' as const, label: 'Venda', color: theme.red },
            ]).map(f => (
              <button key={f.key} onClick={() => setFilterSignal(f.key)}
                style={chipStyle(filterSignal === f.key, filterSignal === f.key ? f.color : undefined)}>{f.label}</button>
            ))}
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Filter size={13} color={theme.textSecondary} />
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} style={{
              padding: '0.35rem 0.5rem', borderRadius: 8, border: `1px solid ${theme.border}`,
              background: theme.bg, color: theme.text, fontSize: '0.78rem', cursor: 'pointer',
            }}>
              <option value="date">Mais recente</option>
              <option value="tracking">Maior acerto</option>
              <option value="return">Maior retorno</option>
              <option value="progress">Mais madura</option>
            </select>
          </div>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button onClick={() => { setDateRange('all'); setFilterSignal('all'); setSearchTicker(''); setSortBy('date'); }}
              style={{ ...chipStyle(false), fontSize: '0.72rem', color: theme.red, borderColor: `${theme.red}40` }}>
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Global KPIs */}
      {globalStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
          {[
            { label: 'Safras', value: `${globalStats.safraCount}`, color: theme.purple, icon: <Calendar size={15} />,
              tip: 'Número de safras no período selecionado.' },
            { label: 'Previsões', value: `${globalStats.totalPredictions}`, color: theme.blue, icon: <BarChart3 size={15} />,
              tip: 'Total de previsões individuais (ticker × dia).' },
            { label: 'Acerto direcional', value: `${fmt(globalStats.avgTracking * 100, 0)}%`, color: globalStats.avgTracking >= 0.55 ? theme.green : theme.yellow, icon: <Target size={15} />,
              tip: 'Percentual de previsões caminhando na direção prevista.' },
            { label: 'Ret. Compra', value: `${globalStats.avgBuyReturn >= 0 ? '+' : ''}${fmt(globalStats.avgBuyReturn * 100, 2)}%`, color: globalStats.avgBuyReturn >= 0 ? theme.green : theme.red, icon: <TrendingUp size={15} />,
              tip: `Retorno médio parcial dos ${globalStats.buyCount} sinais de Compra.` },
            { label: 'Ret. Venda', value: `${globalStats.avgSellReturn >= 0 ? '+' : ''}${fmt(globalStats.avgSellReturn * 100, 2)}%`, color: globalStats.avgSellReturn <= 0 ? theme.green : theme.red, icon: <TrendingDown size={15} />,
              tip: `Retorno médio parcial dos ${globalStats.sellCount} sinais de Venda.` },
          ].map((kpi, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={11} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</span>
                <span style={{ fontSize: 'clamp(1.05rem, 3vw, 1.3rem)', fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verdict card */}
      {globalStats && (
        <div style={{
          ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
          background: globalStats.avgTracking >= 0.55
            ? (darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)')
            : (darkMode ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)'),
          borderColor: globalStats.avgTracking >= 0.55
            ? (darkMode ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)')
            : (darkMode ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)'),
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: 2 }}>
            {globalStats.avgTracking >= 0.55 ? '✅ Modelo está no caminho certo' : '⚠️ Modelo com desempenho misto'}
          </div>
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.5 }}>
            {globalStats.avgTracking >= 0.55
              ? `${fmt(globalStats.avgTracking * 100, 0)}% das previsões estão na direção correta. Sinais de compra acumulam ${globalStats.avgBuyReturn >= 0 ? '+' : ''}${fmt(globalStats.avgBuyReturn * 100, 2)}% de retorno parcial médio.`
              : `Apenas ${fmt(globalStats.avgTracking * 100, 0)}% das previsões estão na direção correta. As safras ainda estão em andamento e o cenário pode mudar.`}
          </div>
        </div>
      )}

      {/* ===== RANKING VIEW ===== */}
      {viewMode === 'ranking' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Award size={16} color={theme.purple} />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Ranking de Tickers</h3>
            <InfoTooltip text="Performance agregada de cada ticker em todas as safras do período. Mostra quais ações estão performando melhor." darkMode={darkMode} size={12} />
          </div>
          {tickerRanking.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: theme.textSecondary, fontSize: '0.85rem' }}>
              Nenhum ticker encontrado para os filtros selecionados.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                    {['#', 'Ticker', 'Safras', 'Ret. Parcial', 'Ret. Previsto', 'Acerto', 'Sinal Dominante'].map(h => (
                      <th key={h} style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: theme.textSecondary, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickerRanking.slice(0, 30).map((t, i) => {
                    const dominant = t.signals.Compra >= t.signals.Venda ? 'Compra' : 'Venda';
                    const domColor = dominant === 'Compra' ? theme.green : theme.red;
                    const DomIcon = dominant === 'Compra' ? ArrowUpRight : ArrowDownRight;
                    return (
                      <tr key={t.ticker} style={{ borderBottom: `1px solid ${theme.border}` }}
                        onMouseEnter={e => e.currentTarget.style.background = theme.hover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.75rem', color: i < 3 ? theme.purple : theme.textSecondary, fontWeight: i < 3 ? 700 : 400 }}>
                          {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                        </td>
                        <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600, color: theme.text, fontSize: '0.85rem' }}>{t.ticker}</td>
                        <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.8rem', color: theme.textSecondary }}>{t.appearances}</td>
                        <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.85rem', fontWeight: 700, color: t.avgPartial >= 0 ? theme.green : theme.red }}>
                          {t.avgPartial >= 0 ? '+' : ''}{fmt(t.avgPartial * 100, 2)}%
                        </td>
                        <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.8rem', color: t.avgPredicted >= 0 ? theme.green : theme.red }}>
                          {t.avgPredicted >= 0 ? '+' : ''}{fmt(t.avgPredicted * 100, 2)}%
                        </td>
                        <td style={{ padding: '0.45rem 0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: t.trackingRate >= 0.55 ? theme.green : t.trackingRate >= 0.4 ? theme.yellow : theme.red }}>
                            {fmt(t.trackingRate * 100, 0)}%
                          </span>
                        </td>
                        <td style={{ padding: '0.45rem 0.5rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0.12rem 0.4rem', borderRadius: 10, fontSize: '0.68rem', fontWeight: 600, background: `${domColor}15`, color: domColor }}>
                            <DomIcon size={11} /> {dominant} ({t.signals[dominant]})
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== SAFRAS VIEW ===== */}
      {viewMode === 'safras' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {filteredSafras.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: theme.textSecondary }}>
              <Calendar size={28} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Nenhuma safra encontrada</div>
              <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Ajuste os filtros para ver resultados.</div>
            </div>
          ) : filteredSafras.map(safra => {
            const isExpanded = expandedSafra === safra.predictionDate;
            const signalFiltered = filterSignal === 'all'
              ? safra.tickers
              : safra.tickers.filter(t => t.signal === filterSignal);

            return (
              <div key={safra.predictionDate} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                {/* Safra header — clickable */}
                <button
                  onClick={() => setExpandedSafra(isExpanded ? null : safra.predictionDate)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: 'clamp(0.6rem, 2vw, 0.85rem) clamp(0.75rem, 3vw, 1.25rem)',
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                    color: theme.text, minHeight: 'auto',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Expand icon */}
                  {isExpanded ? <ChevronDown size={16} color={theme.textSecondary} /> : <ChevronRight size={16} color={theme.textSecondary} />}

                  {/* Date + maturity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{safra.predictionDate}</span>
                    <MaturityBadge progress={safra.progress} />
                  </div>

                  {/* Quick metrics */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: 'auto', flexWrap: 'wrap', flexShrink: 1 }}>
                    <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{safra.tickers.length} ativos</span>
                    <span style={{
                      fontSize: '0.78rem', fontWeight: 600,
                      color: safra.avgPartialReturn >= 0 ? theme.green : theme.red,
                    }}>
                      {safra.avgPartialReturn >= 0 ? '+' : ''}{fmt(safra.avgPartialReturn * 100, 2)}%
                    </span>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 600,
                      color: safra.trackingRate >= 0.55 ? theme.green : safra.trackingRate >= 0.4 ? theme.yellow : theme.red,
                    }}>
                      {fmt(safra.trackingRate * 100, 0)}% acerto
                    </span>
                  </div>
                </button>

                {/* Progress bar below header */}
                <div style={{ padding: '0 clamp(0.75rem, 3vw, 1.25rem) 0.5rem' }}>
                  <ProgressBar progress={safra.progress} daysElapsed={safra.daysElapsed} totalDays={safra.totalDays} trackingRate={safra.trackingRate} />
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${theme.border}`, padding: 'clamp(0.5rem, 2vw, 0.75rem) clamp(0.75rem, 3vw, 1.25rem)' }}>
                    {/* Safra summary row */}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      {[
                        { label: 'Compra', count: safra.buyTickers.length, color: theme.green },
                        { label: 'Venda', count: safra.sellTickers.length, color: theme.red },
                        { label: 'Ret. Previsto', value: `${safra.avgPredicted >= 0 ? '+' : ''}${fmt(safra.avgPredicted * 100, 2)}%`, color: safra.avgPredicted >= 0 ? theme.green : theme.red },
                        { label: 'Meta', value: safra.targetDate || '—', color: theme.blue },
                      ].map((item, idx) => (
                        <div key={idx} style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
                          {item.label}: <span style={{ fontWeight: 600, color: item.color }}>{'count' in item ? item.count : item.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Ticker detail table */}
                    {signalFiltered.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1rem', color: theme.textSecondary, fontSize: '0.8rem' }}>
                        Nenhum ticker com sinal "{filterSignal}" nesta safra.
                      </div>
                    ) : (
                      <div className="tracking-table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                          <thead>
                            <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                              {['Ticker', 'Sinal', 'Preço Base', 'Preço Atual', 'Ret. Parcial', 'Ret. Previsto', 'Evolução', 'Status'].map(h => (
                                <th key={h} style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {signalFiltered.map(t => {
                              const SignalIcon = t.signal === 'Compra' ? ArrowUpRight : t.signal === 'Venda' ? ArrowDownRight : Minus;
                              const signalColor = t.signal === 'Compra' ? theme.green : t.signal === 'Venda' ? theme.red : theme.textSecondary;
                              return (
                                <tr key={t.ticker} style={{ borderBottom: `1px solid ${theme.border}` }}
                                  onMouseEnter={e => e.currentTarget.style.background = theme.hover}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, fontSize: '0.82rem', color: theme.text }}>{t.ticker}</td>
                                  <td style={{ padding: '0.4rem 0.5rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '0.1rem 0.35rem', borderRadius: 8, fontSize: '0.68rem', fontWeight: 600, background: `${signalColor}15`, color: signalColor }}>
                                      <SignalIcon size={11} /> {t.signal}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', color: theme.textSecondary }}>R$ {fmt(t.basePrice, 2)}</td>
                                  <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', color: theme.text, fontWeight: 500 }}>R$ {fmt(t.currentPrice, 2)}</td>
                                  <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.82rem', fontWeight: 700, color: t.partialReturn >= 0 ? theme.green : theme.red }}>
                                    {t.partialReturn >= 0 ? '+' : ''}{fmt(t.partialReturn * 100, 2)}%
                                  </td>
                                  <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', color: t.predictedReturn >= 0 ? theme.green : theme.red }}>
                                    {t.predictedReturn >= 0 ? '+' : ''}{fmt(t.predictedReturn * 100, 2)}%
                                  </td>
                                  <td style={{ padding: '0.4rem 0.5rem' }}>
                                    <Sparkline data={t.dailyPrices} predicted={t.predictedReturn} />
                                  </td>
                                  <td style={{ padding: '0.4rem 0.5rem' }}>
                                    {t.trackingPrediction ? (
                                      <CheckCircle size={15} color={theme.green} />
                                    ) : (
                                      <Activity size={15} color={theme.red} />
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Safra footer summary */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: `1px solid ${theme.border}`, flexWrap: 'wrap', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                        {signalFiltered.length} ativo{signalFiltered.length !== 1 ? 's' : ''} exibido{signalFiltered.length !== 1 ? 's' : ''}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                        Acerto direcional: <span style={{ fontWeight: 600, color: safra.trackingRate >= 0.55 ? theme.green : theme.yellow }}>{fmt(safra.trackingRate * 100, 0)}%</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrackingTab;