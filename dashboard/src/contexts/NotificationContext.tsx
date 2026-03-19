/**
 * Notification Context
 * 
 * Manages notification state and operations.
 * Implements Requirements 45.1-45.10 (Notification Center)
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { Notification, NotificationPreferences } from '../types/notifications';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  loading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
}

const defaultPreferences: NotificationPreferences = {
  emailTypes: ['degradation', 'system'],
  smsTypes: ['system'],
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
  },
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate unread count (Req 45.2)
  const unreadCount = notifications.filter((n) => !n.read && !n.dismissed).length;

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.notifications.getAll();
      // Sort by timestamp, newest first (Req 45.5)
      const sorted = ((response as any).data || []).sort(
        (a: Notification, b: Notification) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setNotifications(sorted);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark notification as read (Req 45.6)
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await api.notifications.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      throw err;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await api.notifications.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      throw err;
    }
  }, []);

  // Dismiss notification (Req 45.7)
  const dismissNotification = useCallback(async (notificationId: string) => {
    try {
      await api.notifications.delete(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
      throw err;
    }
  }, []);

  // Update notification preferences
  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    try {
      const updated = { ...preferences, ...newPreferences };
      // In a real implementation, this would save to backend
      // await api.preferences.update({ notifications: updated });
      setPreferences(updated);
      localStorage.setItem('notificationPreferences', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to update preferences:', err);
      throw err;
    }
  }, [preferences]);

  // Add notification locally (for real-time updates)
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev]);
  }, []);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('notificationPreferences');
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch (err) {
        console.error('Failed to parse stored preferences:', err);
      }
    }
  }, []);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Auto-cleanup old notifications (Req 45.10 - 30 day retention)
  useEffect(() => {
    const cleanup = () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      setNotifications((prev) =>
        prev.filter((n) => new Date(n.timestamp) > thirtyDaysAgo)
      );
    };

    // Run cleanup daily
    const interval = setInterval(cleanup, 24 * 60 * 60 * 1000);
    cleanup(); // Run once on mount

    return () => clearInterval(interval);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        preferences,
        loading,
        error,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        updatePreferences,
        addNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
