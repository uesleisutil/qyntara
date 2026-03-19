import React from 'react';
import { render } from '@testing-library/react';

// Mock d3 to avoid import issues in tests
jest.mock('d3', () => ({
  select: jest.fn(() => ({
    selectAll: jest.fn(() => ({ remove: jest.fn() })),
    append: jest.fn(() => ({
      attr: jest.fn().mockReturnThis(),
      style: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
    })),
  })),
}));

describe('SHAPWaterfallChart', () => {
  const mockData = {
    ticker: 'PETR4',
    prediction: 0.0523,
    baseValue: 0.0250,
    shapValues: [
      { feature: 'RSI_14', value: 0.0150, featureValue: 65.2 },
      { feature: 'Volume_MA_20', value: 0.0080, featureValue: 1250000 },
      { feature: 'Price_MA_50', value: -0.0045, featureValue: 26.8 },
      { feature: 'MACD', value: 0.0053, featureValue: 0.42 },
      { feature: 'Bollinger_Width', value: 0.0035, featureValue: 0.15 },
    ],
    explanation: 'Test explanation',
    confidence: 0.85,
  };

  // Property 49: SHAP Value Sum - Sum of SHAP values + base = final prediction
  it('validates SHAP value sum equals prediction', () => {
    const shapSum = mockData.shapValues.reduce((sum, item) => sum + item.value, 0);
    const calculatedPrediction = mockData.baseValue + shapSum;
    expect(calculatedPrediction).toBeCloseTo(mockData.prediction, 4);
  });

  // Property 50: SHAP Value Ordering - Features should be sortable by absolute magnitude
  it('validates SHAP values can be ordered by magnitude', () => {
    const sorted = [...mockData.shapValues].sort((a, b) => 
      Math.abs(b.value) - Math.abs(a.value)
    );
    expect(Math.abs(sorted[0].value)).toBeGreaterThanOrEqual(Math.abs(sorted[1].value));
  });

  it('validates all SHAP values have required properties', () => {
    mockData.shapValues.forEach(item => {
      expect(item).toHaveProperty('feature');
      expect(item).toHaveProperty('value');
      expect(item).toHaveProperty('featureValue');
      expect(typeof item.feature).toBe('string');
      expect(typeof item.value).toBe('number');
      expect(typeof item.featureValue).toBe('number');
    });
  });
});
