/**
 * Monitoring Service
 * 
 * Frontend monitoring and observability service.
 * Tracks performance metrics, user behavior, and integrates with Sentry for error tracking.
 * 
 * Requirements: 83.6, 83.11, 76.5
 */

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import api from './api';

// Configuration
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const SENTRY_ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || 'development';
const SENTRY_SAMPLE_RATE = parseFloat(import.meta.env.VITE_SENTRY_SAMPLE_RATE || '1.0');
const ANALYTICS_ENDPOINT = '/api/analytics/track';

// Performance metrics interface
interface PerformanceMetrics {
  pageLoadTime?: number;
  timeToInteractive?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  firstInputDelay?: number;
}

// Analytics event interface
interface AnalyticsEvent {
  user_id?: string;
  session_id: string;
  event_type: 'page_view' | 'feature_usage' | 'navigation' | 'interaction';
  event_data: Record<string, any>;
  timestamp: string;
}

/**
 * Initialize Sentry for error tracking
 * 
 * Implements Req 76.5: Integrate Sentry for frontend error tracking
 */
export function initializeSentry(): void {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    integrations: [
      new BrowserTracing(),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Performance monitoring
    tracesSampleRate: SENTRY_SAMPLE_RATE,
    
    // Session replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Error filtering
    beforeSend(event, hint) {
      // Filter out certain errors
      const error = hint.originalException;
      
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message;
        
        // Ignore network errors that are expected
        if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
          return null;
        }
        
        // Ignore ResizeObserver errors (common browser quirk)
        if (message.includes('ResizeObserver')) {
          return null;
        }
      }
      
      return event;
    },
    
    // Add custom tags
    initialScope: {
      tags: {
        app: 'b3-dashboard',
        version: import.meta.env.VITE_VERSION || 'unknown',
      },
    },
  });
}

/**
 * Track performance metrics
 * 
 * Implements Req 83.6: Track frontend performance metrics
 */
export function trackPerformanceMetrics(page?: string): void {
  try {
    // Use Performance API to get metrics
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      const metrics: PerformanceMetrics = {};
      
      // Page load time
      if (navigation) {
        metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
        metrics.timeToInteractive = navigation.domInteractive - navigation.fetchStart;
      }
      
      // Paint metrics
      const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
      if (fcp) {
        metrics.firstContentfulPaint = fcp.startTime;
      }
      
      // Web Vitals
      if ('PerformanceObserver' in window) {
        // Largest Contentful Paint (LCP)
        try {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as any;
            metrics.largestContentfulPaint = lastEntry.renderTime || lastEntry.loadTime;
            sendPerformanceMetrics(metrics, page);
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (e) {
          // LCP not supported
        }
        
        // Cumulative Layout Shift (CLS)
        try {
          let clsValue = 0;
          const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as any[]) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            metrics.cumulativeLayoutShift = clsValue;
          });
          clsObserver.observe({ entryTypes: ['layout-shift'] });
        } catch (e) {
          // CLS not supported
        }
        
        // First Input Delay (FID)
        try {
          const fidObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const firstInput = entries[0] as any;
            metrics.firstInputDelay = firstInput.processingStart - firstInput.startTime;
            sendPerformanceMetrics(metrics, page);
          });
          fidObserver.observe({ entryTypes: ['first-input'] });
        } catch (e) {
          // FID not supported
        }
      }
      
      // Send basic metrics immediately
      sendPerformanceMetrics(metrics, page);
    }
  } catch (error) {
    console.error('Error tracking performance metrics:', error);
    Sentry.captureException(error);
  }
}

/**
 * Send performance metrics to backend
 */
async function sendPerformanceMetrics(metrics: PerformanceMetrics, page?: string): Promise<void> {
  try {
    await api.post('/api/monitoring/performance', {
      page,
      ...metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error sending performance metrics:', error);
  }
}

/**
 * Track user behavior analytics
 * 
 * Implements Req 83.11: Track user behavior analytics
 */
export async function trackAnalytics(event: Omit<AnalyticsEvent, 'session_id' | 'timestamp'>): Promise<void> {
  try {
    const sessionId = getSessionId();
    
    const analyticsEvent: AnalyticsEvent = {
      ...event,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
    };
    
    await api.post(ANALYTICS_ENDPOINT, analyticsEvent);
  } catch (error) {
    console.error('Error tracking analytics:', error);
  }
}

/**
 * Track page view
 */
export function trackPageView(page: string, metadata?: Record<string, any>): void {
  trackAnalytics({
    event_type: 'page_view',
    event_data: {
      page,
      ...metadata,
    },
  });
  
  // Also track performance for this page
  trackPerformanceMetrics(page);
}

/**
 * Track feature usage
 */
export function trackFeatureUsage(feature: string, action: string, metadata?: Record<string, any>): void {
  trackAnalytics({
    event_type: 'feature_usage',
    event_data: {
      feature,
      action,
      ...metadata,
    },
  });
}

/**
 * Track navigation
 */
export function trackNavigation(from: string, to: string, metadata?: Record<string, any>): void {
  trackAnalytics({
    event_type: 'navigation',
    event_data: {
      from,
      to,
      ...metadata,
    },
  });
}

/**
 * Track user interaction
 */
export function trackInteraction(element: string, action: string, metadata?: Record<string, any>): void {
  trackAnalytics({
    event_type: 'interaction',
    event_data: {
      element,
      action,
      ...metadata,
    },
  });
}

/**
 * Get or create session ID
 */
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('session_id');
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('session_id', sessionId);
  }
  
  return sessionId;
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, email?: string, username?: string): void {
  Sentry.setUser({
    id: userId,
    email,
    username,
  });
}

/**
 * Clear user context
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Capture error manually
 */
export function captureError(error: Error, context?: Record<string, any>): void {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
}

/**
 * Capture message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Start performance transaction
 */
export function startTransaction(name: string, op: string): Sentry.Transaction | undefined {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Monitor component performance
 */
export function withProfiler<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  return Sentry.withProfiler(Component, { name: componentName });
}

// Export Sentry for advanced usage
export { Sentry };
