import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Brain, TestTubes, ArrowRight, X, Search, Check, Star } from 'lucide-react';
import { UNIVERSE_SIZE_FALLBACK } from '../../../constants';
import { useAuth } from '../../../contexts/AuthContext';
import { API_BASE_URL, API_KEY } from '../../../config';

interface OnboardingModalProps {
  darkMode: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'b3tr_onboarding_done';

const infoSteps = [
  {
    icon: <TrendingUp size={32} color="#8b5cf6" />,
    title: 'Bem-vindo ao Qyntara!',
    desc: `Nosso modelo de Machine Learning analisa ${UNIVERSE_SIZE_FALLBACK} ações da B3 diariamente e gera sinais de Compra, Venda ou Neutro com base em dezenas de indicadores.`,
    tip: 'Comece pela aba Recomendações — ela é sua página principal.',
  },
  {
    icon: <Brain size={32} color="#8b5cf6" />,
    title: 'Entenda cada recomendação',
    desc: 'Na aba Explicabilidade, você vê quais fatores mais influenciaram a previsão de cada ação. Gráficos SHAP, análise de sensibilidade e explicação em texto.',
    tip: 'Selecione qualquer ação e explore os gráficos interativos.',
  },
  {
    icon: <TestTubes size={32} color="#f59e0b" />,
    title: 'Simule antes de investir',
    desc: 'O Backtesting usa preços reais para simular como uma carteira teria se comportado. Configure capital, número de ações e período.',
    tip: 'Experimente diferentes configurações e compare com o mercado.',
  },
];

export const shouldShowOnboarding = (): boolean => {
  return !localStorage.getItem(STORAGE_KEY);
};

export const markOnboardingDone = (): void => {
  localStorage.setItem(STORAGE_KEY, 'true');
};

const OnboardingModal: React.FC<OnboardingModalProps> = ({ darkMode, onClose }) => {
  const { user, setFreeTicker } = useAuth();
  const isPro = user?.plan === 'pro';
  // For free users: info steps + ticker selection step
  const totalSteps = isPro ? infoSteps.length : infoSteps.length + 1;

  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [tickers, setTickers] = useState<{ ticker: string; score: number }[]>([]);
  const [selectedTicker, setSelectedTicker] = useState('');
  const [tickerSearch, setTickerSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Fetch tickers for the selection step
  useEffect(() => {
    if (isPro) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, {
          headers: { 'x-api-key': API_KEY },
        });
        if (res.ok) {
          const data = await res.json();
          const recs = (data.recommendations || [])
            .map((r: any) => ({ ticker: r.ticker, score: r.score }))
            .sort((a: any, b: any) => b.score - a.score);
          setTickers(recs);
        }
      } catch { /* silent */ }
    })();
  }, [isPro]);

  const handleClose = () => {
    setVisible(false);
    markOnboardingDone();
    setTimeout(onClose, 200);
  };

  const handleFinish = useCallback(async () => {
    if (!isPro && selectedTicker) {
      setSaving(true);
      try {
        await setFreeTicker(selectedTicker);
      } catch { /* silent — will retry on next load */ }
      setSaving(false);
    }
    setVisible(false);
    markOnboardingDone();
    setTimeout(onClose, 200);
  }, [isPro, selectedTicker, setFreeTicker, onClose]);

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else handleFinish();
  };

  const isTickerStep = !isPro && step === infoSteps.length;
  const isLast = step === totalSteps - 1;
  const isInfoStep = step < infoSteps.length;

  const filteredTickers = tickers.filter(t =>
    !tickerSearch || t.ticker.toLowerCase().includes(tickerSearch.toLowerCase())
  );

  return (
    <>
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease',
      }} />
      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: visible ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.95)',
        opacity: visible ? 1 : 0, transition: 'all 0.2s ease',
        zIndex: 9999, width: 'min(440px, 90vw)',
        background: darkMode ? '#1e1b40' : '#fff',
        border: `1px solid ${darkMode ? '#363258' : '#e2e8f0'}`,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Close button */}
        <button onClick={handleClose} style={{
          position: 'absolute', top: 12, right: 12, background: 'none', border: 'none',
          color: darkMode ? '#64748b' : '#9895b0', cursor: 'pointer', padding: 4, zIndex: 1,
        }} aria-label="Fechar">
          <X size={18} />
        </button>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 3, padding: '12px 16px 0' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= step ? '#8b5cf6' : (darkMode ? '#363258' : '#e2e8f0'),
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Content */}
        {isInfoStep ? (
          <div style={{ padding: '1.5rem 1.5rem 1rem', textAlign: 'center' }}>
            <div style={{ marginBottom: '1rem' }}>{infoSteps[step].icon}</div>
            <h2 style={{
              fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem',
              color: darkMode ? '#f1f5f9' : '#0c0a1a',
            }}>{infoSteps[step].title}</h2>
            <p style={{
              fontSize: '0.85rem', color: darkMode ? '#b8b5d0' : '#64748b',
              lineHeight: 1.6, marginBottom: '0.75rem',
            }}>{infoSteps[step].desc}</p>
            <div style={{
              padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.78rem',
              background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
              border: `1px solid ${darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)'}`,
              color: darkMode ? '#b8b5d0' : '#64748b',
            }}>
              💡 {infoSteps[step].tip}
            </div>
          </div>
        ) : isTickerStep ? (
          <div style={{ padding: '1.5rem 1.5rem 1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <Star size={32} color="#f59e0b" style={{ marginBottom: '0.5rem' }} />
              <h2 style={{
                fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem',
                color: darkMode ? '#f1f5f9' : '#0c0a1a',
              }}>Escolha sua ação gratuita</h2>
              <p style={{
                fontSize: '0.82rem', color: darkMode ? '#b8b5d0' : '#64748b',
                lineHeight: 1.5, margin: 0,
              }}>
                No plano Free, você tem acesso completo a <strong style={{ color: darkMode ? '#f1f5f9' : '#0c0a1a' }}>1 ação</strong> de sua escolha.
                Todas as informações dessa ação ficam desbloqueadas nas páginas de Recomendações e Explicabilidade.
              </p>
            </div>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: darkMode ? '#64748b' : '#9895b0' }} />
              <input
                type="text" placeholder="Buscar ticker..." value={tickerSearch}
                onChange={e => setTickerSearch(e.target.value)}
                style={{
                  width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', borderRadius: 8,
                  border: `1px solid ${darkMode ? '#363258' : '#e2e8f0'}`,
                  background: darkMode ? '#0e0c1e' : '#f8f7fc',
                  color: darkMode ? '#f1f5f9' : '#0c0a1a', fontSize: '0.82rem', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {/* Ticker grid */}
            <div style={{
              maxHeight: 200, overflowY: 'auto', display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem',
              padding: '0.25rem 0',
            }}>
              {filteredTickers.map(t => (
                <button key={t.ticker} onClick={() => setSelectedTicker(t.ticker)} style={{
                  padding: '0.5rem 0.4rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
                  border: selectedTicker === t.ticker
                    ? '2px solid #8b5cf6'
                    : `1px solid ${darkMode ? '#363258' : '#e2e8f0'}`,
                  background: selectedTicker === t.ticker
                    ? (darkMode ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.08)')
                    : 'transparent',
                  color: selectedTicker === t.ticker ? '#8b5cf6' : (darkMode ? '#f1f5f9' : '#0c0a1a'),
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
                  transition: 'all 0.15s',
                }}>
                  {selectedTicker === t.ticker && <Check size={12} />}
                  {t.ticker}
                </button>
              ))}
              {filteredTickers.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1rem', color: darkMode ? '#64748b' : '#9895b0', fontSize: '0.8rem' }}>
                  Nenhum ticker encontrado
                </div>
              )}
            </div>
            <div style={{
              marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.75rem',
              background: darkMode ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)',
              border: `1px solid ${darkMode ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.1)'}`,
              color: darkMode ? '#b8b5d0' : '#64748b',
            }}>
              👑 Com o Pro, você desbloqueia todas as {UNIVERSE_SIZE_FALLBACK} ações, carteira modelo e muito mais.
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div style={{
          padding: '0.75rem 1.5rem 1.25rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.72rem', color: darkMode ? '#64748b' : '#9895b0' }}>
            {step + 1} de {totalSteps}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} style={{
                padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.82rem',
                border: `1px solid ${darkMode ? '#363258' : '#e2e8f0'}`,
                background: 'transparent', color: darkMode ? '#b8b5d0' : '#64748b',
                cursor: 'pointer', WebkitAppearance: 'none' as any,
              }}>Voltar</button>
            )}
            <button
              onClick={handleNext}
              disabled={isTickerStep && !selectedTicker && !isPro}
              style={{
                padding: '0.5rem 1.25rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
                border: 'none', cursor: (isTickerStep && !selectedTicker) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                background: isLast
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                color: 'white', boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
                WebkitAppearance: 'none' as any,
                opacity: (isTickerStep && !selectedTicker) ? 0.5 : 1,
              }}>
              {saving ? 'Salvando...' : isLast ? 'Começar' : 'Próximo'} {!saving && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingModal;
