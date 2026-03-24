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
        backgroundColor: isOffline ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${isOffline ? '#fecaca' : '#86efac'}`,
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        animation: 'slideIn 0.3s ease-out',
      }}
      role="alert"
      aria-live="polite"
    >
      {isOffline ? (
        <>
          <WifiOff size={20} color="#dc2626" />
          <div>
            <div style={{ fontWeight: '600', color: '#991b1b', fontSize: '0.875rem' }}>
              You are offline
            </div>
            <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '0.125rem' }}>
              Showing cached data
            </div>
          </div>
        </>
      ) : (
        <>
          <Wifi size={20} color="#16a34a" />
          <div>
            <div style={{ fontWeight: '600', color: '#166534', fontSize: '0.875rem' }}>
              Back online
            </div>
            <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.125rem' }}>
              Refreshing data...
            </div>
          </div>
        </>
      )}
    </div>
  );
};
