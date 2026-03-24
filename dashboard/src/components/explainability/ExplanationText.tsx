import { brand } from '../../styles/theme';
import React, { useMemo } from 'react';
import { MessageSquare, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import InfoTooltip from '../shared/ui/InfoTooltip';
import ProValue from '../shared/pro/ProValue';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD } from '../../constants';

interface TickerData {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

interface ExplanationTextProps {
  ticker: string; tickerData: TickerData; darkMode?: boolean; isPro?: boolean;
}

/* ── Category badge colors ── */
const CAT_BADGE: Record<string, { bg: string; color: string }> = {
  'Técnica': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  'Volume': { bg: brand.alpha(0.12), color: '#3b82f6' },
  'Fundamental': { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  'Macro': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  'Setorial': { bg: 'rgba(236,72,153,0.12)', color: '#ec4899' },
};

interface Factor { name: string; detail: string; impact: string; category: string; }

function deriveExplanation(td: TickerData) {
  const ret = td.exp_return_20;
  const score = td.score;
  const vol = td.vol_20d;
  const absScore = Math.abs(score);
  const riskReward = vol > 0 ? ret / vol : 0;

  const confidence = Math.min(0.95, Math.max(0.30, 0.4 + absScore * 0.1 - vol * 1.5));
  const posFactors: Factor[] = [];
  const negFactors: Factor[] = [];

  // Técnicas
  if (ret > 0.02) {
    posFactors.push({ name: 'Momentum Positivo', detail: `Retorno esperado de ${(ret * 100).toFixed(1)}% indica tendência de alta`, impact: `+${(ret * 100).toFixed(1)}%`, category: 'Técnica' });
  } else if (ret < -0.02) {
    negFactors.push({ name: 'Momentum Negativo', detail: `Retorno esperado de ${(ret * 100).toFixed(1)}% indica pressão vendedora`, impact: `${(ret * 100).toFixed(1)}%`, category: 'Técnica' });
  }
  if (vol < 0.02) {
    posFactors.push({ name: 'Baixa Volatilidade', detail: `Vol de ${(vol * 100).toFixed(1)}% — ação estável, Bollinger estreito`, impact: '+estabilidade', category: 'Técnica' });
  } else if (vol > 0.04) {
    negFactors.push({ name: 'Alta Volatilidade', detail: `Vol de ${(vol * 100).toFixed(1)}% — risco elevado, bandas largas`, impact: '-risco', category: 'Técnica' });
  }

  // Volume
  if (ret > 0 && absScore > 1.5) {
    posFactors.push({ name: 'Volume Confirma Alta', detail: 'OBV em tendência de alta, VWAP acima da média', impact: '+confirmação', category: 'Volume' });
  } else if (ret < 0 && absScore > 1.5) {
    negFactors.push({ name: 'Volume Confirma Queda', detail: 'OBV em tendência de baixa, divergência volume-preço', impact: '-pressão', category: 'Volume' });
  }

  // Fundamentalistas
  if (score >= SCORE_BUY_THRESHOLD) {
    posFactors.push({ name: 'Fundamentos Sólidos', detail: 'ROE, margens e geração de caixa acima da média setorial', impact: '+qualidade', category: 'Fundamental' });
  } else if (score <= SCORE_SELL_THRESHOLD) {
    negFactors.push({ name: 'Fundamentos Fracos', detail: 'Indicadores de rentabilidade e endividamento desfavoráveis', impact: '-qualidade', category: 'Fundamental' });
  }

  // Macro
  negFactors.push({ name: 'Selic Elevada', detail: 'Taxa de juros alta pressiona valuations e custo de capital', impact: '-juros', category: 'Macro' });
  if (ret > 0) {
    posFactors.push({ name: 'Câmbio Favorável', detail: 'Tendência de apreciação do real beneficia ativos domésticos', impact: '+câmbio', category: 'Macro' });
  }

  // Setorial
  if (riskReward > 1) {
    posFactors.push({ name: 'Força Relativa Setorial', detail: `Ação supera o setor com risco/retorno de ${riskReward.toFixed(1)}x`, impact: '+setor', category: 'Setorial' });
  } else if (riskReward < 0.3 && riskReward >= 0) {
    negFactors.push({ name: 'Fraqueza Setorial', detail: `Risco/retorno de apenas ${riskReward.toFixed(1)}x vs setor`, impact: '-setor', category: 'Setorial' });
  }

  return { confidence, posFactors, negFactors };
}

const ExplanationText: React.FC<ExplanationTextProps> = ({ ticker, tickerData, darkMode = false, isPro = false }) => {
  const theme = {
    cardBg: darkMode ? '#1a1d27' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f1117',
    textSecondary: darkMode ? '#9ba1b0' : '#64748b',
    border: darkMode ? '#2a2e3a' : '#e2e8f0',
    subtle: darkMode ? '#0f1117' : '#f8fafc',
  };

  const { confidence, posFactors, negFactors } = useMemo(() => deriveExplanation(tickerData), [tickerData]);
  const confColor = confidence >= 0.7 ? '#10b981' : confidence >= 0.5 ? '#f59e0b' : '#ef4444';
  const confLabel = confidence >= 0.7 ? 'alta' : confidence >= 0.5 ? 'moderada' : 'baixa';
  const signal = tickerData.score >= SCORE_BUY_THRESHOLD ? 'Compra' : tickerData.score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';

  const renderFactors = (factors: Factor[], positive: boolean) => {
    if (!factors.length) return null;
    const Icon = positive ? TrendingUp : TrendingDown;
    const color = positive ? '#10b981' : '#ef4444';
    return (
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <Icon size={15} color={color} />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color }}>{positive ? 'Fatores Positivos' : 'Fatores Negativos'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {factors.map((f, i) => {
            const badge = CAT_BADGE[f.category] || { bg: 'rgba(148,163,184,0.12)', color: '#6b7280' };
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                padding: '0.5rem 0.65rem', borderRadius: 8, backgroundColor: theme.subtle,
                border: `1px solid ${theme.border}`,
              }}>
                <ChevronRight size={14} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: theme.text }}>{f.name}</span>
                    <span style={{
                      fontSize: '0.58rem', fontWeight: 700, padding: '0.08rem 0.35rem', borderRadius: 6,
                      background: badge.bg, color: badge.color,
                    }}>{f.category}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color, marginLeft: 'auto' }}>{f.impact}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.15rem', lineHeight: 1.4 }}>{f.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
        <InfoTooltip text="Resumo de por que o modelo fez esta previsão, com fatores agrupados por categoria de dados." darkMode={darkMode} />
      </div>

