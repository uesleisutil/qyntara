import React from 'react';
import { Database, Clock } from 'lucide-react';
import { cacheService } from '../../../services/cacheService';

interface CacheIndicatorProps {
  cacheKey: string;
  ttl?: number;
  showDetails?: boolean;
}

export const CacheIndicator: React.FC<CacheIndicatorProps> = ({
  cacheKey,
  ttl: _ttl,
  showDetails = false,
}) => {
  const metadata = cacheService.getMetadataForKey(cacheKey);

  if (!metadata.isCached) {
    return null;
  }

  const ageInSeconds = metadata.age ? Math.floor(metadata.age / 1000) : 0;
  const ageDisplay =
    ageInSeconds < 60
      ? `${ageInSeconds}s ago`
      : `${Math.floor(ageInSeconds / 60)}m ago`;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.25rem 0.75rem',
        backgroundColor: '#f0fdf4',
        border: '1px solid #86efac',
        borderRadius: '6px',
        fontSize: '0.75rem',
        color: '#166534',
      }}
      title={`Cached data (${ageDisplay})`}
    >
      <Database size={12} />
      <span>Cached</span>
      {showDetails && (
        <>
          <Clock size={12} />
          <span>{ageDisplay}</span>
        </>
      )}
    </div>
  );
};
