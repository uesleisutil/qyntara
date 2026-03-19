/**
 * System Health Context
 * 
 * Manages system health monitoring and status.
 * Implements Requirements 47.1-47.10 (System Health Indicator)
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { SystemHealth, ComponentHealth } from '../types/notifications';

interface SystemHealthContextType {
  health: SystemHealth;
  loading: boolean;
  error: string | null;
  fetchHealth: () => Promise<void>;
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
}

const SystemHealthContext = createContext<SystemHealthContextType | undefined>(undefined);

const defaultHealth: SystemHealth = {
  status: 'green',
  components: {
    apiGateway: { status: 'healthy', message: 'API Gateway operational' },
    lambda: { status: 'healthy', message: 'Lambda functions executing normally' },
    s3: { status: 'healthy', message: 'S3 buckets accessible' },
    dataFreshness: { status: 'healthy', message: 'Data is current' },
  },
  lastCheck: new Date().toISOString(),
};

export const SystemHealthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [health, setHealth] = useState<SystemHealth>(defaultHealth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshIntervalState] = useState(60); // 60 seconds (Req 47.10)

  // Fetch system health from API
  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real implementation, this would call the backend API
      // const response = await api.get('/api/system/health');
      
      // Mock implementation for now
      const mockHealth = await checkSystemHealth();
      setHealth(mockHealth);
    } catch (err) {
      console.error('Failed to fetch system health:', err);
      setError('Failed to check system health');
      
      // Set all components to unknown status on error
      setHealth({
        status: 'red',
        components: {
          apiGateway: { status: 'failing', message: 'Unable to check status' },
          lambda: { status: 'failing', message: 'Unable to check status' },
          s3: { status: 'failing', message: 'Unable to check status' },
          dataFreshness: { status: 'failing', message: 'Unable to check status' },
        },
        lastCheck: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const setRefreshInterval = useCallback((interval: number) => {
    setRefreshIntervalState(interval);
  }, []);

  // Auto-refresh health status (Req 47.10)
  useEffect(() => {
    fetchHealth(); // Initial fetch

    const interval = setInterval(() => {
      fetchHealth();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [fetchHealth, refreshInterval]);

  return (
    <SystemHealthContext.Provider
      value={{
        health,
        loading,
        error,
        fetchHealth,
        refreshInterval,
        setRefreshInterval,
      }}
    >
      {children}
    </SystemHealthContext.Provider>
  );
};

export const useSystemHealth = (): SystemHealthContextType => {
  const context = useContext(SystemHealthContext);
  if (!context) {
    throw new Error('useSystemHealth must be used within a SystemHealthProvider');
  }
  return context;
};

// Mock function to check system health
// In production, this would make actual API calls to check each component
async function checkSystemHealth(): Promise<SystemHealth> {
  const components: SystemHealth['components'] = {
    apiGateway: await checkAPIGateway(),
    lambda: await checkLambda(),
    s3: await checkS3(),
    dataFreshness: await checkDataFreshness(),
  };

  // Aggregate status (Req 47.6, 47.7, 47.8)
  const status = aggregateStatus(components);

  return {
    status,
    components,
    lastCheck: new Date().toISOString(),
  };
}

// Aggregate component statuses into overall status
function aggregateStatus(components: SystemHealth['components']): 'green' | 'yellow' | 'red' {
  const statuses = Object.values(components).map((c) => c.status);
  
  // If any component is failing, overall status is red (Req 47.8)
  if (statuses.some((s) => s === 'failing')) {
    return 'red';
  }
  
  // If any component has warnings, overall status is yellow (Req 47.7)
  if (statuses.some((s) => s === 'warning')) {
    return 'yellow';
  }
  
  // All components healthy, status is green (Req 47.6)
  return 'green';
}

// Mock health check functions
// In production, these would make actual API calls

async function checkAPIGateway(): Promise<ComponentHealth> {
  try {
    // Simulate API check
    const response = await fetch('/api/health', { method: 'HEAD' });
    if (response.ok) {
      return { status: 'healthy', message: 'API Gateway operational' };
    } else {
      return { status: 'warning', message: `API Gateway responding with ${response.status}` };
    }
  } catch (err) {
    return { status: 'failing', message: 'API Gateway unreachable' };
  }
}

async function checkLambda(): Promise<ComponentHealth> {
  try {
    // In production, check Lambda execution metrics from CloudWatch
    // For now, assume healthy if API is responding
    return { status: 'healthy', message: 'Lambda functions executing normally' };
  } catch (err) {
    return { status: 'failing', message: 'Lambda execution errors detected' };
  }
}

async function checkS3(): Promise<ComponentHealth> {
  try {
    // In production, check S3 bucket accessibility
    // For now, assume healthy
    return { status: 'healthy', message: 'S3 buckets accessible' };
  } catch (err) {
    return { status: 'failing', message: 'S3 buckets inaccessible' };
  }
}

async function checkDataFreshness(): Promise<ComponentHealth> {
  try {
    // In production, check timestamp of latest data
    // For now, assume healthy
    const lastUpdate = new Date();
    const age = Date.now() - lastUpdate.getTime();
    const ageHours = age / (1000 * 60 * 60);
    
    if (ageHours < 24) {
      return { status: 'healthy', message: 'Data is current' };
    } else if (ageHours < 48) {
      return { status: 'warning', message: `Data is ${Math.floor(ageHours)} hours old` };
    } else {
      return { status: 'failing', message: `Data is ${Math.floor(ageHours)} hours old` };
    }
  } catch (err) {
    return { status: 'failing', message: 'Unable to check data freshness' };
  }
}
