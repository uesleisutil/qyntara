import PropTypes from 'prop-types';

/**
 * MetricSelector - Metric selection dropdown
 * 
 * Features:
 * - Dropdown for selecting performance metrics
 * - Grouped metrics by category
 * - Descriptions for each metric
 */
const MetricSelector = ({ value, onChange, showDescription = false }) => {
  const metricGroups = [
    {
      label: 'Accuracy Metrics',
      metrics: [
        { id: 'mape', name: 'MAPE', description: 'Mean Absolute Percentage Error' },
        { id: 'mae', name: 'MAE', description: 'Mean Absolute Error' },
        { id: 'rmse', name: 'RMSE', description: 'Root Mean Squared Error' }
      ]
    },
    {
      label: 'Coverage Metrics',
      metrics: [
        { id: 'coverage', name: 'Coverage', description: 'Prediction interval coverage' },
        { id: 'interval_width', name: 'Interval Width', description: 'Average prediction interval width' }
      ]
    },
    {
      label: 'Performance Metrics',
      metrics: [
        { id: 'training_time', name: 'Training Time', description: 'Model training duration' },
        { id: 'inference_time', name: 'Inference Time', description: 'Prediction latency' }
      ]
    }
  ];

  // Flatten all metrics for easy lookup
  const allMetrics = metricGroups.flatMap(group => group.metrics);
  const selectedMetric = allMetrics.find(m => m.id === value);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Metric
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {metricGroups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.metrics.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Optional description */}
      {showDescription && selectedMetric && (
        <p className="mt-2 text-sm text-gray-600">
          {selectedMetric.description}
        </p>
      )}
    </div>
  );
};

MetricSelector.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  showDescription: PropTypes.bool
};

export default MetricSelector;
