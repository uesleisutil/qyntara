import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Search, ArrowUpDown, Clock, Lock, Crown } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../../components/shared/InfoTooltip';
import { useIsPro } from '../../components/shared/ProGate';

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
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'Compra' | 'Venda' | 'Neutro'>('ALL');

  useEffect(() => { fetchRecommendations(); }, []);

  const fetchRecommendations = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } });
      if (!res.ok) throw new Error('Falha ao carregar recomendações');
      const data = await res.json();
      setRecommendations(data.recommendations || []);
      setDate(data.date || '');
      setLastUpdated(new Date());
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const getSignal = (score: number) => score >= 1.5 ? 'Compra' : score <= -1.5 ? 'Venda' : 'Neutro';
  const getSignalColor = (signal: string) => {
    if (signal === 'Compra') return { bg: 'rgba(16,185,129,0.15)', text: '#10b981', border: 'rgba(16,185,129,0.3)' };
    if (signal === 'Venda') return { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' };
    return { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' };
  };

  const handleSort = useCallback((field: string) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  }, [sortBy]);

  const filtered = recommendations
    .filter(r => !searchTerm || r.ticker?.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(r => signalFilter === 'ALL' || getSignal(r.score) === signalFilter)
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'score') return (a.score - b.score) * dir;
      if (sortBy === 'return') return (a.exp_return_20 - b.exp_return_20) * dir;
      if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker) * dir;
      if (sortBy === 'vol') return (a.vol_20d - b.vol_20d) * dir;
      return (b.score - a.score);
    });

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const buyRecs = recommendations.filter(r => r.score >= 1.5);
  const totalBuy = buyRecs.length;
  const totalSell = recommendations.filter(r => r.score <= -1.5).length;
  const totalNeutral = recommendations.length - totalBuy - totalSell;
  const avgReturn = recommendations.length ? recommendations.reduce((s, r) => s + (r.exp_return_20 || 0), 0) / recommendations.length : 0;
  const avgBuyReturn = buyRecs.length ? buyRecs.reduce((s, r) => s + (r.exp_return_20 || 0), 0) / buyRecs.length : 0;
  const topScore = recommendations.length ? Math.max(...recommendations.map(r => r.score)) : 0;

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
    minHeight: 38,
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
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ ...cardStyle, padding: '1rem' }}>
              <div style={{ ...skeletonPulse, height: 14, width: 60, marginBottom: 8 }} />
              <div style={{ ...skeletonPulse, height: 28, width: 80 }} />
            </div>
          ))}
        </div>
        <div style={{ ...skeletonPulse, height: 44, marginBottom: '0.75rem' }} />
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ ...skeletonPulse, height: 48, marginBottom: 4 }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Recomendações</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            Top ações ranqueadas por ML{date && <span> — {date}</span>}
            {lastUpdated && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.5rem', borderRadius: 10 }}>
                <Clock size={10} /> {getRelativeTime(lastUpdated)}
              </span>
            )}
          </p>
        </div>
        <button onClick={fetchRecommendations}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          style={{
            ...btnBase, padding: '0.55rem 1.1rem',
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: 'white',
            fontWeight: 600, boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
          }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {error && (
        <div style={{ ...cardStyle, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* How it works banner */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
        borderColor: darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
          💡 <strong style={{ color: theme.text }}>Como funciona:</strong> Nosso modelo de Machine Learning analisa dezenas de indicadores técnicos e fundamentalistas de cada ação da B3 diariamente. O <strong>Score</strong> resume a atratividade: quanto maior, mais favorável. Ações com score ≥ 1.5 recebem sinal de <strong style={{ color: '#10b981' }}>Compra</strong>, ≤ -1.5 de <strong style={{ color: '#ef4444' }}>Venda</strong>, e o restante fica <strong style={{ color: '#f59e0b' }}>Neutro</strong>.
        </div>
      </div>

      {/* Big Number: Buy Signal Avg Return */}
      {buyRecs.length > 0 && (
        <div style={{
          ...cardStyle, marginBottom: '1rem', padding: '1.1rem 1.25rem',
          background: darkMode
            ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))'
            : 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.01))',
          border: '1px solid rgba(16,185,129,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem',
        }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              Retorno Médio Previsto — Sinais de Compra
              <InfoTooltip text={`Média do retorno previsto pelo modelo (horizonte de 20 pregões) apenas das ${buyRecs.length} ações com sinal de Compra (score ≥ 1.5). Este é um valor estimado, não realizado. Acompanhe a evolução real na aba Tracking.`} darkMode={darkMode} />
            </div>
            <div style={{ fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', fontWeight: 800, color: '#10b981', lineHeight: 1.1 }}>
              {avgBuyReturn >= 0 ? '+' : ''}{fmt(avgBuyReturn * 100, 2)}%
            </div>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.2rem' }}>
              Baseado em {buyRecs.length} ação{buyRecs.length !== 1 ? 'ões' : ''} com sinal de compra
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.4rem 0.8rem', borderRadius: 20,
            background: 'rgba(16,185,129,0.15)', color: '#10b981',
            fontSize: '0.8rem', fontWeight: 600,
          }}>
            <ArrowUpRight size={16} /> Compra
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total', value: `${recommendations.length}`, color: '#3b82f6', tip: 'Número total de ações analisadas pelo modelo hoje.' },
          { label: 'Compra', value: `${totalBuy}`, color: '#10b981', tip: 'Ações com score ≥ 1.5 — o modelo indica potencial de valorização nos próximos 20 pregões.' },
          { label: 'Venda', value: `${totalSell}`, color: '#ef4444', tip: 'Ações com score ≤ -1.5 — o modelo indica potencial de desvalorização nos próximos 20 pregões.' },
          { label: 'Neutro', value: `${totalNeutral}`, color: '#f59e0b', tip: 'Ações sem sinal claro — o modelo não tem convicção forte para compra ou venda.' },
          { label: 'Ret. Médio Previsto', value: `${fmt(avgReturn * 100, 1)}%`, color: avgReturn >= 0 ? '#10b981' : '#ef4444', tip: 'Retorno médio previsto pelo modelo para todas as ações (horizonte de 20 pregões). Valor estimado, não realizado.' },
          { label: 'Top Score', value: fmt(topScore, 2), color: '#3b82f6', tip: 'Maior score entre todas as ações — indica a recomendação mais forte do modelo hoje.' },
        ].map((kpi, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} />
            </div>
            <div style={{ fontSize: 'clamp(1.1rem, 3vw, 1.35rem)', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Search + Signal Filter + Sort */}
      <div style={{ ...cardStyle, marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: theme.textSecondary }} />
          <input type="text" placeholder="Buscar ticker..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', background: darkMode ? '#0f172a' : '#f8fafc',
              border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, fontSize: '0.85rem', outline: 'none',
              boxSizing: 'border-box', transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
            onBlur={e => { e.currentTarget.style.borderColor = theme.border; }}
          />
        </div>

        {/* Signal filter chips */}
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {([
            { key: 'ALL', label: 'Todos', count: recommendations.length, color: '#3b82f6' },
            { key: 'Compra', label: 'Compra', count: totalBuy, color: '#10b981' },
            { key: 'Neutro', label: 'Neutro', count: totalNeutral, color: '#f59e0b' },
            { key: 'Venda', label: 'Venda', count: totalSell, color: '#ef4444' },
          ] as const).map(chip => {
            const active = signalFilter === chip.key;
            return (
              <button key={chip.key} onClick={() => setSignalFilter(chip.key)}
                style={{
                  ...btnBase, padding: '0.35rem 0.65rem', fontSize: '0.75rem',
                  background: active ? chip.color : 'transparent',
                  color: active ? 'white' : chip.color,
                  border: `1px solid ${active ? chip.color : theme.border}`,
                  fontWeight: active ? 600 : 400, borderRadius: 20,
                }}>
                {chip.label} <span style={{ opacity: 0.8, fontSize: '0.7rem' }}>({chip.count})</span>
              </button>
            );
          })}
        </div>

        {/* Sort controls */}
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
            padding: '0.45rem 0.6rem', background: darkMode ? '#0f172a' : '#f8fafc',
            border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, fontSize: '0.8rem', outline: 'none',
            cursor: 'pointer', minHeight: 34,
          }}>
            <option value="score">Score</option>
            <option value="return">Retorno</option>
            <option value="ticker">Ticker</option>
            <option value="vol">Volatilidade</option>
          </select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            style={{
              ...btnBase, padding: '0.4rem', width: 34, height: 34,
              background: darkMode ? '#0f172a' : '#f8fafc',
              border: `1px solid ${theme.border}`, color: theme.text,
            }}
            title={sortDir === 'asc' ? 'Crescente' : 'Decrescente'}
          >
            <ArrowUpDown size={14} style={{ transform: sortDir === 'asc' ? 'scaleY(-1)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>
      </div>

      {/* Results count */}
      <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.5rem', paddingLeft: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {filtered.length} de {recommendations.length} ações
        {!isPro && filtered.length > 5 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0.15rem 0.5rem',
            borderRadius: 10, background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
            fontSize: '0.68rem', fontWeight: 600,
          }}>
            <Lock size={10} /> Plano Free: top 5 visíveis · <a href="#/dashboard/upgrade" style={{ color: '#f59e0b', textDecoration: 'underline' }}>Upgrade</a>
          </span>
        )}
      </div>

      {/* Desktop Table */}
      <div className="rec-table-desktop" style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {[
                  { key: '', label: '#', sortable: false, tip: '' },
                  { key: 'ticker', label: 'Ticker', sortable: true, tip: 'Código da ação na B3 (ex: PETR4 = Petrobras PN).' },
                  { key: '', label: 'Preço', sortable: false, tip: 'Último preço de fechamento da ação.' },
                  { key: '', label: 'Previsto (20d)', sortable: false, tip: 'Preço que o modelo prevê para daqui a 20 pregões (~1 mês).' },
                  { key: 'return', label: 'Ret. previsto', sortable: true, tip: 'Retorno previsto pelo modelo em % para 20 pregões — diferença entre preço previsto e atual.' },
                  { key: 'vol', label: 'Vol', sortable: true, tip: 'Volatilidade dos últimos 20 dias — mede o risco. Quanto maior, mais a ação oscila.' },
                  { key: 'score', label: 'Score', sortable: true, tip: 'Pontuação do modelo de ML. Combina retorno esperado, risco e indicadores. Quanto maior, mais atrativa.' },
                  { key: '', label: 'Sinal', sortable: false, tip: 'Recomendação simplificada: Compra (score ≥ 1.5), Venda (≤ -1.5) ou Neutro.' },
                  ...(isPro ? [
                    { key: '', label: 'Confiança', sortable: false, tip: 'Nível de confiança do modelo baseado no score. Quanto maior, mais convicto.' },
                    { key: '', label: 'Stop-loss', sortable: false, tip: 'Preço sugerido para limitar perdas (2× volatilidade abaixo do preço atual).' },
                    { key: '', label: 'Take-profit', sortable: false, tip: 'Preço-alvo do modelo para 20 pregões.' },
                  ] : []),
                ].map((h, idx) => (
                  <th key={idx}
                    onClick={() => h.sortable && handleSort(h.key)}
                    style={{
                      padding: '0.65rem 0.6rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600,
                      color: sortBy === h.key ? '#3b82f6' : theme.textSecondary,
                      background: darkMode ? '#0f172a' : '#f8fafc', whiteSpace: 'nowrap',
                      cursor: h.sortable ? 'pointer' : 'default', userSelect: 'none',
                      transition: 'color 0.15s',
                    }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      {h.label}
                      {h.tip && <InfoTooltip text={h.tip} darkMode={darkMode} size={12} />}
                    </span>
                    {h.sortable && sortBy === h.key && (
                      <span style={{ marginLeft: 3, fontSize: '0.7rem' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={isPro ? 11 : 8} style={{ padding: '2rem', textAlign: 'center', color: theme.textSecondary }}>Nenhuma recomendação encontrada</td></tr>
              ) : (isPro ? filtered : filtered.slice(0, 5)).map((rec, i) => {
                const signal = getSignal(rec.score);
                const sc = getSignalColor(signal);
                const ret = rec.exp_return_20;
                return (
                  <tr key={rec.ticker} style={{ borderBottom: `1px solid ${theme.border}`, transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '0.5rem 0.6rem' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 26, height: 26, borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
                        background: i < 3 ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : (darkMode ? '#334155' : '#e2e8f0'),
                        color: i < 3 ? 'white' : theme.text,
                      }}>{i + 1}</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600, color: theme.text, fontSize: '0.85rem' }}>{rec.ticker}</td>
                    <td style={{ padding: '0.5rem 0.6rem', color: theme.textSecondary, fontSize: '0.85rem' }}>R$ {fmt(rec.last_close)}</td>
                    <td style={{ padding: '0.5rem 0.6rem', color: ret >= 0 ? '#10b981' : '#ef4444', fontWeight: 500, fontSize: '0.85rem' }}>R$ {fmt(rec.pred_price_t_plus_20)}</td>
                    <td style={{ padding: '0.5rem 0.6rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: ret >= 0 ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.85rem' }}>
                        {ret >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {fmt(ret * 100, 1)}%
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', color: theme.textSecondary, fontSize: '0.85rem' }}>{fmt(rec.vol_20d * 100, 1)}%</td>
                    <td style={{ padding: '0.5rem 0.6rem', color: '#3b82f6', fontWeight: 700, fontSize: '0.85rem' }}>{fmt(rec.score, 3)}</td>
                    <td style={{ padding: '0.5rem 0.6rem' }}>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: sc.bg, color: sc.text }}>{signal}</span>
                    </td>
                    {isPro && (
                      <>
                        <td style={{ padding: '0.5rem 0.6rem' }}>
                          {(() => {
                            const conf = Math.min(Math.abs(rec.score) / 5 * 100, 99);
                            const confColor = conf >= 70 ? '#10b981' : conf >= 50 ? '#f59e0b' : '#ef4444';
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <div style={{ flex: 1, height: 5, borderRadius: 3, background: darkMode ? '#334155' : '#e2e8f0', maxWidth: 50, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', borderRadius: 3, width: `${conf}%`, background: confColor }} />
                                </div>
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: confColor }}>{fmt(conf, 0)}%</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.82rem', fontWeight: 600, color: '#ef4444' }}>
                          R$ {fmt(rec.last_close * (1 - Math.max(rec.vol_20d * 2, 0.03)), 2)}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.82rem', fontWeight: 600, color: '#10b981' }}>
                          R$ {fmt(rec.pred_price_t_plus_20, 2)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Free user upgrade prompt */}
      {!isPro && filtered.length > 5 && (
        <div style={{
          ...cardStyle, marginTop: '-1px', borderTopLeftRadius: 0, borderTopRightRadius: 0,
          textAlign: 'center', padding: '1.25rem',
          background: darkMode
            ? 'linear-gradient(180deg, rgba(245,158,11,0.05), rgba(245,158,11,0.02))'
            : 'linear-gradient(180deg, rgba(245,158,11,0.04), rgba(245,158,11,0.01))',
          borderColor: 'rgba(245,158,11,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Crown size={18} color="#f59e0b" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>
              +{filtered.length - 5} ações disponíveis no plano Pro
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.75rem' }}>
            Desbloqueie todas as recomendações, confiança, stop-loss e take-profit
          </p>
          <a href="#/dashboard/upgrade" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.5rem 1.2rem', borderRadius: 8, textDecoration: 'none',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white',
            fontSize: '0.82rem', fontWeight: 600,
          }}>
            <Crown size={14} /> Fazer Upgrade
          </a>
        </div>
      )}

      {/* Mobile Cards (hidden on desktop) */}
      <div className="rec-cards-mobile" style={{ display: 'none', flexDirection: 'column', gap: '0.5rem' }}>
        {filtered.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', color: theme.textSecondary }}>Nenhuma recomendação encontrada</div>
        ) : (isPro ? filtered : filtered.slice(0, 5)).map((rec, i) => {
          const signal = getSignal(rec.score);
          const sc = getSignalColor(signal);
          const ret = rec.exp_return_20;
          return (
            <div key={rec.ticker} style={{ ...cardStyle, padding: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, borderRadius: 6, fontSize: '0.7rem', fontWeight: 700,
                    background: i < 3 ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : (darkMode ? '#334155' : '#e2e8f0'),
                    color: i < 3 ? 'white' : theme.text,
                  }}>{i + 1}</span>
                  <span style={{ fontWeight: 700, color: theme.text, fontSize: '1rem' }}>{rec.ticker}</span>
                </div>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: sc.bg, color: sc.text }}>{signal}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem', fontSize: '0.8rem' }}>
                <div><span style={{ color: theme.textSecondary }}>Preço: </span><span style={{ color: theme.text }}>R$ {fmt(rec.last_close)}</span></div>
                <div><span style={{ color: theme.textSecondary }}>Previsto (20d): </span><span style={{ color: ret >= 0 ? '#10b981' : '#ef4444' }}>R$ {fmt(rec.pred_price_t_plus_20)}</span></div>
                <div>
                  <span style={{ color: theme.textSecondary }}>Ret. previsto: </span>
                  <span style={{ color: ret >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{fmt(ret * 100, 1)}%</span>
                </div>
                <div><span style={{ color: theme.textSecondary }}>Score: </span><span style={{ color: '#3b82f6', fontWeight: 700 }}>{fmt(rec.score, 3)}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .rec-table-desktop { display: none !important; }
          .rec-cards-mobile { display: flex !important; }
        }
      `}</style>
    </div>
  );
};

export default RecommendationsPage;
