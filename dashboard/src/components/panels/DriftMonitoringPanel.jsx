import { useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from 'recharts';
import DriftDetectionChart from '../charts/DriftDetectionChart';

/**
 * DriftMonitoringPanel - Display drift detection and monitoring
 * 
 * Features:
 * - Drift summary with status badges
 * - Performance drift chart (MAPE vs baseline)
 * - Feature drift heatmap
 * - Drift events timeline
 * - Alerts-only toggle filter
 * - Manual refresh button
 * 
 * Requirements: 13.3
 */
const DriftMonitoringPanel = ({ 
  data = null,
  onRefresh = () => {}
}) => {
  const [alertsOnly, setAlertsOnly] = useState(false);

  // Status badge component
  const StatusBadge = ({ status, label, count = null }) => {
    const getStatusStyles = () => {
      switch (status) {
        case 'critical':
          return 'bg-red-100 text-red-800 border-red-300';
        case 'warning':
          return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 'good':
          return 'bg-green-100 text-green-800 border-green-300';
        default:
          return 'bg-gray-100 text-gray-800 border-gray-300';
      }
    };

    const getStatusIcon = () => {
      switch (status) {
        case 'critical':
          return <XCircle size={16} />;
        case 'warning':
          return <AlertTriangle size={16} />;
        case 'good':
          return <CheckCircle size={16} />;
        default:
          return null;
      }
    };

    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getStatusStyles()}`}>
        {getStatusIcon()}
        <span className="text-sm font-medium">
          {label}
          {count !== null && ` (${count})`}
        </span>
      </div>
    );
  };

  // Timeline event component
  const TimelineEvent = ({ event }) => {
    const getSeverityColor = () => {
      switch (event.severity) {
        case 'critical':
          return 'border-red-500 bg-red-50';
        case 'warning':
          return 'border-yellow-500 bg-yellow-50';
        default:
          return 'border-gray-300 bg-gray-50';
      }
    };

    return (
      <div className={`border-l-4 p-3 mb-3 ${getSeverityColor()}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-600">
                {new Date(event.date).toLocaleDateString()}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                {event.type}
              </span>
            </div>
            <p className="text-sm text-gray-800">{event.description}</p>
          </div>
        </div>
      </div>
    );
  };

  // Custom tooltip for performance drift chart
  const PerformanceTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toFixed(2)}%
          </p>
        ))}
      </div>
    );
  };

  // Handle loading state
  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Drift Monitoring</h2>
        </div>
        <p className="text-gray-500">Loading drift data...</p>
      </div>
    );
  }

  // Filter drift events if alerts-only is enabled
  const filteredEvents = alertsOnly 
    ? (data.drift_events || []).filter(e => e.severity === 'critical' || e.severity === 'warning')
    : (data.drift_events || []);

  // Filter features for drift chart
  const filteredFeatures = alertsOnly
    ? (data.drifted_features || [])
    : (data.all_features || []);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Drift Monitoring</h2>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Drift Summary */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <StatusBadge 
            status={data.performance_drift ? 'critical' : 'good'}
            label="Performance Drift"
          />
          <StatusBadge 
            status={data.feature_drift_count > 0 ? 'warning' : 'good'}
            label="Feature Drift"
            count={data.feature_drift_count}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={alertsOnly}
              onChange={(e) => setAlertsOnly(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show Alerts Only</span>
          </label>
        </div>
      </div>

      {/* Performance Drift Chart */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Drift</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart 
            data={data.mape_history || []}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              stroke="#666"
            />
            <YAxis 
              label={{ 
                value: 'MAPE (%)', 
                angle: -90, 
                position: 'insideLeft',
                style: { fontSize: 12 }
              }}
              tick={{ fontSize: 12 }}
              stroke="#666"
            />
            <Tooltip content={<PerformanceTooltip />} />
            <Legend />
            
            {/* Drift threshold line */}
            {data.baseline_mape && (
              <ReferenceLine 
                y={data.baseline_mape * 1.2} 
                stroke="#ef4444" 
                strokeDasharray="3 3"
                label={{ 
                  value: 'Drift Threshold (+20%)', 
                  position: 'right',
                  fill: '#ef4444',
                  fontSize: 11
                }}
              />
            )}
            
            <Line 
              type="monotone" 
              dataKey="current" 
              stroke="#8884d8"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Current MAPE"
            />
            <Line 
              type="monotone" 
              dataKey="baseline" 
              stroke="#82ca9d"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Baseline MAPE"
            />
          </LineChart>
        </ResponsiveContainer>
        
        {/* Performance metrics */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {data.current_mape?.toFixed(2)}%
            </div>
            <div className="text-xs text-gray-600">Current MAPE</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {data.baseline_mape?.toFixed(2)}%
            </div>
            <div className="text-xs text-gray-600">Baseline MAPE</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${
              data.mape_change_percentage > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {data.mape_change_percentage > 0 ? '+' : ''}
              {data.mape_change_percentage?.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600">Change</div>
          </div>
        </div>
      </div>

      {/* Feature Drift Detection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Drift Detection</h3>
        <DriftDetectionChart 
          driftData={filteredFeatures}
          threshold={0.05}
        />
      </div>

      {/* Drift Events Timeline */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Drift Events Timeline
          {alertsOnly && ' (Alerts Only)'}
        </h3>
        <div className="max-h-96 overflow-y-auto">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event, index) => (
              <TimelineEvent key={index} event={event} />
            ))
          ) : (
            <p className="text-gray-500 text-center py-8">
              {alertsOnly ? 'No alerts to display' : 'No drift events recorded'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

DriftMonitoringPanel.propTypes = {
  data: PropTypes.shape({
    performance_drift: PropTypes.bool,
    feature_drift_count: PropTypes.number,
    baseline_mape: PropTypes.number,
    current_mape: PropTypes.number,
    mape_change_percentage: PropTypes.number,
    mape_history: PropTypes.arrayOf(PropTypes.shape({
      date: PropTypes.string.isRequired,
      current: PropTypes.number,
      baseline: PropTypes.number
    })),
    all_features: PropTypes.array,
    drifted_features: PropTypes.array,
    drift_events: PropTypes.arrayOf(PropTypes.shape({
      date: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      severity: PropTypes.string.isRequired
    }))
  }),
  onRefresh: PropTypes.func
};

export default DriftMonitoringPanel;
