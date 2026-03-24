/**
 * Freshness Indicators Component
 * 
 * Implements Requirements:
 * - 23.1: Calculate data age (time since last update)
 * - 23.2: Display freshness status per data source (prices, fundamentals, news)
 * - 23.3: Show warning when age > 24 hours
 * - 23.4: Show critical when age > 48 hours
 * - 23.5: Display timestamp of most recent update
 * - 23.6: Display expected update frequency
 * - 23.7: Calculate percentage of current data sources
 * - 23.8: Requirements validation
 */

import React from 'react';
import { Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import Card from '../shared/Card';
import { StatusBadge } from '../shared/StatusBadge';

interface DataSource {
  source: string;
  lastUpdate: string;
  age: number; // in hours
  status: 'current' | 'warning' | 'critical';
  expectedFrequency: string;
}

interface FreshnessData {
  sources: DataSource[];
  currentSourcesPercentage: number;
  lastUpdateTimestamp: string;
}

interface FreshnessIndicatorsProps {
  data: FreshnessData;
  darkMode?: boolean;
  isMobile?: boolean;
}

export const FreshnessIndicators: React.FC<FreshnessIndicatorsProps> = ({ 
  data, 
  darkMode = false, 
  isMobile = false 
}) => {
  const theme = {
    cardBg: darkMode ? '#1a1836' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#9895b0' : '#64748b',
    border: darkMode ? '#2a2745' : '#e2e8f0',
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'critical': return '#dc2626';
      default: return theme.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'current': return <CheckCircle size={20} />;
      case 'warning': return <AlertTriangle size={20} />;
      case 'critical': return <XCircle size={20} />;
      default: return <Clock size={20} />;
    }
  };

  const formatAge = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    } else if (hours < 24) {
      return `${Math.round(hours)} hours`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      return `${days}d ${remainingHours}h`;
    }
  };

  return (
    <Card title={null} subtitle={null} icon={null} actions={null}>
      {/* Summary */}
      <div style={{ 
        marginBottom: '1.5rem', 
        paddingBottom: '1rem', 
        borderBottom: `1px solid ${theme.border}` 
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', 
          gap: '1rem' 
        }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
              Current Data Sources
            </div>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              color: getStatusColor(data.currentSourcesPercentage >= 0.9 ? 'current' : data.currentSourcesPercentage >= 0.7 ? 'warning' : 'critical')
            }}>
              {(data.currentSourcesPercentage * 100).toFixed(0)}%
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.875rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
              Most Recent Update
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
              {new Date(data.lastUpdateTimestamp).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Data Sources */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {data.sources.map((source) => (
          <div
            key={source.source}
            style={{
              padding: isMobile ? '1rem' : '1.25rem',
              border: `1px solid ${theme.border}`,
              borderLeft: `4px solid ${getStatusColor(source.status)}`,
              borderRadius: '8px',
              backgroundColor: darkMode ? '#0c0a1a' : '#f8fafc'
            }}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{ color: getStatusColor(source.status) }}>
                    {getStatusIcon(source.status)}
                  </span>
                  <span style={{ 
                    fontWeight: '600', 
                    fontSize: isMobile ? '1rem' : '1.125rem',
                    color: theme.text 
                  }}>
                    {source.source}
                  </span>
                  <StatusBadge
                    status={source.status === 'current' ? 'success' : source.status === 'warning' ? 'warning' : 'error'}
                    label={source.status.toUpperCase()}
                  />
                </div>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
                  gap: '0.75rem',
                  fontSize: '0.875rem'
                }}>
                  <div>
                    <div style={{ color: theme.textSecondary, marginBottom: '0.25rem' }}>
                      Last Update
                    </div>
                    <div style={{ color: theme.text, fontWeight: '500' }}>
                      {new Date(source.lastUpdate).toLocaleString()}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ color: theme.textSecondary, marginBottom: '0.25rem' }}>
                      Data Age
                    </div>
                    <div style={{ 
                      color: getStatusColor(source.status), 
                      fontWeight: '600' 
                    }}>
                      {formatAge(source.age)}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ color: theme.textSecondary, marginBottom: '0.25rem' }}>
                      Expected Frequency
                    </div>
                    <div style={{ color: theme.text, fontWeight: '500' }}>
                      {source.expectedFrequency}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
