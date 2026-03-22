import React, { useState, useEffect, useMemo } from 'react';
import { Crown, TrendingUp, BarChart3, Target, Award, Calendar } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../shared/InfoTooltip';
import ShareButton from '../shared/ShareButton';
import { markChecklistItem } from '../shared/ActivationChecklist';
import RetroactiveValidation from '../shared/RetroactiveValidation';

interface PerformanceTabProps { darkMode?: boolean; }

interface PriceRow { date: string; ticker: string; close: string; }
interface HistoryEntry { date: string; exp_return_20: number; score: number; }

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const PerformanceTab: React.FC<PerformanceTabProps> = ({ darkMode = false }) => {
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [prices, setPrices] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [perfPeriod, setPerfPeriod] = useState<'all' | '7d' | '14d'>('all');

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    green: '#10b981', red: '#ef4444', yellow: '#f59e0b', blue: '#3b82f6', purple: '#8b5cf6',
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`,
    borderRadius: 12, padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  useEffect(() => {
    (async () => {
      try {
        const headers = { 'x-api-key': API_KEY };
        const [histRes, marRes, febRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/recommendations/history`, { headers }),
          fetch(`${API_BASE_URL}/s3-proxy?key=curated/daily_monthly/year=2026/month=03/daily.csv`, { headers }),
          fetch(`${API_BASE_URL}/s3-proxy?key=curated/daily_monthly/year=2026/month=02/daily.csv`, { headers }),
        ]);
        if (histRes.ok) {
          const hd = await histRes.json();
          setHistory(hd.data || {});
        }
        const priceMap: Record<string, Record<string, number>> = {};
        for (const res of [febRes, marRes]) {
          if (res.ok) {
            const rows: PriceRow[] = await res.json();
            rows.forEach(r => {
              if (!priceMap[r.ticker]) priceMap[r.ticker] = {};
              priceMap[r.ticker][r.date] = parseFloat(r.close);
            });
          }
        }
        setPrices(priceMap);
        markChecklistItem('viewedPerformance');
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  // Build daily cumulative performance
  const perfData = useMemo(() => {
    if (!Object.keys(history).length || !Object.keys(prices).length) return null;

    // Get all unique dates from history
    const allDates = new Set<string>();
    Object.values(history).forEach(entries => entries.forEach(e => allDates.add(e.date)));
    const sortedDates = Array.from(allDates).sort();

    // Get all price dates
    const allPriceDates = new Set<string>();
    Object.values(prices).forEach(tp => Object.keys(tp).forEach(d => allPriceDates.add(d)));

    // For each prediction date, calculate what the "buy signal" portfolio would have returned
    // by the next available price date
    const dailyReturns: { date: string; buyReturn: number; sellReturn: number; ibovReturn: number; buyCount: number; sellCount: number }[] = [];

    for (let i = 0; i < sortedDates.length - 1; i++) {
      const predDate = sortedDates[i];
      const nextDate = sortedDates[i + 1];

      let buyReturns: number[] = [];
      let sellReturns: number[] = [];

      Object.entries(history).forEach(([ticker, entries]) => {
        const entry = entries.find(e => e.date === predDate);
        if (!entry) return;
        const tp = prices[ticker];
        if (!tp || !tp[predDate] || !tp[nextDate]) return;

        const dayReturn = (tp[nextDate] - tp[predDate]) / tp[predDate];

        if (entry.score >= 1.5) buyReturns.push(dayReturn);
        else if (entry.score <= -1.5) sellReturns.push(dayReturn);
      });

      const avgBuy = buyReturns.length ? buyReturns.reduce((s, r) => s + r, 0) / buyReturns.length : 0;
      const avgSell = sellReturns.length ? sellReturns.reduce((s, r) => s + r, 0) / sellReturns.length : 0;

      // Média do universo: average of all tickers (equal weight)
      const allReturns: number[] = [];
      Object.entries(prices).forEach(([, tp]) => {
        if (tp[predDate] && tp[nextDate]) {
          allReturns.push((tp[nextDate] - tp[predDate]) / tp[predDate]);
        }
      });
      const ibov = allReturns.length ? allReturns.reduce((s, r) => s + r, 0) / allReturns.length : 0;

      dailyReturns.push({
        date: nextDate, buyReturn: avgBuy, sellReturn: avgSell, ibovReturn: ibov,
        buyCount: buyReturns.length, sellCount: sellReturns.length,
      });
    }

    // Cumulative returns
    let cumBuy = 1, cumSell = 1, cumIbov = 1;
    const cumulative = dailyReturns.map(d => {
      cumBuy *= (1 + d.buyReturn);
      cumSell *= (1 - d.sellReturn); // Sell signal: profit if stock goes down
      cumIbov *= (1 + d.ibovReturn);
      return {
        date: d.date,
        cumBuy: (cumBuy - 1) * 100,
        cumSell: (cumSell - 1) * 100,
        cumIbov: (cumIbov - 1) * 100,
        buyCount: d.buyCount,
        sellCount: d.sellCount,
      };
    });

    // Win rate
    const buyWins = dailyReturns.filter(d => d.buyReturn > 0).length;
    const sellWins = dailyReturns.filter(d => d.sellReturn < 0).length;
    const totalDays = dailyReturns.length;

    return {
      cumulative,
      totalReturn: cumulative.length ? cumulative[cumulative.length - 1].cumBuy : 0,
      ibovReturn: cumulative.length ? cumulative[cumulative.length - 1].cumIbov : 0,
      buyWinRate: totalDays > 0 ? buyWins / totalDays : 0,
      sellWinRate: totalDays > 0 ? sellWins / totalDays : 0,
      totalDays,
      alpha: cumulative.length ? cumulative[cumulative.length - 1].cumBuy - cumulative[cumulative.length - 1].cumIbov : 0,
    };
  }, [history, prices]);

  // Chart component
  const CumulativeChart: React.FC<{ data: { date: string; cumBuy: number; cumIbov: number }[] }> = ({ data }) => {
    if (!data.length) return null;
    const width = 600, height = 200, padL = 50, padR = 20, padT = 20, padB = 30;
    const chartW = width - padL - padR, chartH = height - padT - padB;

    const allVals = data.flatMap(d => [d.cumBuy, d.cumIbov, 0]);
    const minV = Math.min(...allVals), maxV = Math.max(...allVals);
    const range = maxV - minV || 1;

    const toX = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * chartW;
    const toY = (v: number) => padT + chartH - ((v - minV) / range) * chartH;

    const buyPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.cumBuy)}`).join(' ');
    const ibovPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.cumIbov)}`).join(' ');

    // Y axis labels
    const ySteps = 5;
    const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => minV + (range / ySteps) * i);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: 600, display: 'block' }}>
        {/* Grid */}
        {yLabels.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={toY(v)} x2={width - padR} y2={toY(v)} stroke={theme.border} strokeWidth={0.5} />
            <text x={padL - 6} y={toY(v) + 4} textAnchor="end" fontSize={9} fill={theme.textSecondary}>{fmt(v, 1)}%</text>
          </g>
        ))}
        {/* Zero line */}
        <line x1={padL} y1={toY(0)} x2={width - padR} y2={toY(0)} stroke={theme.textSecondary} strokeWidth={0.8} strokeDasharray="4,3" />
        {/* X axis labels */}
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 5)) === 0 || i === data.length - 1).map((d, i) => (
          <text key={i} x={toX(data.indexOf(d))} y={height - 5} textAnchor="middle" fontSize={8} fill={theme.textSecondary}>
            {new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </text>
        ))}
        {/* Ibovespa line */}
        <path d={ibovPath} fill="none" stroke={theme.textSecondary} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.6} />
        {/* Buy portfolio line */}
        <path d={buyPath} fill="none" stroke={theme.green} strokeWidth={2.5} />
        {/* End dots */}
        <circle cx={toX(data.length - 1)} cy={toY(data[data.length - 1].cumBuy)} r={4} fill={theme.green} />
        <circle cx={toX(data.length - 1)} cy={toY(data[data.length - 1].cumIbov)} r={3} fill={theme.textSecondary} />
        {/* Legend */}
        <circle cx={padL + 10} cy={padT + 8} r={4} fill={theme.green} />
        <text x={padL + 18} y={padT + 12} fontSize={9} fill={theme.text}>Sinais de Compra</text>
        <line x1={padL + 110} y1={padT + 8} x2={padL + 125} y2={padT + 8} stroke={theme.textSecondary} strokeWidth={1.5} strokeDasharray="3,2" />
        <text x={padL + 130} y={padT + 12} fontSize={9} fill={theme.textSecondary}>Média do universo</text>
      </svg>
    );
  };

  if (loading) {
    const pulse: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1e293b' : '#e2e8f0'} 25%, ${darkMode ? '#334155' : '#f1f5f9'} 50%, ${darkMode ? '#1e293b' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <div style={{ ...pulse, height: 28, width: 280, marginBottom: 16 }} />
        <div style={{ ...pulse, height: 200, marginBottom: 16 }} />
      </div>
    );
  }

  if (!perfData) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: theme.textSecondary }}>
        Dados insuficientes para calcular performance. Aguarde mais dias de operação.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <Crown size={20} color="#f59e0b" />
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, margin: 0 }}>
          Performance Acumulada
        </h1>
      </div>
      <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
        Retorno real acumulado seguindo os sinais do modelo vs média do universo · {perfData.totalDays} pregões analisados
      </p>

      {/* Period filter */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {([
          { key: '7d' as const, label: '7 dias' },
          { key: '14d' as const, label: '14 dias' },
          { key: 'all' as const, label: 'Todos' },
        ]).map(d => (
          <button key={d.key} onClick={() => setPerfPeriod(d.key)} style={{
            padding: '0.35rem 0.7rem', borderRadius: 20, fontSize: '0.76rem',
            fontWeight: perfPeriod === d.key ? 600 : 400,
            border: `1px solid ${perfPeriod === d.key ? theme.blue : theme.border}`,
            background: perfPeriod === d.key ? theme.blue : 'transparent',
            color: perfPeriod === d.key ? 'white' : theme.textSecondary,
            cursor: 'pointer', transition: 'all 0.15s', WebkitAppearance: 'none' as any,
          }}>{d.label}</button>
        ))}
      </div>

      {/* How it works */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
        borderColor: darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
          💡 <strong style={{ color: theme.text }}>Como funciona:</strong> A cada atualização do modelo, compramos igualmente todas as ações com sinal de <strong style={{ color: theme.green }}>Compra</strong> e medimos o retorno real até a próxima atualização. O resultado é acumulado dia a dia. Diferente do <em>retorno previsto</em> em Recomendações (horizonte de 20 pregões), aqui mostramos o <strong style={{ color: theme.text }}>retorno que realmente aconteceu</strong>.
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Retorno realizado', value: `${perfData.totalReturn >= 0 ? '+' : ''}${fmt(perfData.totalReturn, 2)}%`, color: perfData.totalReturn >= 0 ? theme.green : theme.red, icon: <TrendingUp size={16} />,
            tip: 'Retorno real acumulado comprando igualmente todas as ações com sinal de Compra entre cada atualização do modelo. Diferente do retorno previsto em Recomendações — aqui é o que realmente aconteceu.' },
          { label: 'Média do universo', value: `${perfData.ibovReturn >= 0 ? '+' : ''}${fmt(perfData.ibovReturn, 2)}%`, color: theme.textSecondary, icon: <BarChart3 size={16} />,
            tip: 'Retorno acumulado de uma carteira com peso igual em todas as 46 ações do universo.' },
          { label: 'Alpha', value: `${perfData.alpha >= 0 ? '+' : ''}${fmt(perfData.alpha, 2)}pp`, color: perfData.alpha >= 0 ? theme.green : theme.red, icon: <Award size={16} />,
            tip: 'Diferença entre o retorno realizado da estratégia e a média do universo. Positivo = modelo superou o mercado.' },
          { label: 'Win rate (Compra)', value: `${fmt(perfData.buyWinRate * 100, 0)}%`, color: perfData.buyWinRate >= 0.55 ? theme.green : theme.yellow, icon: <Target size={16} />,
            tip: 'Percentual de períodos em que os sinais de Compra tiveram retorno positivo até a próxima atualização do modelo.' },
          { label: 'Pregões', value: `${perfData.totalDays}`, color: theme.purple, icon: <Calendar size={16} />,
            tip: 'Número de pregões analisados no período.' },
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

      {/* Verdict */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.85rem 1rem',
        background: perfData.alpha >= 0
          ? (darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)')
          : (darkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)'),
        borderColor: perfData.alpha >= 0
          ? (darkMode ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)')
          : (darkMode ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)'),
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>
            {perfData.alpha >= 0 ? '✅ Modelo superou o mercado' : '⚠️ Modelo abaixo do mercado'}
          </div>
          <ShareButton
            text={`📈 B3 Tactical Ranking — Performance\nRetorno realizado: ${perfData.totalReturn >= 0 ? '+' : ''}${fmt(perfData.totalReturn, 2)}%\nAlpha vs mercado: ${perfData.alpha >= 0 ? '+' : ''}${fmt(perfData.alpha, 2)}pp\nWin rate: ${fmt(perfData.buyWinRate * 100, 0)}%\n${perfData.totalDays} pregões analisados`}
            darkMode={darkMode}
          />
        </div>
        <div style={{ fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.5 }}>
          {perfData.alpha >= 0
            ? `Os sinais de Compra acumularam ${fmt(perfData.totalReturn, 2)}% vs ${fmt(perfData.ibovReturn, 2)}% da média do universo, gerando ${fmt(perfData.alpha, 2)}pp de alpha em ${perfData.totalDays} pregões.`
            : `Os sinais de Compra acumularam ${fmt(perfData.totalReturn, 2)}% vs ${fmt(perfData.ibovReturn, 2)}% da média do universo. O período analisado é curto — a performance tende a melhorar com mais dados.`
          }
        </div>
      </div>

      {/* Retroactive Validation */}
      <RetroactiveValidation darkMode={darkMode} theme={theme} history={history} prices={prices} />

      {/* Cumulative Chart */}
      <div style={{ ...cardStyle, marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>
          Retorno realizado — Sinais de Compra vs Média do Universo
        </div>
        <CumulativeChart data={(() => {
          if (perfPeriod === 'all') return perfData.cumulative;
          const days = perfPeriod === '7d' ? 7 : 14;
          return perfData.cumulative.slice(-days);
        })()} />
      </div>
    </div>
  );
};

export default PerformanceTab;
