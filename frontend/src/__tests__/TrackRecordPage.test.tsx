import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrackRecordPage } from '../pages/TrackRecordPage';

vi.mock('../hooks/useApi', () => ({
  useApi: () => ({
    data: {
      total_signals: 50, resolved: 30, correct: 21, accuracy: 0.7,
      by_direction: {
        YES: { total: 20, correct: 15, accuracy: 0.75 },
        NO: { total: 10, correct: 6, accuracy: 0.6 },
      },
      recent: [],
    },
    loading: false, error: null, refresh: vi.fn(),
  }),
  apiFetch: vi.fn(),
}));

vi.mock('../config', () => ({ API_BASE: 'http://localhost:8000' }));

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: any) => {
    const state = { user: { id: '1', email: 'test@test.com', tier: 'pro', name: 'Test' }, accessToken: 'token' };
    return selector(state);
  },
}));

describe('TrackRecordPage', () => {
  it('renders accuracy stats', () => {
    render(<TrackRecordPage onAuthRequired={() => {}} />);
    expect(screen.getByText('Track Record')).toBeTruthy();
    expect(screen.getByText('70.0%')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText('21')).toBeTruthy();
  });

  it('renders direction breakdown', () => {
    render(<TrackRecordPage onAuthRequired={() => {}} />);
    expect(screen.getByText('YES')).toBeTruthy();
    expect(screen.getByText('NO')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy();
  });
});
