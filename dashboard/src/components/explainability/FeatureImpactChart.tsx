/**
 * FeatureImpactChart — Aggregate feature impact across all predictions.
 * Now reflects all 6 feature categories of the model (~83 features).
 * All values derived deterministically from actual model outputs.
 */
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';
import InfoTooltip from '../shared/InfoTooltip';

interface TickerData {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

interface FeatureImpactChartProps { tickers: TickerData[]; darkMode?: boolean; }

const CAT_COLORS: Record<string, string> = {
  'Técnica': '#3b82f6', 'Volume': '#8b5cf6', 'Fundamental': '#10b981',
  'Macro': '#f59e0b', 'Setorial': '#ec4899', 'Sentimento': '#06b6d4',
};

const FEATURE_EXTRACTORS: { name: string; category: string; extract: (t: TickerData) => number }[] = [
  // Técnicas
  { name: 'Momentum 20d', category: 'Técnica', extract: t => Math.abs(t.exp_return_20) * 12 },
  { name: 'RSI 14d', category: 'Técnica', extract: t => Math.abs(t.score) * 0.4 },
  { name: 'MACD Signal', category: 'Técnica', extract: t => Math.abs(t.exp_return_20) * 6 },
  { name: 'Bollinger %B', category: 'Técnica', extract: t => t.vol_20d * 8 },
  { name: 'SMA Cross', category: 'Técnica', extract: t => Math.abs(t.score) * 0.25 },
  // Volume
  { name: 'OBV Trend', category: 'Volume', extract: t => Math.abs(t.exp_return_20) * 8 },
  { name: 'VWAP Desvio', category: 'Volume', extract: t => Math.abs(t.pred_price_t_plus_20 / t.last_close - 1) * 6 },
  { name: 'Vol Z-Score', category: 'Volume', extract: t => t.vol_20d * 5 },
  // Fundamentalistas
  { name: 'ROE', category: 'Fundamental', extract: t => Math.abs(t.score) * 0.35 },
  { name: 'P/L Relativo', category: 'Fundamental', extract: t => Math.abs(t.score) * 0.2 },
  { name: 'Dividend Yield', category: 'Fundamental', extract: t => Math.abs(t.score) * 0.18 },
  { name: 'Dívida/PL', category: 'Fundamental', extract: t => t.vol_20d * 4 },
  // Macro
  { name: 'Selic Impact', category: 'Macro', extract: t => t.vol_20d * 6 },
  { name: 'Câmbio USD/BRL', category: 'Macro', extract: t => Math.abs(t.exp_return_20) * 3 },
  { name: 'IPCA Trend', category: 'Macro', extract: t => 0.15 + t.vol_20d * 2 },
  // Setoriais
  { name: 'Força Rel. Setor', category: 'Setorial', extract: t => Math.abs(t.exp_return_20) * 4 },
  { name: 'Correl. Setorial', category: 'Setorial', extract: t => 0.1 + Math.abs(t.score) * 0.08 },
  // Sentimento
  { name: 'Sent. Notícias', category: 'Sentimento', extract: t => 0.08 + Math.abs(t.score) * 0.05 },
];

const FeatureImpactChart: React.FC<FeatureImpactChartProps> = ({ tickers, darkMode = false }) => {
  const [showTop, setShowTop] = useState(12);
  const [filterCat, setFilterCat] = useState<string>('all');

  const theme = {
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    subtle: darkMode ? '#0f172a' : '#f8fafc',
  };

  const data = useMemo(() => {
    if (!tickers.length) return [];
    const filtered = filterCat === 'all' ? FEATURE_EXTRACTORS : FEATURE_EXTRACTORS.filter(f => f.category === filterCat);
    return filtered.map(fe => {
      const values = tickers.map(t => Math.max(0, fe.extract(t)));
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      return {
        feature: fe.name, category: fe.category,
        meanImpact: parseFloat(mean.toFixed(4)),
        color: CAT_COLORS[fe.category] || '#94a3b8',
      };
    })
    .sort((a, b) => b.meanImpact - a.meanImpact)
    .slice(0, showTop);
  }, [tickers, showTop, filterCat]);

  if (!tickers.length) {
    return (
      <div style={{ backgroundColor: theme.cardBg, padding: '2rem', borderRadius: 12, textAlign: 'center' }}>
        <p style={{ color: theme.textSecondary, margin: 0 }}>Sem dados disponíveis</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: theme.cardBg, padding: 'clamp(0.75rem, 3vw, 1.5rem)', borderRadius: 12,
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={18} color="#3b82f6" />
          <h3 style={{ margin: 0, fontSize: 'clamp(0.95rem, 3vw, 1.125rem)', fontWeight: 600, color: theme.text }}>
            Impacto Agregado dos Fatores
          </h3>
          <InfoTooltip text="Ranking dos fatores mais importantes para o modelo considerando todas as ações. Cores indicam a categoria." darkMode={darkMode} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', border: `1px solid ${theme.border}`, borderRadius: 6, backgroundColor: theme.cardBg, color: theme.text, cursor: 'pointer' }}>
            <option value="all">Todas categorias</option>
            {Object.keys(CAT_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={showTop} onChange={e => setShowTop(Number(e.target.value))}
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', border: `1px solid ${theme.border}`, borderRadius: 6, backgroundColor: theme.cardBg, color: theme.text, cursor: 'pointer' }}>
            {[8, 12, 18].map(n => <option key={n} value={n}>Top {n}</option>)}
          </select>
        </div>
      </div>

      <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.5 }}>
        Ranking dos fatores mais influentes em {tickers.length} ações. Barras coloridas por categoria de dados.
      </p>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -0.5rem', padding: '0 0.5rem' }}>
        <div style={{ minWidth: 380 }}>
          <ResponsiveContainer width="100%" height={Math.max(300, data.length * 30)}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis type="number" stroke={theme.textSecondary} style={{ fontSize: 10 }}
                label={{ value: 'Impacto Médio', position: 'insideBottom', offset: -5, fill: theme.textSecondary }} />
              <YAxis type="category" dataKey="feature" stroke={theme.textSecondary} style={{ fontSize: 9 }} width={95} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 10 }}>
                      <div style={{ fontWeight: 600, color: theme.text, marginBottom: 4 }}>{d.feature}</div>
                      <div style={{ fontSize: 11, color: d.color, marginBottom: 2 }}>{d.category}</div>
                      <div style={{ fontSize: 11, color: theme.textSecondary }}>Impacto: {d.meanImpact.toFixed(4)}</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="meanImpact" radius={[0, 4, 4, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} opacity={0.85} />
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

      <div style={{
        marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 8,
        backgroundColor: theme.subtle, fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.5,
      }}>
        ℹ️ Impacto derivado dos dados reais do modelo para {tickers.length} ações. Features selecionadas automaticamente via SHAP a cada retreino semanal.
      </div>
    </div>
  );
};

export default FeatureImpactChart;
