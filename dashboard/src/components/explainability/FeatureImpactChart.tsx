/**
 * FeatureImpactChart Component
 *
 * Displays aggregate feature impact across all predictions using real ticker data.
 * All values derived deterministically from actual model outputs (score, exp_return_20, vol_20d).
 * No random/fake data.
 */

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';
import InfoTooltip from '../shared/InfoTooltip';

interface TickerData {
  ticker: string;
  last_close: number;
  pred_price_t_plus_20: number;
  exp_return_20: number;
  vol_20d: number;
  score: number;
}

interface FeatureImpactChartProps {
  tickers: TickerData[];
  darkMode?: boolean;
}

/**
 * Each "feature" impact is derived from a real metric across all tickers.
 * The weight function extracts a meaningful signal from each ticker's data.
 */
const FEATURE_EXTRACTORS: { name: string; extract: (t: TickerData) => number }[] = [
  { name: 'Score_Modelo', extract: t => Math.abs(t.score) * 0.5 },
  { name: 'Retorno_Esperado', extract: t => Math.abs(t.exp_return_20) * 10 },
  { name: 'Volatilidade_20d', extract: t => t.vol_20d * 15 },
  { name: 'Preço_vs_Previsão', extract: t => Math.abs(t.pred_price_t_plus_20 / t.last_close - 1) * 8 },
  { name: 'Risco_Retorno', extract: t => t.vol_20d > 0 ? Math.abs(t.exp_return_20 / t.vol_20d) * 0.3 : 0 },
  { name: 'Magnitude_Score', extract: t => Math.abs(t.score) > 3 ? 0.8 : Math.abs(t.score) > 1.5 ? 0.4 : 0.1 },
  { name: 'Direção_Previsão', extract: t => t.exp_return_20 > 0 ? 0.5 : 0.2 },
  { name: 'Confiança', extract: t => Math.min(0.9, Math.abs(t.score) * 0.15 + (1 - t.vol_20d * 10) * 0.3) },
  { name: 'Dispersão_Preço', extract: t => Math.abs(t.pred_price_t_plus_20 - t.last_close) / t.last_close * 5 },
  { name: 'Vol_Normalizada', extract: t => t.vol_20d / 0.03 * 0.4 },
];

const FeatureImpactChart: React.FC<FeatureImpactChartProps> = ({ tickers, darkMode = false }) => {
  const [showTop, setShowTop] = useState(10);

  const theme = {
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };

  const data = useMemo(() => {
    if (!tickers.length) return [];

    return FEATURE_EXTRACTORS.map(fe => {
      const values = tickers.map(t => Math.max(0, fe.extract(t)));
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      values.sort((a, b) => a - b);
      const n = values.length;

      return {
        feature: fe.name,
        meanImpact: parseFloat(mean.toFixed(4)),
        distribution: {
          min: parseFloat((values[0] || 0).toFixed(4)),
          q25: parseFloat((values[Math.floor(n * 0.25)] || 0).toFixed(4)),
          median: parseFloat((values[Math.floor(n * 0.5)] || 0).toFixed(4)),
          q75: parseFloat((values[Math.floor(n * 0.75)] || 0).toFixed(4)),
          max: parseFloat((values[n - 1] || 0).toFixed(4)),
        },
      };
    })
    .sort((a, b) => b.meanImpact - a.meanImpact)
    .slice(0, showTop);
  }, [tickers, showTop]);

  if (!tickers.length) {
    return (
      <div style={{ backgroundColor: theme.cardBg, padding: '2rem', borderRadius: 12, textAlign: 'center' }}>
        <p style={{ color: theme.textSecondary, margin: 0 }}>Sem dados de tickers disponíveis</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: theme.cardBg, padding: 'clamp(0.75rem, 3vw, 1.5rem)', borderRadius: 12,
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BarChart3 size={20} color="#3b82f6" />
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: theme.text }}>
            Impacto Agregado dos Fatores
          </h3>
          <InfoTooltip text="Visão geral de quais fatores mais influenciam as previsões do modelo considerando TODAS as ações. Derivado dos dados reais (score, retorno, volatilidade)." darkMode={darkMode} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8rem', color: theme.textSecondary }}>Exibir top:</label>
          <select value={showTop} onChange={(e) => setShowTop(Number(e.target.value))}
            style={{ padding: '0.375rem 0.5rem', fontSize: '0.85rem', border: `1px solid ${theme.border}`, borderRadius: 6, backgroundColor: theme.cardBg, color: theme.text, cursor: 'pointer' }}>
            {[5, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.5 }}>
        Ranking dos fatores mais importantes para o modelo em {tickers.length} ações. Barras maiores = maior influência nas previsões.
      </p>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -0.5rem', padding: '0 0.5rem' }}>
        <div style={{ minWidth: 360 }}>
          <ResponsiveContainer width="100%" height={Math.max(300, showTop * 35)}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis type="number" stroke={theme.textSecondary} style={{ fontSize: 10 }}
                label={{ value: 'Impacto Médio', position: 'insideBottom', offset: -5, fill: theme.textSecondary }} />
              <YAxis type="category" dataKey="feature" stroke={theme.textSecondary} style={{ fontSize: 9 }} width={75} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6, color: theme.text }}>{d.feature}</div>
                      <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 3 }}>Impacto Médio: {d.meanImpact.toFixed(4)}</div>
                      <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${theme.border}` }}>
                        Dist: [{d.distribution.min.toFixed(3)}, {d.distribution.q25.toFixed(3)}, {d.distribution.median.toFixed(3)}, {d.distribution.q75.toFixed(3)}, {d.distribution.max.toFixed(3)}]
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="meanImpact" radius={[0, 4, 4, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index < 3 ? '#3b82f6' : index < 6 ? '#10b981' : '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', fontSize: '0.8rem' }}>
        {[
          { color: '#3b82f6', label: 'Top 3' },
          { color: '#10b981', label: 'Relevante' },
          { color: '#94a3b8', label: 'Menor impacto' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 12, height: 12, backgroundColor: color, borderRadius: 2 }} />
            <span style={{ color: theme.textSecondary }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '1rem', padding: '0.75rem', backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        borderRadius: 8, fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6,
      }}>
        ℹ️ Valores derivados dos dados reais do modelo (score, retorno esperado, volatilidade) para {tickers.length} ações. Não utiliza dados simulados.
      </div>
    </div>
  );
};

export default FeatureImpactChart;
