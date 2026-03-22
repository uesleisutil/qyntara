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

const steps: Step[] = [
  {
    target: '.rec-table-desktop, .rec-cards-mobile',
    content: '📊 Esta é sua tabela de recomendações. Cada linha é uma ação da B3 analisada pelo modelo de ML. Colunas com cadeado são exclusivas Pro.',
    title: 'Recomendações do Dia',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '[data-tour="kpi-strip"]',
    content: '📈 Aqui você vê o resumo do dia: quantas ações com sinal de Compra, Venda, retorno médio e o top score.',
    title: 'KPIs do Dia',
    placement: 'bottom',
  },
  {
    target: '[data-tour="search-bar"]',
    content: '🔍 Use a busca para encontrar um ticker específico, filtrar por sinal ou ordenar por diferentes critérios.',
    title: 'Busca e Filtros',
    placement: 'bottom',
  },
  {
    target: '[data-tour="highlight-card"]',
    content: '🏆 O destaque do dia mostra a ação com maior score. Clique para ver a explicabilidade completa.',
    title: 'Destaque do Dia',
    placement: 'bottom',
  },
  {
    target: '[data-tour="nav-explainability"]',
    content: '🧠 Na Explicabilidade, você entende POR QUE o modelo recomendou cada ação — gráficos SHAP, sensibilidade e texto.',
    title: 'Explicabilidade',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-backtesting"]',
    content: '🧪 No Backtesting, simule como uma carteira teria performado com dados reais. Configure capital, ações e período.',
    title: 'Backtesting',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-pro"]',
    content: '👑 Recursos Pro incluem Tracking por Safra, Carteira Modelo otimizada, stop-loss e take-profit desbloqueados.',
    title: 'Recursos Pro',
    placement: 'right',
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
          primaryColor: '#3b82f6',
          backgroundColor: darkMode ? '#1e293b' : '#fff',
          textColor: darkMode ? '#f1f5f9' : '#0f172a',
          arrowColor: darkMode ? '#1e293b' : '#fff',
          overlayColor: 'rgba(0,0,0,0.5)',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 12,
          fontSize: '0.85rem',
          padding: '1rem 1.25rem',
        },
        tooltipTitle: {
          fontSize: '1rem',
          fontWeight: 700,
        },
        buttonNext: {
          borderRadius: 8,
          fontSize: '0.82rem',
          fontWeight: 600,
          padding: '0.5rem 1rem',
        },
        buttonBack: {
          color: darkMode ? '#94a3b8' : '#64748b',
          fontSize: '0.82rem',
        },
        buttonSkip: {
          color: darkMode ? '#64748b' : '#94a3b8',
          fontSize: '0.75rem',
        },
      }}
    />
  );
};

export default GuidedTour;
