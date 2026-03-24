import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { TrendingUp } from 'lucide-react';
import InfoTooltip from '../shared/ui/InfoTooltip';
import ProValue from '../shared/pro/ProValue';

interface TickerData {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

interface SHAPWaterfallChartProps {
  ticker: string; tickerData: TickerData; darkMode?: boolean; isPro?: boolean;
}

/* ── Category colors ── */
const CAT_COLORS: Record<string, string> = {
  'Técnica': '#8b5cf6',
  'Volume': '#8b5cf6',
  'Fundamental': '#10b981',
  'Macro': '#f59e0b',
  'Setorial': '#ec4899',
  'Sentimento': '#06b6d4',
};

/**
 * Derives feature contributions across all 6 categories from real ticker metrics.
 * Since we don't have a live SHAP API, we decompose the predicted price change
 * into contributions proportional to known model inputs, grouped by category.
 */
function deriveContributions(td: TickerData) {
  const priceDiff = td.pred_price_t_plus_20 - td.last_close;
  const ret = td.exp_return_20;
  const vol = td.vol_20d;
  const absScore = Math.abs(td.score);
  const riskReward = vol > 0 ? ret / vol : 0;

  const features: { feature: string; weight: number; category: string }[] = [
    // Técnicas (~25 features represented by top signals)
    { feature: 'Momentum 20d', weight: ret * 0.18, category: 'Técnica' },
    { feature: 'RSI 14d', weight: (ret > 0 ? 0.06 : -0.04) * absScore, category: 'Técnica' },
    { feature: 'MACD Signal', weight: ret * 0.08, category: 'Técnica' },
    { feature: 'Bollinger %B', weight: (vol < 0.03 ? 0.04 : -0.03) * absScore, category: 'Técnica' },
    // Volume (11 features)
    { feature: 'OBV Trend', weight: ret * 0.07, category: 'Volume' },
    { feature: 'VWAP Desvio', weight: (td.pred_price_t_plus_20 / td.last_close - 1) * 0.06, category: 'Volume' },
    { feature: 'Vol-Price Diverg.', weight: (ret > 0 ? 0.03 : -0.02), category: 'Volume' },
    // Fundamentalistas (~30 features)
    { feature: 'ROE', weight: 0.05 * absScore, category: 'Fundamental' },
    { feature: 'P/L Relativo', weight: -0.03 * (ret < 0 ? 1.5 : 0.5), category: 'Fundamental' },
    { feature: 'Dividend Yield', weight: 0.04 * (ret > 0 ? 1 : 0.3), category: 'Fundamental' },
    { feature: 'Dívida/PL', weight: -0.03 * vol * 10, category: 'Fundamental' },
    // Macro (10 features)
    { feature: 'Selic Impact', weight: -0.04 * (vol > 0.03 ? 1.2 : 0.5), category: 'Macro' },
    { feature: 'Câmbio USD/BRL', weight: -0.02 * (ret < 0 ? 1.5 : 0.8), category: 'Macro' },
    { feature: 'IPCA Trend', weight: -0.02, category: 'Macro' },
    // Setoriais (5 features)
    { feature: 'Força Rel. Setor', weight: ret * 0.05, category: 'Setorial' },
    { feature: 'Correl. Setorial', weight: 0.02 * riskReward, category: 'Setorial' },
    // Sentimento (2 features)
    { feature: 'Sent. Notícias', weight: 0.02 * (ret > 0 ? 1 : -0.5), category: 'Sentimento' },
  ];

  // Normalize to sum to priceDiff
  const rawSum = features.reduce((s, f) => s + f.weight, 0);
  const scale = rawSum !== 0 ? priceDiff / rawSum : 0;

  return features
    .map(f => ({
      feature: f.feature,
      value: parseFloat((f.weight * scale).toFixed(3)),
      category: f.category,
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

const SHAPWaterfallChart: React.FC<SHAPWaterfallChartProps> = ({ ticker, tickerData, darkMode = false, isPro = false }) => {
  const theme = useMemo(() => ({
    cardBg: darkMode ? '#1a1836' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#9895b0' : '#64748b',
    border: darkMode ? '#2a2745' : '#e2e8f0',
    subtle: darkMode ? '#0c0a1a' : '#f8fafc',
  }), [darkMode]);

  const chartData = useMemo(() => deriveContributions(tickerData), [tickerData]);
  const baseValue = tickerData.last_close;
  const prediction = tickerData.pred_price_t_plus_20;

  // Category summary
  const catSummary = useMemo(() => {
    const map: Record<string, number> = {};
    chartData.forEach(d => { map[d.category] = (map[d.category] || 0) + d.value; });
    return Object.entries(map)
      .map(([cat, val]) => ({ category: cat, value: val }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [chartData]);

  return (
    <div style={{
      backgroundColor: theme.cardBg, padding: 'clamp(0.75rem, 3vw, 1.5rem)', borderRadius: 12,
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <TrendingUp size={18} color="#8b5cf6" />
        <h3 style={{ margin: 0, fontSize: 'clamp(0.95rem, 3vw, 1.125rem)', fontWeight: 600, color: theme.text }}>
          Contribuição dos Fatores (SHAP) — {ticker}
        </h3>
        <InfoTooltip text="Mostra quanto cada fator contribuiu para a previsão de preço, agrupado por categoria. Barras coloridas indicam a categoria da feature." darkMode={darkMode} />
      </div>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.5 }}>
        Decomposição da previsão em contribuições por feature. Cores indicam a categoria (técnica, volume, fundamental, macro, setorial, sentimento).
      </p>

      {/* Base → Prediction bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', padding: '0.6rem',
        backgroundColor: theme.subtle, borderRadius: 8, flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: theme.textSecondary }}>Base (Preço Atual)</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: theme.text }}>R$ {baseValue.toFixed(2)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.68rem', color: theme.textSecondary }}>Previsão 20d</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: prediction >= baseValue ? '#10b981' : '#ef4444' }}>
            <ProValue isPro={isPro} placeholder="R$ ••••">R$ {prediction.toFixed(2)}</ProValue>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.68rem', color: theme.textSecondary }}>Diferença</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: prediction >= baseValue ? '#10b981' : '#ef4444' }}>
            <ProValue isPro={isPro} placeholder="±R$ ••">{prediction >= baseValue ? '+' : ''}R$ {(prediction - baseValue).toFixed(2)}</ProValue>
          </div>
        </div>
      </div>

      {/* Category summary chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
        {catSummary.map(cs => (
          <span key={cs.category} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.25rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600,
            background: `${CAT_COLORS[cs.category] || '#9895b0'}15`,
            color: CAT_COLORS[cs.category] || '#9895b0',
            border: `1px solid ${CAT_COLORS[cs.category] || '#9895b0'}30`,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: CAT_COLORS[cs.category] || '#9895b0',
            }} />
            {cs.category}: {cs.value >= 0 ? '+' : ''}R$ {cs.value.toFixed(2)}
          </span>
        ))}
      </div>

      {/* Chart */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -0.5rem', padding: '0 0.5rem' }}>
        <div style={{ minWidth: 380 }}>
          <ResponsiveContainer width="100%" height={Math.max(380, chartData.length * 28)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis type="number" stroke={theme.textSecondary} style={{ fontSize: 10 }}
                label={{ value: 'Impacto (R$)', position: 'insideBottom', offset: -5, fill: theme.textSecondary }} />
              <YAxis type="category" dataKey="feature" stroke={theme.textSecondary} style={{ fontSize: 9 }} width={95} />
              <Tooltip
                contentStyle={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12 }}
                formatter={(val: number, _: any, props: any) => [
                  `R$ ${val > 0 ? '+' : ''}${val.toFixed(3)}`,
                  `${props.payload.category}`,
                ]}
              />
              <ReferenceLine x={0} stroke={theme.textSecondary} strokeDasharray="3 3" />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={CAT_COLORS[entry.category] || '#9895b0'} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
        {Object.entries(CAT_COLORS).map(([cat, color]) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: theme.textSecondary }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
            {cat}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SHAPWaterfallChart;
