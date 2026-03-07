import { useState } from 'react';
import PropTypes from 'prop-types';
import { Settings } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';
import ModelSelector from '../filters/ModelSelector';

/**
 * HyperparameterPanel - Display hyperparameter optimization history and progress
 * 
 * Features:
 * - Model selector to view different model hyperparameters
 * - Hyperparameter history over time
 * - Optimization progress visualization
 * - Best trials display
 * - Parameter value trends
 * 
 * Requirements: 13.3
 */
const HyperparameterPanel = ({ 
  data = null,
  selectedModel = 'lstm',
  onModelChange = () => {}
}) => {
  const [selectedParam, setSelectedParam] = useState(null);

  const modelNames = {
    deepar: 'DeepAR',
    lstm: 'LSTM',
    prophet: 'Prophet',
    xgboost: 'XGBoost'
  };

  // Custom tooltip for optimization progress
  const OptimizationTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-1">Trial {data.trial_number}</p>
        <p className="text-xs text-gray-600">MAPE: {data.mape?.toFixed(3)}%</p>
        <p className="text-xs text-gray-600 mt-1">Parameters:</p>
        {data.params && Object.entries(data.params).map(([key, value]) => (
          <p key={key} className="text-xs text-gray-500 ml-2">
            {key}: {typeof value === 'number' ? value.toFixed(4) : value}
          </p>
        ))}
      </div>
    );
  };

  // Custom tooltip for parameter history
  const ParamHistoryTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(4) : entry.value}
          </p>
        ))}
      </div>
    );
  };

  // Render parameter value based on type
  const renderParamValue = (value) => {
    if (typeof value === 'number') {
      return value.toFixed(4);
    }
    if (typeof value === 'boolean') {
      return value ? 'True' : 'False';
    }
    return String(value);
  };

  // Handle loading state
  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Hyperparameter Optimization</h2>
        </div>
        <p className="text-gray-500">Loading hyperparameter data...</p>
      </div>
    );
  }

  const modelData = data[selectedModel] || {};
  const paramNames = modelData.param_history ? Object.keys(modelData.param_history[0]?.params || {}) : [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Settings className="text-blue-600" size={24} />
        <h2 className="text-xl font-semibold text-gray-900">Hyperparameter Optimization</h2>
      </div>

      {/* Model Selector */}
      <div className="mb-6">
        <ModelSelector 
          value={selectedModel} 
          onChange={onModelChange}
          multiSelect={false}
        />
      </div>

      {/* Current Best Parameters */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Current Best Parameters - {modelNames[selectedModel]}
        </h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modelData.best_params && Object.entries(modelData.best_params).map(([key, value]) => (
              <div key={key} className="bg-white rounded p-3 border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">{key}</div>
                <div className="text-lg font-semibold text-gray-900">
                  {renderParamValue(value)}
                </div>
              </div>
            ))}
          </div>
          {modelData.best_mape && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Best MAPE Achieved:</span>
                <span className="text-xl font-bold text-green-600">
                  {modelData.best_mape.toFixed(3)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Optimization Progress */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Progress</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              dataKey="trial_number" 
              name="Trial"
              label={{ value: 'Trial Number', position: 'bottom' }}
            />
            <YAxis 
              type="number" 
              dataKey="mape" 
              name="MAPE"
              label={{ value: 'MAPE (%)', angle: -90, position: 'insideLeft' }}
            />
            <ZAxis type="number" range={[50, 200]} />
            <Tooltip content={<OptimizationTooltip />} />
            <Scatter 
              data={modelData.optimization_progress || []}
              fill="#8884d8"
            />
          </ScatterChart>
        </ResponsiveContainer>
        
        {/* Optimization stats */}
        {modelData.optimization_stats && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {modelData.optimization_stats.total_trials}
              </div>
              <div className="text-xs text-gray-600">Total Trials</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {modelData.optimization_stats.completed_trials}
              </div>
              <div className="text-xs text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {modelData.optimization_stats.optimization_time_hours?.toFixed(1)}h
              </div>
              <div className="text-xs text-gray-600">Time Spent</div>
            </div>
          </div>
        )}
      </div>

      {/* Parameter History */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Parameter History</h3>
        
        {/* Parameter selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Parameter to View
          </label>
          <select
            value={selectedParam || ''}
            onChange={(e) => setSelectedParam(e.target.value)}
            className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Select Parameter --</option>
            {paramNames.map((param) => (
              <option key={param} value={param}>{param}</option>
            ))}
          </select>
        </div>

        {/* Parameter trend chart */}
        {selectedParam && modelData.param_history && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart 
              data={modelData.param_history}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ 
                  value: selectedParam, 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fontSize: 12 }
                }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<ParamHistoryTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey={`params.${selectedParam}`}
                stroke="#8884d8"
                strokeWidth={2}
                dot={{ r: 4 }}
                name={selectedParam}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {!selectedParam && (
          <p className="text-gray-500 text-center py-8">
            Select a parameter to view its history
          </p>
        )}
      </div>

      {/* Best Trials Table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Best Trials</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trial
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MAPE
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parameters
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {modelData.best_trials && modelData.best_trials.slice(0, 5).map((trial, index) => (
                <tr key={trial.trial_number} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-800' :
                      index === 1 ? 'bg-gray-100 text-gray-800' :
                      index === 2 ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    #{trial.trial_number}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    {trial.mape?.toFixed(3)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="flex flex-wrap gap-2">
                      {trial.params && Object.entries(trial.params).slice(0, 3).map(([key, value]) => (
                        <span key={key} className="inline-block px-2 py-1 bg-gray-100 rounded text-xs">
                          {key}: {renderParamValue(value)}
                        </span>
                      ))}
                      {trial.params && Object.keys(trial.params).length > 3 && (
                        <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs">
                          +{Object.keys(trial.params).length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!modelData.best_trials || modelData.best_trials.length === 0) && (
          <p className="text-gray-500 text-center py-4">No trial data available</p>
        )}
      </div>
    </div>
  );
};

HyperparameterPanel.propTypes = {
  data: PropTypes.objectOf(PropTypes.shape({
    best_params: PropTypes.object,
    best_mape: PropTypes.number,
    optimization_progress: PropTypes.arrayOf(PropTypes.shape({
      trial_number: PropTypes.number.isRequired,
      mape: PropTypes.number.isRequired,
      params: PropTypes.object
    })),
    optimization_stats: PropTypes.shape({
      total_trials: PropTypes.number,
      completed_trials: PropTypes.number,
      optimization_time_hours: PropTypes.number
    }),
    param_history: PropTypes.array,
    best_trials: PropTypes.array
  })),
  selectedModel: PropTypes.string,
  onModelChange: PropTypes.func
};

export default HyperparameterPanel;
