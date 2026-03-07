import { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * DateRangePicker - Date range selection with presets
 * 
 * Features:
 * - Start and end date inputs
 * - Quick preset buttons (Last 7 days, Last 30 days, Last 90 days, YTD, All time)
 * - Validation (end date must be after start date)
 */
const DateRangePicker = ({ value, onChange }) => {
  const [error, setError] = useState('');

  // Preset date ranges
  const presets = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
    { label: 'YTD', days: 'ytd' },
    { label: 'All time', days: 'all' }
  ];

  const handleStartChange = (e) => {
    const newStart = e.target.value;
    if (value.end && newStart > value.end) {
      setError('Start date must be before end date');
    } else {
      setError('');
      onChange({ ...value, start: newStart });
    }
  };

  const handleEndChange = (e) => {
    const newEnd = e.target.value;
    if (value.start && newEnd < value.start) {
      setError('End date must be after start date');
    } else {
      setError('');
      onChange({ ...value, end: newEnd });
    }
  };

  const handlePreset = (preset) => {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    let startDate;

    if (preset.days === 'ytd') {
      // Year to date
      startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
    } else if (preset.days === 'all') {
      // All time - set to 2 years ago
      const twoYearsAgo = new Date(today);
      twoYearsAgo.setFullYear(today.getFullYear() - 2);
      startDate = twoYearsAgo.toISOString().split('T')[0];
    } else {
      // Last N days
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - preset.days);
      startDate = pastDate.toISOString().split('T')[0];
    }

    setError('');
    onChange({ start: startDate, end: endDate });
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Date Range
      </label>
      
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePreset(preset)}
            className="px-3 py-1 text-sm bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Date inputs */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={value.start}
            onChange={handleStartChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={value.end}
            onChange={handleEndChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

DateRangePicker.propTypes = {
  value: PropTypes.shape({
    start: PropTypes.string.isRequired,
    end: PropTypes.string.isRequired
  }).isRequired,
  onChange: PropTypes.func.isRequired
};

export default DateRangePicker;
