/**
 * RetrainingRecommendations Component Tests
 * 
 * Tests Requirements:
 * - 28.1: Generate retraining recommendations
 * - 28.2: Recommend when > 30% features drifted
 * - 28.3: Recommend when concept drift detected
 * - 28.4: Recommend when degradation persists > 7 days
 * - 28.5: Display priority levels
 * - 28.6: Estimate expected improvement
 * - 28.7: Display time since last training
 * - 28.8: Provide retraining checklist
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RetrainingRecommendations } from './RetrainingRecommendations';

describe('RetrainingRecommendations', () => {
  describe('No Recommendation State', () => {
    it('should display no recommendation message when no triggers are active', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={0}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('No Retraining Required')).toBeInTheDocument();
      expect(screen.getByText('Model performance is stable. No significant drift or degradation detected.')).toBeInTheDocument();
    });

    it('should display time since last training in no recommendation state', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={0}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={45}
        />
      );

      expect(screen.getByText(/Last trained:/)).toBeInTheDocument();
    });
  });

  describe('Data Drift Trigger (Req 28.2)', () => {
    it('should recommend retraining when > 30% features drifted', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('Model Retraining Recommended')).toBeInTheDocument();
      expect(screen.getByText(/35.0% of features have drifted/)).toBeInTheDocument();
    });

    it('should set medium priority for 30-40% drift', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    });

    it('should set high priority for 40-50% drift', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={45}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('should set critical priority for > 50% drift', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={55}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });
  });

  describe('Concept Drift Trigger (Req 28.3)', () => {
    it('should recommend retraining when concept drift detected', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={0}
          conceptDriftDetected={true}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('Model Retraining Recommended')).toBeInTheDocument();
      expect(screen.getByText(/concept drift detected/)).toBeInTheDocument();
    });

    it('should set high priority for concept drift', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={0}
          conceptDriftDetected={true}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });
  });

  describe('Performance Degradation Trigger (Req 28.4)', () => {
    it('should recommend retraining when degradation persists > 7 days', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={0}
          conceptDriftDetected={false}
          performanceDegradationDays={10}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('Model Retraining Recommended')).toBeInTheDocument();
      expect(screen.getByText(/Performance degradation has persisted for 10 days/)).toBeInTheDocument();
    });

    it('should set high priority for 7-14 days degradation', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={0}
          conceptDriftDetected={false}
          performanceDegradationDays={10}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('should set critical priority for > 14 days degradation', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={0}
          conceptDriftDetected={false}
          performanceDegradationDays={15}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });
  });

  describe('Priority Display (Req 28.5)', () => {
    it('should display priority badge', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    });

    it('should display correct priority for multiple triggers', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={true}
          performanceDegradationDays={10}
          daysSinceLastTraining={30}
        />
      );

      // Highest priority should be displayed (high from concept drift and degradation)
      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });
  });

  describe('Expected Improvement (Req 28.6)', () => {
    it('should display expected improvement estimate', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('Expected Improvement')).toBeInTheDocument();
      expect(screen.getByText(/\+\d+\.\d+%/)).toBeInTheDocument();
    });

    it('should cap expected improvement at 25%', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={100}
          conceptDriftDetected={true}
          performanceDegradationDays={30}
          daysSinceLastTraining={30}
        />
      );

      const improvementText = screen.getByText(/\+\d+\.\d+%/);
      const improvement = parseFloat(improvementText.textContent?.replace(/[+%]/g, '') || '0');
      expect(improvement).toBeLessThanOrEqual(25);
    });
  });

  describe('Time Since Last Training (Req 28.7)', () => {
    it('should display days since last training', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={45}
        />
      );

      expect(screen.getByText('Last Training')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
    });

    it('should format time correctly for different durations', () => {
      const { rerender } = render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={1}
        />
      );

      expect(screen.getByText('1 day ago')).toBeInTheDocument();

      rerender(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={14}
        />
      );

      expect(screen.getByText('2 weeks ago')).toBeInTheDocument();
    });
  });

  describe('Retraining Checklist (Req 28.8)', () => {
    it('should display retraining checklist', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('Retraining Checklist')).toBeInTheDocument();
    });

    it('should toggle checklist visibility when clicked', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      const checklistHeader = screen.getByText('Retraining Checklist').closest('div');
      
      // Initially collapsed
      expect(screen.queryByText('Review drift analysis and identify affected features')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(checklistHeader!);
      expect(screen.getByText('Review drift analysis and identify affected features')).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(checklistHeader!);
      expect(screen.queryByText('Review drift analysis and identify affected features')).not.toBeInTheDocument();
    });

    it('should toggle checklist items when clicked', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      // Expand checklist
      const checklistHeader = screen.getByText('Retraining Checklist').closest('div');
      fireEvent.click(checklistHeader!);

      // Find first checklist item
      const firstItem = screen.getByText('Review drift analysis and identify affected features').closest('div');
      
      // Click to complete
      fireEvent.click(firstItem!);
      
      // Progress should update (0/8 -> 1/8)
      expect(screen.getByText('1 / 8')).toBeInTheDocument();
    });

    it('should display progress bar', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('0 / 8')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should add extra checklist item for concept drift', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={0}
          conceptDriftDetected={true}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
        />
      );

      // Expand checklist
      const checklistHeader = screen.getByText('Retraining Checklist').closest('div');
      fireEvent.click(checklistHeader!);

      // Should have 9 items instead of 8 (extra item for concept drift)
      expect(screen.getByText('0 / 9')).toBeInTheDocument();
      expect(screen.getByText('Review and update model architecture if needed')).toBeInTheDocument();
    });
  });

  describe('Multiple Triggers', () => {
    it('should display all active triggers', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={true}
          performanceDegradationDays={10}
          daysSinceLastTraining={30}
        />
      );

      expect(screen.getByText('3')).toBeInTheDocument(); // 3 active triggers
      expect(screen.getByText('Retraining conditions met')).toBeInTheDocument();
    });

    it('should display reason with all triggers', () => {
      render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={true}
          performanceDegradationDays={10}
          daysSinceLastTraining={30}
        />
      );

      const reason = screen.getByText(/Model retraining recommended due to:/);
      expect(reason).toBeInTheDocument();
      expect(reason.textContent).toContain('35.0% of features have drifted');
      expect(reason.textContent).toContain('concept drift detected');
      expect(reason.textContent).toContain('performance degraded for 10 days');
    });
  });

  describe('Dark Mode', () => {
    it('should render correctly in dark mode', () => {
      const { container } = render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
          darkMode={true}
        />
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Mobile Layout', () => {
    it('should render correctly in mobile layout', () => {
      const { container } = render(
        <RetrainingRecommendations
          driftedFeaturesPercentage={35}
          conceptDriftDetected={false}
          performanceDegradationDays={0}
          daysSinceLastTraining={30}
          isMobile={true}
        />
      );

      expect(container).toBeInTheDocument();
    });
  });
});
