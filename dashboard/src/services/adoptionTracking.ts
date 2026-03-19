/**
 * User Adoption Tracking Service
 *
 * Tracks daily active users, session duration, feature usage,
 * and retention metrics for the B3 Tactical Ranking Dashboard.
 *
 * Requirements: 91.1-91.10
 */

import api from './api';
import { trackAnalytics } from './monitoring';

// ── Constants ──────────────────────────────────────────────

const STORAGE_KEY_DAU = 'adoption_dau';
const STORAGE_KEY_SESSION_START = 'adoption_session_start';
const STORAGE_KEY_FEATURE_LOG = 'adoption_feature_log';
const STORAGE_KEY_FIRST_SEEN = 'adoption_first_seen';
const ADOPTION_ENDPOINT = '/api/analytics/adoption';

// ── Types ──────────────────────────────────────────────────

export interface AdoptionEvent {
  event: string;
  tab?: string;
  component?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  sessionDuration?: number;
}

export interface AdoptionSummary {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDuration: number;
  featureUsageByTab: Record<string, number>;
  retentionRate: { daily: number; weekly: number; monthly: number };
  topFeatures: Array<{ feature: string; count: number }>;
  powerUsers: Array<{ userId: string; sessions: number }>;
}

// ── Session tracking ───────────────────────────────────────

/**
 * Mark the start of a user session.
 * Req 91.1: Track daily active users
 * Req 91.3: Track user session duration
 */
export function startSession(): void {
  const now = Date.now();
  sessionStorage.setItem(STORAGE_KEY_SESSION_START, String(now));

  // Record DAU marker in localStorage (persists across sessions)
  const today = new Date().toISOString().slice(0, 10);
  const dauData = JSON.parse(localStorage.getItem(STORAGE_KEY_DAU) || '{}');
  dauData[today] = (dauData[today] || 0) + 1;
  localStorage.setItem(STORAGE_KEY_DAU, JSON.stringify(dauData));

  // Record first-seen date for retention calculation
  if (!localStorage.getItem(STORAGE_KEY_FIRST_SEEN)) {
    localStorage.setItem(STORAGE_KEY_FIRST_SEEN, today);
  }

  sendAdoptionEvent({ event: 'session_start' });
}

/**
 * End the current session and report duration.
 * Req 91.3: Track user session duration
 */
export function endSession(): void {
  const duration = getSessionDuration();
  if (duration > 0) {
    sendAdoptionEvent({ event: 'session_end', sessionDuration: duration });
  }
  sessionStorage.removeItem(STORAGE_KEY_SESSION_START);
}

/**
 * Get current session duration in seconds.
 */
export function getSessionDuration(): number {
  const start = sessionStorage.getItem(STORAGE_KEY_SESSION_START);
  if (!start) return 0;
  return Math.round((Date.now() - Number(start)) / 1000);
}

// ── Feature usage tracking ─────────────────────────────────

/**
 * Track usage of a specific tab.
 * Req 91.2: Track feature usage by tab and component
 */
export function trackTabUsage(tab: string): void {
  recordFeatureUsage(`tab:${tab}`);
  sendAdoptionEvent({ event: 'tab_view', tab });
}

/**
 * Track usage of a specific component within a tab.
 * Req 91.2: Track feature usage by tab and component
 */
export function trackComponentUsage(tab: string, component: string): void {
  recordFeatureUsage(`${tab}:${component}`);
  sendAdoptionEvent({ event: 'component_usage', tab, component });
}

/**
 * Track adoption of a new feature.
 * Req 91.5: Track feature adoption rate for new features
 */
export function trackNewFeatureAdoption(featureName: string): void {
  recordFeatureUsage(`new_feature:${featureName}`);
  sendAdoptionEvent({ event: 'new_feature_adoption', metadata: { feature: featureName } });
}

/**
 * Record feature usage in local storage for offline aggregation.
 */
function recordFeatureUsage(key: string): void {
  const log: Record<string, number> = JSON.parse(
    localStorage.getItem(STORAGE_KEY_FEATURE_LOG) || '{}'
  );
  log[key] = (log[key] || 0) + 1;
  localStorage.setItem(STORAGE_KEY_FEATURE_LOG, JSON.stringify(log));
}

// ── Retention helpers ──────────────────────────────────────

/**
 * Get local DAU data for retention calculation.
 * Req 91.4: Track user retention rate (daily, weekly, monthly)
 */
export function getLocalRetentionData(): { firstSeen: string; activeDays: string[] } {
  const firstSeen = localStorage.getItem(STORAGE_KEY_FIRST_SEEN) || new Date().toISOString().slice(0, 10);
  const dauData: Record<string, number> = JSON.parse(
    localStorage.getItem(STORAGE_KEY_DAU) || '{}'
  );
  return { firstSeen, activeDays: Object.keys(dauData).sort() };
}

// ── Error & issue tracking ─────────────────────────────────

/**
 * Track a user-reported issue.
 * Req 91.7: Track error rates and user-reported issues
 */
export function trackUserReportedIssue(description: string, category: string): void {
  sendAdoptionEvent({
    event: 'user_reported_issue',
    metadata: { description, category },
  });
}

// ── Performance tracking ───────────────────────────────────

/**
 * Track a performance metric (load time, interaction time).
 * Req 91.8: Track performance metrics (load time, interaction time)
 */
export function trackPerformanceMetric(metric: string, valueMs: number): void {
  sendAdoptionEvent({
    event: 'performance_metric',
    metadata: { metric, valueMs },
  });
}

// ── Reporting ──────────────────────────────────────────────

/**
 * Fetch the adoption summary from the backend.
 * Req 91.9: Generate monthly usage reports
 * Req 91.10: Identify power users and their usage patterns
 */
export async function getAdoptionSummary(days: number = 30): Promise<AdoptionSummary> {
  return api.get(ADOPTION_ENDPOINT, { days: String(days) });
}

// ── Internal helpers ───────────────────────────────────────

function sendAdoptionEvent(partial: Omit<AdoptionEvent, 'timestamp'>): void {
  const event: AdoptionEvent = {
    ...partial,
    timestamp: new Date().toISOString(),
  };

  // Fire-and-forget to analytics backend
  trackAnalytics({
    event_type: 'feature_usage',
    event_data: event as unknown as Record<string, unknown>,
  }).catch(() => {
    // Silently ignore — analytics should never block the user
  });
}
