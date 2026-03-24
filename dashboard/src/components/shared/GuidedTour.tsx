import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';

interface GuidedTourProps {
  darkMode: boolean;
  run: boolean;
  onFinish: () => void;
}

const TOUR_KEY = 'b3tr_tour_done';

export const shouldShowTour = (): boolean => !localStorage.getItem(TOUR_KEY);
export const markTourDone = (): void => localStorage.setItem(TOUR_KEY, 'true');
export const resetTour = (): void => localStorage.removeItem(TOUR_KEY);

const steps: Step[] = [
  {
    target: 'body',
    content: 'Bem-vindo ao Qyntara! Vamos conhecer as principais áreas da plataforma.',
    title: '👋 Olá!',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="nav-mydashboard"]',
    content: 'Seu painel pessoal com destaque do dia, posições, novidades, alertas de preço e comparador de ações. Personalize os widgets como quiser.',
    title: '🏠 Meu Dashboard',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-recommendations"]',
    content: 'Todas as ações da B3 ranqueadas pelo modelo de ML. Veja scores, sinais de compra/venda, retorno esperado e volatilidade.',
    title: '📊 Recomendações',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-explainability"]',
    content: 'Entenda por que o modelo recomendou cada ação. Gráficos de contribuição dos fatores, análise de sensibilidade e explicação em texto.',
    title: '🧠 Explicabilidade',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-backtesting"]',
    content: 'Simule como uma carteira teria performado usando recomendações passadas. Configure capital, número de ações e período.',
    title: '🧪 Backtesting',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-performance"]',
    content: 'Métricas de acurácia do modelo: MAPE, Sharpe, correlação, taxa de acerto e comparação com benchmarks.',
    title: '📈 Performance',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-pro"]',
    content: 'Recursos exclusivos Pro: Acompanhamento por Safra, Carteira Modelo otimizada, stop-loss e take-profit.',
    title: '👑 Recursos Pro',
    placement: 'right',
  },
  {
    target: '[data-tour="notification-center"]',
    content: 'Alertas sobre mudanças de sinal, drift do modelo e anomalias nos dados.',
    title: '🔔 Notificações',
    placement: 'bottom',
  },
  {
    target: '[data-tour="theme-toggle"]',
    content: 'Alterne entre modo claro e escuro.',
    title: '🌙 Tema',
    placement: 'bottom',
  },
  {
    target: '[data-tour="help-menu"]',
    content: 'Acesse ajuda, FAQ, glossário e reinicie este tour a qualquer momento.',
    title: '❓ Ajuda',
    placement: 'bottom',
  },
];

const GuidedTour: React.FC<GuidedTourProps> = ({ darkMode, run, onFinish }) => {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (run) {
      const timer = setTimeout(() => setRunning(true), 800);
      return () => clearTimeout(timer);
    }
  }, [run]);

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      markTourDone();
      setRunning(false);
      onFinish();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={running}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      disableOverlayClose
      callback={handleCallback}
      locale={{
        back: 'Voltar',
        close: 'Fechar',
        last: 'Finalizar',
        next: 'Próximo',
        skip: 'Pular tour',
      }}
      styles={{
        options: {
          primaryColor: '#5a9e87',
          backgroundColor: darkMode ? '#1a2626' : '#fff',
          textColor: darkMode ? '#e8f0ed' : '#121a1a',
          arrowColor: darkMode ? '#1a2626' : '#fff',
          overlayColor: 'rgba(0,0,0,0.5)',
          zIndex: 10000,
        },
        tooltip: { borderRadius: 12, fontSize: '0.85rem', padding: '1rem 1.25rem' },
        tooltipTitle: { fontSize: '1rem', fontWeight: 700 },
        buttonNext: { borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, padding: '0.5rem 1rem' },
        buttonBack: { color: darkMode ? '#8fa89c' : '#5a7268', fontSize: '0.82rem' },
        buttonSkip: { color: darkMode ? '#5a7268' : '#8fa89c', fontSize: '0.75rem' },
      }}
    />
  );
};

export default GuidedTour;
