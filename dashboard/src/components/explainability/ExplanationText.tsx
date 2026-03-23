import React, { useMemo } from 'react';
import { MessageSquare, TrendingUp, TrendingDown } from 'lucide-react';
import InfoTooltip from '../shared/InfoTooltip';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD } from '../../constants';

interface TickerData {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

interface ExplanationTextProps {
  ticker: string; tickerData: TickerData; darkMode?: boolean; isPro?: boolean;
}

/**
 * Derives explanation from real ticker data only — no fake/random values.
 * Confidence is computed from score magnitude and volatility.
 * Positive/negative factors are determined by actual metric values.
 */
function deriveExplanation(td: TickerData) {
  const ret = td.exp_return_20;
  const score = td.score;
  const vol = td.vol_20d;
  const absScore = Math.abs(score);

  // Confidence: high score + low vol = high confidence
  const confidence = Math.min(0.95, Math.max(0.30,
    0.4 + absScore * 0.1 - vol * 1.5
  ));

  // Derive factors from real data
  const posFactors: { name: string; detail: string; impact: string }[] = [];
  const negFactors: { name: string; detail: string; impact: string }[] = [];

  // Score-based
  if (score >= SCORE_BUY_THRESHOLD) {
    posFactors.push({ name: 'Score do Modelo', detail: `Score ${score.toFixed(2)} indica sinal de compra forte`, impact: `+${(absScore * 2).toFixed(1)}%` });
  } else if (score <= SCORE_SELL_THRESHOLD) {
    negFactors.push({ name: 'Score do Modelo', detail: `Score ${score.toFixed(2)} indica sinal de venda`, impact: `-${(absScore * 2).toFixed(1)}%` });
  }

  // Return-based
  if (ret > 0.03) {
    posFactors.push({ name: 'Retorno Esperado', detail: `Retorno previsto de ${(ret * 100).toFixed(1)}% em 20 pregões`, impact: `+${(ret * 100).toFixed(1)}%` });
  } else if (ret < -0.03) {
    negFactors.push({ name: 'Retorno Esperado', detail: `Retorno previsto de ${(ret * 100).toFixed(1)}% em 20 pregões`, impact: `${(ret * 100).toFixed(1)}%` });
  } else if (ret > 0) {
    posFactors.push({ name: 'Retorno Esperado', detail: `Retorno modesto de ${(ret * 100).toFixed(1)}%`, impact: `+${(ret * 100).toFixed(1)}%` });
  } else {
    negFactors.push({ name: 'Retorno Esperado', detail: `Retorno negativo de ${(ret * 100).toFixed(1)}%`, impact: `${(ret * 100).toFixed(1)}%` });
  }

  // Volatility-based
  if (vol < 0.02) {
    posFactors.push({ name: 'Baixa Volatilidade', detail: `Vol de ${(vol * 100).toFixed(1)}% — ação estável`, impact: '+estabilidade' });
  } else if (vol > 0.04) {
    negFactors.push({ name: 'Alta Volatilidade', detail: `Vol de ${(vol * 100).toFixed(1)}% — risco elevado`, impact: '-risco' });
  }

  // Risk/reward
  const riskReward = vol > 0 ? ret / vol : 0;
  if (riskReward > 1) {
    posFactors.push({ name: 'Relação Risco/Retorno', detail: `Retorno ${riskReward.toFixed(1)}x a volatilidade`, impact: '+favorável' });
  } else if (riskReward < 0.3 && riskReward >= 0) {
    negFactors.push({ name: 'Relação Risco/Retorno', detail: `Retorno apenas ${riskReward.toFixed(1)}x a volatilidade`, impact: '-desfavorável' });
  }

  // Price movement
  const priceChange = td.pred_price_t_plus_20 - td.last_close;
  if (priceChange > 0) {
    posFactors.push({ name: 'Tendência de Preço', detail: `Previsão de alta de R$ ${td.last_close.toFixed(2)} para R$ ${td.pred_price_t_plus_20.toFixed(2)}`, impact: `+R$ ${priceChange.toFixed(2)}` });
  } else {
    negFactors.push({ name: 'Tendência de Preço', detail: `Previsão de queda de R$ ${td.last_close.toFixed(2)} para R$ ${td.pred_price_t_plus_20.toFixed(2)}`, impact: `-R$ ${Math.abs(priceChange).toFixed(2)}` });
  }

  return { confidence, posFactors, negFactors };
}

const ExplanationText: React.FC<ExplanationTextProps> = ({ ticker, tickerData, darkMode = false, isPro = false }) => {
  const theme = {
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };

  const { confidence, posFactors, negFactors } = useMemo(() => deriveExplanation(tickerData), [tickerData]);

  const confColor = confidence >= 0.7 ? '#10b981' : confidence >= 0.5 ? '#f59e0b' : '#ef4444';
  const confLabel = confidence >= 0.7 ? 'alta' : confidence >= 0.5 ? 'moderada' : 'baixa';
  const signal = tickerData.score >= SCORE_BUY_THRESHOLD ? 'Compra' : tickerData.score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';

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
        <InfoTooltip text="Resumo de por que o modelo fez esta previsão, baseado nos dados reais do ticker." darkMode={darkMode} />
      </div>

      <div style={{
        padding: 'clamp(0.75rem, 2vw, 1.25rem)', backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        borderRadius: 8, marginBottom: '0.75rem', lineHeight: 1.7,
      }}>
        <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: theme.text }}>
          O modelo prevê que <strong>{ticker}</strong> atingirá{' '}
          <strong style={{ color: '#3b82f6', filter: isPro ? 'none' : 'blur(5px)', userSelect: isPro ? 'auto' : 'none' }}>R$ {tickerData.pred_price_t_plus_20.toFixed(2)}</strong>{' '}
          nos próximos 20 pregões (retorno de{' '}
          <strong style={{ color: tickerData.exp_return_20 >= 0 ? '#10b981' : '#ef4444', filter: isPro ? 'none' : 'blur(5px)', userSelect: isPro ? 'auto' : 'none' }}>
            {(tickerData.exp_return_20 * 100).toFixed(1)}%
          </strong>).
          Sinal: <strong>{signal}</strong> (score {tickerData.score.toFixed(2)}).
          Confiança: <strong style={{ color: confColor }}>{confLabel}</strong> ({(confidence * 100).toFixed(0)}%).
        </p>

        {posFactors.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <TrendingUp size={16} color="#10b981" />
              <strong style={{ fontSize: '0.875rem', color: '#10b981' }}>Fatores Positivos</strong>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: theme.text, fontSize: '0.85rem' }}>
              {posFactors.map((f, i) => (
                <li key={i} style={{ marginBottom: '0.4rem' }}>
                  <strong>{f.name}</strong>: {f.detail}.
                  Contribuição: <strong style={{ color: '#10b981' }}>{f.impact}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {negFactors.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <TrendingDown size={16} color="#ef4444" />
              <strong style={{ fontSize: '0.875rem', color: '#ef4444' }}>Fatores Negativos</strong>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: theme.text, fontSize: '0.85rem' }}>
              {negFactors.map((f, i) => (
                <li key={i} style={{ marginBottom: '0.4rem' }}>
                  <strong>{f.name}</strong>: {f.detail}.
                  Contribuição: <strong style={{ color: '#ef4444' }}>{f.impact}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div style={{
        padding: '0.75rem', backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        borderRadius: 8, borderLeft: `4px solid ${confColor}`, fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.6,
      }}>
        <strong style={{ color: theme.text }}>O que significa a confiança?</strong>{' '}
        {confidence >= 0.7
          ? 'Score alto e volatilidade baixa indicam que o modelo está seguro desta previsão.'
          : confidence >= 0.5
          ? 'O modelo tem confiança moderada — o score é razoável mas a volatilidade adiciona incerteza.'
          : 'O modelo tem baixa confiança — score baixo ou volatilidade alta. Considere com cautela.'}
      </div>
    </div>
  );
};

export default ExplanationText;
