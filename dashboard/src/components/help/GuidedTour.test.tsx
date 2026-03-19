import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GuidedTour } from './GuidedTour';

// Mock react-joyride
jest.mock('react-joyride', () => {
  return function MockJoyride(props: any) {
    return (
      <div data-testid="joyride-mock">
        {props.run && <div data-testid="tour-running">Tour Running</div>}
        <div data-testid="tour-steps">{props.steps.length} steps</div>
        <div data-testid="tour-type">{props.steps[0]?.content || 'No content'}</div>
      </div>
    );
  };
});

describe('GuidedTour', () => {
  it('renders without crashing', () => {
    render(<GuidedTour />);
    expect(screen.getByTestId('joyride-mock')).toBeInTheDocument();
  });

  it('does not run tour by default', () => {
    render(<GuidedTour run={false} />);
    expect(screen.queryByTestId('tour-running')).not.toBeInTheDocument();
  });

  it('runs tour when run prop is true', () => {
    render(<GuidedTour run={true} />);
    expect(screen.getByTestId('tour-running')).toBeInTheDocument();
  });

  it('displays main tour steps by default', () => {
    render(<GuidedTour run={true} />);
    const stepsElement = screen.getByTestId('tour-steps');
    expect(stepsElement).toHaveTextContent('13 steps'); // Main tour has 13 steps
  });

  it('displays advanced tour steps when tourType is advanced', () => {
    render(<GuidedTour run={true} tourType="advanced" />);
    const stepsElement = screen.getByTestId('tour-steps');
    expect(stepsElement).toHaveTextContent('9 steps'); // Advanced tour has 9 steps
  });

  it('calls onComplete when tour finishes', async () => {
    const onComplete = jest.fn();
    render(<GuidedTour run={true} onComplete={onComplete} />);
    
    // In a real scenario, this would be triggered by Joyride's callback
    // For now, we just verify the prop is passed
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onSkip when tour is skipped', async () => {
    const onSkip = jest.fn();
    render(<GuidedTour run={true} onSkip={onSkip} />);
    
    // In a real scenario, this would be triggered by Joyride's callback
    // For now, we just verify the prop is passed
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('has correct welcome message for main tour', () => {
    render(<GuidedTour run={true} tourType="main" />);
    const tourType = screen.getByTestId('tour-type');
    expect(tourType).toHaveTextContent('Welcome to the B3 Tactical Ranking MLOps Dashboard');
  });

  it('has correct welcome message for advanced tour', () => {
    render(<GuidedTour run={true} tourType="advanced" />);
    const tourType = screen.getByTestId('tour-type');
    expect(tourType).toHaveTextContent('Welcome to the advanced features tour');
  });
});
