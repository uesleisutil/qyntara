/**
 * Real-Time Context
 * 
 * Manages real-time status updates and WebSocket connection.
 * Implements Requirements 48.1-48.11 (Real-Time Status Updates)
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import websocketService, { WebSocketMessage } from '../services/websocket';
import { RealTimeStatus } from '../types/notifications';

interface RealTimeContextType {
  status: RealTimeStatus;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  triggerRefresh: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const RealTimeContext = createContext<RealTimeContextType | undefined>(undefined);

const defaultStatus: RealTimeStatus = {
  connected: false,
  lastRefresh: new Date().toISOString(),
  autoRefresh: true,
  refreshInterval: 300, // 5 minutes default
  processing: false,
};

export const RealTimeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<RealTimeStatus>(defaultStatus);
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    try {
      await websocketService.connect();
      setStatus((prev) => ({ ...prev, connected: true }));
    } catch (err) {
      console.error('Failed to connect to WebSocket:', err);
      setStatus((prev) => ({ ...prev, connected: false }));
    }
  }, []);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    websocketService.disconnect();
    setStatus((prev) => ({ ...prev, connected: false }));
  }, []);

  // Set auto-refresh (Req 48.4)
  const setAutoRefresh = useCallback((enabled: boolean) => {
    setStatus((prev) => ({ ...prev, autoRefresh: enabled }));
    localStorage.setItem('autoRefresh', JSON.stringify(enabled));
  }, []);

  // Set refresh interval
  const setRefreshInterval = useCallback((interval: number) => {
    setStatus((prev) => ({ ...prev, refreshInterval: interval }));
    localStorage.setItem('refreshInterval', interval.toString());
  }, []);

  // Trigger manual refresh (Req 48.7)
  const triggerRefresh = useCallback(async () => {
    setStatus((prev) => ({
      ...prev,
      processing: true,
      currentActivity: 'Refreshing data...',
    }));

    try {
      // In production, this would trigger actual data refresh
      // For now, just simulate the refresh
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setStatus((prev) => ({
        ...prev,
        lastRefresh: new Date().toISOString(),
        processing: false,
        currentActivity: undefined,
      }));

      // Notify via WebSocket if connected
      if (websocketService.isConnected()) {
        websocketService.send({
          type: 'data_update',
          payload: { action: 'refresh_requested' },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Refresh failed:', err);
      setStatus((prev) => ({
        ...prev,
        processing: false,
        currentActivity: 'Refresh failed',
      }));
      
      // Clear error message after 3 seconds
      setTimeout(() => {
        setStatus((prev) => ({
          ...prev,
          currentActivity: undefined,
        }));
      }, 3000);
    }
  }, []);

  // Load preferences from localStorage
  useEffect(() => {
    const storedAutoRefresh = localStorage.getItem('autoRefresh');
    const storedInterval = localStorage.getItem('refreshInterval');

    if (storedAutoRefresh !== null) {
      setStatus((prev) => ({ ...prev, autoRefresh: JSON.parse(storedAutoRefresh) }));
    }
    if (storedInterval !== null) {
      setStatus((prev) => ({ ...prev, refreshInterval: parseInt(storedInterval, 10) }));
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Set up WebSocket message handlers
  useEffect(() => {
    // Handle processing start (Req 48.2)
    const unsubProcessingStart = websocketService.on('processing_start', (message: WebSocketMessage) => {
      setStatus((prev) => ({
        ...prev,
        processing: true,
        currentActivity: message.payload?.activity || 'Processing...',
      }));
    });

    // Handle processing complete (Req 48.2)
    const unsubProcessingComplete = websocketService.on('processing_complete', (_message: WebSocketMessage) => {
      setStatus((prev) => ({
        ...prev,
        processing: false,
        currentActivity: undefined,
      }));
    });

    // Handle data update (Req 48.3)
    const unsubDataUpdate = websocketService.on('data_update', (message: WebSocketMessage) => {
      setStatus((prev) => ({
        ...prev,
        lastRefresh: message.timestamp,
        currentActivity: 'New data available',
      }));

      // Clear "new data" message after 5 seconds
      setTimeout(() => {
        setStatus((prev) => ({
          ...prev,
          currentActivity: undefined,
        }));
      }, 5000);
    });

    // Handle errors (Req 48.9)
    const unsubError = websocketService.on('error', (message: WebSocketMessage) => {
      setStatus((prev) => ({
        ...prev,
        processing: false,
        currentActivity: message.payload?.message || 'An error occurred',
      }));

      // Clear error message after 5 seconds
      setTimeout(() => {
        setStatus((prev) => ({
          ...prev,
          currentActivity: undefined,
        }));
      }, 5000);
    });

    return () => {
      if (typeof unsubProcessingStart === 'function') unsubProcessingStart();
      if (typeof unsubProcessingComplete === 'function') unsubProcessingComplete();
      if (typeof unsubDataUpdate === 'function') unsubDataUpdate();
      if (typeof unsubError === 'function') unsubError();
    };
  }, []);

  // Auto-refresh timer (Req 48.6)
  useEffect(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    if (status.autoRefresh && status.refreshInterval > 0) {
      const timer = setInterval(() => {
        triggerRefresh();
      }, status.refreshInterval * 1000);

      setRefreshTimer(timer);

      // Calculate next refresh time
      const nextRefresh = new Date(Date.now() + status.refreshInterval * 1000).toISOString();
      setStatus((prev) => ({ ...prev, nextRefresh }));
    } else {
      setStatus((prev) => ({ ...prev, nextRefresh: undefined }));
    }

    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [status.autoRefresh, status.refreshInterval, triggerRefresh]);

  return (
    <RealTimeContext.Provider
      value={{
        status,
        setAutoRefresh,
        setRefreshInterval,
        triggerRefresh,
        connect,
        disconnect,
      }}
    >
      {children}
    </RealTimeContext.Provider>
  );
};

export const useRealTime = (): RealTimeContextType => {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }
  return context;
};
