import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Search, ArrowUpDown, Clock, Lock, Crown } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../../components/shared/InfoTooltip';
import ShareButton from '../../components/shared/ShareButton';
import { useIsPro } from '../../components/shared/ProGate';
import FollowButton from '../../components/shared/FollowButton';
import ActivationChecklist, { markChecklistItem } from '../../components/shared/ActivationChecklist';
import { WatchlistButton, getWatchlist } from '../../components/shared/Watchlist';
import ExportCSV from '../../components/shared/ExportCSV';
import Sparkline from '../../components/shared/Sparkline';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD, getSignal, getSignalColor, getCurrentMonthPriceKey, PRO_PRICE_LABEL } from '../../constants';
import { getSector, ALL_SECTORS } from '../../constants/sectors';
import MonthlyReport from '../../components/shared/MonthlyReport';
import ProValue from '../../components/shared/ProValue';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }
interface Recommendation {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const RecommendationsPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const isPro = useIsPro();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'Compra' | 'Venda' | 'Neutro' | 'Favoritos'>('ALL');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sparklineData, setSparklineData] = useState<Record<string, number[]>>({});
  const [watchlistVersion, setWatchlistVersion] = useState(0);

  useEffect(() => { fetchRecommendations(); }, []);

  // Fetch sparkline price data
  useEffect(() => {
    (async () => {
      try {
        const headers = { 'x-api-key': API_KEY };
        const res = await fetch(`${API_BASE_URL}/s3-proxy?key=${getCurrentMonthPriceKey()}`, { headers });
        if (!res.ok) return;
        const rows: { date: string; ticker: string; close: string }[] = await res.json();
        const map: Record<string, { date: string; close: number }[]> = {};
        rows.forEach(r => {
          if (!map[r.ticker]) map[r.ticker] = [];
          map[r.ticker].push({ date: r.date, close: parseFloat(r.close) });
        });
        const sparklines: Record<string, number[]> = {};
        Object.entries(map).forEach(([ticker, entries]) => {
          entries.sort((a, b) => a.date.localeCompare(b.date));
          sparklines[ticker] = entries.slice(-20).map(e => e.close);
        });
        setSparklineData(sparklines);
      } catch { /* silent */ }
    })();
  }, []);

  // Listen for watchlist changes
  useEffect(() => {
    const handler = () => setWatchlistVersion(v => v + 1);
    window.addEventListener('watchlist-change', handler);
    return () => window.removeEventListener('watchlist-change', handler);
  }, []);
  const fetchRecommendations = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } });
      if (!res.ok) throw new Error(`Erro ${res.status} ao carregar recomendações`);
      const data = await res.json();
      setRecommendations(data.recommendations || []);
      setDate(data.date || '');
      setLastUpdated(new Date());
      markChecklistItem('viewedRecommendations');
    } catch (err: any) {
      const msg = err.message === 'Load failed' || err.message === 'Failed to fetch'
        ? 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.'
        : err.message;
      setError(msg);
    }
    finally { setLoading(false); }
  };

  // getSignal and getSignalColor imported from constants

  const handleSort = useCallback((field: string) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  }, [sortBy]);

  const watchlist = useMemo(() => getWatchlist(), [watchlistVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = recommendations
    .filter(r => !searchTerm || r.ticker?.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(r => {
      if (signalFilter === 'ALL') return true;
      if (signalFilter === 'Favoritos') return watchlist.includes(r.ticker);
      return getSignal(r.score) === signalFilter;
    })
    .filter(r => sectorFilter === 'ALL' || getSector(r.ticker).sector === sectorFilter)
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'score') return (a.score - b.score) * dir;
      if (sortBy === 'return') return (a.exp_return_20 - b.exp_return_20) * dir;
      if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker) * dir;
      if (sortBy === 'vol') return (a.vol_20d - b.vol_20d) * dir;
      return (b.score - a.score);
    });

  const buyRecs = recommendations.filter(r => r.score >= SCORE_BUY_THRESHOLD);
  const totalBuy = buyRecs.length;
  const totalSell = recommendations.filter(r => r.score <= SCORE_SELL_THRESHOLD).length;
  const totalNeutral = recommendations.length - totalBuy - totalSell;
  const avgBuyReturn = buyRecs.length ? buyRecs.reduce((s, r) => s + (r.exp_return_20 || 0), 0) / buyRecs.length : 0;
  const topScore = recommendations.length ? Math.max(...recommendations.map(r => r.score)) : 0;
  const topTicker = recommendations.length ? recommendations.reduce((a, b) => a.score > b.score ? a : b) : null;

  const simReturn = useMemo(() => {
    if (!buyRecs.length) return null;
    const initial = 10000;
    const avgRet = avgBuyReturn;
    const finalVal = initial * (1 + avgRet);
    return { initial, final: finalVal, gain: finalVal - initial, pct: avgRet * 100 };
  }, [buyRecs, avgBuyReturn]);

  const getRelativeTime = (d: Date) => {
    const diff = Math.round((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'agora mesmo';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    return `há ${Math.floor(diff / 86400)}d`;
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1rem',
  };
  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
    border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
    borderRadius: 8, transition: 'all 0.2s ease', WebkitTapHighlightColor: 'transparent',
    WebkitAppearance: 'none' as any, minHeight: 38,
  };

  if (loading) {
    const skeletonPulse: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1e293b' : '#e2e8f0'} 25%, ${darkMode ? '#334155' : '#f1f5f9'} 50%, ${darkMode ? '#1e293b' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ ...skeletonPulse, height: 28, width: 200, marginBottom: 8 }} />
          <div style={{ ...skeletonPulse, height: 16, width: 280 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ ...cardStyle, padding: '1rem' }}>
              <div style={{ ...skeletonPulse, height: 14, width: 60, marginBottom: 8 }} />
              <div style={{ ...skeletonPulse, height: 28, width: 80 }} />
            </div>
          ))}
        </div>
        <div style={{ ...skeletonPulse, height: 44, marginBottom: '0.75rem' }} />
        {[1,2,3,4,5].map(i => (<div key={i} style={{ ...skeletonPulse, height: 48, marginBottom: 4 }} />))}
      </div>
    );
  }

  return (
    <div>
      {/* Header: Title + Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.2rem' }}>Recomendações</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.78rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            Top ações ranqueadas por ML{date && <span> — {date}</span>}
            {lastUpdated && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.12rem 0.45rem', borderRadius: 10 }}>
                <Clock size={10} /> {getRelativeTime(lastUpdated)}
              </span>
            )}
            <InfoTooltip text={`Nosso modelo de ML analisa indicadores técnicos e fundamentalistas de cada ação da B3 diariamente. Score ≥ ${SCORE_BUY_THRESHOLD} = Compra, ≤ ${SCORE_SELL_THRESHOLD} = Venda, restante = Neutro.`} darkMode={darkMode} size={13} />
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {isPro && recommendations.length > 0 && (
            <>
              <MonthlyReport darkMode={darkMode} theme={theme} />
              <ExportCSV
              darkMode={darkMode}
              filename="b3_recomendacoes"
              label="CSV"
              data={recommendations.map(r => ({
                Ticker: r.ticker,
                Sinal: getSignal(r.score),
                Score: fmt(r.score, 2),
                'Preço Atual': fmt(r.last_close, 2),
                'Preço Previsto': fmt(r.pred_price_t_plus_20, 2),
                'Retorno Previsto (%)': fmt(r.exp_return_20 * 100, 2),
                'Volatilidade (%)': fmt(r.vol_20d * 100, 1),
              }))}
            />
            </>
          )}
          <ShareButton
            text={`📊 B3 Tactical — ${date}\n${totalBuy} compra, ${totalSell} venda, ${totalNeutral} neutros\nTop: ${topTicker?.ticker || '—'} (${topTicker ? fmt(topTicker.score, 2) : '—'})`}
            darkMode={darkMode}
          />
          <button onClick={fetchRecommendations}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            style={{ ...btnBase, padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: 'white', fontWeight: 600, boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div style={{ ...cardStyle, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', marginBottom: '0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {error}
          <button onClick={fetchRecommendations} style={{ ...btnBase, padding: '0.3rem 0.7rem', background: 'rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.75rem', marginLeft: 'auto' }}>
            <RefreshCw size={12} /> Tentar novamente
          </button>
        </div>
      )}

      {/* Activation checklist for new users */}
      <ActivationChecklist darkMode={darkMode} theme={theme} />

      {/* Compact KPI strip — Resumo do Dia inline */}
      {recommendations.length > 0 && (
        <div data-tour="kpi-strip" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))',
          gap: '0.5rem', marginBottom: '0.75rem',
        }}>
          {[
            { label: 'Compra', value: `${totalBuy}`, color: '#10b981', icon: <ArrowUpRight size={14} />, tip: `Ações com score ≥ ${SCORE_BUY_THRESHOLD} — sinal de compra.`, blur: false },
            { label: 'Venda', value: `${totalSell}`, color: '#ef4444', icon: <ArrowDownRight size={14} />, tip: `Ações com score ≤ ${SCORE_SELL_THRESHOLD} — sinal de venda.`, blur: false },
            { label: 'Neutro', value: `${totalNeutral}`, color: '#94a3b8', icon: null, tip: `Ações com score entre ${SCORE_SELL_THRESHOLD} e ${SCORE_BUY_THRESHOLD}.`, blur: false },
            { label: 'Ret. Compra', value: `${avgBuyReturn >= 0 ? '+' : ''}${fmt(avgBuyReturn * 100, 1)}%`, color: avgBuyReturn >= 0 ? '#10b981' : '#ef4444', icon: null, tip: `Retorno médio previsto (20 pregões) das ${buyRecs.length} ações com sinal de compra.`, blur: true },
            { label: 'Top Score', value: `${topTicker?.ticker || '—'} ${fmt(topScore, 1)}`, color: '#8b5cf6', icon: null, tip: 'Ação com maior score do dia.', blur: false },
            ...(simReturn && simReturn.pct !== 0 ? [{
              label: 'Sim. R$10k', value: `R$ ${Math.round(simReturn.final).toLocaleString('pt-BR')}`,
              color: simReturn.gain >= 0 ? '#10b981' : '#ef4444', icon: null,
              tip: `Se investisse R$ 10k nas ${buyRecs.length} ações de compra, retorno previsto: ${simReturn.pct >= 0 ? '+' : ''}${fmt(simReturn.pct, 1)}%. Simulação, não garantia.`,
              blur: true,
            }] : []),
          ].map((kpi, i) => (
            <div key={i} style={{ ...cardStyle, padding: '0.6rem 0.75rem' }}>
              <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={10} />
              </div>
              <div style={{ fontSize: 'clamp(1rem, 2.5vw, 1.15rem)', fontWeight: 700, color: kpi.color, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {kpi.icon}{kpi.blur && !isPro ? <ProValue isPro={false} style={{ color: kpi.color }} placeholder="•••••">{kpi.value}</ProValue> : kpi.value}
              </div>
            </div>
          ))}
        </div>
      )}




      {/* Search + Filter + Sort bar */}
      <div data-tour="search-bar" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: theme.textSecondary }} />
          <input
            type="text" placeholder="Buscar ticker..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '0.55rem 0.55rem 0.55rem 2rem', borderRadius: 8,
              border: `1px solid ${theme.border}`, background: theme.card || (darkMode ? '#1e293b' : '#fff'),
              color: theme.text, fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <select value={signalFilter} onChange={e => setSignalFilter(e.target.value as any)}
          style={{
            padding: '0.55rem 0.75rem', borderRadius: 8, border: `1px solid ${theme.border}`,
            background: theme.card || (darkMode ? '#1e293b' : '#fff'), color: theme.text,
            fontSize: '0.82rem', cursor: 'pointer', WebkitAppearance: 'none' as any, minWidth: 100,
          }}>
          <option value="ALL">Todos</option>
          <option value="Favoritos">★ Favoritos</option>
          <option value="Compra">Compra</option>
          <option value="Venda">Venda</option>
          <option value="Neutro">Neutro</option>
        </select>
        <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
          style={{
            padding: '0.55rem 0.75rem', borderRadius: 8, border: `1px solid ${theme.border}`,
            background: theme.card || (darkMode ? '#1e293b' : '#fff'), color: theme.text,
            fontSize: '0.82rem', cursor: 'pointer', WebkitAppearance: 'none' as any, minWidth: 100,
          }}>
          <option value="ALL">Setor: Todos</option>
          {ALL_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => handleSort(sortBy === 'score' ? 'return' : sortBy === 'return' ? 'ticker' : sortBy === 'ticker' ? 'vol' : 'score')}
          style={{ ...btnBase, padding: '0.55rem 0.75rem', background: theme.card || (darkMode ? '#1e293b' : '#fff'), color: theme.text, border: `1px solid ${theme.border}` }}>
          <ArrowUpDown size={14} /> {sortBy === 'score' ? 'Score' : sortBy === 'return' ? 'Retorno' : sortBy === 'ticker' ? 'Ticker' : 'Volatilidade'}
        </button>
      </div>

      {/* Results count */}
      <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>
        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Desktop Table */}
      <div className="rec-table-desktop" style={{ overflowX: 'auto', marginBottom: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
              {[
                { label: '#', tip: '' },
                ...(isPro ? [{ label: '⊕', tip: 'Clique para seguir/deixar de seguir a ação.' }] : []),
                { label: 'Ticker', tip: 'Código da ação na B3. Clique na ★ para favoritar.' },
                { label: '', tip: '' }, // sparkline column
                { label: 'Sinal', tip: `Compra (score ≥ ${SCORE_BUY_THRESHOLD}), Venda (≤ ${SCORE_SELL_THRESHOLD}) ou Neutro.` },
                { label: 'Score', tip: 'Score do modelo ML. Quanto maior, mais forte o sinal de compra. A barra indica confiança.' },
                { label: 'Preço Atual', tip: 'Último preço de fechamento disponível.' },
                { label: 'Preço Previsto', tip: 'Preço previsto pelo modelo para daqui 20 pregões.' },
                { label: 'Retorno Previsto', tip: 'Retorno esperado em 20 pregões: (previsto - atual) / atual.' },
                { label: 'Volatilidade', tip: 'Volatilidade dos últimos 20 dias. Menor = mais estável.' },
                { label: 'Faixa', tip: 'Stop-Loss → Take-Profit. Faixa de preço sugerida baseada em volatilidade.' },
              ].map((h, i) => (
                <th key={i} style={{
                  padding: '0.6rem 0.5rem', textAlign: i === 0 ? 'left' : 'right', color: theme.textSecondary,
                  fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em',
                  whiteSpace: 'nowrap', cursor: 'pointer',
                }}
                  onClick={() => {
                    const offset = isPro ? 1 : 0;
                    if (i === 1 + offset) handleSort('ticker');
                    else if (i === 3 + offset) handleSort('score');
                    else if (i === 6 + offset) handleSort('return');
                    else if (i === 7 + offset) handleSort('vol');
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    {h.label}
                    {h.tip && <InfoTooltip text={h.tip} darkMode={darkMode} size={10} />}
                  </span>
                  {i >= (isPro ? 7 : 6) && !isPro && <Lock size={10} style={{ marginLeft: 3, verticalAlign: 'middle', color: '#f59e0b' }} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => {
              const signal = getSignal(r.score);
              const sc = getSignalColor(signal);
              const confidence = Math.min(99, Math.max(10, Math.round(50 + r.score * 10 + (1 - r.vol_20d) * 20)));
              const stopLoss = r.last_close * (1 - Math.max(0.03, r.vol_20d * 1.5));
              const takeProfit = r.pred_price_t_plus_20 * (1 + r.vol_20d * 0.3);
              return (
                <tr key={r.ticker} style={{
                  borderBottom: `1px solid ${theme.border}`,
                  background: idx % 2 === 0 ? 'transparent' : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'); }}
                >
                  <td style={{ padding: '0.55rem 0.5rem', color: theme.textSecondary, fontSize: '0.72rem' }}>{idx + 1}</td>
                  {isPro && (
                    <td style={{ padding: '0.55rem 0.3rem', textAlign: 'center' }}>
                      <FollowButton ticker={r.ticker} entryPrice={r.last_close} predPrice={r.pred_price_t_plus_20} score={r.score} darkMode={darkMode} compact />
                    </td>
                  )}
                  <td style={{ padding: '0.55rem 0.5rem', fontWeight: 700, color: theme.text }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <WatchlistButton ticker={r.ticker} darkMode={darkMode} size={14} />
                      {r.ticker}
                      <span style={{ fontSize: '0.6rem', opacity: 0.7 }} title={getSector(r.ticker).sector}>{getSector(r.ticker).icon}</span>
                    </span>
                  </td>
                  <td style={{ padding: '0.55rem 0.3rem' }}>
                    {sparklineData[r.ticker] && <Sparkline data={sparklineData[r.ticker]} width={56} height={18} />}
                  </td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      padding: '0.2rem 0.55rem', borderRadius: 10, fontSize: '0.72rem', fontWeight: 600,
                      background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                    }}>
                      {signal === 'Compra' ? <ArrowUpRight size={12} /> : signal === 'Venda' ? <ArrowDownRight size={12} /> : null}
                      {signal}
                    </span>
                  </td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 600, color: getSignalColor(getSignal(r.score)).text }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                      {fmt(r.score, 2)}
                      <div style={{ width: 28, height: 4, borderRadius: 2, background: darkMode ? '#334155' : '#e2e8f0', overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${confidence}%`, background: confidence >= 70 ? '#10b981' : confidence >= 40 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: theme.text }}>R$ {fmt(r.last_close, 2)}</td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>
                    <ProValue isPro={isPro} style={{ color: theme.text }} placeholder="R$ ••••">R$ {fmt(r.pred_price_t_plus_20, 2)}</ProValue>
                  </td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>
                    <ProValue isPro={isPro} style={{ fontWeight: 600, color: r.exp_return_20 >= 0 ? '#10b981' : '#ef4444' }} placeholder="±••••%">
                      {r.exp_return_20 >= 0 ? '+' : ''}{fmt(r.exp_return_20 * 100, 2)}%
                    </ProValue>
                  </td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>
                    <ProValue isPro={isPro} style={{ color: theme.textSecondary }} placeholder="••%">{fmt(r.vol_20d * 100, 1)}%</ProValue>
                  </td>
                  {/* #12: Merged Faixa column (Stop-Loss → Take-Profit) */}
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>
                    <ProValue isPro={isPro} style={{ color: theme.text, fontSize: '0.75rem' }} placeholder="••• → •••">
                      <span style={{ color: '#ef4444' }}>{fmt(stopLoss, 2)}</span>
                      <span style={{ color: theme.textSecondary, margin: '0 0.15rem' }}>→</span>
                      <span style={{ color: '#10b981' }}>{fmt(takeProfit, 2)}</span>
                    </ProValue>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="rec-cards-mobile" style={{ display: 'none' }}>
        {filtered.map((r, idx) => {
          const signal = getSignal(r.score);
          const sc = getSignalColor(signal);
          const confidence = Math.min(99, Math.max(10, Math.round(50 + r.score * 10 + (1 - r.vol_20d) * 20)));
          const stopLoss = r.last_close * (1 - Math.max(0.03, r.vol_20d * 1.5));
          const takeProfit = r.pred_price_t_plus_20 * (1 + r.vol_20d * 0.3);
          return (
            <div key={r.ticker} style={{ ...cardStyle, marginBottom: '0.5rem', padding: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>#{idx + 1}</span>
                  <WatchlistButton ticker={r.ticker} darkMode={darkMode} size={14} />
                  <span style={{ fontWeight: 700, color: theme.text, fontSize: '0.95rem' }}>{r.ticker}</span>
                  {sparklineData[r.ticker] && <Sparkline data={sparklineData[r.ticker]} width={44} height={16} />}
                  {isPro && <FollowButton ticker={r.ticker} entryPrice={r.last_close} predPrice={r.pred_price_t_plus_20} score={r.score} darkMode={darkMode} compact />}
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                  padding: '0.2rem 0.5rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600,
                  background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                }}>
                  {signal === 'Compra' ? <ArrowUpRight size={11} /> : signal === 'Venda' ? <ArrowDownRight size={11} /> : null}
                  {signal}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.75rem' }}>
                <div><span style={{ color: theme.textSecondary }}>Score:</span> <strong style={{ color: getSignalColor(getSignal(r.score)).text }}>{fmt(r.score, 2)}</strong></div>
                <div><span style={{ color: theme.textSecondary }}>Preço:</span> <strong style={{ color: theme.text }}>R$ {fmt(r.last_close, 2)}</strong></div>
                <div><span style={{ color: theme.textSecondary }}>Previsto:</span> <ProValue isPro={isPro} style={{ fontWeight: 700, color: theme.text }} placeholder="R$ ••••">R$ {fmt(r.pred_price_t_plus_20, 2)}</ProValue></div>
                <div><span style={{ color: theme.textSecondary }}>Retorno:</span> <ProValue isPro={isPro} style={{ fontWeight: 700, color: r.exp_return_20 >= 0 ? '#10b981' : '#ef4444' }} placeholder="±••%">{r.exp_return_20 >= 0 ? '+' : ''}{fmt(r.exp_return_20 * 100, 2)}%</ProValue></div>
                <div><span style={{ color: theme.textSecondary }}>Vol:</span> <ProValue isPro={isPro} style={{ fontWeight: 700, color: theme.textSecondary }} placeholder="••%">{fmt(r.vol_20d * 100, 1)}%</ProValue></div>
                <div>
                  <span style={{ color: theme.textSecondary }}>Confiança:</span>{' '}
                  <ProValue isPro={isPro} style={{ fontWeight: 700, color: confidence >= 70 ? '#10b981' : '#94a3b8' }} placeholder="••%">{confidence}%</ProValue>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.75rem', marginTop: '0.3rem', paddingTop: '0.3rem', borderTop: `1px solid ${theme.border}` }}>
                <div>
                  <span style={{ color: theme.textSecondary }}>Stop-Loss:</span>{' '}
                  <ProValue isPro={isPro} style={{ fontWeight: 700, color: theme.text }} placeholder="R$ ••••">R$ {fmt(stopLoss, 2)}</ProValue>
                </div>
                <div>
                  <span style={{ color: theme.textSecondary }}>Take-Profit:</span>{' '}
                  <ProValue isPro={isPro} style={{ fontWeight: 700, color: theme.text }} placeholder="R$ ••••">R$ {fmt(takeProfit, 2)}</ProValue>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Free user upgrade prompt */}
      {!isPro && (
        <div style={{
          ...cardStyle, textAlign: 'center', padding: '1.25rem',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))',
          border: '1px solid rgba(245,158,11,0.25)',
        }}>
          <Crown size={24} color="#f59e0b" style={{ marginBottom: '0.5rem' }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text, marginBottom: '0.3rem' }}>
            Desbloqueie Confiança, Stop-Loss e Take-Profit
          </div>
          <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '0.75rem' }}>
            Veja todas as colunas sem blur e tenha acesso completo a todas as {recommendations.length} ações.
          </div>
          <a href="#/dashboard/upgrade" style={{
            ...btnBase, padding: '0.6rem 1.5rem', textDecoration: 'none',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontWeight: 700,
            boxShadow: '0 2px 10px rgba(245,158,11,0.3)', display: 'inline-flex',
          }}>
            <Crown size={14} /> Assinar Pro — {PRO_PRICE_LABEL}
          </a>
        </div>
      )}


    </div>
  );
};

export default RecommendationsPage;
