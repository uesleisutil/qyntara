import React, { useState, useEffect, useMemo } from 'react';
import { Crown, TrendingUp, Shield, Target, PieChart, ArrowUpRight } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../shared/InfoTooltip';

interface PortfolioTabProps { darkMode?: boolean; }

interface Rec {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const PortfolioTab: React.FC<PortfolioTabProps> = ({ darkMode = false }) => {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [recDate, setRecDate] = useState('');

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
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } });
        if (res.ok) {
          const data = await res.json();
          setRecs(data.recommendations || []);
          setRecDate(data.date || '');
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  // Build portfolio: top 5 buys weighted by score/vol ratio (risk-adjusted)
  const portfolio = useMemo(() => {
    const buys = recs.filter(r => r.score >= 1.5).sort((a, b) => {
      // Risk-adjusted score: score / volatility
      const aRatio = a.score / (a.vol_20d || 0.01);
      const bRatio = b.score / (b.vol_20d || 0.01);
      return bRatio - aRatio;
    });

    const top5 = buys.slice(0, 5);
    if (!top5.length) return [];

    // Weight by inverse volatility (lower vol = higher weight)
    const invVols = top5.map(r => 1 / (r.vol_20d || 0.01));
    const totalInvVol = invVols.reduce((s, v) => s + v, 0);
    return top5.map((r, i) => ({
      ...r,
      weight: invVols[i] / totalInvVol,
      confidence: Math.min(Math.abs(r.score) / 5 * 100, 99),
      stopLoss: r.last_close * (1 - Math.max(r.vol_20d * 2, 0.03)),
      takeProfit: r.pred_price_t_plus_20,
    }));
  }, [recs]);

  // Portfolio metrics
  const portfolioReturn = portfolio.length
    ? portfolio.reduce((s, p) => s + p.exp_return_20 * p.weight, 0) : 0;
  const portfolioVol = portfolio.length
    ? Math.sqrt(portfolio.reduce((s, p) => s + (p.vol_20d * p.weight) ** 2, 0)) : 0;
  const sharpeProxy = portfolioVol > 0 ? portfolioReturn / portfolioVol : 0;

  // Colors for pie chart
  const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  if (loading) {
    const pulse: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1e293b' : '#e2e8f0'} 25%, ${darkMode ? '#334155' : '#f1f5f9'} 50%, ${darkMode ? '#1e293b' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <Crown size={20} color="#f59e0b" />
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, margin: 0 }}>
          Carteira Modelo
        </h1>
      </div>
      <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: '0 0 1rem' }}>
        Top 5 ações selecionadas por score ajustado ao risco · Atualizada em {recDate ? new Date(recDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
      </p>

      {/* How it works */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
        background: darkMode ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.03)',
        borderColor: darkMode ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
      }}>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
          👑 <strong style={{ color: theme.text }}>Como funciona:</strong> A carteira seleciona as 5 melhores ações com sinal de Compra, ponderadas por volatilidade inversa (ações menos voláteis recebem mais peso). Inclui stop-loss (2× volatilidade) e take-profit (preço-alvo do modelo).
        </div>
      </div>

      {/* Portfolio KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Retorno previsto', value: `${portfolioReturn >= 0 ? '+' : ''}${fmt(portfolioReturn * 100, 2)}%`, color: portfolioReturn >= 0 ? theme.green : theme.red, icon: <TrendingUp size={16} />,
            tip: 'Retorno previsto ponderado da carteira (top 5 ações, peso por volatilidade inversa) para os próximos 20 pregões. Difere da média de Compra em Recomendações pois usa apenas 5 ações e pesos diferentes.' },
          { label: 'Volatilidade', value: `${fmt(portfolioVol * 100, 2)}%`, color: theme.yellow, icon: <Shield size={16} />,
            tip: 'Volatilidade estimada da carteira (desvio padrão ponderado dos retornos diários).' },
          { label: 'Sharpe (proxy)', value: fmt(sharpeProxy, 2), color: sharpeProxy >= 1 ? theme.green : theme.yellow, icon: <Target size={16} />,
            tip: 'Razão retorno/risco da carteira. Acima de 1.0 é considerado bom.' },
          { label: 'Ações', value: `${portfolio.length}`, color: theme.blue, icon: <PieChart size={16} />,
            tip: 'Número de ações na carteira modelo.' },
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

      {/* Portfolio allocation visual */}
      {portfolio.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>Alocação da Carteira</div>
          {/* Horizontal bar */}
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 28, marginBottom: '0.75rem' }}>
            {portfolio.map((p, i) => (
              <div key={p.ticker} style={{
                width: `${p.weight * 100}%`, background: pieColors[i % pieColors.length],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontWeight: 600, color: 'white', minWidth: 30,
                transition: 'width 0.5s ease',
              }}>
                {p.weight >= 0.12 ? `${p.ticker} ${fmt(p.weight * 100, 0)}%` : fmt(p.weight * 100, 0) + '%'}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {portfolio.map((p, i) => (
              <div key={p.ticker} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: pieColors[i % pieColors.length] }} />
                <span style={{ color: theme.text, fontWeight: 500 }}>{p.ticker}</span>
                <span style={{ color: theme.textSecondary }}>{fmt(p.weight * 100, 1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio table with stop-loss, take-profit, confidence */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {[
                  { label: '#', tip: '' },
                  { label: 'Ticker', tip: 'Código da ação na B3' },
                  { label: 'Peso', tip: 'Percentual da carteira alocado nesta ação' },
                  { label: 'Preço atual', tip: 'Último preço de fechamento' },
                  { label: 'Stop-loss', tip: 'Preço sugerido para limitar perdas (2× volatilidade abaixo do preço atual)' },
                  { label: 'Take-profit', tip: 'Preço-alvo do modelo para 20 pregões' },
                  { label: 'Ret. previsto', tip: 'Retorno previsto pelo modelo para 20 pregões' },
                  { label: 'Confiança', tip: 'Nível de confiança baseado no score do modelo. Quanto maior o score, maior a confiança.' },
                  { label: 'Risco/Retorno', tip: 'Relação entre retorno esperado e volatilidade. Verde = favorável.' },
                ].map(h => (
                  <th key={h.label} style={{
                    padding: '0.6rem 0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600,
                    color: theme.textSecondary, background: darkMode ? '#0f172a' : '#f8fafc', whiteSpace: 'nowrap',
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      {h.label} {h.tip && <InfoTooltip text={h.tip} darkMode={darkMode} size={11} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {portfolio.map((p, i) => {
                const riskReward = p.vol_20d > 0 ? p.exp_return_20 / p.vol_20d : 0;
                return (
                  <tr key={p.ticker} style={{ borderBottom: `1px solid ${theme.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#334155' : '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: theme.textSecondary, fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: '0.5rem', fontWeight: 700, color: theme.text, fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {p.ticker}
                        <ArrowUpRight size={14} color={theme.green} />
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <div style={{
                        display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 8,
                        background: `${pieColors[i % pieColors.length]}15`, color: pieColors[i % pieColors.length],
                        fontSize: '0.78rem', fontWeight: 600,
                      }}>{fmt(p.weight * 100, 1)}%</div>
                    </td>
                    <td style={{ padding: '0.5rem', fontSize: '0.82rem', color: theme.text }}>R$ {fmt(p.last_close, 2)}</td>
                    <td style={{ padding: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: theme.red }}>R$ {fmt(p.stopLoss, 2)}</td>
                    <td style={{ padding: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: theme.green }}>R$ {fmt(p.takeProfit, 2)}</td>
                    <td style={{ padding: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: p.exp_return_20 >= 0 ? theme.green : theme.red }}>
                      {p.exp_return_20 >= 0 ? '+' : ''}{fmt(p.exp_return_20 * 100, 2)}%
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: darkMode ? '#334155' : '#e2e8f0', maxWidth: 60, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3, width: `${p.confidence}%`,
                            background: p.confidence >= 70 ? theme.green : p.confidence >= 50 ? theme.yellow : theme.red,
                          }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: p.confidence >= 70 ? theme.green : p.confidence >= 50 ? theme.yellow : theme.red }}>
                          {fmt(p.confidence, 0)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <span style={{
                        padding: '0.15rem 0.45rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600,
                        background: riskReward >= 2 ? `${theme.green}15` : riskReward >= 1 ? `${theme.yellow}15` : `${theme.red}15`,
                        color: riskReward >= 2 ? theme.green : riskReward >= 1 ? theme.yellow : theme.red,
                      }}>
                        {fmt(riskReward, 1)}x
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop: '1rem', fontSize: '0.7rem', color: theme.textSecondary, lineHeight: 1.5, textAlign: 'center' }}>
        ⚠️ A carteira modelo é gerada automaticamente e não constitui recomendação de investimento.
        Stop-loss e take-profit são sugestões baseadas em volatilidade histórica.
      </div>
    </div>
  );
};

export default PortfolioTab;
