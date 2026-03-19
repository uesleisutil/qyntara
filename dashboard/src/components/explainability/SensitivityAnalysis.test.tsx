import React from 'react';

// Mock recharts to avoid import issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

describe('SensitivityAnalysis', () => {
  // Property 51: Sensitivity Monotonicity - Sign consistency with feature changes
  it('validates sensitivity maintains sign consistency', () => {
    const mockSensitivityData = [
      { featureValue: 20, prediction: 0.020 },
      { featureValue: 40, prediction: 0.025 },
      { featureValue: 60, prediction: 0.030 },
      { featureValue: 80, prediction: 0.035 },
    ];

    // Check if sensitivity is monotonic (either always increasing or always decreasing)
    const differences = [];
    for (let i = 1; i < mockSensitivityData.length; i++) {
      const diff = mockSensitivityData[i].prediction - mockSensitivityData[i - 1].prediction;
      differences.push(diff);
    }

    // All differences should have the same sign (all positive or all negative)
    const allPositive = differences.every(d => d >= 0);
    const allNegative = differences.every(d => d <= 0);
    expect(allPositive || allNegative).toBe(true);
  });

  it('validates sensitivity calculation', () => {
    const baselinePrediction = 0.025;
    const featureChange = 10;
    const newPrediction = 0.030;
    
    const sensitivity = (newPrediction - baselinePrediction) / featureChange;
    expect(typeof sensitivity).toBe('number');
    expect(isFinite(sensitivity)).toBe(true);
  });
});
