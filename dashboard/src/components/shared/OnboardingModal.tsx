import React, { useState, useEffect } from 'react';
import { TrendingUp, Brain, TestTubes, Crown, ArrowRight, X } from 'lucide-react';
import { UNIVERSE_SIZE_FALLBACK } from '../../constants';

interface OnboardingModalProps {
  darkMode: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'b3tr_onboarding_done';

const steps = [
  {
    icon: <TrendingUp size={32} color="#3b82f6" />,
    title: 'Bem-vindo ao B3 Tactical Ranking!',
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
  {
    icon: <Crown size={32} color="#f59e0b" />,
    title: 'Desbloqueie o Pro',
    desc: `Com o plano Pro você acessa todas as ${UNIVERSE_SIZE_FALLBACK} ações, carteira modelo otimizada, stop-loss, take-profit, tracking por safra e muito mais.`,
    tip: 'Colunas Pro aparecem com blur — faça upgrade para desbloquear.',
  },
];

export const shouldShowOnboarding = (): boolean => {
  return !localStorage.getItem(STORAGE_KEY);
};

export const markOnboardingDone = (): void => {
  localStorage.setItem(STORAGE_KEY, 'true');
};

const OnboardingModal: React.FC<OnboardingModalProps> = ({ darkMode, onClose }) => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    markOnboardingDone();
    setTimeout(onClose, 200);
  };

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else handleClose();
  };

  const current = steps[step];
  const isLast = step === steps.length - 1;

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
        zIndex: 9999, width: 'min(420px, 90vw)',
        background: darkMode ? '#1e293b' : '#fff',
        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Close button */}
        <button onClick={handleClose} style={{
          position: 'absolute', top: 12, right: 12, background: 'none', border: 'none',
          color: darkMode ? '#64748b' : '#94a3b8', cursor: 'pointer', padding: 4, zIndex: 1,
        }} aria-label="Fechar">
          <X size={18} />
        </button>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 3, padding: '12px 16px 0' }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= step ? '#3b82f6' : (darkMode ? '#334155' : '#e2e8f0'),
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem 1.5rem 1rem', textAlign: 'center' }}>
          <div style={{ marginBottom: '1rem' }}>{current.icon}</div>
          <h2 style={{
            fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem',
            color: darkMode ? '#f1f5f9' : '#0f172a',
          }}>{current.title}</h2>
          <p style={{
            fontSize: '0.85rem', color: darkMode ? '#94a3b8' : '#64748b',
            lineHeight: 1.6, marginBottom: '0.75rem',
          }}>{current.desc}</p>
          <div style={{
            padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.78rem',
            background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
            border: `1px solid ${darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)'}`,
            color: darkMode ? '#94a3b8' : '#64748b',
          }}>
            💡 {current.tip}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.75rem 1.5rem 1.25rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.72rem', color: darkMode ? '#64748b' : '#94a3b8' }}>
            {step + 1} de {steps.length}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} style={{
                padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.82rem',
                border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                background: 'transparent', color: darkMode ? '#94a3b8' : '#64748b',
                cursor: 'pointer', WebkitAppearance: 'none' as any,
              }}>Voltar</button>
            )}
            <button onClick={handleNext} style={{
              padding: '0.5rem 1.25rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem',
              background: isLast ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
              color: 'white', boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
              WebkitAppearance: 'none' as any,
            }}>
              {isLast ? 'Começar' : 'Próximo'} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingModal;
