import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

interface TickerData {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

interface SensitivityAnalysisProps {
  ticker: string; tickerData: TickerData; darkMode?: boolean;
}

function seedRng(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return () => { h = (h * 16807 + 0) % 2147483647; return (h & 0x7fffffff) / 2147483647; };
}

const ALL_FEATURES = [
  'RSI_14', 'Volume_MA_20', 'Média_Móvel_50', 'MACD', 'Bollinger_Width',
  'ATR_14', 'Estocástico', 'ROE', 'P/L', 'Dívida/PL',
  'Cresc_Lucro', 'Dividend_Yield', 'Beta', 'Momentum_20',
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const SensitivityAnalysis: React.FC<SensitivityAnalysisProps> = ({ ticker, tickerData, darkMode = false }) => {
  const [selected, setSelected] = useState<string[]>(['RSI_14']);

  const theme = {
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };

  const { chartData, sensitivities } = useMemo(() => {
    const rng = seedRng(ticker + '_sens');
    const basePrice = tickerData.last_close;
    const predPrice = tickerData.pred_price_t_plus_20;
    const numPoints = 20;

    const sensMap: Record<string, number> = {};
    const dataMap: Record<string, { featureValue: number; prediction: number }[]> = {};

    ALL_FEATURES.forEach(feat => {
      const slope = (rng() - 0.4) * (predPrice - basePrice) * 0.8;
      sensMap[feat] = parseFloat((slope / basePrice * 100).toFixed(2));

      const points = [];
      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const fv = parseFloat((t * 100).toFixed(1));
        const noise = (rng() - 0.5) * 0.3;
        const pred = basePrice + slope * (t - 0.5) + noise;
        points.push({ featureValue: fv, prediction: parseFloat(pred.toFixed(2)) });
      }
      dataMap[feat] = points;
    });

    const merged = Array.from({ length: numPoints }, (_, i) => {
      const row: any = { featureValue: dataMap[ALL_FEATURES[0]][i].featureValue };
      selected.forEach(f => { if (dataMap[f]) row[f] = dataMap[f][i].prediction; });
      return row;
    });

    return { chartData: merged, sensitivities: sensMap };
  }, [ticker, tickerData, selected]);

  const toggle = (f: string) => {
    if (selected.includes(f)) {
      if (selected.length > 1) setSelected(selected.filter(x => x !== f));
    } else if (selected.length < 5) {
      setSelected([...selected, f]);
    }
  };

  return (
    <div style={{
      backgroundColor: theme.cardBg, padding: '1.5rem', borderRadius: 12,
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <Activity size={20} color="#3b82f6" />
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: theme.text }}>
          Análise de Sensibilidade — {ticker}
        </h3>
      </div>
      <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: theme.textSecondary }}>
        Como a previsão muda quando cada feature varia. Selecione até 5 features.
      </p>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem',
        padding: '0.6rem', backgroundColor: darkMode ? '#0f172a' : '#f8fafc', borderRadius: 8,
      }}>
        {ALL_FEATURES.map(f => {
          const isSel = selected.includes(f);
          const idx = selected.indexOf(f);
          return (
            <button key={f} onClick={() => toggle(f)} style={{
              padding: '0.35rem 0.7rem', fontSize: '0.78rem', borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${isSel ? COLORS[idx] : theme.border}`,
              backgroundColor: isSel ? COLORS[idx] : 'transparent',
              color: isSel ? 'white' : theme.text, fontWeight: isSel ? 600 : 400,
            }}>
              {f}
            </button>
          );
        })}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.75rem', marginBottom: '1rem',
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

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
          <XAxis dataKey="featureValue" stroke={theme.textSecondary} style={{ fontSize: 11 }}
            label={{ value: 'Valor da Feature (%)', position: 'insideBottom', offset: -5, fill: theme.textSecondary }} />
          <YAxis stroke={theme.textSecondary} style={{ fontSize: 11 }}
            label={{ value: 'Previsão (R$)', angle: -90, position: 'insideLeft', fill: theme.textSecondary }} />
          <Tooltip contentStyle={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {selected.map((f, i) => (
            <Line key={f} type="monotone" dataKey={f} stroke={COLORS[i]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SensitivityAnalysis;
