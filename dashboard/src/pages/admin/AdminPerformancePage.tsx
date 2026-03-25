import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw, TrendingUp, Target, BarChart3, Award, Calendar, AlertTriangle } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../../components/shared/ui/InfoTooltip';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD, getPriceDataKeys, UNIVERSE_SIZE_FALLBACK } from '../../constants';
import { fmt } from '../../lib/formatters';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }
interface PriceRow { date: string; ticker: string; close: string; }
interface HistoryEntry { date: string; exp_return_20: number; score: number; }

const AdminPerformancePage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [prices, setPrices] = useState<Record<string, Record<string, number>>>({});
  const [monitorData, setMonitorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1d27' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const headers = { 'x-api-key': API_KEY };
      const [curKey, prevKey] = getPriceDataKeys();
      const [histRes, marRes, febRes, monRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/recommendations/history`, { headers }),
        fetch(`${API_BASE_URL}/s3-proxy?key=${curKey}`, { headers }),
        fetch(`${API_BASE_URL}/s3-proxy?key=${prevKey}`, { headers }),
        fetch(`${API_BASE_URL}/api/monitoring/model-performance`, { headers }),
      ]);
      if (histRes.ok) { const hd = await histRes.json(); setHistory(hd.data || {}); }
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
      if (monRes.ok) setMonitorData(await monRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // Compute real performance from history + prices (same logic as client PerformanceTab)
  const perfData = useMemo(() => {
    if (!Object.keys(history).length || !Object.keys(prices).length) return null;

    const allDates = new Set<string>();
    Object.values(history).forEach(entries => entries.forEach(e => allDates.add(e.date)));
    const sortedDates = Array.from(allDates).sort();

    const dailyReturns: { date: string; buyReturn: number; sellReturn: number; universeReturn: number; buyCount: number; sellCount: number }[] = [];

    for (let i = 0; i < sortedDates.length - 1; i++) {
      const predDate = sortedDates[i];
      const nextDate = sortedDates[i + 1];
      const buyReturns: number[] = [];
      const sellReturns: number[] = [];

      Object.entries(history).forEach(([ticker, entries]) => {
        const entry = entries.find(e => e.date === predDate);
        if (!entry) return;
        const tp = prices[ticker];
        if (!tp || !tp[predDate] || !tp[nextDate]) return;
        const dayReturn = (tp[nextDate] - tp[predDate]) / tp[predDate];
        if (entry.score >= SCORE_BUY_THRESHOLD) buyReturns.push(dayReturn);
        else if (entry.score <= SCORE_SELL_THRESHOLD) sellReturns.push(dayReturn);
      });

      const avgBuy = buyReturns.length ? buyReturns.reduce((s, r) => s + r, 0) / buyReturns.length : 0;
      const avgSell = sellReturns.length ? sellReturns.reduce((s, r) => s + r, 0) / sellReturns.length : 0;

      const allReturns: number[] = [];
      Object.entries(prices).forEach(([, tp]) => {
        if (tp[predDate] && tp[nextDate]) allReturns.push((tp[nextDate] - tp[predDate]) / tp[predDate]);
      });
      const universe = allReturns.length ? allReturns.reduce((s, r) => s + r, 0) / allReturns.length : 0;

      dailyReturns.push({ date: nextDate, buyReturn: avgBuy, sellReturn: avgSell, universeReturn: universe, buyCount: buyReturns.length, sellCount: sellReturns.length });
    }

    let cumBuy = 1, cumSell = 1, cumUniverse = 1;
    const cumulative = dailyReturns.map(d => {
      cumBuy *= (1 + d.buyReturn);
      cumSell *= (1 - d.sellReturn);
      cumUniverse *= (1 + d.universeReturn);
      return { date: d.date, cumBuy: (cumBuy - 1) * 100, cumSell: (cumSell - 1) * 100, cumUniverse: (cumUniverse - 1) * 100, buyCount: d.buyCount, sellCount: d.sellCount };
    });

    const buyWins = dailyReturns.filter(d => d.buyReturn > 0).length;
    const sellWins = dailyReturns.filter(d => d.sellReturn < 0).length;
    const totalDays = dailyReturns.length;

    // Per-ticker analysis
    const tickerPerf: { ticker: string; signal: string; predReturn: number; actualReturn: number; correct: boolean }[] = [];
    const latestDate = sortedDates[sortedDates.length - 1];
    const firstDate = sortedDates[0];

    Object.entries(history).forEach(([ticker, entries]) => {
      const firstEntry = entries.find(e => e.date === firstDate);
      if (!firstEntry) return;
      const tp = prices[ticker];
      if (!tp || !tp[firstDate] || !tp[latestDate]) return;
      const actualReturn = (tp[latestDate] - tp[firstDate]) / tp[firstDate];
      const signal = firstEntry.score >= SCORE_BUY_THRESHOLD ? 'Compra' : firstEntry.score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';
      const correct = signal === 'Compra' ? actualReturn > 0 : signal === 'Venda' ? actualReturn < 0 : true;
      tickerPerf.push({ ticker, signal, predReturn: firstEntry.exp_return_20, actualReturn, correct });
    });

    tickerPerf.sort((a, b) => Math.abs(b.actualReturn) - Math.abs(a.actualReturn));

    return {
      cumulative,
      totalReturn: cumulative.length ? cumulative[cumulative.length - 1].cumBuy : 0,
      universeReturn: cumulative.length ? cumulative[cumulative.length - 1].cumUniverse : 0,
      alpha: cumulative.length ? cumulative[cumulative.length - 1].cumBuy - cumulative[cumulative.length - 1].cumUniverse : 0,
      buyWinRate: totalDays > 0 ? buyWins / totalDays : 0,
      sellWinRate: totalDays > 0 ? sellWins / totalDays : 0,
      totalDays,
      tickerPerf,
      avgBuyCount: dailyReturns.length ? dailyReturns.reduce((s, d) => s + d.buyCount, 0) / dailyReturns.length : 0,
      avgSellCount: dailyReturns.length ? dailyReturns.reduce((s, d) => s + d.sellCount, 0) / dailyReturns.length : 0,
    };
  }, [history, prices]);

  const latest = monitorData?.latest || {};
  const mapeHistory = monitorData?.time_series?.mape || [];
  const accHistory = monitorData?.time_series?.directional_accuracy || [];

  if (loading) {
    const sk: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1a1d27' : '#e2e8f0'} 25%, ${darkMode ? '#2a2e3a' : '#f1f5f9'} 50%, ${darkMode ? '#1a1d27' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ ...sk, height: 28, width: 220, marginBottom: 8 }} />
          <div style={{ ...sk, height: 16, width: 340 }} />
        </div>
        <div style={{ ...sk, height: 52, marginBottom: '1rem', borderRadius: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} style={{ ...cardStyle, padding: '1rem' }}>
              <div style={{ ...sk, height: 12, width: 70, marginBottom: 8 }} />
              <div style={{ ...sk, height: 24, width: 50 }} />
            </div>
          ))}
        </div>
        <div style={{ ...sk, height: 200, borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Performance do Modelo</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0 }}>
            Métricas reais calculadas a partir de preços de mercado + métricas do monitor de DL
          </p>
        </div>
        <button onClick={fetchAll} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Section 1: Real Performance (from S3 prices) */}
      <div style={{ ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem', background: darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)', borderColor: darkMode ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, marginBottom: 2 }}>📈 Performance Real (preços de mercado)</div>
        <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Retorno acumulado real comprando ações com sinal de Compra entre cada atualização do modelo.</div>
      </div>

      {perfData ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Retorno realizado', value: `${perfData.totalReturn >= 0 ? '+' : ''}${fmt(perfData.totalReturn, 2)}%`, color: perfData.totalReturn >= 0 ? '#10b981' : '#ef4444', icon: <TrendingUp size={16} />, tip: 'Retorno real acumulado seguindo sinais de Compra.' },
              { label: 'Média do universo', value: `${perfData.universeReturn >= 0 ? '+' : ''}${fmt(perfData.universeReturn, 2)}%`, color: theme.textSecondary, icon: <BarChart3 size={16} />, tip: `Retorno acumulado de todas as ${UNIVERSE_SIZE_FALLBACK} ações com peso igual.` },
              { label: 'Alpha', value: `${perfData.alpha >= 0 ? '+' : ''}${fmt(perfData.alpha, 2)}pp`, color: perfData.alpha >= 0 ? '#10b981' : '#ef4444', icon: <Award size={16} />, tip: 'Diferença entre retorno da estratégia e média do universo.' },
              { label: 'Win rate (Compra)', value: `${fmt(perfData.buyWinRate * 100, 0)}%`, color: perfData.buyWinRate >= 0.55 ? '#10b981' : '#f59e0b', icon: <Target size={16} />, tip: 'Percentual de períodos com retorno positivo nos sinais de Compra.' },
              { label: 'Win rate (Venda)', value: `${fmt(perfData.sellWinRate * 100, 0)}%`, color: perfData.sellWinRate >= 0.55 ? '#10b981' : '#f59e0b', icon: <Target size={16} />, tip: 'Percentual de períodos com retorno negativo nos sinais de Venda (acerto).' },
              { label: 'Pregões', value: `${perfData.totalDays}`, color: '#3b82f6', icon: <Calendar size={16} />, tip: 'Número de pregões analisados.' },
              { label: 'Média compras/dia', value: fmt(perfData.avgBuyCount, 0), color: '#10b981', icon: <TrendingUp size={16} />, tip: 'Média de ações com sinal de Compra por dia.' },
              { label: 'Média vendas/dia', value: fmt(perfData.avgSellCount, 0), color: '#ef4444', icon: <TrendingUp size={16} />, tip: 'Média de ações com sinal de Venda por dia.' },
            ].map((kpi, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={12} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</span>
                  <span style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)', fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Top/Bottom tickers table */}
          {perfData.tickerPerf.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: '1.25rem', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>Performance por Ticker (período completo)</span>
              </div>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                      {['Ticker', 'Sinal', 'Ret. previsto', 'Ret. real', 'Acertou?'].map(h => (
                        <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: theme.textSecondary, background: darkMode ? '#0f1117' : '#f8fafc' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perfData.tickerPerf.filter(t => t.signal !== 'Neutro').slice(0, 20).map((t, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600, color: theme.text, fontSize: '0.82rem' }}>{t.ticker}</td>
                        <td style={{ padding: '0.45rem 0.6rem' }}>
                          <span style={{ padding: '0.15rem 0.4rem', borderRadius: 10, fontSize: '0.68rem', fontWeight: 600, background: t.signal === 'Compra' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: t.signal === 'Compra' ? '#10b981' : '#ef4444' }}>{t.signal}</span>
                        </td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', color: t.predReturn >= 0 ? '#10b981' : '#ef4444' }}>{t.predReturn >= 0 ? '+' : ''}{fmt(t.predReturn * 100)}%</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', fontWeight: 600, color: t.actualReturn >= 0 ? '#10b981' : '#ef4444' }}>{t.actualReturn >= 0 ? '+' : ''}{fmt(t.actualReturn * 100)}%</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }}>
                          {t.correct ? <span style={{ color: '#10b981' }}>✅ Sim</span> : <span style={{ color: '#ef4444' }}>❌ Não</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: theme.textSecondary, marginBottom: '1.25rem' }}>
          Dados insuficientes para calcular performance real. Aguarde mais dias de operação.
        </div>
      )}

      {/* Section 2: DL Monitor Metrics */}
      <div style={{ ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem', background: darkMode ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.03)', borderColor: darkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, marginBottom: 2 }}>🤖 Métricas do Monitor de DL</div>
        <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Métricas calculadas pelo pipeline de monitoramento (previsão vs realidade).</div>
      </div>

      {monitorData ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Acurácia Direcional', value: `${fmt(latest.directional_accuracy * 100, 1)}%`, color: latest.directional_accuracy >= 0.6 ? '#10b981' : '#f59e0b', tip: 'Percentual de previsões que acertaram a direção (alta/baixa).' },
              { label: 'MAPE', value: `${fmt(latest.mape, 2)}%`, color: latest.mape <= 1 ? '#10b981' : latest.mape <= 2 ? '#f59e0b' : '#ef4444', tip: 'Erro percentual absoluto médio das previsões de preço.' },
              { label: 'MAE', value: `${fmt(latest.mae * 100, 2)}%`, color: latest.mae <= 0.05 ? '#10b981' : '#f59e0b', tip: 'Erro absoluto médio das previsões de retorno.' },
              { label: 'Hit Rate', value: `${fmt(latest.hit_rate * 100, 1)}%`, color: latest.hit_rate >= 0.5 ? '#10b981' : '#f59e0b', tip: 'Taxa de acerto geral do modelo.' },
              { label: 'Sharpe Ratio', value: fmt(latest.sharpe_ratio, 2), color: latest.sharpe_ratio >= 0 ? '#10b981' : '#ef4444', tip: 'Razão retorno/risco. Negativo indica que a estratégia perdeu para o CDI.' },
              { label: 'Amostra', value: `${latest.sample_size || '—'}`, color: '#3b82f6', tip: 'Número de tickers analisados.' },
            ].map((kpi, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={12} />
                </div>
                <span style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)', fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
              </div>
            ))}
          </div>

          {!latest.using_real_prices && (
            <div style={{ ...cardStyle, marginBottom: '1rem', padding: '0.6rem 1rem', background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} color="#f59e0b" />
              <span style={{ fontSize: '0.78rem', color: '#f59e0b' }}>Monitor usando preços estimados (preços reais de mercado ainda não disponíveis para todas as datas-alvo).</span>
            </div>
          )}

          {/* MAPE History Chart */}
          {mapeHistory.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>Histórico MAPE ({mapeHistory.length} dias)</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100 }}>
                {mapeHistory.map((d: any, i: number) => {
                  const maxMape = Math.max(...mapeHistory.map((x: any) => x.mape || 0), 0.5);
                  const h = ((d.mape || 0) / maxMape) * 100;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }} title={`${d.date}: ${fmt(d.mape)}%`}>
                      <div style={{ width: '100%', height: `${h}%`, minHeight: 2, borderRadius: '3px 3px 0 0', background: (d.mape || 0) > 2 ? '#ef4444' : (d.mape || 0) > 1 ? '#f59e0b' : '#3b82f6', transition: 'height 0.3s' }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>{mapeHistory[0]?.date}</span>
                <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>{mapeHistory[mapeHistory.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* Accuracy History Chart */}
          {accHistory.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>Acurácia Direcional ({accHistory.length} dias)</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100 }}>
                {accHistory.map((d: any, i: number) => {
                  const h = (d.accuracy || 0) * 100;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }} title={`${d.date}: ${fmt((d.accuracy || 0) * 100, 1)}%`}>
                      <div style={{ width: '100%', height: `${h}%`, minHeight: 2, borderRadius: '3px 3px 0 0', background: (d.accuracy || 0) >= 0.6 ? '#10b981' : (d.accuracy || 0) >= 0.5 ? '#f59e0b' : '#ef4444', transition: 'height 0.3s' }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>{accHistory[0]?.date}</span>
                <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>{accHistory[accHistory.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: theme.textSecondary }}>
          Sem dados do monitor de DL disponíveis.
        </div>
      )}
    </div>
  );
};

export default AdminPerformancePage;