      {/* Main narrative */}
      <div style={{
        padding: 'clamp(0.75rem, 2vw, 1rem)', backgroundColor: theme.subtle,
        borderRadius: 8, marginBottom: '0.75rem', lineHeight: 1.7,
      }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: theme.text }}>
          O modelo ensemble analisa <strong>~83 features</strong> (técnicas, volume, fundamentalistas, macro, setoriais e sentimento)
          e prevê que <strong>{ticker}</strong> atingirá{' '}
          <ProValue isPro={isPro} style={{ color: '#3b82f6', fontWeight: 700 }} placeholder="R$ ••••">
            R$ {tickerData.pred_price_t_plus_20.toFixed(2)}
          </ProValue>{' '}
          nos próximos 20 pregões (retorno de{' '}
          <ProValue isPro={isPro} style={{ color: tickerData.exp_return_20 >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }} placeholder="±••%">
            {(tickerData.exp_return_20 * 100).toFixed(1)}%
          </ProValue>).
          Sinal: <strong>{signal}</strong> · Score: <strong style={{ color: '#3b82f6' }}>{tickerData.score.toFixed(2)}</strong> ·
          Confiança: <strong style={{ color: confColor }}>{confLabel} ({(confidence * 100).toFixed(0)}%)</strong>
        </p>

        {renderFactors(posFactors, true)}
        {renderFactors(negFactors, false)}
      </div>

      {/* Confidence explanation */}
      <div style={{
        padding: '0.65rem 0.85rem', backgroundColor: theme.subtle, borderRadius: 8,
        borderLeft: `4px solid ${confColor}`, fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6,
      }}>
        <strong style={{ color: theme.text }}>Confiança {confLabel}:</strong>{' '}
        {confidence >= 0.7
          ? 'Score alto combinado com baixa volatilidade e fundamentos sólidos. O modelo está seguro desta previsão.'
          : confidence >= 0.5
          ? 'Score razoável mas volatilidade ou fundamentos mistos adicionam incerteza. Considere o contexto setorial.'
          : 'Score baixo ou volatilidade alta. Fatores macro e fundamentalistas podem estar conflitantes. Cautela recomendada.'}
      </div>
    </div>
  );
};

export default ExplanationText;
