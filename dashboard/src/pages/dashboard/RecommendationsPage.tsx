import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Search, ArrowUpDown } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }
interface Recommendation {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const RecommendationsPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'COMPRA' | 'VENDA' | 'NEUTRO'>('ALL');

  useEffect(() => { fetchRecommendations(); }, []);

  const fetchRecommendations = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } });
      if (!res.ok) throw new Error('Falha ao carregar recomendações');
      const data = await res.json();
      setRecommendations(data.recommendations || []);
      setDate(data.date || '');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const getSignal = (score: number) => score >= 1.5 ? 'COMPRA' : score <= -1.5 ? 'VENDA' : 'NEUTRO';
  const getSignalColor = (signal: string) => {
    if (signal === 'COMPRA') return { bg: 'rgba(16,185,129,0.15)', text: '#10b981', border: 'rgba(16,185,129,0.3)' };
    if (signal === 'VENDA') return { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' };
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

  const totalBuy = recommendations.filter(r => r.score >= 1.5).length;
  const totalSell = recommendations.filter(r => r.score <= -1.5).length;
  const totalNeutral = recommendations.length - totalBuy - totalSell;
  const avgReturn = recommendations.length ? recommendations.reduce((s, r) => s + (r.exp_return_20 || 0), 0) / recommendations.length : 0;
  const topScore = recommendations.length ? Math.max(...recommendations.map(r => r.score)) : 0;

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
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: theme.textSecondary }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
        Carregando recomendações...
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Recomendações</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0 }}>
            Top ações ranqueadas por ML{date && <span> — {date}</span>}
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

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total', value: `${recommendations.length}`, color: '#3b82f6' },
          { label: 'Compra', value: `${totalBuy}`, color: '#10b981' },
          { label: 'Venda', value: `${totalSell}`, color: '#ef4444' },
          { label: 'Ret. Médio', value: `${fmt(avgReturn * 100, 1)}%`, color: avgReturn >= 0 ? '#10b981' : '#ef4444' },
          { label: 'Top Score', value: fmt(topScore, 2), color: '#f59e0b' },
        ].map((kpi, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.3rem' }}>{kpi.label}</div>
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
            { key: 'COMPRA', label: 'Compra', count: totalBuy, color: '#10b981' },
            { key: 'NEUTRO', label: 'Neutro', count: totalNeutral, color: '#f59e0b' },
            { key: 'VENDA', label: 'Venda', count: totalSell, color: '#ef4444' },
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
      <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
        {filtered.length} de {recommendations.length} ações
      </div>

      {/* Desktop Table */}
      <div className="rec-table-desktop" style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {[
                  { key: '', label: '#', sortable: false },
                  { key: 'ticker', label: 'Ticker', sortable: true },
                  { key: '', label: 'Preço', sortable: false },
                  { key: '', label: 'Previsto', sortable: false },
                  { key: 'return', label: 'Retorno', sortable: true },
                  { key: 'vol', label: 'Vol', sortable: true },
                  { key: 'score', label: 'Score', sortable: true },
                  { key: '', label: 'Sinal', sortable: false },
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
                    {h.label}
                    {h.sortable && sortBy === h.key && (
                      <span style={{ marginLeft: 3, fontSize: '0.7rem' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: theme.textSecondary }}>Nenhuma recomendação encontrada</td></tr>
              ) : filtered.map((rec, i) => {
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards (hidden on desktop) */}
      <div className="rec-cards-mobile" style={{ display: 'none', flexDirection: 'column', gap: '0.5rem' }}>
        {filtered.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', color: theme.textSecondary }}>Nenhuma recomendação encontrada</div>
        ) : filtered.map((rec, i) => {
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
                <div><span style={{ color: theme.textSecondary }}>Previsto: </span><span style={{ color: ret >= 0 ? '#10b981' : '#ef4444' }}>R$ {fmt(rec.pred_price_t_plus_20)}</span></div>
                <div>
                  <span style={{ color: theme.textSecondary }}>Retorno: </span>
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
