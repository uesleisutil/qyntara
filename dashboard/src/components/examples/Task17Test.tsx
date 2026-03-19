/**
 * Simple test file to verify Task 17 components compile correctly
 */
import React from 'react';
import { CandlestickChart } from '../charts/CandlestickChart';
import { Sparkline } from '../shared/Sparkline';
import { ProgressBar } from '../shared/ProgressBar';
import { GoalProgressBar } from '../shared/GoalProgressBar';
import { StatusBadge } from '../shared/StatusBadge';
import {
  TemporalComparisonProvider,
  TemporalComparisonToggle,
  TemporalKPICard,
} from '../shared/TemporalComparison';

export const Task17Test: React.FC = () => {
  // Test data
  const priceData = [
    { date: '2024-01-01', open: 100, high: 105, low: 98, close: 103, volume: 1000000 },
    { date: '2024-01-02', open: 103, high: 107, low: 102, close: 106, volume: 1200000 },
  ];

  const sparklineData = [1, 2, 3, 4, 5];

  const goal = {
    id: 'test',
    metric: 'Test Metric',
    target: 100,
    current: 75,
    unit: '%',
  };

  return (
    <TemporalComparisonProvider>
      <div style={{ padding: '2rem' }}>
        <h1>Task 17 Components Test</h1>

        <section>
          <h2>17.1: Candlestick Chart</h2>
          <CandlestickChart data={priceData} width={800} height={400} />
        </section>

        <section>
          <h2>17.3: Sparkline</h2>
          <Sparkline data={sparklineData} width={100} height={30} />
        </section>

        <section>
          <h2>17.4: Progress Bar</h2>
          <ProgressBar value={75} max={100} label="Test Progress" />
          <GoalProgressBar goal={goal} editable={false} />
        </section>

        <section>
          <h2>17.6: Status Badge</h2>
          <StatusBadge status="success" label="Test Badge" />
        </section>

        <section>
          <h2>17.7: Temporal Comparison</h2>
          <TemporalComparisonToggle />
          <TemporalKPICard title="Test KPI" current={100} previous={90} />
        </section>
      </div>
    </TemporalComparisonProvider>
  );
};
