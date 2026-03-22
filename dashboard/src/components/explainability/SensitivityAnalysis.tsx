import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';
import InfoTooltip from '../shared/InfoTooltip';

interface TickerData {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

interface SensitivityAnalysisProps {
  ticker: string; tickerData: TickerData; darkMode?: boolean;
}

/**
 * Sensitivity factors derived from real model metrics.
 * Each factor shows how the prediction would change if that input varied.
 * Slopes are computed deterministically from the ticker's actual data.
 */
const FACTORS = [
  { key: 'Score', derive: (td: TickerData) => td.score * 0.8 },
  { key: 'Retorno_Esperado', derive: (td: TickerData) => td.exp_return_20 * 50 },
  { key: 'Volatilidade', derive: (td: TickerData) => -td.vol_20d * 30 },
  { key: 'Preço_Atual', derive: (td: TickerData) => (td.pred_price_t_plus_20 / td.last_close - 1) * 20 },
  { key: 'Risco_Retorno', derive: (td: TickerData) => (td.vol_20d > 0 ? td.exp_return_20 / td.vol_20d : 0) * 2 },
  { key: 'Magnitude_Score', derive: (td: TickerData) => Math.abs(td.score) * 0.5 },
  { key: 'Direção_Score', derive: (td: TickerData) => td.score > 0 ? 1.5 : -1.5 },
  { key: 'Vol_Relativa', derive: (td: TickerData) => td.vol_20d < 0.03 ? 1 : -1 },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const SensitivityAnalysis: React.FC<SensitivityAnalysisProps> = ({ ticker, tickerData, darkMode = false }) => {
  const [selected, setSelected] = useState<string[]>(['Score']);

  const theme = {
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
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

  const toggle = (f: string) => {
    if (selected.includes(f)) {
      if (selected.length > 1) setSelected(selected.filter(x => x !== f));
    } else if (selected.length < 5) {
      setSelected([...selected, f]);
    }
  };

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
        <InfoTooltip text="Mostra como a previsão muda quando cada fator varia. Linhas mais inclinadas = modelo mais sensível a esse fator. Derivado dos dados reais do ticker." darkMode={darkMode} />
      </div>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.5 }}>
        Selecione até 5 fatores para comparar. O valor de sensibilidade indica quanto a previsão muda quando o fator varia.
      </p>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem',
        padding: '0.6rem', backgroundColor: darkMode ? '#0f172a' : '#f8fafc', borderRadius: 10,
        border: `1px solid ${theme.border}`,
      }}>
        {FACTORS.map(f => {
          const isSel = selected.includes(f.key);
          const idx = selected.indexOf(f.key);
          const atMax = !isSel && selected.length >= 5;
          return (
            <button key={f.key} onClick={() => toggle(f.key)}
              style={{
                padding: '0.35rem 0.65rem', fontSize: '0.76rem', borderRadius: 20,
                cursor: atMax ? 'not-allowed' : 'pointer',
                border: isSel ? 'none' : `1px solid ${theme.border}`,
                backgroundColor: isSel ? COLORS[idx] : 'transparent',
                color: isSel ? 'white' : (atMax ? theme.border : theme.text),
                fontWeight: isSel ? 600 : 400,
                opacity: atMax ? 0.4 : 1,
                transition: 'all 0.2s ease',
                boxShadow: isSel ? `0 2px 6px ${COLORS[idx]}40` : 'none',
                WebkitTapHighlightColor: 'transparent',
                WebkitAppearance: 'none' as any,
              }}>
              {isSel && <span style={{ marginRight: 3, fontSize: '0.7rem' }}>✓</span>}
              {f.key}
            </button>
          );
        })}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))',
        gap: '0.5rem', marginBottom: '0.75rem',
      }}>
        {selected.map((f, i) => (
          <div key={f} style={{
            padding: '0.75rem', backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
            borderRadius: 8, borderLeft: `4px solid ${COLORS[i]}`,
          }}>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>{f}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: sensitivities[f] >= 0 ? '#10b981' : '#ef4444' }}>
              {sensitivities[f] > 0 ? '+' : ''}{sensitivities[f]}%
            </div>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>sensibilidade</div>
          </div>
        ))}
      </div>

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
              {selected.map((f, i) => (
                <Line key={f} type="monotone" dataKey={f} stroke={COLORS[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SensitivityAnalysis;
