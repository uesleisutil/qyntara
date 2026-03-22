import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Search, ArrowUpDown, Clock, Lock, Crown, Eye, Zap, DollarSign } from 'lucide-react';
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

  const buyRecs = recommendations.filter(r => r.score >= 1.5);
  const totalBuy = buyRecs.length;
  const totalSell = recommendations.filter(r => r.score <= -1.5).length;
  const totalNeutral = recommendations.length - totalBuy - totalSell;
  const avgReturn = recommendations.length ? recommendations.reduce((s, r) => s + (r.exp_return_20 || 0), 0) / recommendations.length : 0;
  const avgBuyReturn = buyRecs.length ? buyRecs.reduce((s, r) => s + (r.exp_return_20 || 0), 0) / buyRecs.length : 0;
  const topScore = recommendations.length ? Math.max(...recommendations.map(r => r.score)) : 0;
  const topTicker = recommendations.length ? recommendations.reduce((a, b) => a.score > b.score ? a : b) : null;

  // Strategy G: "Se você tivesse seguido" — simulated return
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
          {[1,2,3,4,5,6].map(i => (
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

  // Strategy F: time-limited hint for free users
  const now = new Date();
  const hour = now.getHours();
  const isAfterCutoff = hour >= 14;

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
          style={{ ...btnBase, padding: '0.55rem 1.1rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: 'white', fontWeight: 600, boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {error && (
        <div style={{ ...cardStyle, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>
      )}

      {/* Strategy B: Resumo do Dia */}
      {recommendations.length > 0 && (
        <div style={{
          ...cardStyle, marginBottom: '1rem', padding: '1rem 1.25rem',
          background: darkMode
            ? 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.05))'
            : 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(139,92,246,0.03))',
          border: `1px solid ${darkMode ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <Zap size={18} color="#3b82f6" />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text }}>Resumo do Dia</span>
            <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>{date}</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: '0.82rem', color: theme.textSecondary, lineHeight: 1.6 }}>
              Hoje temos <strong style={{ color: '#10b981' }}>{totalBuy} sinais de compra</strong>,{' '}
              <strong style={{ color: '#ef4444' }}>{totalSell} de venda</strong> e{' '}
              <strong style={{ color: '#f59e0b' }}>{totalNeutral} neutros</strong>.
              {topTicker && (
                <> O sinal mais forte é <strong style={{ color: theme.text }}>{topTicker.ticker}</strong> com score{' '}
                <strong style={{ color: '#3b82f6' }}>{fmt(topTicker.score, 2)}</strong>
                {!isPro && <> — <a href="#/dashboard/upgrade" style={{ color: '#f59e0b', fontWeight: 600 }}>desbloqueie todos os sinais</a></>}
                .</>
              )}
            </div>
          </div>
          {/* Strategy E: Strong signals teaser for free */}
          {!isPro && totalBuy >= 3 && (
            <div style={{
              marginTop: '0.6rem', padding: '0.5rem 0.75rem', borderRadius: 8,
              background: darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)',
              border: '1px solid rgba(16,185,129,0.2)',
              display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
            }}>
              <Eye size={14} color="#10b981" />
              <span style={{ fontSize: '0.78rem', color: theme.textSecondary }}>
                <strong style={{ color: '#10b981' }}>{totalBuy} ações com sinal forte hoje</strong> — você está vendo apenas 5.{' '}
                <a href="#/dashboard/upgrade" style={{ color: '#f59e0b', fontWeight: 600, textDecoration: 'underline' }}>Veja todas →</a>
              </span>
            </div>
          )}
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

      {/* Strategy G: "Se você tivesse seguido" */}
      {simReturn && simReturn.pct !== 0 && (
        <div style={{
          ...cardStyle, marginBottom: '1rem', padding: '1rem 1.25rem',
          background: simReturn.gain >= 0
            ? (darkMode ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))' : 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.01))')
            : (darkMode ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))' : 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.01))'),
          border: `1px solid ${simReturn.gain >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <DollarSign size={16} color={simReturn.gain >= 0 ? '#10b981' : '#ef4444'} />
            <span style={{ fontSize: '0.78rem', color: theme.textSecondary }}>
              Simulação — Sinais de Compra de Hoje
              <InfoTooltip text="Simulação hipotética: se você investisse R$ 10.000 distribuídos igualmente entre as ações com sinal de Compra hoje, e o retorno previsto se concretizasse, este seria o resultado em ~20 pregões. Valor estimado, não garantido." darkMode={darkMode} size={12} />
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: theme.textSecondary }}>R$ {simReturn.initial.toLocaleString('pt-BR')}</span>
            <span style={{ color: theme.textSecondary }}>→</span>
            <span style={{ fontSize: 'clamp(1.3rem, 4vw, 1.8rem)', fontWeight: 800, color: simReturn.gain >= 0 ? '#10b981' : '#ef4444' }}>
              R$ {Math.round(simReturn.final).toLocaleString('pt-BR')}
            </span>
            <span style={{
              padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
              background: simReturn.gain >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: simReturn.gain >= 0 ? '#10b981' : '#ef4444',
            }}>
              {simReturn.gain >= 0 ? '+' : ''}{fmt(simReturn.pct, 1)}%
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginTop: '0.3rem' }}>
            Baseado em {buyRecs.length} ações com sinal de compra · Retorno previsto (20 pregões) · Não é garantia
          </div>
        </div>
      )}

      {/* Big Number: Buy Signal Avg Return */}
      {buyRecs.length > 0 && (
        <div style={{
          ...cardStyle, marginBottom: '1rem', padding: '1.1rem 1.25rem',
          background: darkMode ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))' : 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.01))',
          border: '1px solid rgba(16,185,129,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem',
        }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              Retorno Médio Previsto — Sinais de Compra
              <InfoTooltip text={`Média do retorno previsto pelo modelo (horizonte de 20 pregões) apenas das ${buyRecs.length} ações com sinal de Compra (score ≥ 1.5). Este é um valor estimado, não realizado.`} darkMode={darkMode} />
            </div>
            <div style={{ fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', fontWeight: 800, color: '#10b981', lineHeight: 1.1 }}>
              {avgBuyReturn >= 0 ? '+' : ''}{fmt(avgBuyReturn * 100, 2)}%
            </div>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.2rem' }}>
              Baseado em {buyRecs.length} ação{buyRecs.length !== 1 ? 'ões' : ''} com sinal de compra
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem', borderRadius: 20, background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>
            <ArrowUpRight size={16} /> Compra
          </div>
        </div>
      )}

      {/* Strategy F: Time-limited hint for free users */}
      {!isPro && isAfterCutoff && (
        <div style={{
          ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
          background: darkMode ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)',
          border: '1px solid rgba(245,158,11,0.25)',
          display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
        }}>
          <Clock size={16} color="#f59e0b" />
          <span style={{ fontSize: '0.8rem', color: theme.textSecondary }}>
            ⏰ Recomendações atualizadas disponíveis até 14h para o plano Free. Após esse horário, apenas Pro tem acesso.{' '}
            <a href="#/dashboard/upgrade" style={{ color: '#f59e0b', fontWeight: 600 }}>Assinar Pro →</a>
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {[
          { label: 'Total Ações', value: `${recommendations.length}`, color: '#3b82f6', tip: 'Número total de ações analisadas pelo modelo hoje.' },
          { label: 'Compra', value: `${totalBuy}`, color: '#10b981', tip: 'Ações com score ≥ 1.5 — sinal de compra.' },
          { label: 'Venda', value: `${totalSell}`, color: '#ef4444', tip: 'Ações com score ≤ -1.5 — sinal de venda.' },
          { label: 'Neutro', value: `${totalNeutral}`, color: '#f59e0b', tip: 'Ações com score entre -1.5 e 1.5.' },
          { label: 'Retorno Médio', value: `${avgReturn >= 0 ? '+' : ''}${fmt(avgReturn * 100, 2)}%`, color: avgReturn >= 0 ? '#10b981' : '#ef4444', tip: 'Retorno médio previsto de todas as ações (horizonte 20 pregões).' },
          { label: 'Top Score', value: fmt(topScore, 2), color: '#8b5cf6', tip: 'Maior score do dia — quanto maior, mais forte o sinal.' },
        ].map((kpi, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={11} />
            </div>
            <div style={{ fontSize: 'clamp(1.1rem, 3vw, 1.3rem)', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter + Sort bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
          <option value="Compra">Compra</option>
          <option value="Venda">Venda</option>
          <option value="Neutro">Neutro</option>
        </select>
        <button onClick={() => handleSort(sortBy === 'score' ? 'return' : sortBy === 'return' ? 'ticker' : sortBy === 'ticker' ? 'vol' : 'score')}
          style={{ ...btnBase, padding: '0.55rem 0.75rem', background: theme.card || (darkMode ? '#1e293b' : '#fff'), color: theme.text, border: `1px solid ${theme.border}` }}>
          <ArrowUpDown size={14} /> {sortBy === 'score' ? 'Score' : sortBy === 'return' ? 'Retorno' : sortBy === 'ticker' ? 'Ticker' : 'Volatilidade'}
        </button>
      </div>

      {/* Results count */}
      <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>
        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        {!isPro && <span> · <Lock size={10} style={{ verticalAlign: 'middle' }} /> Colunas Pro bloqueadas — <a href="#/dashboard/upgrade" style={{ color: '#f59e0b' }}>desbloquear</a></span>}
      </div>

      {/* Desktop Table — Strategy A: show ALL rows, blur Pro columns for free */}
      <div className="rec-table-desktop" style={{ overflowX: 'auto', marginBottom: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
              {['#', 'Ticker', 'Sinal', 'Score', 'Preço Atual', 'Preço Previsto', 'Retorno Previsto', 'Volatilidade',
                ...(true ? ['Confiança', 'Stop-Loss', 'Take-Profit'] : [])
              ].map((h, i) => (
                <th key={i} style={{
                  padding: '0.6rem 0.5rem', textAlign: i <= 1 ? 'left' : 'right', color: theme.textSecondary,
                  fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em',
                  whiteSpace: 'nowrap', cursor: 'pointer',
                  position: 'relative',
                }}
                  onClick={() => {
                    if (i === 1) handleSort('ticker');
                    else if (i === 3) handleSort('score');
                    else if (i === 6) handleSort('return');
                    else if (i === 7) handleSort('vol');
                  }}
                >
                  {h}
                  {i >= 8 && !isPro && <Lock size={10} style={{ marginLeft: 3, verticalAlign: 'middle', color: '#f59e0b' }} />}
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
                  <td style={{ padding: '0.55rem 0.5rem', fontWeight: 700, color: theme.text }}>{r.ticker}</td>
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
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 600, color: r.score >= 1.5 ? '#10b981' : r.score <= -1.5 ? '#ef4444' : '#f59e0b' }}>{fmt(r.score, 2)}</td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: theme.text }}>R$ {fmt(r.last_close, 2)}</td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: theme.text }}>R$ {fmt(r.pred_price_t_plus_20, 2)}</td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 600, color: r.exp_return_20 >= 0 ? '#10b981' : '#ef4444' }}>
                    {r.exp_return_20 >= 0 ? '+' : ''}{fmt(r.exp_return_20 * 100, 2)}%
                  </td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: theme.textSecondary }}>{fmt(r.vol_20d * 100, 1)}%</td>
                  {/* Pro columns — blurred for free users */}
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', position: 'relative' }}>
                    <span style={{ filter: isPro ? 'none' : 'blur(6px)', userSelect: isPro ? 'auto' : 'none', color: confidence >= 70 ? '#10b981' : confidence >= 40 ? '#f59e0b' : '#ef4444' }}>
                      {confidence}%
                    </span>
                    {!isPro && <Lock size={10} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: '#f59e0b', opacity: 0.7 }} />}
                  </td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', position: 'relative' }}>
                    <span style={{ filter: isPro ? 'none' : 'blur(6px)', userSelect: isPro ? 'auto' : 'none', color: theme.text }}>
                      R$ {fmt(stopLoss, 2)}
                    </span>
                    {!isPro && <Lock size={10} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: '#f59e0b', opacity: 0.7 }} />}
                  </td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', position: 'relative' }}>
                    <span style={{ filter: isPro ? 'none' : 'blur(6px)', userSelect: isPro ? 'auto' : 'none', color: theme.text }}>
                      R$ {fmt(takeProfit, 2)}
                    </span>
                    {!isPro && <Lock size={10} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: '#f59e0b', opacity: 0.7 }} />}
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
                  <span style={{ fontWeight: 700, color: theme.text, fontSize: '0.95rem' }}>{r.ticker}</span>
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
                <div><span style={{ color: theme.textSecondary }}>Score:</span> <strong style={{ color: r.score >= 1.5 ? '#10b981' : r.score <= -1.5 ? '#ef4444' : '#f59e0b' }}>{fmt(r.score, 2)}</strong></div>
                <div><span style={{ color: theme.textSecondary }}>Preço:</span> <strong style={{ color: theme.text }}>R$ {fmt(r.last_close, 2)}</strong></div>
                <div><span style={{ color: theme.textSecondary }}>Previsto:</span> <strong style={{ color: theme.text }}>R$ {fmt(r.pred_price_t_plus_20, 2)}</strong></div>
                <div><span style={{ color: theme.textSecondary }}>Retorno:</span> <strong style={{ color: r.exp_return_20 >= 0 ? '#10b981' : '#ef4444' }}>{r.exp_return_20 >= 0 ? '+' : ''}{fmt(r.exp_return_20 * 100, 2)}%</strong></div>
                <div><span style={{ color: theme.textSecondary }}>Vol:</span> <strong style={{ color: theme.textSecondary }}>{fmt(r.vol_20d * 100, 1)}%</strong></div>
                {/* Pro data blurred on mobile */}
                <div style={{ position: 'relative' }}>
                  <span style={{ color: theme.textSecondary }}>Confiança:</span>{' '}
                  <strong style={{ filter: isPro ? 'none' : 'blur(5px)', color: confidence >= 70 ? '#10b981' : '#f59e0b' }}>{confidence}%</strong>
                  {!isPro && <Lock size={9} style={{ marginLeft: 3, color: '#f59e0b', verticalAlign: 'middle' }} />}
                </div>
              </div>
              {/* Pro row: stop-loss / take-profit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.75rem', marginTop: '0.3rem', paddingTop: '0.3rem', borderTop: `1px solid ${theme.border}` }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ color: theme.textSecondary }}>Stop-Loss:</span>{' '}
                  <strong style={{ filter: isPro ? 'none' : 'blur(5px)', color: theme.text }}>R$ {fmt(stopLoss, 2)}</strong>
                  {!isPro && <Lock size={9} style={{ marginLeft: 3, color: '#f59e0b', verticalAlign: 'middle' }} />}
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ color: theme.textSecondary }}>Take-Profit:</span>{' '}
                  <strong style={{ filter: isPro ? 'none' : 'blur(5px)', color: theme.text }}>R$ {fmt(takeProfit, 2)}</strong>
                  {!isPro && <Lock size={9} style={{ marginLeft: 3, color: '#f59e0b', verticalAlign: 'middle' }} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Free user upgrade prompt at bottom */}
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
            <Crown size={14} /> Assinar Pro — R$ 49/mês
          </a>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .rec-table-desktop { display: none !important; }
          .rec-cards-mobile { display: block !important; }
        }
      `}</style>
    </div>
  );
};

export default RecommendationsPage;
