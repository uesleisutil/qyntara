import React, { useState } from 'react';
import { CandlestickChart } from '../charts/CandlestickChart';
import { Sparkline } from '../shared/Sparkline';
import { GoalProgressBar } from '../shared/GoalProgressBar';
import { StatusBadge, StatusBadgeLegend } from '../shared/StatusBadge';
import {
  TemporalComparisonProvider,
  TemporalComparisonToggle,
  TemporalKPICard,
} from '../shared/TemporalComparison';
import { TrendingUp, Database, Activity } from 'lucide-react';

/**
 * Example component demonstrating all Task 17 advanced visualizations
 * 
 * This component showcases:
 * - 17.1: Candlestick charts with volume
 * - 17.3: Sparklines in tables
 * - 17.4: Progress bars for goals
 * - 17.6: Status badges
 * - 17.7: Temporal comparison mode
 */
export const AdvancedVisualizationsExample: React.FC = () => {
  // Sample data for candlestick chart
  const priceData = generateSamplePriceData();
  const recommendations = [
    { date: '2024-01-15', score: 8.5 },
    { date: '2024-02-10', score: 9.2 },
  ];

  // Sample goals
  const [goals, setGoals] = useState([
    {
      id: 'return',
      metric: 'Annual Return',
      target: 15,
      current: 12.5,
      unit: '%',
      deadline: '2024-12-31',
      historicalAchievementRate: 75,
    },
    {
      id: 'sharpe',
      metric: 'Sharpe Ratio',
      target: 2.0,
      current: 1.8,
      unit: '',
      deadline: '2024-12-31',
      historicalAchievementRate: 85,
    },
    {
      id: 'accuracy',
      metric: 'Prediction Accuracy',
      target: 70,
      current: 65,
      unit: '%',
      deadline: '2024-12-31',
      historicalAchievementRate: 60,
    },
  ]);

  const handleEditGoal = (goalId: string, newTarget: number) => {
    setGoals(goals.map(g => g.id === goalId ? { ...g, target: newTarget } : g));
  };

  // Sample table data with sparklines
  const tableData = [
    {
      ticker: 'PETR4',
      sector: 'Energy',
      score: 8.5,
      scoreHistory: [7.2, 7.5, 7.8, 8.0, 8.2, 8.3, 8.5],
      returnHistory: [2.1, 2.3, 1.8, 2.5, 2.7, 2.4, 2.6],
      volumeHistory: [1200000, 1350000, 1100000, 1450000, 1500000, 1380000, 1420000],
    },
    {
      ticker: 'VALE3',
      sector: 'Materials',
      score: 7.8,
      scoreHistory: [8.1, 8.0, 7.9, 7.8, 7.7, 7.8, 7.8],
      returnHistory: [1.5, 1.3, 1.2, 1.0, 0.9, 1.1, 1.2],
      volumeHistory: [2100000, 2050000, 2200000, 2150000, 2100000, 2180000, 2200000],
    },
    {
      ticker: 'ITUB4',
      sector: 'Financials',
      score: 9.2,
      scoreHistory: [8.5, 8.7, 8.9, 9.0, 9.1, 9.2, 9.2],
      returnHistory: [3.2, 3.4, 3.5, 3.6, 3.8, 3.9, 4.0],
      volumeHistory: [1800000, 1850000, 1900000, 1950000, 2000000, 2050000, 2100000],
    },
  ];

  // Sample KPI data for temporal comparison
  const kpiData = {
    totalReturn: { current: 12.5, previous: 11.2 },
    sharpeRatio: { current: 1.8, previous: 1.6 },
    accuracy: { current: 65, previous: 62 },
    costs: { current: 1250, previous: 1400 },
  };

  return (
    <TemporalComparisonProvider>
      <div className="advanced-visualizations-example" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '2rem', fontSize: '2rem', fontWeight: 700 }}>
          Advanced Visualizations Demo
        </h1>

        {/* Temporal Comparison Toggle */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>
            17.7: Temporal Comparison Mode
          </h2>
          <TemporalComparisonToggle />
        </section>

        {/* KPI Cards with Temporal Comparison */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>
            KPI Cards with Temporal Comparison
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <TemporalKPICard
              title="Total Return"
              current={kpiData.totalReturn.current}
              previous={kpiData.totalReturn.previous}
              unit="%"
              icon={<TrendingUp size={20} />}
            />
            <TemporalKPICard
              title="Sharpe Ratio"
              current={kpiData.sharpeRatio.current}
              previous={kpiData.sharpeRatio.previous}
              format={(v) => v.toFixed(2)}
            />
            <TemporalKPICard
              title="Accuracy"
              current={kpiData.accuracy.current}
              previous={kpiData.accuracy.previous}
              unit="%"
              icon={<Activity size={20} />}
            />
            <TemporalKPICard
              title="Monthly Costs"
              current={kpiData.costs.current}
              previous={kpiData.costs.previous}
              unit=" USD"
              reverseColors={true}
              icon={<Database size={20} />}
            />
          </div>
        </section>

        {/* Status Badges */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>
            17.6: Status Badges
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <StatusBadge status="good" label="Data Quality" tooltip="All data sources current" />
            <StatusBadge status="no-drift" label="No Drift Detected" tooltip="Model performance stable" />
            <StatusBadge status="excellent" label="Model Performance" tooltip="Exceeding targets" />
            <StatusBadge status="active" label="3 Active Alerts" tooltip="Click to view alerts" onClick={() => alert('View alerts')} />
            <StatusBadge status="warning" label="Stale Data" tooltip="Data is 36 hours old" />
            <StatusBadge status="drift-detected" label="Drift Detected" tooltip="Feature distribution changed" />
            <StatusBadge status="critical" label="Budget Exceeded" tooltip="Over budget by 15%" />
          </div>

          <StatusBadgeLegend
            categories={[
              {
                title: 'Data Quality',
                badges: [
                  { status: 'good', label: 'Good', description: 'All data complete and current' },
                  { status: 'warning', label: 'Warning', description: 'Some data issues detected' },
                  { status: 'critical', label: 'Critical', description: 'Significant data quality problems' },
                ],
              },
              {
                title: 'Drift Detection',
                badges: [
                  { status: 'no-drift', label: 'No Drift', description: 'Model inputs and performance stable' },
                  { status: 'drift-detected', label: 'Drift Detected', description: 'Distribution or concept drift identified' },
                ],
              },
              {
                title: 'Model Performance',
                badges: [
                  { status: 'excellent', label: 'Excellent', description: 'Exceeding performance targets' },
                  { status: 'good', label: 'Good', description: 'Meeting performance targets' },
                  { status: 'fair', label: 'Fair', description: 'Below targets but acceptable' },
                  { status: 'poor', label: 'Poor', description: 'Significantly below targets' },
                ],
              },
            ]}
          />
        </section>

        {/* Progress Bars for Goals */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>
            17.4: Progress Bars for Goals
          </h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {goals.map(goal => (
              <GoalProgressBar
                key={goal.id}
                goal={goal}
                onEditTarget={handleEditGoal}
                editable={true}
              />
            ))}
          </div>
        </section>

        {/* Sparklines in Table */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>
            17.3: Sparklines in Tables
          </h2>
          <div style={{ 
            background: 'white', 
            border: '1px solid #e5e7eb', 
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Ticker</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Sector</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>Score</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>Score Trend</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>Return Trend</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>Volume Trend</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, idx) => (
                  <tr key={row.ticker} style={{ borderBottom: idx < tableData.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{row.ticker}</td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>{row.sector}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>{row.score.toFixed(1)}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <Sparkline 
                        data={row.scoreHistory} 
                        width={100} 
                        height={30}
                        label="Score"
                        dates={['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']}
                      />
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <Sparkline 
                        data={row.returnHistory} 
                        width={100} 
                        height={30}
                        label="Return %"
                        dates={['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']}
                      />
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <Sparkline 
                        data={row.volumeHistory} 
                        width={100} 
                        height={30}
                        label="Volume"
                        dates={['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Candlestick Chart */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>
            17.1: Candlestick Chart with Volume
          </h2>
          <div style={{ 
            background: 'white', 
            border: '1px solid #e5e7eb', 
            borderRadius: '8px',
            padding: '1.5rem',
          }}>
            <CandlestickChart
              data={priceData}
              recommendations={recommendations}
              width={1200}
              height={600}
              showMovingAverages={true}
              movingAveragePeriods={[20, 50, 200]}
            />
          </div>
        </section>

        {/* Implementation Notes */}
        <section style={{ 
          marginTop: '3rem', 
          padding: '1.5rem', 
          background: '#f8fafc', 
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}>
          <h3 style={{ marginTop: 0, fontSize: '1.25rem', fontWeight: 600 }}>
            Implementation Notes
          </h3>
          <ul style={{ marginBottom: 0, paddingLeft: '1.5rem', color: '#64748b' }}>
            <li><strong>17.1 Candlestick Charts:</strong> D3.js-based with OHLC prices, volume bars, moving averages, zoom/pan, and recommendation markers</li>
            <li><strong>17.3 Sparklines:</strong> Enhanced with hover tooltips, trend-based coloring, and 30-day data display</li>
            <li><strong>17.4 Progress Bars:</strong> Auto-colored based on progress (green/yellow/red), editable targets, historical achievement rates</li>
            <li><strong>17.6 Status Badges:</strong> Multiple status types, icons, tooltips, clickable actions, and comprehensive legend</li>
            <li><strong>17.7 Temporal Comparison:</strong> Context-based with period selector, side-by-side values, percentage/absolute changes, and color-coded indicators</li>
          </ul>
        </section>
      </div>
    </TemporalComparisonProvider>
  );
};

// Helper function to generate sample price data
function generateSamplePriceData() {
  const data = [];
  const startDate = new Date('2024-01-01');
  let price = 100;

  for (let i = 0; i < 180; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (Math.random() - 0.5) * 4;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    const volume = Math.floor(1000000 + Math.random() * 500000);

    data.push({
      date: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });

    price = close;
  }

  return data;
}
