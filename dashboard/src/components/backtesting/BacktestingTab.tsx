import React, { useState } from 'react';
import { Play, Settings, TrendingUp, BarChart3, AlertTriangle, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../shared/ui/InfoTooltip';
import { UNIVERSE_SIZE_FALLBACK } from '../../constants';
import { markChecklistItem } from '../shared/features/ActivationChecklist';
import { saveBacktestResult, loadBacktestResult } from '../../lib/BacktestCache';
import { fmt, fmtPct, fmtBRL } from '../../lib/formatters';

interface BacktestingTabProps { darkMode?: boolean; }

interface Config {
  startDate: string; endDate: string; initialCapital: number;
  positionSize: 'equal' | 'weighted'; topN: number;
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly'; commissionRate: number;
}

interface PriceRow { date: string; ticker: string; close: string | number; }

async function fetchAllPrices(): Promise<PriceRow[]> {
  const headers: Record<string, string> = { 'x-api-key': API_KEY };
  const allPrices: PriceRow[] = [];
  // Fetch available months from S3
  try {
    const listRes = await fetch(`${API_BASE_URL}/s3-proxy/list?prefix=curated/daily_monthly/year=${new Date().getFullYear()}`, { headers });
    if (listRes.ok) {
      const data = await listRes.json();
      // API returns { objects: [{ Key, ... }], count, prefix }
      const items: any[] = Array.isArray(data) ? data : (data.objects || []);
      const csvKeys = items.map(o => o.Key || o.key || o).filter((k: any) => typeof k === 'string' && k.endsWith('daily.csv'));
      for (const key of csvKeys) {
        try {
          const res = await fetch(`${API_BASE_URL}/s3-proxy?key=${encodeURIComponent(key)}`, { headers });
          if (res.ok) {
            const rows: PriceRow[] = await res.json();
            allPrices.push(...rows);
          }
        } catch { /* skip failed months */ }
      }
    }
  } catch { /* list failed */ }
  // Fallback: try current year months dynamically
  if (allPrices.length === 0) {
    const now = new Date();
    const year = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    for (let m = 1; m <= currentMonth; m++) {
      const monthStr = String(m).padStart(2, '0');
      try {
        const res = await fetch(`${API_BASE_URL}/s3-proxy?key=${encodeURIComponent(`curated/daily_monthly/year=${year}/month=${monthStr}/daily.csv`)}`, { headers });
        if (res.ok) {
          const rows: PriceRow[] = await res.json();
          allPrices.push(...rows);
        }
      } catch { /* skip */ }
    }
  }
  return allPrices;
}

function runBacktest(config: Config, tickers: any[], allPrices: PriceRow[]) {
  // Build price map: ticker -> { date -> close }
  const priceMap: Record<string, Record<string, number>> = {};
  allPrices.forEach(r => {
    const t = r.ticker;
    if (!priceMap[t]) priceMap[t] = {};
    priceMap[t][r.date] = typeof r.close === 'string' ? parseFloat(r.close) : r.close;
  });

  // Get all unique trading dates in range, sorted
  const allDates = [...new Set(allPrices.map(r => r.date))]
    .filter(d => d >= config.startDate && d <= config.endDate)
    .sort();

  if (allDates.length < 2) throw new Error(`Apenas ${allDates.length} pregão(ões) no período. Precisa de pelo menos 2.`);

  // Select top N tickers by score
  const topTickers = tickers.slice(0, config.topN);

  // Calculate weights
  const weights: Record<string, number> = {};
  if (config.positionSize === 'weighted') {
    const totalScore = topTickers.reduce((s, t) => s + Math.max(t.score, 0.01), 0);
    topTickers.forEach(t => { weights[t.ticker] = Math.max(t.score, 0.01) / totalScore; });
  } else {
    topTickers.forEach(t => { weights[t.ticker] = 1 / topTickers.length; });
  }

  // Simulate portfolio day by day
  const portfolioValue: { date: string; value: number }[] = [];
  let cash = config.initialCapital;
  let holdings: Record<string, number> = {}; // ticker -> shares
  let invested = false;
  let totalCommission = 0;
  let lastRebalanceIdx = -999;

  const rebalanceInterval = config.rebalanceFrequency === 'daily' ? 1
    : config.rebalanceFrequency === 'weekly' ? 5 : 20;

  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];
    const needsRebalance = !invested || (i - lastRebalanceIdx >= rebalanceInterval);

    if (needsRebalance) {
      // Sell all current holdings
      if (invested) {
        // eslint-disable-next-line no-loop-func
        Object.entries(holdings).forEach(([ticker, shares]) => {
          const price = priceMap[ticker]?.[date];
          if (price && shares > 0) {
            const proceeds = shares * price;
            const commission = proceeds * config.commissionRate;
            cash += proceeds - commission;
            totalCommission += commission;
          }
        });
        holdings = {};
      }

      // Buy top N tickers
      const availableTickers = topTickers.filter(t => priceMap[t.ticker]?.[date]);
      if (availableTickers.length > 0) {
        // Recalculate weights for available tickers
        const availWeights: Record<string, number> = {};
        if (config.positionSize === 'weighted') {
          const totalS = availableTickers.reduce((s, t) => s + Math.max(t.score, 0.01), 0);
          availableTickers.forEach(t => { availWeights[t.ticker] = Math.max(t.score, 0.01) / totalS; });
        } else {
          availableTickers.forEach(t => { availWeights[t.ticker] = 1 / availableTickers.length; });
        }

        // eslint-disable-next-line no-loop-func
        availableTickers.forEach(t => {
          const price = priceMap[t.ticker][date];
          const allocation = cash * availWeights[t.ticker];
          const commission = allocation * config.commissionRate;
          const shares = (allocation - commission) / price;
          holdings[t.ticker] = shares;
          totalCommission += commission;
        });
        cash = 0;
        invested = true;
        lastRebalanceIdx = i;
      }
    }

    // Calculate portfolio value
    let portValue = cash;
    Object.entries(holdings).forEach(([ticker, shares]) => {
      const price = priceMap[ticker]?.[date];
      if (price) portValue += shares * price;
    });
    portfolioValue.push({ date, value: Math.round(portValue * 100) / 100 });
  }

  if (portfolioValue.length < 2) throw new Error('Dados insuficientes para o período selecionado.');

  const finalValue = portfolioValue[portfolioValue.length - 1].value;
  const totalReturn = (finalValue - config.initialCapital) / config.initialCapital;

  // Calculate daily returns for risk metrics
  const dailyReturns: number[] = [];
  for (let i = 1; i < portfolioValue.length; i++) {
    dailyReturns.push((portfolioValue[i].value - portfolioValue[i - 1].value) / portfolioValue[i - 1].value);
  }

  // Drawdowns
  let peak = config.initialCapital;
  let maxDD = 0;
  let worstDDStart = '', worstDDEnd = '', ddStart = '';
  let inDD = false;
  portfolioValue.forEach(p => {
    if (p.value > peak) { peak = p.value; inDD = false; }
    const dd = (p.value - peak) / peak;
    if (dd < 0 && !inDD) { ddStart = p.date; inDD = true; }
    if (dd < maxDD) { maxDD = dd; worstDDStart = ddStart; worstDDEnd = p.date; }
  });

  // Annualization
  const tradingDays = portfolioValue.length;
  const annFactor = 252 / Math.max(tradingDays, 1);
  const annReturn = Math.pow(1 + totalReturn, annFactor) - 1;

  // Volatility from real daily returns
  const meanReturn = dailyReturns.reduce((s, r) => s + r, 0) / Math.max(dailyReturns.length, 1);
  const variance = dailyReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / Math.max(dailyReturns.length - 1, 1);
  const dailyVol = Math.sqrt(variance);
  const annVol = dailyVol * Math.sqrt(252);

  const sharpe = annVol > 0 ? (annReturn - 0.1075) / annVol : 0;
  const negReturns = dailyReturns.filter(r => r < 0);
  const downsideVar = negReturns.length > 0
    ? negReturns.reduce((s, r) => s + r ** 2, 0) / negReturns.length : 0;
  const downsideDev = Math.sqrt(downsideVar) * Math.sqrt(252);
  const sortino = downsideDev > 0 ? (annReturn - 0.1075) / downsideDev : 0;

  // Benchmark: equal-weight all tickers with price data (market proxy)
  const benchmarkValues: { date: string; value: number }[] = [];
  let benchCash = config.initialCapital;
  let benchHoldings: Record<string, number> = {};
  let benchInvested = false;
  const allTickersWithPrices = Object.keys(priceMap).filter(t => priceMap[t][allDates[0]]);

  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];
    if (!benchInvested && allTickersWithPrices.length > 0) {
      const w = 1 / allTickersWithPrices.length;
      // eslint-disable-next-line no-loop-func
      allTickersWithPrices.forEach(t => {
        const price = priceMap[t]?.[date];
        if (price) {
          benchHoldings[t] = (benchCash * w) / price;
        }
      });
      benchCash = 0;
      benchInvested = true;
    }
    let bv = benchCash;
    Object.entries(benchHoldings).forEach(([t, shares]) => {
      const price = priceMap[t]?.[date];
      if (price) bv += shares * price;
    });
    benchmarkValues.push({ date, value: Math.round(bv * 100) / 100 });
  }

  const benchFinal = benchmarkValues[benchmarkValues.length - 1]?.value || config.initialCapital;
  const benchReturn = (benchFinal - config.initialCapital) / config.initialCapital;
  const benchAnnReturn = Math.pow(1 + benchReturn, annFactor) - 1;

  // Benchmark daily returns for vol
  const benchDailyReturns: number[] = [];
  for (let i = 1; i < benchmarkValues.length; i++) {
    benchDailyReturns.push((benchmarkValues[i].value - benchmarkValues[i - 1].value) / benchmarkValues[i - 1].value);
  }
  const benchMean = benchDailyReturns.reduce((s, r) => s + r, 0) / Math.max(benchDailyReturns.length, 1);
  const benchVar = benchDailyReturns.reduce((s, r) => s + (r - benchMean) ** 2, 0) / Math.max(benchDailyReturns.length - 1, 1);
  const benchAnnVol = Math.sqrt(benchVar) * Math.sqrt(252);
  const benchSharpe = benchAnnVol > 0 ? (benchAnnReturn - 0.1075) / benchAnnVol : 0;

  // Benchmark max drawdown
  let bPeak = config.initialCapital, bMaxDD = 0;
  benchmarkValues.forEach(p => {
    if (p.value > bPeak) bPeak = p.value;
    const dd = (p.value - bPeak) / bPeak;
    if (dd < bMaxDD) bMaxDD = dd;
  });

  const cdiReturn = 0.1075 * (tradingDays / 252);

  // Win rate
  const wins = dailyReturns.filter(r => r > 0).length;
  const winRate = dailyReturns.length > 0 ? wins / dailyReturns.length : 0;
  const avgGain = dailyReturns.filter(r => r > 0).length > 0
    ? dailyReturns.filter(r => r > 0).reduce((s, r) => s + r, 0) / dailyReturns.filter(r => r > 0).length : 0;
  const avgLoss = negReturns.length > 0
    ? negReturns.reduce((s, r) => s + r, 0) / negReturns.length : 0;

  // VaR/CVaR from sorted returns
  const sortedReturns = [...dailyReturns].sort((a, b) => a - b);
  const idx95 = Math.floor(sortedReturns.length * 0.05);
  const idx99 = Math.floor(sortedReturns.length * 0.01);
  const var95 = sortedReturns[idx95] || 0;
  const var99 = sortedReturns[idx99] || 0;
  const cvar95 = idx95 > 0 ? sortedReturns.slice(0, idx95).reduce((s, r) => s + r, 0) / idx95 : var95;
  const cvar99 = idx99 > 0 ? sortedReturns.slice(0, idx99).reduce((s, r) => s + r, 0) / idx99 : var99;

  // Max consecutive losses
  let maxConsecLoss = 0, consecLoss = 0;
  dailyReturns.forEach(r => {
    if (r < 0) { consecLoss++; maxConsecLoss = Math.max(maxConsecLoss, consecLoss); }
    else consecLoss = 0;
  });

  // Rolling volatility
  const rollingVol: { date: string; volatility: number }[] = [];
  for (let i = 20; i < portfolioValue.length; i += 3) {
    const window = portfolioValue.slice(i - 20, i);
    const rets = window.map((p, j) => j > 0 ? (p.value - window[j - 1].value) / window[j - 1].value : 0).slice(1);
    const m = rets.reduce((s, r) => s + r, 0) / rets.length;
    const v = rets.reduce((s, r) => s + (r - m) ** 2, 0) / rets.length;
    rollingVol.push({ date: portfolioValue[i].date, volatility: Math.sqrt(v * 252) });
  }

  // Return decomposition per ticker
  const decomposition = topTickers.map(t => {
    const tp = priceMap[t.ticker];
    if (!tp) return { ticker: t.ticker, contribution: 0 };
    const firstDate = allDates.find(d => tp[d] != null);
    const lastDate = [...allDates].reverse().find(d => tp[d] != null);
    if (!firstDate || !lastDate) return { ticker: t.ticker, contribution: 0 };
    const tickerReturn = (tp[lastDate] - tp[firstDate]) / tp[firstDate];
    const weight = weights[t.ticker] || (1 / topTickers.length);
    return { ticker: t.ticker, contribution: tickerReturn * weight * config.initialCapital };
  });

  // Alpha/Beta
  const alpha = annReturn - benchAnnReturn;
  // Beta via covariance
  let covar = 0;
  for (let i = 0; i < Math.min(dailyReturns.length, benchDailyReturns.length); i++) {
    covar += (dailyReturns[i] - meanReturn) * (benchDailyReturns[i] - benchMean);
  }
  const n = Math.min(dailyReturns.length, benchDailyReturns.length);
  covar = n > 1 ? covar / (n - 1) : 0;
  const beta = benchVar > 0 ? covar / benchVar : 1;
  const trackingError = Math.sqrt(
    dailyReturns.slice(0, n).reduce((s, r, i) => s + (r - benchDailyReturns[i]) ** 2, 0) / Math.max(n - 1, 1)
  ) * Math.sqrt(252);
  const infoRatio = trackingError > 0 ? alpha / trackingError : 0;

  // Drawdown duration
  let ddDurations: number[] = [];
  let curDDLen = 0;
  let curPeak = config.initialCapital;
  portfolioValue.forEach(p => {
    if (p.value >= curPeak) { if (curDDLen > 0) ddDurations.push(curDDLen); curDDLen = 0; curPeak = p.value; }
    else curDDLen++;
  });
  if (curDDLen > 0) ddDurations.push(curDDLen);
  const avgDDDuration = ddDurations.length > 0
    ? Math.round(ddDurations.reduce((s, d) => s + d, 0) / ddDurations.length) : 0;

  return {
    portfolioValue,
    metrics: {
      totalReturn, annualizedReturn: annReturn, volatility: annVol,
      sharpeRatio: sharpe, sortinoRatio: sortino, maxDrawdown: maxDD,
      averageDrawdownDuration: avgDDDuration,
      winRate, averageGain: avgGain, averageLoss: avgLoss,
      turnoverRate: invested ? (tradingDays / rebalanceInterval) * config.commissionRate * 2 : 0,
    },
    benchmarks: {
      ibovespa: { totalReturn: benchReturn, annualizedReturn: benchAnnReturn, volatility: benchAnnVol, sharpeRatio: benchSharpe, maxDrawdown: bMaxDD },
      cdi: { totalReturn: cdiReturn, annualizedReturn: 0.1075 },
      alpha, beta, informationRatio: infoRatio, trackingError,
    },
    riskMetrics: {
      var95, var99, cvar95, cvar99,
      maxConsecutiveLosses: maxConsecLoss, downsideDeviation: downsideDev,
      rollingVolatility: rollingVol,
    },
    drawdowns: [{ start: worstDDStart || config.startDate, end: worstDDEnd || config.endDate, depth: maxDD, duration: ddDurations[0] || 0 }],
    returnDecomposition: decomposition,
    tradingDays,
    totalCommission,
    config,
  };
}

