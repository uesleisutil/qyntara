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
    content: 'Bem-vindo ao Qyntara! Vamos fazer um tour rápido pelas principais funcionalidades.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="nav-mydashboard"]',
    content: 'Seu painel pessoal com destaque do dia, posições, novidades, alertas de preço e comparador de ações. Personalize os widgets como quiser.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-recommendations"]',
    content: 'Todas as ações da B3 ranqueadas pelo modelo de ML. Veja scores, sinais de compra/venda, retorno esperado e volatilidade.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-explainability"]',
    content: 'Entenda por que o modelo recomendou cada ação — gráficos de contribuição dos fatores, análise de sensibilidade e explicação em texto.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-backtesting"]',
    content: 'Simule como uma carteira teria performado usando recomendações passadas. Configure capital, número de ações e período.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-performance"]',
    content: 'Métricas de acurácia do modelo: MAPE, Sharpe, correlação, taxa de acerto e comparação com benchmarks.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-pro"]',
    content: 'Recursos exclusivos Pro: Acompanhamento por Safra, Carteira Modelo otimizada, stop-loss e take-profit.',
    placement: 'right',
  },
  {
    target: '[data-tour="notification-center"]',
    content: 'Alertas sobre mudanças de sinal, drift do modelo e anomalias nos dados.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="theme-toggle"]',
    content: 'Alterne entre modo claro e escuro conforme sua preferência.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="help-menu"]',
    content: 'Acesse ajuda, FAQ, glossário e reinicie este tour a qualquer momento.',
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
    target: '[data-tour="kpi-strip"]',
    content: 'Resumo do dia: quantas ações com sinal de Compra, Venda, retorno médio e o top score.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="search-bar"]',
    content: 'Use a busca para encontrar um ticker específico, filtrar por sinal ou ordenar por diferentes critérios.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="filters"]',
    content: 'Refine as recomendações por setor, retorno esperado e score mínimo.',
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
    target: '[data-tour="favorites"]',
    content: 'Marque ações como favoritas para acompanhamento rápido.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="keyboard-shortcuts"]',
    content: 'Use atalhos de teclado para navegar mais rápido. Pressione ? para ver todos os atalhos.',
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

  useEffect(() => { setRunTour(run); }, [run]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;
    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRunTour(false);
      setStepIndex(0);
      if (status === STATUS.FINISHED && onComplete) onComplete();
      else if (status === STATUS.SKIPPED && onSkip) onSkip();
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
        options: { primaryColor: '#3b82f6', zIndex: 10000 },
        tooltip: { borderRadius: '12px', fontSize: '14px' },
        tooltipContainer: { textAlign: 'left' as const },
        buttonNext: { borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: '600' },
        buttonBack: { borderRadius: '8px', padding: '8px 16px', fontSize: '14px', marginRight: '8px' },
        buttonSkip: { borderRadius: '8px', padding: '8px 16px', fontSize: '14px', color: '#64748b' },
      }}
      locale={{ back: 'Voltar', close: 'Fechar', last: 'Finalizar', next: 'Próximo', skip: 'Pular Tour' }}
    />
  );
};

export default GuidedTour;
