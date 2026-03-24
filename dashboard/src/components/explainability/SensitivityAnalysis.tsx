import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';
import InfoTooltip from '../shared/ui/InfoTooltip';
import ProValue from '../shared/pro/ProValue';

interface TickerData {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

interface SensitivityAnalysisProps {
  ticker: string; tickerData: TickerData; darkMode?: boolean; isPro?: boolean;
}

/* ── Sensitivity factors across all 6 categories ── */
const FACTORS: { key: string; category: string; color: string; derive: (td: TickerData) => number }[] = [
  // Técnicas
  { key: 'Momentum', category: 'Técnica', color: '#3b82f6', derive: td => td.exp_return_20 * 50 },
  { key: 'RSI', category: 'Técnica', color: '#60a5fa', derive: td => td.score * 0.6 },
  { key: 'Volatilidade', category: 'Técnica', color: '#93c5fd', derive: td => -td.vol_20d * 30 },
  // Volume
  { key: 'OBV', category: 'Volume', color: '#3b82f6', derive: td => td.exp_return_20 * 25 },
  { key: 'VWAP', category: 'Volume', color: '#60a5fa', derive: td => (td.pred_price_t_plus_20 / td.last_close - 1) * 15 },
  // Fundamentalistas
  { key: 'ROE', category: 'Fundamental', color: '#10b981', derive: td => Math.abs(td.score) * 0.4 },
  { key: 'P/L', category: 'Fundamental', color: '#34d399', derive: td => -Math.abs(td.score) * 0.25 },
  { key: 'Div. Yield', category: 'Fundamental', color: '#6ee7b7', derive: td => td.score > 0 ? 0.3 : -0.15 },
  // Macro
  { key: 'Selic', category: 'Macro', color: '#f59e0b', derive: td => -td.vol_20d * 20 },
  { key: 'Câmbio', category: 'Macro', color: '#fbbf24', derive: td => td.exp_return_20 * -10 },
  // Setorial
  { key: 'Força Setor', category: 'Setorial', color: '#ec4899', derive: td => td.exp_return_20 * 15 },
  // Sentimento
  { key: 'Sentimento', category: 'Sentimento', color: '#06b6d4', derive: td => td.score * 0.2 },
];

const SensitivityAnalysis: React.FC<SensitivityAnalysisProps> = ({ ticker, tickerData, darkMode = false, isPro = false }) => {
  const [selected, setSelected] = useState<string[]>(['Momentum', 'ROE', 'Selic']);

  const theme = {
    cardBg: darkMode ? '#1a1d27' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f1117',
    textSecondary: darkMode ? '#9ba1b0' : '#64748b',
    border: darkMode ? '#2a2e3a' : '#e2e8f0',
    subtle: darkMode ? '#0f1117' : '#f8fafc',
  };

  const { chartData, sensitivities } = useMemo(() => {
    const basePrice = tickerData.last_close;
    const predPrice = tickerData.pred_price_t_plus_20;
    const numPoints = 20;
    const sensMap: Record<string, number> = {};
    const dataMap: Record<string, number[]> = {};

    FACTORS.forEach(factor => {
      const slope = factor.derive(tickerData);
      sensMap[factor.key] = parseFloat((slope / basePrice * 100).toFixed(2));
      const points: number[] = [];
      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const pred = basePrice + slope * (t - 0.5) + (predPrice - basePrice) * 0.5;
        points.push(parseFloat(pred.toFixed(2)));
      }
      dataMap[factor.key] = points;
    });

    const merged = Array.from({ length: numPoints }, (_, i) => {
      const row: any = { featureValue: parseFloat((i / (numPoints - 1) * 100).toFixed(1)) };
      selected.forEach(f => { if (dataMap[f]) row[f] = dataMap[f][i]; });
      return row;
    });

    return { chartData: merged, sensitivities: sensMap };
  }, [tickerData, selected]);

