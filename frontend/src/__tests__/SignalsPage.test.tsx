import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignalsPage } from '../pages/SignalsPage';

vi.mock('../hooks/useApi', () => ({
  useApi: () => ({
    data: {
      signals: [
        {
          market_id: 'm1', source: 'polymarket', question: 'Test signal?',
          yes_price: 0.65, ai_estimated_price: 0.78, edge: 0.13,
          volume_24h: 5000, signal_score: 0.26, signal_type: 'ai_edge',
          direction: 'YES', is_anomaly: false, anomaly_score: 0.5,
        },
      ],
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  apiFetch: vi.fn(),
}));

vi.mock('../config', () => ({ API_BASE: 'http://localhost:8000' }));

// Mock auth store with Pro user
vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: any) => {
    const state = {
      user: { id: '1', email: 'test@test.com', tier: 'pro', name: 'Test' },
      accessToken: 'token',
    };
    return selector(state);
  },
}));

describe('SignalsPage', () => {
  it('renders signals for Pro user', () => {
    render(<SignalsPage onAuthRequired={() => {}} />);
    expect(screen.getByText('Sinais de IA')).toBeTruthy();
    expect(screen.getByText('Test signal?')).toBeTruthy();
    expect(screen.getByText('YES')).toBeTruthy();
  });

  it('shows AI edge data', () => {
    render(<SignalsPage onAuthRequired={() => {}} />);
    expect(screen.getByText('+13.0%')).toBeTruthy();
    expect(screen.getByText('edge')).toBeTruthy();
  });

  it('shows model trained label', () => {
    render(<SignalsPage onAuthRequired={() => {}} />);
    expect(screen.getByText(/Modelo treinado/)).toBeTruthy();
  });
});
