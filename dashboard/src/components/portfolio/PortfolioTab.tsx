import React, { useState, useEffect, useMemo } from 'react';
import { Crown, TrendingUp, Shield, Target, PieChart, ArrowUpRight, ShieldCheck, Flame, Scale } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../shared/InfoTooltip';

interface PortfolioTabProps { darkMode?: boolean; }

interface Rec {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

type Profile = 'conservador' | 'moderado' | 'arrojado';

const PROFILES: Record<Profile, { label: string; icon: React.ReactNode; color: string; desc: string; maxVol: number; minScore: number; topN: number; stopMult: number; sortBy: 'risk_adjusted' | 'return' | 'score'; weightBy: 'inv_vol' | 'equal' | 'score' }> = {
  conservador: {
    label: 'Conservador', icon: <ShieldCheck size={16} />, color: '#8b5cf6',
    desc: 'Prioriza baixa volatilidade e alta confiança. Menos ações, mais proteção.',
    maxVol: 0.025, minScore: 2.5, topN: 3, stopMult: 1.5,
    sortBy: 'risk_adjusted', weightBy: 'inv_vol',
  },
  moderado: {
    label: 'Moderado', icon: <Scale size={16} />, color: '#f59e0b',
    desc: 'Equilíbrio entre risco e retorno. Diversificação média.',
    maxVol: 0.045, minScore: 1.5, topN: 5, stopMult: 2.0,
    sortBy: 'risk_adjusted', weightBy: 'inv_vol',
  },
  arrojado: {
    label: 'Arrojado', icon: <Flame size={16} />, color: '#ef4444',
    desc: 'Busca maior retorno, aceita mais volatilidade. Mais ações, peso por retorno.',
    maxVol: 1.0, minScore: 1.0, topN: 8, stopMult: 2.5,
    sortBy: 'return', weightBy: 'score',
  },
};

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';
const pieColors = ['#8b5cf6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

const PortfolioTab: React.FC<PortfolioTabProps> = ({ darkMode = false }) => {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recDate, setRecDate] = useState('');
  const [profile, setProfile] = useState<Profile>('moderado');
  const [simCapital, setSimCapital] = useState(10000);

  const theme = {
    bg: darkMode ? '#0c0a1a' : '#f8fafc',
    cardBg: darkMode ? '#1a1836' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#9895b0' : '#64748b',
    border: darkMode ? '#2a2745' : '#e2e8f0',
    green: '#10b981', red: '#ef4444', yellow: '#f59e0b', blue: '#8b5cf6', purple: '#8b5cf6',
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`,
    borderRadius: 12, padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };
  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
    border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
    borderRadius: 8, transition: 'all 0.2s ease', WebkitAppearance: 'none' as any,
    WebkitTapHighlightColor: 'transparent', padding: '0.5rem 0.9rem',
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } });
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const data = await res.json();
        setRecs(data.recommendations || []);
        setRecDate(data.date || '');
      } catch (err: any) {
        const msg = err.message === 'Load failed' || err.message === 'Failed to fetch'
          ? 'Falha de conexão. Verifique sua internet.' : err.message;
        setError(msg);
      } finally { setLoading(false); }
    })();
  }, []);

  const p = PROFILES[profile];

  const portfolio = useMemo(() => {
    const buys = recs
      .filter(r => r.score >= p.minScore && r.vol_20d <= p.maxVol)
      .sort((a, b) => {
        if (p.sortBy === 'return') return (b.exp_return_20 || 0) - (a.exp_return_20 || 0);
        if (p.sortBy === 'score') return b.score - a.score;
        // risk_adjusted: score / volatility
        const aRatio = a.score / (a.vol_20d || 0.01);
        const bRatio = b.score / (b.vol_20d || 0.01);
        return bRatio - aRatio;
      });

    const top = buys.slice(0, p.topN);
    if (!top.length) return [];

    let weights: number[];
    if (p.weightBy === 'equal') {
      weights = top.map(() => 1 / top.length);
    } else if (p.weightBy === 'score') {
      const totalScore = top.reduce((s, r) => s + Math.abs(r.score), 0);
      weights = top.map(r => Math.abs(r.score) / (totalScore || 1));
    } else {
      // inv_vol
      const invVols = top.map(r => 1 / (r.vol_20d || 0.01));
      const totalInvVol = invVols.reduce((s, v) => s + v, 0);
      weights = invVols.map(v => v / (totalInvVol || 1));
    }

    return top.map((r, i) => ({
      ...r,
      weight: weights[i],
      confidence: Math.min(Math.abs(r.score) / 5 * 100, 99),
      stopLoss: r.last_close * (1 - Math.max(r.vol_20d * p.stopMult, 0.03)),
      takeProfit: r.pred_price_t_plus_20,
    }));
  }, [recs, p]);

  const portfolioReturn = portfolio.length
    ? portfolio.reduce((s, q) => s + q.exp_return_20 * q.weight, 0) : 0;
  const portfolioVol = portfolio.length
    ? Math.sqrt(portfolio.reduce((s, q) => s + (q.vol_20d * q.weight) ** 2, 0)) : 0;
  const sharpeProxy = portfolioVol > 0 ? portfolioReturn / portfolioVol : 0;

  if (loading) {
    const pulse: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1a1836' : '#e2e8f0'} 25%, ${darkMode ? '#2a2745' : '#f1f5f9'} 50%, ${darkMode ? '#1a1836' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ ...pulse, height: 28, width: 250, marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ ...pulse, height: 80 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
        <Crown size={20} color="#f59e0b" />
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, margin: 0 }}>
          Carteira Modelo
        </h1>
        <InfoTooltip text="A carteira seleciona as melhores ações com sinal de Compra, ponderadas por volatilidade inversa. Cada perfil ajusta filtros de risco, número de ações e stop-loss." darkMode={darkMode} size={14} />
      </div>
      <p style={{ color: theme.textSecondary, fontSize: '0.78rem', margin: '0 0 0.75rem' }}>
        Atualizada em {recDate ? new Date(recDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
      </p>

      {error && (
        <div style={{ ...cardStyle, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Profile Selector */}
      <div style={{ ...cardStyle, marginBottom: '0.75rem', padding: '0.75rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          Perfil de Investidor
          <InfoTooltip text="Escolha o perfil que mais combina com você. Conservador: menos risco, menos ações. Moderado: equilíbrio. Arrojado: mais risco, mais ações." darkMode={darkMode} size={12} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(Object.keys(PROFILES) as Profile[]).map(key => {
            const pr = PROFILES[key];
            const active = profile === key;
            return (
              <button key={key} onClick={() => setProfile(key)}
                style={{
                  ...btnBase,
                  background: active
                    ? `${pr.color}20`
                    : (darkMode ? '#0c0a1a' : '#f8fafc'),
                  color: active ? pr.color : theme.textSecondary,
                  border: `1.5px solid ${active ? pr.color : theme.border}`,
                  transform: active ? 'scale(1.02)' : 'scale(1)',
                }}>
                {pr.icon} {pr.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.4rem', lineHeight: 1.5 }}>
          {p.icon} {p.desc}
          <span style={{ display: 'block', marginTop: '0.2rem', fontSize: '0.68rem', opacity: 0.8 }}>
            Filtros: vol ≤ {p.maxVol < 1 ? `${(p.maxVol * 100).toFixed(1)}%` : 'sem limite'} · score ≥ {p.minScore} · até {p.topN} ações · stop {p.stopMult}× vol · ordena por {p.sortBy === 'return' ? 'retorno' : p.sortBy === 'score' ? 'score' : 'risco-ajustado'} · peso por {p.weightBy === 'inv_vol' ? 'vol. inversa' : p.weightBy === 'score' ? 'score' : 'igual'}
          </span>
        </div>
      </div>

      {/* KPIs */}
      {portfolio.length > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {[
              { label: 'Retorno previsto', value: `${portfolioReturn >= 0 ? '+' : ''}${fmt(portfolioReturn * 100, 2)}%`, color: portfolioReturn >= 0 ? theme.green : theme.red, icon: <TrendingUp size={15} />,
                tip: 'Retorno previsto ponderado da carteira para os próximos 20 pregões.' },
              { label: 'Volatilidade', value: `${fmt(portfolioVol * 100, 2)}%`, color: theme.yellow, icon: <Shield size={15} />,
                tip: 'Volatilidade estimada da carteira.' },
              { label: 'Sharpe (proxy)', value: fmt(sharpeProxy, 2), color: sharpeProxy >= 1 ? theme.green : theme.yellow, icon: <Target size={15} />,
                tip: 'Razão retorno/risco. Acima de 1.0 é bom.' },
              { label: 'Ações', value: `${portfolio.length}`, color: p.color, icon: <PieChart size={15} />,
                tip: `Número de ações no perfil ${p.label}.` },
            ].map((kpi, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={10} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</span>
                  <span style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)', fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Investment Simulator */}
          <div style={{ ...cardStyle, marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              💰 Simulador de Investimento
              <InfoTooltip text="Veja quanto investir em cada ação com base na alocação da carteira modelo." darkMode={darkMode} size={12} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: theme.textSecondary }}>Investir:</span>
              {[5000, 10000, 25000, 50000].map(v => (
                <button key={v} onClick={() => setSimCapital(v)} style={{
                  padding: '0.3rem 0.6rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: simCapital === v ? 600 : 400,
                  border: `1px solid ${simCapital === v ? theme.blue : theme.border}`,
                  background: simCapital === v ? `${theme.blue}15` : 'transparent',
                  color: simCapital === v ? theme.blue : theme.textSecondary,
                  cursor: 'pointer', WebkitAppearance: 'none' as any,
                }}>
                  R$ {v.toLocaleString('pt-BR')}
                </button>
              ))}
              <input type="number" value={simCapital} onChange={e => setSimCapital(Math.max(100, +e.target.value))}
                style={{
                  width: 100, padding: '0.3rem 0.5rem', borderRadius: 6, fontSize: '0.78rem',
                  border: `1px solid ${theme.border}`, background: darkMode ? '#0c0a1a' : '#f8fafc',
                  color: theme.text, outline: 'none',
                }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.4rem' }}>
              {portfolio.map((q, i) => {
                const amount = simCapital * q.weight;
                const shares = Math.floor(amount / q.last_close);
                return (
                  <div key={q.ticker} style={{
                    padding: '0.4rem 0.6rem', borderRadius: 8,
                    border: `1px solid ${theme.border}`, borderLeft: `3px solid ${pieColors[i % pieColors.length]}`,
                  }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: theme.text }}>{q.ticker}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: pieColors[i % pieColors.length] }}>
                      R$ {Math.round(amount).toLocaleString('pt-BR')}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: theme.textSecondary }}>
                      ~{shares} ações · {fmt(q.weight * 100, 1)}%
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginTop: '0.4rem' }}>
              Retorno previsto: <strong style={{ color: portfolioReturn >= 0 ? theme.green : theme.red }}>
                R$ {Math.round(simCapital * (1 + portfolioReturn)).toLocaleString('pt-BR')}
              </strong> ({portfolioReturn >= 0 ? '+' : ''}{fmt(portfolioReturn * 100, 2)}% em 20 pregões)
            </div>
          </div>

          {/* Allocation bar */}
          <div style={{ ...cardStyle, marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem' }}>Alocação</div>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 26, marginBottom: '0.5rem' }}>
              {portfolio.map((q, i) => (
                <div key={q.ticker} style={{
                  width: `${q.weight * 100}%`, background: pieColors[i % pieColors.length],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.62rem', fontWeight: 600, color: 'white', minWidth: 28,
                }}>
                  {q.weight >= 0.1 ? `${q.ticker} ${fmt(q.weight * 100, 0)}%` : fmt(q.weight * 100, 0) + '%'}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {portfolio.map((q, i) => (
                <div key={q.ticker} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: pieColors[i % pieColors.length] }} />
                  <span style={{ color: theme.text, fontWeight: 500 }}>{q.ticker}</span>
                  <span style={{ color: theme.textSecondary }}>{fmt(q.weight * 100, 1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div className="portfolio-table-desktop" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {[
                      { l: '#', t: '' }, { l: 'Ticker', t: '' }, { l: 'Peso', t: 'Alocação na carteira' },
                      { l: 'Preço', t: 'Último fechamento' }, { l: 'Stop-Loss', t: `${p.stopMult}× volatilidade abaixo` },
                      { l: 'Take-Profit', t: 'Preço-alvo do modelo' }, { l: 'Retorno', t: 'Retorno previsto 20 pregões' },
                      { l: 'Confiança', t: 'Baseada no score' }, { l: 'R/R', t: 'Risco/Retorno' },
                    ].map(h => (
                      <th key={h.l} style={{
                        padding: '0.55rem 0.45rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600,
                        color: theme.textSecondary, background: darkMode ? '#0c0a1a' : '#f8fafc', whiteSpace: 'nowrap',
                      }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          {h.l} {h.t && <InfoTooltip text={h.t} darkMode={darkMode} size={10} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portfolio.map((q, i) => {
                    const rr = q.vol_20d > 0 ? q.exp_return_20 / q.vol_20d : 0;
                    return (
                      <tr key={q.ticker} style={{ borderBottom: `1px solid ${theme.border}` }}
                        onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#2a2745' : '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '0.5rem 0.45rem', color: theme.textSecondary, fontSize: '0.72rem', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '0.5rem 0.45rem', fontWeight: 700, color: theme.text, fontSize: '0.82rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            {q.ticker} <ArrowUpRight size={13} color={theme.green} />
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem 0.45rem' }}>
                          <span style={{
                            padding: '0.12rem 0.4rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
                            background: `${pieColors[i % pieColors.length]}15`, color: pieColors[i % pieColors.length],
                          }}>{fmt(q.weight * 100, 1)}%</span>
                        </td>
                        <td style={{ padding: '0.5rem 0.45rem', fontSize: '0.8rem', color: theme.text }}>R$ {fmt(q.last_close, 2)}</td>
                        <td style={{ padding: '0.5rem 0.45rem', fontSize: '0.8rem', fontWeight: 600, color: theme.red }}>R$ {fmt(q.stopLoss, 2)}</td>
                        <td style={{ padding: '0.5rem 0.45rem', fontSize: '0.8rem', fontWeight: 600, color: theme.green }}>R$ {fmt(q.takeProfit, 2)}</td>
                        <td style={{ padding: '0.5rem 0.45rem', fontSize: '0.8rem', fontWeight: 600, color: q.exp_return_20 >= 0 ? theme.green : theme.red }}>
                          {q.exp_return_20 >= 0 ? '+' : ''}{fmt(q.exp_return_20 * 100, 2)}%
                        </td>
                        <td style={{ padding: '0.5rem 0.45rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <div style={{ flex: 1, height: 5, borderRadius: 3, background: darkMode ? '#2a2745' : '#e2e8f0', maxWidth: 50, overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 3, width: `${q.confidence}%`, background: q.confidence >= 70 ? theme.green : q.confidence >= 50 ? theme.yellow : theme.red }} />
                            </div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: q.confidence >= 70 ? theme.green : q.confidence >= 50 ? theme.yellow : theme.red }}>
                              {fmt(q.confidence, 0)}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '0.5rem 0.45rem' }}>
                          <span style={{
                            padding: '0.12rem 0.4rem', borderRadius: 8, fontSize: '0.68rem', fontWeight: 600,
                            background: rr >= 2 ? `${theme.green}15` : rr >= 1 ? `${theme.yellow}15` : `${theme.red}15`,
                            color: rr >= 2 ? theme.green : rr >= 1 ? theme.yellow : theme.red,
                          }}>{fmt(rr, 1)}x</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="portfolio-cards-mobile" style={{ display: 'none', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem' }}>
              {portfolio.map((q, i) => {
                const rr = q.vol_20d > 0 ? q.exp_return_20 / q.vol_20d : 0;
                return (
                  <div key={q.ticker} style={{ padding: '0.75rem', borderRadius: 10, border: `1px solid ${theme.border}`, borderLeft: `3px solid ${pieColors[i % pieColors.length]}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>#{i + 1}</span>
                        <span style={{ fontWeight: 700, color: theme.text, fontSize: '0.95rem' }}>{q.ticker}</span>
                        <ArrowUpRight size={13} color={theme.green} />
                      </div>
                      <span style={{ padding: '0.12rem 0.4rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, background: `${pieColors[i % pieColors.length]}15`, color: pieColors[i % pieColors.length] }}>
                        {fmt(q.weight * 100, 1)}%
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', fontSize: '0.75rem' }}>
                      <div><span style={{ color: theme.textSecondary }}>Preço:</span> <strong style={{ color: theme.text }}>R$ {fmt(q.last_close, 2)}</strong></div>
                      <div><span style={{ color: theme.textSecondary }}>Retorno:</span> <strong style={{ color: q.exp_return_20 >= 0 ? theme.green : theme.red }}>{q.exp_return_20 >= 0 ? '+' : ''}{fmt(q.exp_return_20 * 100, 2)}%</strong></div>
                      <div><span style={{ color: theme.textSecondary }}>Stop:</span> <strong style={{ color: theme.red }}>R$ {fmt(q.stopLoss, 2)}</strong></div>
                      <div><span style={{ color: theme.textSecondary }}>Take:</span> <strong style={{ color: theme.green }}>R$ {fmt(q.takeProfit, 2)}</strong></div>
                      <div><span style={{ color: theme.textSecondary }}>Confiança:</span> <strong style={{ color: q.confidence >= 70 ? theme.green : q.confidence >= 50 ? theme.yellow : theme.red }}>{fmt(q.confidence, 0)}%</strong></div>
                      <div><span style={{ color: theme.textSecondary }}>R/R:</span> <strong style={{ color: rr >= 2 ? theme.green : rr >= 1 ? theme.yellow : theme.red }}>{fmt(rr, 1)}x</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: theme.textSecondary }}>
          <Shield size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: '0.3rem' }}>
            Nenhuma ação atende aos critérios do perfil {p.label}
          </div>
          <div style={{ fontSize: '0.78rem' }}>
            Tente um perfil com filtros menos restritivos ou aguarde novas recomendações.
          </div>
        </div>
      )}

      <div style={{ marginTop: '0.75rem', fontSize: '0.68rem', color: theme.textSecondary, lineHeight: 1.5, textAlign: 'center' }}>
        ⚠️ A carteira modelo é gerada automaticamente e não constitui recomendação de investimento.
        Stop-loss e take-profit são sugestões baseadas em volatilidade histórica.
      </div>
    </div>
  );
};

export default PortfolioTab;