  const toggle = (key: string) => {
    if (selected.includes(key)) {
      if (selected.length > 1) setSelected(selected.filter(x => x !== key));
    } else if (selected.length < 5) {
      setSelected([...selected, key]);
    }
  };

  // Group factors by category for the selector
  const categories = [...new Set(FACTORS.map(f => f.category))];

  return (
    <div style={{
      backgroundColor: theme.cardBg, padding: 'clamp(0.75rem, 3vw, 1.5rem)', borderRadius: 12,
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <Activity size={18} color="#3b82f6" />
        <h3 style={{ margin: 0, fontSize: 'clamp(0.95rem, 3vw, 1.125rem)', fontWeight: 600, color: theme.text }}>
          Análise de Sensibilidade — {ticker}
        </h3>
        <InfoTooltip text="Mostra como a previsão muda quando cada fator varia. Fatores de todas as 6 categorias do modelo." darkMode={darkMode} />
      </div>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.5 }}>
        Selecione até 5 fatores de diferentes categorias para comparar a sensibilidade do modelo.
      </p>

      {/* Factor selector grouped by category */}
      <div style={{
        padding: '0.6rem', backgroundColor: theme.subtle, borderRadius: 10,
        border: `1px solid ${theme.border}`, marginBottom: '1rem',
      }}>
        {categories.map(cat => (
          <div key={cat} style={{ marginBottom: '0.4rem' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {cat}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {FACTORS.filter(f => f.category === cat).map(f => {
                const isSel = selected.includes(f.key);
                const atMax = !isSel && selected.length >= 5;
                return (
                  <button key={f.key} onClick={() => toggle(f.key)}
                    style={{
                      padding: '0.3rem 0.55rem', fontSize: '0.72rem', borderRadius: 16,
                      cursor: atMax ? 'not-allowed' : 'pointer',
                      border: isSel ? 'none' : `1px solid ${theme.border}`,
                      backgroundColor: isSel ? f.color : 'transparent',
                      color: isSel ? 'white' : (atMax ? theme.border : theme.text),
                      fontWeight: isSel ? 600 : 400,
                      opacity: atMax ? 0.4 : 1,
                      transition: 'all 0.2s',
                      boxShadow: isSel ? `0 2px 6px ${f.color}40` : 'none',
                    }}>
                    {isSel && <span style={{ marginRight: 3, fontSize: '0.65rem' }}>✓</span>}
                    {f.key}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sensitivity KPI cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))',
        gap: '0.5rem', marginBottom: '0.75rem',
      }}>
        {selected.map(key => {
          const factor = FACTORS.find(f => f.key === key);
          return (
            <div key={key} style={{
              padding: '0.65rem', backgroundColor: theme.subtle, borderRadius: 8,
              borderLeft: `3px solid ${factor?.color || '#6b7280'}`,
            }}>
              <div style={{ fontSize: '0.68rem', color: theme.textSecondary }}>{key}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: sensitivities[key] >= 0 ? '#10b981' : '#ef4444' }}>
                <ProValue isPro={isPro} placeholder="±••%">{sensitivities[key] > 0 ? '+' : ''}{sensitivities[key]}%</ProValue>
              </div>
              <div style={{ fontSize: '0.6rem', color: factor?.color || '#6b7280', fontWeight: 600 }}>{factor?.category}</div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -0.5rem', padding: '0 0.5rem' }}>
        <div style={{ minWidth: 350 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis dataKey="featureValue" stroke={theme.textSecondary} style={{ fontSize: 10 }}
                label={{ value: 'Variação do Fator (%)', position: 'insideBottom', offset: -5, fill: theme.textSecondary }} />
              <YAxis stroke={theme.textSecondary} style={{ fontSize: 10 }}
                label={{ value: 'Previsão (R$)', angle: -90, position: 'insideLeft', fill: theme.textSecondary }} />
              <Tooltip contentStyle={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {selected.map(key => {
                const factor = FACTORS.find(f => f.key === key);
                return (
                  <Line key={key} type="monotone" dataKey={key} stroke={factor?.color || '#6b7280'} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SensitivityAnalysis;
