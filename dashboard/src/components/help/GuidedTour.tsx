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
    content: 'Welcome to the B3 Tactical Ranking MLOps Dashboard! Let\'s take a quick tour of the key features.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="tabs"]',
    content: 'Navigate between different sections using these tabs. Each tab provides specific insights into your ML models and recommendations.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="recommendations-tab"]',
    content: 'The Recommendations tab shows current stock recommendations with expected returns and scores.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="performance-tab"]',
    content: 'View model performance metrics, including accuracy, MAPE, and Sharpe ratio in the Performance tab.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="validation-tab"]',
    content: 'The Validation tab helps you analyze prediction accuracy with scatter plots and temporal analysis.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="costs-tab"]',
    content: 'Monitor AWS costs and optimize spending in the Costs tab.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="data-quality-tab"]',
    content: 'Track data completeness, anomalies, and freshness in the Data Quality tab.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="drift-tab"]',
    content: 'Detect data and concept drift to identify when models need retraining.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="explainability-tab"]',
    content: 'Understand model predictions with SHAP values and feature importance.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="backtesting-tab"]',
    content: 'Simulate portfolio performance using historical recommendations.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="notification-center"]',
    content: 'Check alerts and notifications here. You\'ll receive updates about drift, anomalies, and performance issues.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="theme-toggle"]',
    content: 'Toggle between light and dark mode for comfortable viewing.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="help-menu"]',
    content: 'Access help resources, FAQ, glossary, and restart this tour anytime from the help menu.',
    placement: 'bottom',
  },
];

const advancedTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to the advanced features tour! Let\'s explore powerful capabilities for in-depth analysis.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="filters"]',
    content: 'Use filters to narrow down recommendations by sector, return range, and minimum score.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="export-button"]',
    content: 'Export data to CSV or Excel for offline analysis and reporting.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="comparison-mode"]',
    content: 'Enable comparison mode to analyze multiple tickers side-by-side.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="temporal-comparison"]',
    content: 'Toggle temporal comparison to see how metrics have changed over time.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="favorites"]',
    content: 'Mark tickers as favorites for quick access and monitoring.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="keyboard-shortcuts"]',
    content: 'Use keyboard shortcuts for faster navigation. Press ? to see all available shortcuts.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="drill-down"]',
    content: 'Click on charts and tables to drill down into detailed views and related data.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="annotations"]',
    content: 'Add annotations to charts to mark important events and insights.',
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
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip Tour',
      }}
    />
  );
};

export default GuidedTour;
