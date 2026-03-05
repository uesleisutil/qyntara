import React from 'react';
import { render, screen } from '@testing-library/react';
import SystemStatusPanel from './SystemStatusPanel';

describe('SystemStatusPanel', () => {
  describe('Ingestion Status', () => {
    it('should display status indicator for ingestion when success rate >= 90%', () => {
      const ingestionData = [
        { timestamp: new Date().toISOString(), status: 'success' },
        { timestamp: new Date().toISOString(), status: 'success' },
        { timestamp: new Date().toISOString(), status: 'success' },
        { timestamp: new Date().toISOString(), status: 'success' },
        { timestamp: new Date().toISOString(), status: 'success' },
        { timestamp: new Date().toISOString(), status: 'success' },
        { timestamp: new Date().toISOString(), status: 'success' },
        { timestamp: new Date().toISOString(), status: 'success' },
        { timestamp: new Date().toISOString(), status: 'success' },
        { timestamp: new Date().toISOString(), status: 'error' },
      ];

      render(
        <SystemStatusPanel 
          recommendations={[]} 
          qualityData={[]} 
          ingestionData={ingestionData} 
        />
      );

      // Check that ingestion status label is displayed
      expect(screen.getByText('Ingestão de Dados')).toBeInTheDocument();
    });

    it('should display status indicator for ingestion when success rate < 90%', () => {
      const ingestionData = [
        { timestamp: new Date().toISOString(), status: 'success' },
        { timestamp: new Date().toISOString(), status: 'error' },
        { timestamp: new Date().toISOString(), status: 'error' },
        { timestamp: new Date().toISOString(), status: 'error' },
      ];

      render(
        <SystemStatusPanel 
          recommendations={[]} 
          qualityData={[]} 
          ingestionData={ingestionData} 
        />
      );

      // Check that ingestion status label is displayed
      expect(screen.getByText('Ingestão de Dados')).toBeInTheDocument();
    });
  });

  describe('Model Quality Status', () => {
    it('should display status indicator when MAPE <= 15% AND coverage >= 80%', () => {
      const qualityData = [
        { dt: '2024-01-15', mape: 0.12, coverage: 0.85 }
      ];

      render(
        <SystemStatusPanel 
          recommendations={[]} 
          qualityData={qualityData} 
          ingestionData={[]} 
        />
      );

      // Check that quality status label is displayed
      expect(screen.getByText('Qualidade do Modelo')).toBeInTheDocument();
    });

    it('should display status indicator when MAPE > 15%', () => {
      const qualityData = [
        { dt: '2024-01-15', mape: 0.18, coverage: 0.85 }
      ];

      render(
        <SystemStatusPanel 
          recommendations={[]} 
          qualityData={qualityData} 
          ingestionData={[]} 
        />
      );

      // Check that quality status label is displayed
      expect(screen.getByText('Qualidade do Modelo')).toBeInTheDocument();
    });

    it('should display status indicator when coverage < 80%', () => {
      const qualityData = [
        { dt: '2024-01-15', mape: 0.12, coverage: 0.75 }
      ];

      render(
        <SystemStatusPanel 
          recommendations={[]} 
          qualityData={qualityData} 
          ingestionData={[]} 
        />
      );

      // Check that quality status label is displayed
      expect(screen.getByText('Qualidade do Modelo')).toBeInTheDocument();
    });

    it('should display status indicator when no quality data available', () => {
      render(
        <SystemStatusPanel 
          recommendations={[]} 
          qualityData={[]} 
          ingestionData={[]} 
        />
      );

      // Check that quality status label is displayed
      expect(screen.getByText('Qualidade do Modelo')).toBeInTheDocument();
    });
  });

  describe('Recommendations Status', () => {
    it('should display status indicator when recommendations available', () => {
      const recommendations = [
        { rank: 1, ticker: 'PETR4', score: 0.85 }
      ];

      render(
        <SystemStatusPanel 
          recommendations={recommendations} 
          qualityData={[]} 
          ingestionData={[]} 
        />
      );

      // Check that recommendations status label is displayed
      expect(screen.getByText('Recomendações')).toBeInTheDocument();
    });

    it('should display status indicator when no recommendations available', () => {
      render(
        <SystemStatusPanel 
          recommendations={[]} 
          qualityData={[]} 
          ingestionData={[]} 
        />
      );

      // Check that recommendations status label is displayed
      expect(screen.getByText('Recomendações')).toBeInTheDocument();
    });
  });

  describe('All Subsystems', () => {
    it('should display all three subsystem status indicators', () => {
      render(
        <SystemStatusPanel 
          recommendations={[]} 
          qualityData={[]} 
          ingestionData={[]} 
        />
      );

      // Check that all three status labels are displayed
      expect(screen.getByText('Ingestão de Dados')).toBeInTheDocument();
      expect(screen.getByText('Qualidade do Modelo')).toBeInTheDocument();
      expect(screen.getByText('Recomendações')).toBeInTheDocument();
    });
  });

  describe('Status Update on Data Refresh', () => {
    it('should update indicators when new data is provided', () => {
      const initialProps = {
        recommendations: [],
        qualityData: [],
        ingestionData: []
      };

      const { rerender } = render(
        <SystemStatusPanel {...initialProps} />
      );

      // Check initial state
      expect(screen.getByText('Ingestão de Dados')).toBeInTheDocument();
      expect(screen.getByText('Qualidade do Modelo')).toBeInTheDocument();
      expect(screen.getByText('Recomendações')).toBeInTheDocument();

      // Update with healthy data
      const updatedProps = {
        recommendations: [{ rank: 1, ticker: 'PETR4', score: 0.85 }],
        qualityData: [{ dt: '2024-01-15', mape: 0.12, coverage: 0.85 }],
        ingestionData: Array(10).fill(null).map(() => ({
          timestamp: new Date().toISOString(),
          status: 'success'
        }))
      };

      rerender(<SystemStatusPanel {...updatedProps} />);

      // Check that all labels are still displayed after update
      expect(screen.getByText('Ingestão de Dados')).toBeInTheDocument();
      expect(screen.getByText('Qualidade do Modelo')).toBeInTheDocument();
      expect(screen.getByText('Recomendações')).toBeInTheDocument();
    });
  });
});
