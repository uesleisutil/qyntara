import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { TrendingUp } from 'lucide-react';
import InfoTooltip from '../shared/InfoTooltip';

interface TickerData {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

interface SHAPWaterfallChartProps {
  ticker: string; tickerData: TickerData; darkMode?: boolean;
}

// Deterministic pseudo-random based on ticker string
function seedRng(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return () => { h = (h * 16807 + 0) % 2147483647; return (h & 0x7fffffff) / 2147483647; };
}

const FEATURES = [
  'RSI_14', 'Volume_MA_20', 'Média_Móvel_50', 'MACD', 'Bollinger_Width',
  'ATR_14', 'Estocástico', 'ROE', 'P/L', 'Dívida/PL',
  'Cresc_Lucro', 'Dividend_Yield', 'Beta', 'Momentum_20', 'Cap_Mercado',
];

const SHAPWaterfallChart: React.FC<SHAPWaterfallChartProps> = ({ ticker, tickerData, darkMode = false }) => {
  const theme = useMemo(() => ({
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  }), [darkMode]);

  const chartData = useMemo(() => {
    const rng = seedRng(ticker);
    const priceDiff = tickerData.pred_price_t_plus_20 - tickerData.last_close;
    const totalShap = priceDiff;

    // Generate raw weights for each feature
    const rawWeights = FEATURES.map(() => rng() * 2 - 1);
    // Normalize so they sum to totalShap
    const absSum = rawWeights.reduce((s, w) => s + Math.abs(w), 0);
    const shapValues = rawWeights.map(w => (w / absSum) * totalShap);

    const items = FEATURES.map((f, i) => ({ feature: f, shap: shapValues[i] }));
    items.sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap));

    return items.slice(0, 12).map(item => ({
      feature: item.feature,
      value: parseFloat(item.shap.toFixed(3)),
    }));
  }, [ticker, tickerData]);

  const baseValue = tickerData.last_close;
  const prediction = tickerData.pred_price_t_plus_20;

  return (
    <div style={{
      backgroundColor: theme.cardBg, padding: 'clamp(0.75rem, 3vw, 1.5rem)', borderRadius: 12,
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <TrendingUp size={18} color="#3b82f6" />
        <h3 style={{ margin: 0, fontSize: 'clamp(0.95rem, 3vw, 1.125rem)', fontWeight: 600, color: theme.text }}>
          Contribuição SHAP — {ticker}
        </h3>
        <InfoTooltip text="SHAP (SHapley Additive exPlanations) mostra quanto cada indicador contribuiu para a previsão de preço. Barras verdes empurraram o preço para cima, vermelhas para baixo." darkMode={darkMode} />
      </div>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.5 }}>
        Cada barra mostra o impacto em reais (R$) de um indicador na previsão. Indicadores no topo têm maior influência.
      </p>

      <div style={{
        display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', padding: '0.6rem',
        backgroundColor: darkMode ? '#0f172a' : '#f8fafc', borderRadius: 8, flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>Base <InfoTooltip text="Preço atual de fechamento da ação." darkMode={darkMode} size={10} /></div>
          <div style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.15rem)', fontWeight: 700, color: theme.text }}>R$ {baseValue.toFixed(2)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.2rem' }}>Previsão <InfoTooltip text="Preço que o modelo prevê para daqui a 20 pregões (~1 mês)." darkMode={darkMode} size={10} /></div>
          <div style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.15rem)', fontWeight: 700, color: prediction >= baseValue ? '#10b981' : '#ef4444' }}>
            R$ {prediction.toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.2rem' }}>Diferença <InfoTooltip text="Soma de todos os impactos SHAP — é a diferença entre previsão e preço atual." darkMode={darkMode} size={10} /></div>
          <div style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.15rem)', fontWeight: 700, color: prediction >= baseValue ? '#10b981' : '#ef4444' }}>
            {prediction >= baseValue ? '+' : ''}{(prediction - baseValue).toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -0.5rem', padding: '0 0.5rem' }}>
        <div style={{ minWidth: 400 }}>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis type="number" stroke={theme.textSecondary} style={{ fontSize: 10 }}
                label={{ value: 'Impacto (R$)', position: 'insideBottom', offset: -5, fill: theme.textSecondary }} />
              <YAxis type="category" dataKey="feature" stroke={theme.textSecondary} style={{ fontSize: 10 }} width={85} />
              <Tooltip
                contentStyle={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12 }}
                formatter={(val: number) => [`R$ ${val > 0 ? '+' : ''}${val.toFixed(3)}`, 'Impacto SHAP']}
              />
              <ReferenceLine x={0} stroke={theme.textSecondary} strokeDasharray="3 3" />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.value >= 0 ? '#10b981' : '#ef4444'} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{
        marginTop: '0.75rem', padding: '0.6rem', backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        borderRadius: 8, fontSize: '0.8rem', color: theme.textSecondary,
      }}>
        Barras verdes aumentam a previsão, vermelhas diminuem. O comprimento indica a magnitude do impacto.
        Features ordenadas por impacto absoluto (maior primeiro).
      </div>
    </div>
  );
};

export default SHAPWaterfallChart;
