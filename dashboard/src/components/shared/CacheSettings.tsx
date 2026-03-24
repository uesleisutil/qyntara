import React, { useState, useEffect } from 'react';
import { Database, Trash2, RefreshCw } from 'lucide-react';
import { cacheService } from '../../services/cacheService';
import { clearCache as clearServiceWorkerCache } from '../../utils/serviceWorkerRegistration';

export const CacheSettings: React.FC = () => {
  const [stats, setStats] = useState(cacheService.getStats());
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(cacheService.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleClearCache = async () => {
    if (!window.confirm('Are you sure you want to clear all cached data? This will require reloading data from the server.')) {
      return;
    }

    setClearing(true);
    try {
      // Clear browser cache
      cacheService.clearAll();
      
      // Clear service worker cache
      await clearServiceWorkerCache();
      
      // Refresh stats
      setStats(cacheService.getStats());
      
      alert('Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Database size={24} color="#5a9e87" />
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#1a2626' }}>
          Cache Settings
        </h3>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f6faf8',
              borderRadius: '8px',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#5a7268', marginBottom: '0.25rem' }}>
              Cache Size
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a2626' }}>
              {formatBytes(stats.totalSize)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#5a7268', marginTop: '0.25rem' }}>
              of {formatBytes(stats.maxSize)}
            </div>
          </div>

          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f6faf8',
              borderRadius: '8px',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#5a7268', marginBottom: '0.25rem' }}>
              Cached Entries
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a2626' }}>
              {stats.entryCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#5a7268', marginTop: '0.25rem' }}>
              items
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#5a7268', marginBottom: '0.5rem' }}>
            Cache Utilization
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#d4e5dc',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(stats.utilizationPercent, 100)}%`,
                height: '100%',
                backgroundColor:
                  stats.utilizationPercent > 90
                    ? '#c04040'
                    : stats.utilizationPercent > 70
                    ? '#d4a84b'
                    : '#4ead8a',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ fontSize: '0.75rem', color: '#5a7268', marginTop: '0.25rem' }}>
            {stats.utilizationPercent.toFixed(1)}% used
          </div>
        </div>
      </div>

      <button
        onClick={handleClearCache}
        disabled={clearing || stats.entryCount === 0}
        style={{
          width: '100%',
          padding: '0.75rem 1.5rem',
          backgroundColor: clearing ? '#b0c8bc' : '#c04040',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: clearing || stats.entryCount === 0 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          transition: 'all 0.2s',
        }}
      >
        {clearing ? (
          <>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Clearing...
          </>
        ) : (
          <>
            <Trash2 size={16} />
            Clear All Cache
          </>
        )}
      </button>

      <div
        style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: '#f5ecd0',
          border: '1px solid #e0b85c',
          borderRadius: '8px',
          fontSize: '0.75rem',
          color: '#8a5a1e',
        }}
      >
        <strong>Note:</strong> Clearing cache will require reloading all data from the server.
        This may take a few moments depending on your connection speed.
      </div>
    </div>
  );
};