export const BacktestingTab: React.FC<BacktestingTabProps> = ({ darkMode = false }) => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'portfolio' | 'metrics' | 'risk'>('config');
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [config, setConfig] = useState<Config>({
    startDate: '2026-02-02',
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 100000, positionSize: 'equal', topN: 10,
    rebalanceFrequency: 'monthly', commissionRate: 0.0003,
  });

  const theme = {
    bg: darkMode ? '#0e0c1e' : '#f8fafc',
    cardBg: darkMode ? '#1e1b40' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#b8b5d0' : '#64748b',
    border: darkMode ? '#363258' : '#e2e8f0',
    inputBg: darkMode ? '#0e0c1e' : '#f8fafc',
    hover: darkMode ? '#363258' : '#f1f5f9',
  };

  const today = new Date().toISOString().split('T')[0];

  // Load cached backtest result on mount
  React.useEffect(() => {
    const cached = loadBacktestResult();
    if (cached) {
      setResult(cached.result);
      setConfig(cached.config);
      setActiveTab('portfolio');
      const savedDate = new Date(cached.savedAt);
      setSavedLabel(`Resultado salvo em ${savedDate.toLocaleDateString('pt-BR')} ${savedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
    }
  }, []);

  const handleRun = async () => {
    if (config.endDate > today) {
      setError('A data fim não pode ser no futuro.');
      handleChange('endDate', today);
      return;
    }
    if (config.startDate >= config.endDate) {
      setError('A data início deve ser anterior à data fim.');
      return;
    }
    setLoading(true); setError(null);
    try {
      const [recRes, allPrices] = await Promise.all([
        fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } }),
        fetchAllPrices(),
      ]);
      if (!recRes.ok) throw new Error('Falha ao carregar recomendações');
      const data = await recRes.json();
      const tickers = (data.recommendations || []).sort((a: any, b: any) => b.score - a.score);
      if (!tickers.length) throw new Error('Sem dados de recomendações');
      if (!allPrices.length) throw new Error('Sem dados de preços no S3. Verifique se existem dados para o período selecionado.');
      const simResult = runBacktest(config, tickers, allPrices);
      setResult(simResult);
      setActiveTab('portfolio');
      saveBacktestResult(simResult, config);
      setSavedLabel(null);
      markChecklistItem('ranBacktest');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleChange = (field: keyof Config, value: any) => setConfig(prev => ({ ...prev, [field]: value }));

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.75rem', backgroundColor: theme.inputBg,
    border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text,
    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: theme.text,
  };
  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.cardBg, borderRadius: 12, padding: 'clamp(0.75rem, 3vw, 1.25rem)',
    border: `1px solid ${theme.border}`,
  };

  const tabs: { id: 'config' | 'portfolio' | 'metrics' | 'risk'; label: string; icon: React.ReactNode; disabled: boolean }[] = [
    { id: 'config', label: 'Configuração', icon: <Settings size={15} />, disabled: false },
    { id: 'portfolio', label: 'Portfólio', icon: <TrendingUp size={15} />, disabled: !result },
    { id: 'metrics', label: 'Métricas', icon: <BarChart3 size={15} />, disabled: !result },
    { id: 'risk', label: 'Risco', icon: <AlertTriangle size={15} />, disabled: !result },
  ];

  return (
    <div>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', overflowX: 'auto',
        WebkitOverflowScrolling: 'touch', padding: '0.25rem', backgroundColor: theme.bg,
        borderRadius: 10, border: `1px solid ${theme.border}`,
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 0.85rem',
              borderRadius: 8, border: 'none', cursor: tab.disabled ? 'default' : 'pointer',
              fontSize: '0.8rem', fontWeight: activeTab === tab.id ? 600 : 400, whiteSpace: 'nowrap',
              background: activeTab === tab.id ? (darkMode ? '#363258' : 'white') : 'transparent',
              color: tab.disabled ? (darkMode ? '#475569' : '#cbd5e1') : activeTab === tab.id ? '#8b5cf6' : theme.textSecondary,
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s', opacity: tab.disabled ? 0.5 : 1,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Settings size={18} color="#8b5cf6" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: theme.text }}>Configuração do Backtest</h3>
          </div>
          <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
            💡 O backtest usa <strong style={{ color: theme.text }}>preços reais</strong> do S3 para simular como sua carteira teria se comportado. Dados disponíveis: fevereiro e março de 2026.
          </p>

          {/* Quick Presets */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: theme.textSecondary, alignSelf: 'center' }}>Presets:</span>
            {[
              { label: '🛡️ Conservador', cfg: { initialCapital: 50000, topN: 3, positionSize: 'equal' as const, rebalanceFrequency: 'monthly' as const, commissionRate: 0.0003 } },
              { label: '⚖️ Moderado', cfg: { initialCapital: 100000, topN: 5, positionSize: 'equal' as const, rebalanceFrequency: 'weekly' as const, commissionRate: 0.0003 } },
              { label: '🔥 Agressivo', cfg: { initialCapital: 100000, topN: 10, positionSize: 'weighted' as const, rebalanceFrequency: 'daily' as const, commissionRate: 0.0003 } },
            ].map((preset, i) => (
              <button key={i} onClick={() => setConfig(prev => ({ ...prev, ...preset.cfg }))} style={{
                padding: '0.4rem 0.75rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 500,
                border: `1px solid ${theme.border}`, background: darkMode ? '#0e0c1e' : '#f8fafc',
                color: theme.text, cursor: 'pointer', transition: 'all 0.15s',
                WebkitAppearance: 'none' as any,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = darkMode ? '#0e0c1e' : '#f8fafc'; }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div><label style={labelStyle}>Data Início <InfoTooltip text="Início do período. Dados disponíveis a partir de fev/2026." darkMode={darkMode} size={12} /></label><input type="date" value={config.startDate} onChange={e => handleChange('startDate', e.target.value)} max={today} style={inputStyle} /></div>
            <div><label style={labelStyle}>Data Fim <InfoTooltip text="Fim do período. Não pode ser no futuro." darkMode={darkMode} size={12} /></label><input type="date" value={config.endDate} onChange={e => handleChange('endDate', e.target.value)} max={today} style={inputStyle} /></div>
            <div><label style={labelStyle}>Capital Inicial (R$) <InfoTooltip text="Quanto dinheiro investir no início." darkMode={darkMode} size={12} /></label><input type="number" value={config.initialCapital} onChange={e => handleChange('initialCapital', +e.target.value)} min={1000} step={1000} style={inputStyle} /></div>
            <div><label style={labelStyle}>Alocação <InfoTooltip text="'Peso Igual' divide igualmente. 'Ponderado por Score' investe mais nas ações com score mais alto." darkMode={darkMode} size={12} /></label>
              <select value={config.positionSize} onChange={e => handleChange('positionSize', e.target.value)} style={inputStyle}>
                <option value="equal">Peso Igual</option><option value="weighted">Ponderado por Score</option>
              </select>
            </div>
            <div><label style={labelStyle}>Top N Ações <InfoTooltip text="Quantas das melhores ações incluir na carteira." darkMode={darkMode} size={12} /></label><input type="number" value={config.topN} onChange={e => handleChange('topN', +e.target.value)} min={1} max={UNIVERSE_SIZE_FALLBACK} style={inputStyle} /></div>
            <div><label style={labelStyle}>Rebalanceamento <InfoTooltip text="Frequência de ajuste da carteira." darkMode={darkMode} size={12} /></label>
              <select value={config.rebalanceFrequency} onChange={e => handleChange('rebalanceFrequency', e.target.value as any)} style={inputStyle}>
                <option value="daily">Diário</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option>
              </select>
            </div>
            <div><label style={labelStyle}>Comissão (%) <InfoTooltip text="Taxa de corretagem por operação." darkMode={darkMode} size={12} /></label><input type="number" value={config.commissionRate * 100} onChange={e => handleChange('commissionRate', +e.target.value / 100)} min={0} max={1} step={0.01} style={inputStyle} /></div>
          </div>

          {error && (
            <div style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <button onClick={handleRun} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem',
            background: loading ? '#64748b' : 'linear-gradient(135deg, #7c3aed, #3b82f6)',
            border: 'none', color: 'white', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.2s',
            boxShadow: loading ? 'none' : '0 2px 8px rgba(37,99,235,0.3)',
          }}>
            {loading ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Carregando preços reais...</> : <><Play size={16} /> Executar Backtest</>}
          </button>
        </div>
      )}

      {/* Portfolio Tab */}
      {activeTab === 'portfolio' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Data source badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', color: theme.textSecondary, flexWrap: 'wrap' }}>
            <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600 }}>
              ✓ Dados reais
            </span>
            {savedLabel && (
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: '#8b5cf6', fontWeight: 500 }}>
                💾 {savedLabel}
              </span>
            )}
            {result.tradingDays} pregões · Comissões: {fmtBRL(result.totalCommission)}
          </div>
          {/* Verdict Card */}
          {(() => {
            const ret = result.metrics.totalReturn;
            const benchRet = result.benchmarks.ibovespa.totalReturn;
            const cdiRet = result.benchmarks.cdi.totalReturn;
            const isPositive = ret > 0;
            const beatBench = ret > benchRet;
            const beatCDI = ret > cdiRet;
            const diff = ((ret - benchRet) * 100).toFixed(1);

            // 4-tier verdict logic
            let verdictIcon: string, verdictTitle: string, verdictColor: string, verdictBg: string, verdictBorder: string;
            if (!isPositive) {
              // Red: negative return — losing money is never "beating the market"
              verdictIcon = '📉';
              verdictTitle = 'Retorno negativo no período';
              verdictColor = '#ef4444';
              verdictBg = 'rgba(239,68,68,0.08)';
              verdictBorder = 'rgba(239,68,68,0.25)';
            } else if (!beatCDI) {
              // Yellow: positive but below CDI (risk-free rate)
              verdictIcon = '⚠️';
              verdictTitle = 'Retorno positivo, mas abaixo do CDI';
              verdictColor = '#f59e0b';
              verdictBg = 'rgba(245,158,11,0.08)';
              verdictBorder = 'rgba(245,158,11,0.25)';
            } else if (!beatBench) {
              // Yellow-green: beat CDI but not the universe average
              verdictIcon = '📊';
              verdictTitle = 'Superou o CDI, mas ficou abaixo da média do universo';
              verdictColor = '#f59e0b';
              verdictBg = 'rgba(245,158,11,0.08)';
              verdictBorder = 'rgba(245,158,11,0.25)';
            } else {
              // Green: positive, beat CDI AND beat universe average
              verdictIcon = '🏆';
              verdictTitle = 'Sua estratégia superou a média do mercado!';
              verdictColor = '#10b981';
              verdictBg = 'rgba(16,185,129,0.08)';
              verdictBorder = 'rgba(16,185,129,0.25)';
            }

            return (
              <div style={{ ...cardStyle, padding: '1.1rem 1.25rem', background: verdictBg, borderColor: verdictBorder, borderLeft: `4px solid ${verdictColor}`, overflow: 'hidden' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: verdictColor, marginBottom: '0.3rem' }}>
                  {verdictIcon} {verdictTitle}
                </div>
                <div style={{ fontSize: '0.82rem', color: theme.textSecondary, lineHeight: 1.6 }}>
                  Retorno da carteira: <strong style={{ color: ret >= 0 ? '#10b981' : '#ef4444' }}>{fmtPct(ret)}</strong>
                  {' · Média do universo: '}<strong style={{ color: '#f59e0b' }}>{fmtPct(benchRet)}</strong>
                  {' '}({beatBench ? '+' : ''}{diff} p.p.)
                  {' · CDI: '}<strong style={{ color: '#10b981' }}>{fmtPct(cdiRet)}</strong>
                  {beatCDI ? ' ✓' : ' ✗'}
                </div>
              </div>
            );
          })()}
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.6rem' }}>
            {[
              { label: 'Capital Inicial', value: fmtBRL(config.initialCapital), color: theme.text, tip: 'Valor investido no início.' },
              { label: 'Valor Final', value: fmtBRL(result.portfolioValue[result.portfolioValue.length - 1].value), color: result.metrics.totalReturn >= 0 ? '#10b981' : '#ef4444', tip: 'Valor final da carteira.' },
              { label: 'Retorno Total', value: fmtPct(result.metrics.totalReturn), color: result.metrics.totalReturn >= 0 ? '#10b981' : '#ef4444', tip: 'Ganho ou perda total no período.' },
              { label: 'Sharpe', value: fmt(result.metrics.sharpeRatio), color: '#8b5cf6', tip: 'Retorno ajustado ao risco. Acima de 1.0 é bom.' },
              { label: 'Max Drawdown', value: fmtPct(result.metrics.maxDrawdown), color: '#ef4444', tip: 'Maior queda do pico ao vale.' },
            ].map((kpi, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={11} />
                </div>
                <div style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Portfolio Value Chart */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <TrendingUp size={16} color="#8b5cf6" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Evolução do Portfólio</h3>
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: 350 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={result.portfolioValue}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                    <XAxis dataKey="date" stroke={theme.textSecondary} style={{ fontSize: 10 }} tickFormatter={(d: string) => { const dt = new Date(d + 'T12:00:00'); return `${dt.getDate()}/${dt.getMonth() + 1}`; }} />
                    <YAxis stroke={theme.textSecondary} style={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [fmtBRL(v), 'Portfólio']} labelFormatter={(d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')} />
                    <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Benchmark Comparison */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <BarChart3 size={16} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Comparação com Benchmarks</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {[
                { label: 'Alpha', value: fmtPct(result.benchmarks.alpha), color: result.benchmarks.alpha >= 0 ? '#10b981' : '#ef4444', tip: 'Retorno extra acima do mercado.' },
                { label: 'Beta', value: fmt(result.benchmarks.beta), color: theme.text, tip: 'Sensibilidade ao mercado. 1.0 = acompanha o mercado.' },
                { label: 'Info Ratio', value: fmt(result.benchmarks.informationRatio), color: '#8b5cf6', tip: 'Retorno extra por unidade de risco adicional.' },
                { label: 'Tracking Error', value: fmtPct(result.benchmarks.trackingError), color: '#f59e0b', tip: 'Quanto sua carteira desvia do mercado.' },
              ].map((m, i) => (
                <div key={i} style={{ padding: '0.5rem', backgroundColor: theme.bg, borderRadius: 6 }}>
                  <div style={{ fontSize: '0.65rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    {m.label} <InfoTooltip text={m.tip} darkMode={darkMode} size={10} />
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Portfólio', ret: fmtPct(result.metrics.totalReturn), color: '#8b5cf6' },
                { label: 'Média do universo', ret: fmtPct(result.benchmarks.ibovespa.totalReturn), color: '#f59e0b' },
                { label: 'CDI', ret: fmtPct(result.benchmarks.cdi.totalReturn), color: '#10b981' },
              ].map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: theme.bg, borderRadius: 6, borderLeft: `3px solid ${b.color}` }}>
                  <span style={{ fontSize: '0.8rem', color: theme.textSecondary, flex: 1 }}>{b.label}</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: b.color }}>{b.ret}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Return Decomposition */}
          {result.returnDecomposition?.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Decomposição de Retorno (Top Contribuidores)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {result.returnDecomposition.sort((a: any, b: any) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 10).map((d: any, i: number) => {
                  const maxAbs = Math.max(...result.returnDecomposition.map((x: any) => Math.abs(x.contribution)));
                  const pct = maxAbs > 0 ? Math.abs(d.contribution) / maxAbs * 100 : 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: theme.text, width: 55, flexShrink: 0 }}>{d.ticker}</span>
                      <div style={{ flex: 1, height: 16, backgroundColor: theme.bg, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: d.contribution >= 0 ? '#10b981' : '#ef4444', borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: d.contribution >= 0 ? '#10b981' : '#ef4444', width: 65, textAlign: 'right', flexShrink: 0 }}>
                        {d.contribution >= 0 ? '+' : ''}{fmtBRL(Math.round(d.contribution))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metrics Tab */}
      {activeTab === 'metrics' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '0.6rem' }}>
            {[
              { label: 'Retorno Total', value: fmtPct(result.metrics.totalReturn), color: result.metrics.totalReturn >= 0 ? '#10b981' : '#ef4444', tip: 'Ganho ou perda total no período.' },
              { label: 'Retorno Anualizado', value: fmtPct(result.metrics.annualizedReturn), color: result.metrics.annualizedReturn >= 0 ? '#10b981' : '#ef4444', tip: 'Retorno convertido para base anual.' },
              { label: 'Volatilidade Anual', value: fmtPct(result.metrics.volatility), color: '#f59e0b', tip: 'Oscilação anualizada da carteira.' },
              { label: 'Sharpe Ratio', value: fmt(result.metrics.sharpeRatio), color: '#8b5cf6', tip: 'Retorno por unidade de risco. Acima de 1.0 é bom.' },
              { label: 'Sortino Ratio', value: fmt(result.metrics.sortinoRatio), color: '#8b5cf6', tip: 'Similar ao Sharpe, mas só penaliza quedas.' },
              { label: 'Max Drawdown', value: fmtPct(result.metrics.maxDrawdown), color: '#ef4444', tip: 'Maior queda do pico ao vale.' },
              { label: 'Duração Média DD', value: `${result.metrics.averageDrawdownDuration}d`, color: theme.text, tip: 'Tempo médio de recuperação de quedas.' },
              { label: 'Win Rate', value: fmtPct(result.metrics.winRate), color: '#10b981', tip: 'Percentual de dias com retorno positivo.' },
              { label: 'Ganho Médio', value: fmtPct(result.metrics.averageGain), color: '#10b981', tip: 'Retorno médio nos dias positivos.' },
              { label: 'Perda Média', value: fmtPct(result.metrics.averageLoss), color: '#ef4444', tip: 'Retorno médio nos dias negativos.' },
              { label: 'Turnover', value: fmtPct(result.metrics.turnoverRate), color: theme.textSecondary, tip: 'Custo estimado de rotação da carteira.' },
            ].map((m, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.3rem', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  {m.label} <InfoTooltip text={m.tip} darkMode={darkMode} size={10} />
                </div>
                <div style={{ fontSize: 'clamp(1.1rem, 3vw, 1.35rem)', fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Portfólio vs Média do Universo</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 350 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {['Métrica', 'Portfólio', 'Universo'].map(h => (
                      <th key={h} style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: theme.textSecondary }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Retorno Total', p: fmtPct(result.metrics.totalReturn), b: fmtPct(result.benchmarks.ibovespa.totalReturn) },
                    { label: 'Volatilidade', p: fmtPct(result.metrics.volatility), b: fmtPct(result.benchmarks.ibovespa.volatility) },
                    { label: 'Sharpe', p: fmt(result.metrics.sharpeRatio), b: fmt(result.benchmarks.ibovespa.sharpeRatio) },
                    { label: 'Max Drawdown', p: fmtPct(result.metrics.maxDrawdown), b: fmtPct(result.benchmarks.ibovespa.maxDrawdown) },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: '0.5rem', fontSize: '0.8rem', color: theme.textSecondary }}>{row.label}</td>
                      <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#8b5cf6' }}>{row.p}</td>
                      <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>{row.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Risk Tab */}
      {activeTab === 'risk' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.6rem' }}>
            {[
              { label: 'VaR 95%', value: fmtPct(result.riskMetrics.var95), color: '#ef4444', tip: 'Em 95% dos dias, a perda não ultrapassa este valor.' },
              { label: 'VaR 99%', value: fmtPct(result.riskMetrics.var99), color: '#ef4444', tip: 'VaR mais conservador — cenário quase extremo.' },
              { label: 'CVaR 95%', value: fmtPct(result.riskMetrics.cvar95), color: '#dc2626', tip: 'Perda média nos piores 5% dos dias.' },
              { label: 'CVaR 99%', value: fmtPct(result.riskMetrics.cvar99), color: '#dc2626', tip: 'Perda média nos piores 1% dos dias.' },
              { label: 'Desvio Downside', value: fmtPct(result.riskMetrics.downsideDeviation), color: '#f59e0b', tip: 'Volatilidade apenas dos retornos negativos.' },
              { label: 'Perdas Consecutivas', value: `${result.riskMetrics.maxConsecutiveLosses} dias`, color: theme.text, tip: 'Maior sequência de dias com perda.' },
            ].map((m, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  {m.label} <InfoTooltip text={m.tip} darkMode={darkMode} size={10} />
                </div>
                <div style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)', fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Worst Drawdown */}
          {result.drawdowns?.[0] && (
            <div style={{ ...cardStyle, borderLeft: '3px solid #ef4444' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 600, color: theme.text }}>Pior Drawdown</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: '0.5rem' }}>
                <div><div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Início</div><div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>{result.drawdowns[0].start}</div></div>
                <div><div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Fim</div><div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>{result.drawdowns[0].end}</div></div>
                <div><div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Profundidade</div><div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444' }}>{fmtPct(result.drawdowns[0].depth)}</div></div>
                <div><div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Duração</div><div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>{result.drawdowns[0].duration} dias</div></div>
              </div>
            </div>
          )}

          {/* Rolling Volatility */}
          {result.riskMetrics.rollingVolatility?.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Volatilidade Rolante (20d)</h3>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ minWidth: 350 }}>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={result.riskMetrics.rollingVolatility}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                      <XAxis dataKey="date" stroke={theme.textSecondary} style={{ fontSize: 10 }} tickFormatter={(d: string) => { const dt = new Date(d + 'T12:00:00'); return `${dt.getDate()}/${dt.getMonth() + 1}`; }} />
                      <YAxis stroke={theme.textSecondary} style={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                      <Tooltip contentStyle={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, 'Volatilidade']} />
                      <Area type="monotone" dataKey="volatility" stroke="#f59e0b" fill="rgba(245,158,11,0.15)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && activeTab === 'config' && (
        <div style={{ ...cardStyle, marginTop: '1rem', textAlign: 'center', padding: '2.5rem 1rem', color: theme.textSecondary }}>
          <Play size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 500, color: theme.text }}>Pronto para simular?</p>
          <p style={{ margin: 0, fontSize: '0.8rem', maxWidth: 400, marginInline: 'auto', lineHeight: 1.6 }}>
            Configure os parâmetros acima e clique em "Executar Backtest". A simulação usa <strong>preços reais</strong> do S3 para calcular como sua carteira teria se comportado.
          </p>
        </div>
      )}
    </div>
  );
};

export default BacktestingTab;
