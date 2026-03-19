/**
 * Notification Types
 * 
 * Type definitions for the notification system.
 * Implements Requirements 45.1-45.10 (Notification Center)
 */

export type NotificationType = 'info' | 'warning' | 'critical';
export type NotificationCategory = 'drift' | 'anomaly' | 'cost' | 'degradation' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  dismissed?: boolean;
  actionUrl?: string;
}

export interface NotificationPreferences {
  email?: string;
  phone?: string;
  emailTypes: NotificationCategory[];
  smsTypes: NotificationCategory[];
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
}

export interface SystemHealth {
  status: 'green' | 'yellow' | 'red';
  components: {
    apiGateway: ComponentHealth;
    lambda: ComponentHealth;
    s3: ComponentHealth;
    dataFreshness: ComponentHealth;
  };
  lastCheck: string;
}

export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'failing';
  message: string;
  details?: string;
}

export interface RealTimeStatus {
  connected: boolean;
  lastRefresh: string;
  nextRefresh?: string;
  autoRefresh: boolean;
  refreshInterval: number; // seconds
  currentActivity?: string;
  processing: boolean;
}
