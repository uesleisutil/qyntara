import PropTypes from 'prop-types';
import { TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import EnsembleWeightsChart from '../charts/EnsembleWeightsChart';
import StockSelector from '../filters/StockSelector';

/**
 * EnsembleInsightsPanel - Display ensemble model insights and contributions
 * 
 * Features:
 * - Current ensemble weights display
 * - Weight evolution over time (stacked area chart)
 * - Model contributions pie chart
 * - Prediction breakdown table
 * - Stock selector filter
 * 
 * Requirements: 13.3
 */
const EnsembleInsightsPanel = ({ 
  data = null,
  selectedStock = 'PETR4',
  onStockChange = () => {}
}) => {
  const modelColors = {
    deepar: '#8884d8',
    lstm: '#82ca9d',
    prophet: '#ffc658',
    xgboost: '#ff7c7c'
  };

  const modelNames = {
    deepar: 'DeepAR',
    lstm: 'LSTM',
    prophet: 'Prophet',
    xgboost: 'XGBoost'
  };

  // Prepare pie chart data from contributions
  const preparePieData = (contributions) => {
    if (!contributions) return [];
    
    return Object.entries(contributions).map(([model, value]) => ({
      name: modelNames[model] || model,
      value: value,
      color: modelColors[model]
    }));
  };

  // Custom tooltip for pie chart
  const CustomPieTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0];
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm">{data.name}</p>
        <p className="text-xs text-gray-600">
          Contribution: {(data.value * 100).toFixed(1)}%
        </p>
      </div>
    );
  };

  // Handle loading state
  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Ensemble Insights</h2>
        </div>
        <p className="text-gray-500">Loading ensemble data...</p>
      </div>
    );
  }

  const pieData = preparePieData(data.contributions);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="text-blue-600" size={24} />
        <h2 className="text-xl font-semibold text-gray-900">Ensemble Insights</h2>
      </div>

      {/* Stock Selector */}
      <div className="mb-6">
        <StockSelector 
          value={selectedStock} 
          onChange={onStockChange}
        />
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Current Weights Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Weights</h3>
          <div className="space-y-3">
            {data.current_weights && Object.entries(data.current_weights).map(([model, weight]) => (
              <div key={model} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: modelColors[model] }}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {modelNames[model] || model}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {(weight * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Model Contributions Pie Chart */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Model Contributions</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie 
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%" 
                cy="50%" 
                outerRadius={80}
                label={({ name, value }) => `${name}: ${(value * 100).toFixed(1)}%`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weight Evolution Chart */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Weight Evolution</h3>
        <EnsembleWeightsChart 
          weights={data.weight_history || []}
        />
      </div>

      {/* Prediction Breakdown Table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Prediction Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prediction
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Weight
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contribution
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.prediction_breakdown && data.prediction_breakdown.map((row) => (
                <tr key={row.model} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: modelColors[row.model] }}
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {modelNames[row.model] || row.model}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                    R$ {row.prediction.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-600">
                    {(row.weight * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    R$ {row.contribution.toFixed(2)}
                  </td>
                </tr>
              ))}
              {data.prediction_breakdown && data.prediction_breakdown.length > 0 && (
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    Ensemble
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                    R$ {data.prediction_breakdown.reduce((sum, row) => sum + row.contribution, 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-600">
                    100%
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                    -
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

EnsembleInsightsPanel.propTypes = {
  data: PropTypes.shape({
    current_weights: PropTypes.object,
    weight_history: PropTypes.array,
    contributions: PropTypes.object,
    prediction_breakdown: PropTypes.arrayOf(PropTypes.shape({
      model: PropTypes.string.isRequired,
      prediction: PropTypes.number.isRequired,
      weight: PropTypes.number.isRequired,
      contribution: PropTypes.number.isRequired
    }))
  }),
  selectedStock: PropTypes.string,
  onStockChange: PropTypes.func
};

export default EnsembleInsightsPanel;
