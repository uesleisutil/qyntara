import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, TrendingUp, TrendingDown, BarChart3, Target, ChevronDown, ChevronRight, Activity, Calendar, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
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
  trackingPrediction: boolean; // partial return going in same direction as prediction
}

interface SafraProgress {
  predictionDate: string;
  targetDate: string;
  daysElapsed: number;
  totalDays: number;
  progress: number; // 0-1
  tickers: TickerProgress[];
  avgPredicted: number;
  avgPartialReturn: number;
  buyTickers: TickerProgress[];
  sellTickers: TickerProgress[];
  trackingRate: number; // % of tickers tracking toward prediction
}

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const TrackingTab: React.FC<TrackingTabProps> = ({ darkMode = false }) => {
  const [prices, setPrices] = useState<Record<string, Record<string, number>>>({});
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [validations, setValidations] = useState<Validation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSafra, setExpandedSafra] = useState<string | null>(null);
  const [filterSignal, setFilterSignal] = useState<'all' | 'Compra' | 'Venda'>('all');

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

      // Build price lookup: { TICKER: { "2026-03-09": 43.16, ... } }
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

    // Get all unique prediction dates from history
    const allDates = new Set<string>();
    Object.values(history).forEach(entries => entries.forEach(e => allDates.add(e.date)));
    const sortedDates = Array.from(allDates).sort();

    // Get all available price dates (trading days)
    const allPriceDates = new Set<string>();
    Object.values(prices).forEach(tickerPrices => {
      Object.keys(tickerPrices).forEach(d => allPriceDates.add(d));
    });
    const tradingDays = Array.from(allPriceDates).sort();

    // For each prediction date, build safra progress
    return sortedDates.map(predDate => {
      // Find target date from validations or calculate (20 trading days ahead)
      const valForDate = validations.find(v => v.prediction_date === predDate);
      const targetDate = valForDate?.target_date || '';

      // Count trading days elapsed since prediction
      const futureDays = tradingDays.filter(d => d > predDate);
      const daysElapsed = futureDays.length;
      const totalDays = 20;
      const progress = Math.min(daysElapsed / totalDays, 1);

      // Get the latest price date
      const latestPriceDate = tradingDays[tradingDays.length - 1] || predDate;

      // Build ticker progress
      const tickers: TickerProgress[] = [];
      Object.entries(history).forEach(([ticker, entries]) => {
        const predEntry = entries.find(e => e.date === predDate);
        if (!predEntry) return;

        const tickerPrices = prices[ticker];
        if (!tickerPrices) return;

        // Base price = closing price on prediction date (or closest prior date)
        let basePrice = tickerPrices[predDate];
        if (!basePrice) {
          // Find closest prior date
          const priorDates = Object.keys(tickerPrices).filter(d => d <= predDate).sort();
          if (priorDates.length) basePrice = tickerPrices[priorDates[priorDates.length - 1]];
        }
        if (!basePrice) return;

        // Current price = latest available
        const currentPrice = tickerPrices[latestPriceDate] || basePrice;
        const partialReturn = (currentPrice - basePrice) / basePrice;

        // Daily price evolution since prediction
        const dailyPrices = futureDays
          .filter(d => tickerPrices[d])
          .map(d => ({
            date: d,
            close: tickerPrices[d],
            partialReturn: (tickerPrices[d] - basePrice) / basePrice,
          }));

        const signal: 'Compra' | 'Venda' | 'Neutro' =
          predEntry.score >= 1.5 ? 'Compra' : predEntry.score <= -1.5 ? 'Venda' : 'Neutro';

        // Is the partial return tracking toward the prediction?
        const trackingPrediction = predEntry.exp_return_20 >= 0
          ? partialReturn >= 0
          : partialReturn <= 0;

        tickers.push({
          ticker, basePrice, currentPrice,
          predictedReturn: predEntry.exp_return_20,
          partialReturn, score: predEntry.score, signal, dailyPrices,
          daysElapsed, totalDays, trackingPrediction,
        });
      });

      if (!tickers.length) return null;

      tickers.sort((a, b) => Math.abs(b.predictedReturn) - Math.abs(a.predictedReturn));

      const avgPredicted = tickers.reduce((s, t) => s + t.predictedReturn, 0) / tickers.length;
      const avgPartialReturn = tickers.reduce((s, t) => s + t.partialReturn, 0) / tickers.length;
      const buyTickers = tickers.filter(t => t.signal === 'Compra');
      const sellTickers = tickers.filter(t => t.signal === 'Venda');
      const trackingRate = tickers.filter(t => t.trackingPrediction).length / tickers.length;

      return {
        predictionDate: predDate, targetDate, daysElapsed, totalDays, progress,
        tickers, avgPredicted, avgPartialReturn, buyTickers, sellTickers, trackingRate,
      };
    }).filter(Boolean).reverse() as SafraProgress[];
  }, [prices, history, validations]);

  // Global stats
  const globalStats = useMemo(() => {
    if (!safras.length) return null;
    const allTickers = safras.flatMap(s => s.tickers);
    const totalPredictions = allTickers.length;
    const avgTracking = safras.reduce((s, sf) => s + sf.trackingRate, 0) / safras.length;
    const buyTickers = allTickers.filter(t => t.signal === 'Compra');
    const sellTickers = allTickers.filter(t => t.signal === 'Venda');
    const avgBuyReturn = buyTickers.length
      ? buyTickers.reduce((s, t) => s + t.partialReturn, 0) / buyTickers.length : 0;
    const avgSellReturn = sellTickers.length
      ? sellTickers.reduce((s, t) => s + t.partialReturn, 0) / sellTickers.length : 0;
    return { totalPredictions, avgTracking, avgBuyReturn, avgSellReturn, safraCount: safras.length, buyCount: buyTickers.length, sellCount: sellTickers.length };
  }, [safras]);

  // Mini sparkline component
  const Sparkline: React.FC<{ data: { partialReturn: number }[]; predicted: number; width?: number; height?: number }> = ({ data, predicted, width = 120, height = 32 }) => {
    if (!data.length) return <span style={{ color: theme.textSecondary, fontSize: '0.7rem' }}>Sem dados</span>;
    const values = data.map(d => d.partialReturn);
    const allVals = [...values, predicted, 0];
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const range = max - min || 0.01;
    const toY = (v: number) => height - ((v - min) / range) * height;
    const toX = (i: number) => (i / Math.max(values.length - 1, 1)) * width;
    const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
    const zeroY = toY(0);
    const predY = toY(predicted);

    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Zero line */}
        <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke={theme.textSecondary} strokeWidth={0.5} strokeDasharray="2,2" opacity={0.5} />
        {/* Predicted return target line */}
        <line x1={0} y1={predY} x2={width} y2={predY} stroke={theme.blue} strokeWidth={0.8} strokeDasharray="3,2" opacity={0.6} />
        {/* Actual path */}
        <polyline points={points} fill="none" stroke={values[values.length - 1] >= 0 ? theme.green : theme.red} strokeWidth={1.5} />
        {/* Last point dot */}
        <circle cx={toX(values.length - 1)} cy={toY(values[values.length - 1])} r={2.5}
          fill={values[values.length - 1] >= 0 ? theme.green : theme.red} />
      </svg>
    );
  };

  // Progress bar component
  const ProgressBar: React.FC<{ progress: number; daysElapsed: number; totalDays: number; trackingRate: number }> = ({ progress, daysElapsed, totalDays, trackingRate }) => {
    const barColor = trackingRate >= 0.6 ? theme.green : trackingRate >= 0.4 ? theme.yellow : theme.red;
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: theme.textSecondary, marginBottom: 3 }}>
          <span>Dia {Math.min(daysElapsed, totalDays)} de {totalDays}</span>
          <span>{fmt(progress * 100, 0)}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: darkMode ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3, width: `${Math.min(progress * 100, 100)}%`,
            background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
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

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>
          Acompanhamento por Safra
        </h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0 }}>
          Acompanhe dia a dia como cada safra de previsões está evoluindo em relação à realidade
        </p>
      </div>

      {error && (
        <div style={{ ...cardStyle, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* How it works */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
        borderColor: darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
          💡 <strong style={{ color: theme.text }}>Como funciona:</strong> Cada safra é um dia de previsões. O modelo prevê o retorno de cada ação para 20 pregões à frente. Aqui você acompanha <strong style={{ color: theme.text }}>dia a dia</strong> se o mercado está caminhando na direção prevista. A <span style={{ color: theme.blue }}>linha tracejada azul</span> no gráfico é a meta (retorno previsto). A <span style={{ color: theme.green }}>linha verde</span>/<span style={{ color: theme.red }}>vermelha</span> é o retorno real parcial.
        </div>
      </div>

      {/* Global KPIs */}
      {globalStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Safras ativas', value: `${globalStats.safraCount}`, color: theme.purple, icon: <Calendar size={16} />,
              tip: 'Número de dias com previsões sendo acompanhadas. Cada dia gera uma safra de recomendações.' },
            { label: 'Previsões', value: `${globalStats.totalPredictions}`, color: theme.blue, icon: <BarChart3 size={16} />,
              tip: 'Total de previsões individuais (ticker × dia) em acompanhamento.' },
            { label: 'Taxa de acerto parcial', value: `${fmt(globalStats.avgTracking * 100, 0)}%`, color: globalStats.avgTracking >= 0.55 ? theme.green : theme.yellow, icon: <Target size={16} />,
              tip: 'Percentual de previsões onde o retorno parcial está caminhando na mesma direção prevista pelo modelo.' },
            { label: 'Ret. parcial (Compra)', value: `${globalStats.avgBuyReturn >= 0 ? '+' : ''}${fmt(globalStats.avgBuyReturn * 100, 2)}%`, color: globalStats.avgBuyReturn >= 0 ? theme.green : theme.red, icon: <TrendingUp size={16} />,
              tip: `Retorno médio parcial dos ${globalStats.buyCount} tickers com sinal de Compra. Se positivo, as recomendações de compra estão acertando.` },
            { label: 'Ret. parcial (Venda)', value: `${globalStats.avgSellReturn >= 0 ? '+' : ''}${fmt(globalStats.avgSellReturn * 100, 2)}%`, color: globalStats.avgSellReturn <= 0 ? theme.green : theme.red, icon: <TrendingDown size={16} />,
              tip: `Retorno médio parcial dos ${globalStats.sellCount} tickers com sinal de Venda. Se negativo, as recomendações de venda estão acertando.` },
          ].map((kpi, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={12} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</span>
                <span style={{ fontSize: 'clamp(1.1rem, 3vw, 1.35rem)', fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verdict card */}
      {globalStats && (
        <div style={{
          ...cardStyle, marginBottom: '1rem', padding: '0.85rem 1rem',
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
              ? `${fmt(globalStats.avgTracking * 100, 0)}% das previsões estão caminhando na direção correta. Os sinais de compra acumulam ${globalStats.avgBuyReturn >= 0 ? '+' : ''}${fmt(globalStats.avgBuyReturn * 100, 2)}% de retorno parcial médio.`
              : `Apenas ${fmt(globalStats.avgTracking * 100, 0)}% das previsões estão na direção correta até agora. Lembre-se: as safras ainda estão em andamento e o cenário pode mudar.`
            }
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {([
          { key: 'all' as const, label: 'Todas' },
          { key: 'Compra' as const, label: 'Sinais de compra' },
          { key: 'Venda' as const, label: 'Sinais de venda' },
        ]).map(f => (
          <button key={f.key} onClick={() => setFilterSignal(f.key)} style={{
            padding: '0.4rem 0.75rem', borderRadius: 20, border: `1px solid ${filterSignal === f.key ? theme.blue : theme.border}`,
            background: filterSignal === f.key ? theme.blue : 'transparent',
            color: filterSignal === f.key ? 'white' : theme.textSecondary,
            fontSize: '0.78rem', fontWeight: filterSignal === f.key ? 600 : 400,
            cursor: 'pointer', transition: 'all 0.15s', WebkitAppearance: 'none', appearance: 'none',
          }}>{f.label}</button>
        ))}
      </div>

      {/* Safra Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {safras.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: theme.textSecondary }}>
            Nenhuma safra encontrada. Os dados de preço e histórico podem não estar disponíveis ainda.
          </div>
        ) : safras.map(safra => {
          const isExpanded = expandedSafra === safra.predictionDate;
          const displayTickers = filterSignal === 'all' ? safra.tickers
            : safra.tickers.filter(t => t.signal === filterSignal);

          if (!displayTickers.length) return null;

          const safraAvgPartial = displayTickers.reduce((s, t) => s + t.partialReturn, 0) / displayTickers.length;
          const safraAvgPredicted = displayTickers.reduce((s, t) => s + t.predictedReturn, 0) / displayTickers.length;
          const safraTrackingRate = displayTickers.filter(t => t.trackingPrediction).length / displayTickers.length;

          return (
            <div key={safra.predictionDate} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              {/* Safra Header */}
              <button onClick={() => setExpandedSafra(isExpanded ? null : safra.predictionDate)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: 'clamp(0.65rem, 2vw, 0.85rem) clamp(0.75rem, 3vw, 1.25rem)',
                background: 'transparent', border: 'none', cursor: 'pointer', color: theme.text,
                textAlign: 'left', transition: 'background 0.15s', WebkitAppearance: 'none', appearance: 'none',
              }}
                onMouseEnter={e => e.currentTarget.style.background = theme.hover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Expand icon */}
                <span style={{ color: theme.textSecondary, flexShrink: 0, transition: 'transform 0.2s' }}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>

                {/* Date + progress */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: 2 }}>
                    Safra {new Date(safra.predictionDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  <ProgressBar progress={safra.progress} daysElapsed={safra.daysElapsed} totalDays={safra.totalDays} trackingRate={safraTrackingRate} />
                </div>

                {/* Quick metrics */}
                <div style={{ display: 'flex', gap: '0.6rem', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <div style={{ textAlign: 'right', minWidth: 55 }}>
                    <div style={{ fontSize: '0.62rem', color: theme.textSecondary }}>Previsto</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: safraAvgPredicted >= 0 ? theme.green : theme.red }}>
                      {safraAvgPredicted >= 0 ? '+' : ''}{fmt(safraAvgPredicted * 100, 1)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 55 }}>
                    <div style={{ fontSize: '0.62rem', color: theme.textSecondary }}>Parcial</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: safraAvgPartial >= 0 ? theme.green : theme.red }}>
                      {safraAvgPartial >= 0 ? '+' : ''}{fmt(safraAvgPartial * 100, 1)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 45 }}>
                    <div style={{ fontSize: '0.62rem', color: theme.textSecondary }}>Acerto</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: safraTrackingRate >= 0.55 ? theme.green : theme.yellow }}>
                      {fmt(safraTrackingRate * 100, 0)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: 30 }}>
                    <div style={{ fontSize: '0.62rem', color: theme.textSecondary }}>Qtd</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>
                      {displayTickers.length}
                    </div>
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${theme.border}` }}>
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                          {[
                            { label: 'Ticker', tip: 'Código da ação na B3' },
                            { label: 'Sinal', tip: 'Sinal gerado pelo modelo: Compra (score ≥ 1.5), Venda (score ≤ -1.5) ou Neutro' },
                            { label: 'Preço base', tip: 'Preço de fechamento no dia da previsão' },
                            { label: 'Preço atual', tip: 'Último preço de fechamento disponível' },
                            { label: 'Ret. previsto', tip: 'Retorno esperado pelo modelo para 20 pregões' },
                            { label: 'Ret. parcial', tip: 'Retorno acumulado desde o dia da previsão até agora' },
                            { label: 'Evolução', tip: 'Gráfico da evolução diária. Linha tracejada azul = meta (retorno previsto)' },
                            { label: 'Status', tip: 'Se o retorno parcial está caminhando na mesma direção da previsão' },
                          ].map(h => (
                            <th key={h.label} style={{
                              padding: '0.5rem 0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600,
                              color: theme.textSecondary, background: darkMode ? '#0f172a' : '#f8fafc', whiteSpace: 'nowrap',
                            }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                {h.label} <InfoTooltip text={h.tip} darkMode={darkMode} size={11} />
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayTickers.map((t, i) => {
                          const signalColor = t.signal === 'Compra' ? theme.green : t.signal === 'Venda' ? theme.red : theme.textSecondary;
                          const SignalIcon = t.signal === 'Compra' ? ArrowUpRight : t.signal === 'Venda' ? ArrowDownRight : Minus;
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}
                              onMouseEnter={e => e.currentTarget.style.background = theme.hover}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600, color: theme.text, fontSize: '0.82rem' }}>{t.ticker}</td>
                              <td style={{ padding: '0.45rem 0.5rem' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0.15rem 0.45rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600, background: `${signalColor}15`, color: signalColor }}>
                                  <SignalIcon size={12} /> {t.signal}
                                </span>
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem', color: theme.text }}>R$ {fmt(t.basePrice, 2)}</td>
                              <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem', fontWeight: 600, color: t.currentPrice >= t.basePrice ? theme.green : theme.red }}>
                                R$ {fmt(t.currentPrice, 2)}
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem', fontWeight: 600, color: t.predictedReturn >= 0 ? theme.green : theme.red }}>
                                {t.predictedReturn >= 0 ? '+' : ''}{fmt(t.predictedReturn * 100, 2)}%
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem', fontWeight: 700, color: t.partialReturn >= 0 ? theme.green : theme.red }}>
                                {t.partialReturn >= 0 ? '+' : ''}{fmt(t.partialReturn * 100, 2)}%
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem' }}>
                                <Sparkline data={t.dailyPrices} predicted={t.predictedReturn} />
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem' }}>
                                {t.trackingPrediction ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0.15rem 0.45rem', borderRadius: 10, fontSize: '0.68rem', fontWeight: 600, background: `${theme.green}15`, color: theme.green }}>
                                    <CheckCircle size={12} /> No caminho
                                  </span>
                                ) : (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0.15rem 0.45rem', borderRadius: 10, fontSize: '0.68rem', fontWeight: 600, background: `${theme.red}15`, color: theme.red }}>
                                    <Activity size={12} /> Divergindo
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Safra summary footer */}
                  <div style={{
                    padding: '0.6rem 1rem', borderTop: `1px solid ${theme.border}`,
                    background: darkMode ? '#0f172a' : '#f8fafc',
                    display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.72rem', color: theme.textSecondary,
                  }}>
                    <span>Compra: <strong style={{ color: theme.green }}>{safra.buyTickers.length}</strong></span>
                    <span>Venda: <strong style={{ color: theme.red }}>{safra.sellTickers.length}</strong></span>
                    <span>Neutro: <strong style={{ color: theme.textSecondary }}>{safra.tickers.length - safra.buyTickers.length - safra.sellTickers.length}</strong></span>
                    <span style={{ marginLeft: 'auto' }}>
                      Vencimento: {safra.targetDate ? new Date(safra.targetDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : `~${safra.totalDays} pregões`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrackingTab;
