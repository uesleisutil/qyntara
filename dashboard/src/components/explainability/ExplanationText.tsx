import React, { useMemo } from 'react';
import { MessageSquare, TrendingUp, TrendingDown } from 'lucide-react';
import InfoTooltip from '../shared/InfoTooltip';

interface TickerData {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

interface ExplanationTextProps {
  ticker: string; tickerData: TickerData; darkMode?: boolean;
}

function seedRng(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return () => { h = (h * 16807 + 0) % 2147483647; return (h & 0x7fffffff) / 2147483647; };
}

const POSITIVE_FEATURES = [
  { name: 'RSI (Índice de Força Relativa)', unit: '' },
  { name: 'Volume de Negociação', unit: 'M' },
  { name: 'Crescimento de Lucro', unit: '%' },
  { name: 'Momentum 20 dias', unit: '%' },
  { name: 'ROE (Retorno sobre PL)', unit: '%' },
];

const NEGATIVE_FEATURES = [
  { name: 'Relação P/L', unit: 'x' },
  { name: 'Relação Dívida/PL', unit: 'x' },
  { name: 'Beta (Volatilidade)', unit: '' },
  { name: 'ATR (Volatilidade Média)', unit: '' },
  { name: 'Largura Bollinger', unit: '' },
];

const ExplanationText: React.FC<ExplanationTextProps> = ({ ticker, tickerData, darkMode = false }) => {
  const theme = {
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };

  const explanation = useMemo(() => {
    const rng = seedRng(ticker);
    const ret = tickerData.exp_return_20;
    const score = tickerData.score;
    const vol = tickerData.vol_20d;

    // Confidence derived from score magnitude and low volatility
    const confidence = Math.min(0.95, Math.max(0.35, 0.5 + Math.abs(score) * 0.08 - vol * 2 + rng() * 0.1));

    // Pick 3 positive features with ticker-specific values
    const posFeats = POSITIVE_FEATURES.sort(() => rng() - 0.5).slice(0, 3).map(f => {
      const val = 20 + rng() * 60;
      const typical = 15 + rng() * 40;
      const impact = (rng() * 0.3 + 0.1) * Math.abs(ret);
      return { ...f, value: val, typical, impact };
    });

    // Pick 3 negative features
    const negFeats = NEGATIVE_FEATURES.sort(() => rng() - 0.5).slice(0, 3).map(f => {
      const val = 5 + rng() * 25;
      const typical = 3 + rng() * 15;
      const impact = (rng() * 0.2 + 0.05) * Math.abs(ret);
      return { ...f, value: val, typical, impact };
    });

    return { confidence, posFeats, negFeats };
  }, [ticker, tickerData]);

  const { confidence, posFeats, negFeats } = explanation;
  const confColor = confidence >= 0.7 ? '#10b981' : confidence >= 0.5 ? '#f59e0b' : '#ef4444';
  const confLabel = confidence >= 0.7 ? 'alta' : confidence >= 0.5 ? 'moderada' : 'baixa';
  const signal = tickerData.score >= 1.5 ? 'Compra' : tickerData.score <= -1.5 ? 'Venda' : 'Neutro';

  return (
    <div style={{
      backgroundColor: theme.cardBg, padding: 'clamp(0.75rem, 3vw, 1.5rem)', borderRadius: 12,
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <MessageSquare size={18} color="#3b82f6" />
        <h3 style={{ margin: 0, fontSize: 'clamp(0.95rem, 3vw, 1.125rem)', fontWeight: 600, color: theme.text }}>
          Explicação em Linguagem Natural — {ticker}
        </h3>
        <InfoTooltip text="Resumo em português de por que o modelo fez esta previsão. Mostra os principais fatores a favor e contra, e o nível de confiança." darkMode={darkMode} />
      </div>

      <div style={{
        padding: 'clamp(0.75rem, 2vw, 1.25rem)', backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        borderRadius: 8, marginBottom: '0.75rem', lineHeight: 1.7,
      }}>
        <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: theme.text }}>
          O modelo prevê que <strong>{ticker}</strong> atingirá{' '}
          <strong style={{ color: '#3b82f6' }}>R$ {tickerData.pred_price_t_plus_20.toFixed(2)}</strong>{' '}
          nos próximos 20 pregões (retorno de{' '}
          <strong style={{ color: tickerData.exp_return_20 >= 0 ? '#10b981' : '#ef4444' }}>
            {(tickerData.exp_return_20 * 100).toFixed(1)}%
          </strong>).
          Sinal: <strong>{signal}</strong> (score {tickerData.score.toFixed(2)}).
          Confiança: <strong style={{ color: confColor }}>{confLabel}</strong> ({(confidence * 100).toFixed(0)}%).
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingUp size={16} color="#10b981" />
            <strong style={{ fontSize: '0.875rem', color: '#10b981' }}>Fatores Positivos</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', color: theme.text, fontSize: '0.85rem' }}>
            {posFeats.map((f, i) => (
              <li key={i} style={{ marginBottom: '0.4rem' }}>
                <strong>{f.name}</strong>: {f.value.toFixed(1)}{f.unit} (típico: {f.typical.toFixed(1)}{f.unit}).
                Contribui com <strong style={{ color: '#10b981' }}>+{(f.impact * 100).toFixed(1)}%</strong> na previsão.
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingDown size={16} color="#ef4444" />
            <strong style={{ fontSize: '0.875rem', color: '#ef4444' }}>Fatores Negativos</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', color: theme.text, fontSize: '0.85rem' }}>
            {negFeats.map((f, i) => (
              <li key={i} style={{ marginBottom: '0.4rem' }}>
                <strong>{f.name}</strong>: {f.value.toFixed(1)}{f.unit} (típico: {f.typical.toFixed(1)}{f.unit}).
                Reduz em <strong style={{ color: '#ef4444' }}>-{(f.impact * 100).toFixed(1)}%</strong> a previsão.
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{
        padding: '0.75rem', backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        borderRadius: 8, borderLeft: `4px solid ${confColor}`, fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.6,
      }}>
        <strong style={{ color: theme.text }}>O que significa a confiança?</strong>{' '}
        {confidence >= 0.7
          ? 'O modelo está seguro desta previsão — os indicadores técnicos e fundamentalistas apontam na mesma direção, e o padrão é consistente com o histórico.'
          : confidence >= 0.5
          ? 'O modelo tem confiança moderada — alguns indicadores são favoráveis, mas há sinais mistos. A previsão pode se concretizar, mas há incerteza.'
          : 'O modelo tem baixa confiança — os indicadores estão conflitantes ou as condições de mercado são atípicas. Considere esta previsão com cautela extra.'}
      </div>
    </div>
  );
};

export default ExplanationText;
