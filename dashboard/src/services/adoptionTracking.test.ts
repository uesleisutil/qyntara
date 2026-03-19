import {
  startSession,
  endSession,
  getSessionDuration,
  trackTabUsage,
  trackComponentUsage,
  trackNewFeatureAdoption,
  getLocalRetentionData,
  trackUserReportedIssue,
  trackPerformanceMetric,
} from './adoptionTracking';

// Mock monitoring service
jest.mock('./monitoring', () => ({
  trackAnalytics: jest.fn().mockResolvedValue(undefined),
}));

// Mock api service
jest.mock('./api', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({}),
    post: jest.fn().mockResolvedValue({}),
  },
}));

describe('adoptionTracking', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('startSession', () => {
    it('stores session start time in sessionStorage', () => {
      startSession();
      expect(sessionStorage.getItem('adoption_session_start')).toBeTruthy();
    });

    it('records DAU marker in localStorage', () => {
      startSession();
      const dau = JSON.parse(localStorage.getItem('adoption_dau') || '{}');
      expect(dau['2026-03-15']).toBe(1);
    });

    it('increments DAU count for same day', () => {
      startSession();
      startSession();
      const dau = JSON.parse(localStorage.getItem('adoption_dau') || '{}');
      expect(dau['2026-03-15']).toBe(2);
    });

    it('records first-seen date', () => {
      startSession();
      expect(localStorage.getItem('adoption_first_seen')).toBe('2026-03-15');
    });

    it('does not overwrite first-seen date', () => {
      localStorage.setItem('adoption_first_seen', '2026-03-01');
      startSession();
      expect(localStorage.getItem('adoption_first_seen')).toBe('2026-03-01');
    });
  });

  describe('getSessionDuration', () => {
    it('returns 0 when no session started', () => {
      expect(getSessionDuration()).toBe(0);
    });

    it('returns elapsed seconds', () => {
      startSession();
      jest.advanceTimersByTime(5000);
      expect(getSessionDuration()).toBe(5);
    });
  });

  describe('endSession', () => {
    it('clears session start from sessionStorage', () => {
      startSession();
      endSession();
      expect(sessionStorage.getItem('adoption_session_start')).toBeNull();
    });
  });

  describe('trackTabUsage', () => {
    it('records tab usage in localStorage', () => {
      trackTabUsage('recommendations');
      const log = JSON.parse(localStorage.getItem('adoption_feature_log') || '{}');
      expect(log['tab:recommendations']).toBe(1);
    });
  });

  describe('trackComponentUsage', () => {
    it('records component usage in localStorage', () => {
      trackComponentUsage('performance', 'confusion-matrix');
      const log = JSON.parse(localStorage.getItem('adoption_feature_log') || '{}');
      expect(log['performance:confusion-matrix']).toBe(1);
    });
  });

  describe('trackNewFeatureAdoption', () => {
    it('records new feature usage', () => {
      trackNewFeatureAdoption('feedback-widget');
      const log = JSON.parse(localStorage.getItem('adoption_feature_log') || '{}');
      expect(log['new_feature:feedback-widget']).toBe(1);
    });
  });

  describe('getLocalRetentionData', () => {
    it('returns first-seen and active days', () => {
      localStorage.setItem('adoption_first_seen', '2026-03-01');
      localStorage.setItem('adoption_dau', JSON.stringify({ '2026-03-01': 1, '2026-03-05': 2 }));
      const data = getLocalRetentionData();
      expect(data.firstSeen).toBe('2026-03-01');
      expect(data.activeDays).toEqual(['2026-03-01', '2026-03-05']);
    });
  });

  describe('trackUserReportedIssue', () => {
    it('does not throw', () => {
      expect(() => trackUserReportedIssue('broken chart', 'bug')).not.toThrow();
    });
  });

  describe('trackPerformanceMetric', () => {
    it('does not throw', () => {
      expect(() => trackPerformanceMetric('page_load', 1200)).not.toThrow();
    });
  });
});
