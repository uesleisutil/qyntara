import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';

interface GuidedTourProps {
  run?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
  tourType?: 'main' | 'advanced';
}

const mainTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Bem-vindo ao B3 Tactical Ranking! Vamos fazer um tour rápido pelas principais funcionalidades.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="nav-mydashboard"]',
    content: 'Este é o seu Dashboard pessoal. Aqui você vê suas posições, destaque do dia, novidades e pode comparar ações.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-recommendations"]',
    content: 'Na aba Recomendações você encontra todas as ações ranqueadas pelo modelo de ML, com scores, sinais e retornos previstos.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-explainability"]',
    content: 'A Explicabilidade mostra por que o modelo recomendou cada ação — quais indicadores mais pesaram na decisão.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-backtesting"]',
    content: 'No Backtesting você simula como teria sido o desempenho de uma carteira usando recomendações passadas.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-performance"]',
    content: 'A aba Performance mostra métricas de acurácia do modelo: MAPE, Sharpe, correlação e mais.',
    placement: 'right',
  },
  {
    target: '[data-tour="notification-center"]',
    content: 'Aqui ficam os alertas e notificações. Você recebe avisos sobre mudanças de sinal, drift e anomalias.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="theme-toggle"]',
    content: 'Alterne entre modo claro e escuro conforme sua preferência.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="help-menu"]',
    content: 'Acesse ajuda, FAQ, glossário e reinicie este tour a qualquer momento pelo menu de ajuda.',
    placement: 'bottom',
  },
];

const advancedTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Vamos explorar as funcionalidades avançadas para análises mais profundas.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="filters"]',
    content: 'Use os filtros para refinar as recomendações por setor, retorno esperado e score mínimo.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="export-button"]',
    content: 'Exporte os dados em CSV para análise offline e relatórios.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="comparison-mode"]',
    content: 'Ative o modo de comparação para analisar múltiplas ações lado a lado.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="temporal-comparison"]',
    content: 'Ative a comparação temporal para ver como as métricas mudaram ao longo do tempo.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="favorites"]',
    content: 'Marque ações como favoritas para acompanhamento rápido.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="keyboard-shortcuts"]',
    content: 'Use atalhos de teclado para navegar mais rápido. Pressione ? para ver todos os atalhos.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="drill-down"]',
    content: 'Clique em gráficos e tabelas para ver detalhes e dados relacionados.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="annotations"]',
    content: 'Adicione anotações aos gráficos para marcar eventos e insights importantes.',
    placement: 'bottom',
  },
];

export const GuidedTour: React.FC<GuidedTourProps> = ({
  run = false,
  onComplete,
  onSkip,
  tourType = 'main',
}) => {
  const [runTour, setRunTour] = useState(run);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setRunTour(run);
  }, [run]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRunTour(false);
      setStepIndex(0);
      
      if (status === STATUS.FINISHED && onComplete) {
        onComplete();
      } else if (status === STATUS.SKIPPED && onSkip) {
        onSkip();
      }
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    }
  };

  const steps = tourType === 'main' ? mainTourSteps : advancedTourSteps;

  return (
    <Joyride
      steps={steps}
      run={runTour}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      scrollOffset={100}
      disableOverlayClose
      disableCloseOnEsc={false}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#3b82f6',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '12px',
          fontSize: '14px',
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        buttonNext: {
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: '600',
        },
        buttonBack: {
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          marginRight: '8px',
        },
        buttonSkip: {
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          color: '#64748b',
        },
      }}
      locale={{
        back: 'Voltar',
        close: 'Fechar',
        last: 'Finalizar',
        next: 'Próximo',
        skip: 'Pular Tour',
      }}
    />
  );
};

export default GuidedTour;
