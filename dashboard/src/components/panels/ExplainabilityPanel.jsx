import { useState } from 'react';
import PropTypes from 'prop-types';
import { Info, ArrowUp, ArrowDown } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts';
import StockSelector from '../filters/StockSelector';

/**
 * ExplainabilityPanel - Display prediction explainability and SHAP analysis
 * 
 * Features:
 * - Recent predictions selector
 * - SHAP waterfall chart showing feature contributions
 * - Feature values table with impact direction
 * - Dominant model identification
 * - Confidence indicators
 * 
 * Requirements: 13.3, 13.5, 15.1, 15.2
 */
const ExplainabilityPanel = ({ 
  data = null,
  selectedStock = 'PETR4',
  onStockChange = () => {}
}) => {
  const [selectedPrediction, setSelectedPrediction] = useState(null);

  // Prediction card component
  const PredictionCard = ({ prediction, selected, onClick }) => {
    const confidenceColor = prediction.confidence > 0.8 
      ? 'text-green-600' 
      : prediction.confidence > 0.6 
        ? 'text-yellow-600' 
        : 'text-red-600';

    return (
      <button
        onClick={onClick}
        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
          selected 
            ? 'border-blue-600 bg-blue-50' 
            : 'border-gray-200 hover:border-gray-300 bg-white'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-900">
            {new Date(prediction.prediction_date).toLocaleDateString()}
          </span>
          <span className={`text-xs font-medium ${confidenceColor}`}>
            {(prediction.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
        <div className="text-2xl font-bold text-gray-900 mb-1">
          R$ {prediction.prediction_value.toFixed(2)}
        </div>
        <div className="text-xs text-gray-600">
          Model: {prediction.dominant_model}
        </div>
      </button>
    );
  };

  // SHAP waterfall chart component
  const SHAPWaterfallChart = ({ data, baseValue, finalValue }) => {
    if (!data || data.length === 0) return null;

    // Sort by absolute SHAP value
    const sortedData = [...data].sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value));
    
    // Take top 10
    const topData = sortedData.slice(0, 10);

    const CustomTooltip = ({ active, payload }) => {
      if (!active || !payload || payload.length === 0) return null;

      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold text-sm mb-1">{data.feature}</p>
          <p className="text-xs text-gray-600">Value: {data.value?.toFixed(4)}</p>
          <p className="text-xs font-semibold mt-1">
            SHAP Impact: {data.shap_value > 0 ? '+' : ''}{data.shap_value?.toFixed(4)}
          </p>
        </div>
      );
    };

    return (
      <div>
        <div className="mb-4 flex items-center justify-between text-sm">
          <div>
            <span className="text-gray-600">Base Value: </span>
            <span className="font-semibold">R$ {baseValue?.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-600">Final Prediction: </span>
            <span className="font-semibold">R$ {finalValue?.toFixed(2)}</span>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={400}>
          <BarChart 
            data={topData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number"
              label={{ value: 'SHAP Value', position: 'bottom' }}
            />
            <YAxis 
              type="category" 
              dataKey="feature"
              width={110}
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={0} stroke="#666" />
            <Bar dataKey="shap_value" radius={[0, 4, 4, 0]}>
              {topData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.shap_value > 0 ? '#10b981' : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Handle loading state
  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-6">
          <Info className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Prediction Explainability</h2>
        </div>
        <p className="text-gray-500">Loading explainability data...</p>
      </div>
    );
  }

  // Set initial selected prediction if not set
  if (!selectedPrediction && data.recent_predictions && data.recent_predictions.length > 0) {
    setSelectedPrediction(data.recent_predictions[0]);
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Info className="text-blue-600" size={24} />
        <h2 className="text-xl font-semibold text-gray-900">Prediction Explainability</h2>
      </div>

      {/* Stock Selector */}
      <div className="mb-6">
        <StockSelector 
          value={selectedStock} 
          onChange={onStockChange}
        />
      </div>

      {/* Recent Predictions Selector */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Predictions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.recent_predictions && data.recent_predictions.map((pred) => (
            <PredictionCard 
              key={pred.id}
              prediction={pred}
              selected={selectedPrediction?.id === pred.id}
              onClick={() => setSelectedPrediction(pred)}
            />
          ))}
        </div>
        {(!data.recent_predictions || data.recent_predictions.length === 0) && (
          <p className="text-gray-500 text-center py-4">No recent predictions available</p>
        )}
      </div>

      {/* Explanation Details */}
      {selectedPrediction && (
        <div>
          {/* Prediction Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Prediction</div>
                <div className="text-2xl font-bold text-gray-900">
                  R$ {selectedPrediction.prediction_value.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Confidence</div>
                <div className="text-2xl font-bold text-gray-900">
                  {(selectedPrediction.confidence * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Dominant Model</div>
                <div className="text-2xl font-bold text-gray-900">
                  {selectedPrediction.dominant_model}
                </div>
              </div>
            </div>
          </div>

          {/* SHAP Waterfall Chart */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Feature Contributions (SHAP Values)
            </h3>
            <SHAPWaterfallChart 
              data={selectedPrediction.shap_waterfall}
              baseValue={selectedPrediction.base_value}
              finalValue={selectedPrediction.prediction_value}
            />
          </div>

          {/* Feature Values Table */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Values</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Feature
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SHAP Impact
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Direction
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedPrediction.top_features && selectedPrediction.top_features.map((feat, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {feat.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-600">
                        {feat.value?.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <span className={feat.shap_value > 0 ? 'text-green-600' : 'text-red-600'}>
                          {feat.shap_value > 0 ? '+' : ''}{feat.shap_value?.toFixed(4)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {feat.shap_value > 0 ? (
                          <ArrowUp size={16} className="inline text-green-600" />
                        ) : (
                          <ArrowDown size={16} className="inline text-red-600" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(!selectedPrediction.top_features || selectedPrediction.top_features.length === 0) && (
              <p className="text-gray-500 text-center py-4">No feature data available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

ExplainabilityPanel.propTypes = {
  data: PropTypes.shape({
    recent_predictions: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      prediction_date: PropTypes.string.isRequired,
      prediction_value: PropTypes.number.isRequired,
      confidence: PropTypes.number.isRequired,
      dominant_model: PropTypes.string.isRequired,
      base_value: PropTypes.number,
      shap_waterfall: PropTypes.array,
      top_features: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string.isRequired,
        value: PropTypes.number.isRequired,
        shap_value: PropTypes.number.isRequired
      }))
    }))
  }),
  selectedStock: PropTypes.string,
  onStockChange: PropTypes.func
};

export default ExplainabilityPanel;
