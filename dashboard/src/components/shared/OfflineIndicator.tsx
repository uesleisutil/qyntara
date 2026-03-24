import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowToast(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showToast) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1.25rem',
        backgroundColor: isOffline ? '#fdf0f0' : '#edf5f1',
        border: `1px solid ${isOffline ? '#f0c4c4' : '#7ed4b0'}`,
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        animation: 'slideIn 0.3s ease-out',
      }}
      role="alert"
      aria-live="polite"
    >
      {isOffline ? (
        <>
          <WifiOff size={20} color="#c04040" />
          <div>
            <div style={{ fontWeight: '600', color: '#8a2020', fontSize: '0.875rem' }}>
              You are offline
            </div>
            <div style={{ fontSize: '0.75rem', color: '#a03030', marginTop: '0.125rem' }}>
              Showing cached data
            </div>
          </div>
        </>
      ) : (
        <>
          <Wifi size={20} color="#3a8a6a" />
          <div>
            <div style={{ fontWeight: '600', color: '#1a5a3a', fontSize: '0.875rem' }}>
              Back online
            </div>
            <div style={{ fontSize: '0.75rem', color: '#2e7d4a', marginTop: '0.125rem' }}>
              Refreshing data...
            </div>
          </div>
        </>
      )}
    </div>
  );
};
