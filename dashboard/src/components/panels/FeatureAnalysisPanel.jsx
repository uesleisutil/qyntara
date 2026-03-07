import { useState } from 'react';
import PropTypes from 'prop-types';
import { BarChart3 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ScatterChart, Scatter, ZAxis, Cell } from 'recharts';
import FeatureImportanceChart from '../charts/FeatureImportanceChart';
import StockSelector from '../filters/StockSelector';

/**
 * FeatureAnalysisPanel - Display feature importance and analysis
 * 
 * Features:
 * - Tabs for feature importance, distributions, and correlations
 * - SHAP feature importance chart
 * - Feature distribution visualizations
 * - Correlation heatmap
 * - Stock and date filters
 * 
 * Requirements: 13.3, 15.3
 */
const FeatureAnalysisPanel = ({ 
  data = null,
  selectedStock = 'PETR4',
  onStockChange = () => {}
}) => {
  const [activeTab, setActiveTab] = useState('importance');

  // Tab button component
  const TabButton = ({ id, label, active }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
        active
          ? 'bg-white text-blue-600 border-b-2 border-blue-600'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  // Custom tooltip for distribution charts
  const DistributionTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-1">{label}</p>
        <p className="text-xs text-gray-600">
          Value: {payload[0].value?.toFixed(4)}
        </p>
      </div>
    );
  };

  // Custom tooltip for correlation heatmap
  const CorrelationTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-1">Correlation</p>
        <p className="text-xs text-gray-600">
          {data.feature1} × {data.feature2}
        </p>
        <p className="text-xs font-semibold mt-1">
          {data.correlation?.toFixed(3)}
        </p>
      </div>
    );
  };

  // Get color for correlation value
  const getCorrelationColor = (value) => {
    if (value > 0.7) return '#ef4444'; // Strong positive - red
    if (value > 0.3) return '#f97316'; // Moderate positive - orange
    if (value > -0.3) return '#94a3b8'; // Weak - gray
    if (value > -0.7) return '#3b82f6'; // Moderate negative - blue
    return '#1e40af'; // Strong negative - dark blue
  };

  // Handle loading state
  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Feature Analysis</h2>
        </div>
        <p className="text-gray-500">Loading feature data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="text-blue-600" size={24} />
        <h2 className="text-xl font-semibold text-gray-900">Feature Analysis</h2>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <StockSelector 
          value={selectedStock} 
          onChange={onStockChange}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <TabButton id="importance" label="Feature Importance" active={activeTab === 'importance'} />
        <TabButton id="distributions" label="Distributions" active={activeTab === 'distributions'} />
        <TabButton id="correlations" label="Correlations" active={activeTab === 'correlations'} />
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* Feature Importance Tab */}
        {activeTab === 'importance' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Top 20 Most Important Features (SHAP Values)
            </h3>
            <FeatureImportanceChart 
              shapValues={data.shap_values || []}
              topN={20}
            />
          </div>
        )}

        {/* Feature Distributions Tab */}
        {activeTab === 'distributions' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Feature Distributions Over Time
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.top_features && data.top_features.map((feature) => (
                <div key={feature.name} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    {feature.name}
                  </h4>
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={feature.distribution || []}>
                      <defs>
                        <linearGradient id={`gradient-${feature.name}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#8884d8"
                        fill={`url(#gradient-${feature.name})`}
                      />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<DistributionTooltip />} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="mt-2 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Category: {feature.category || 'N/A'}</span>
                      <span>Avg: {feature.avg_value?.toFixed(3) || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {(!data.top_features || data.top_features.length === 0) && (
              <p className="text-gray-500 text-center py-8">No distribution data available</p>
            )}
          </div>
        )}

        {/* Feature Correlations Tab */}
        {activeTab === 'correlations' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Feature Correlation Matrix
            </h3>
            <div className="overflow-x-auto">
              <ResponsiveContainer width="100%" height={500}>
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 80, left: 80 }}
                >
                  <XAxis 
                    type="category" 
                    dataKey="feature1" 
                    name="Feature 1"
                    angle={-45}
                    textAnchor="end"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="feature2" 
                    name="Feature 2"
                    tick={{ fontSize: 10 }}
                  />
                  <ZAxis 
                    type="number" 
                    dataKey="correlation" 
                    range={[100, 400]} 
                  />
                  <Tooltip content={<CorrelationTooltip />} />
                  <Scatter 
                    data={data.correlation_matrix || []}
                    shape="square"
                  >
                    {(data.correlation_matrix || []).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={getCorrelationColor(entry.correlation)}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4" style={{ backgroundColor: '#1e40af' }} />
                <span>Strong Negative (&lt; -0.7)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4" style={{ backgroundColor: '#3b82f6' }} />
                <span>Moderate Negative (-0.7 to -0.3)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4" style={{ backgroundColor: '#94a3b8' }} />
                <span>Weak (-0.3 to 0.3)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4" style={{ backgroundColor: '#f97316' }} />
                <span>Moderate Positive (0.3 to 0.7)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4" style={{ backgroundColor: '#ef4444' }} />
                <span>Strong Positive (&gt; 0.7)</span>
              </div>
            </div>

            {(!data.correlation_matrix || data.correlation_matrix.length === 0) && (
              <p className="text-gray-500 text-center py-8">No correlation data available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

FeatureAnalysisPanel.propTypes = {
  data: PropTypes.shape({
    shap_values: PropTypes.array,
    top_features: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string.isRequired,
      category: PropTypes.string,
      avg_value: PropTypes.number,
      distribution: PropTypes.array
    })),
    correlation_matrix: PropTypes.arrayOf(PropTypes.shape({
      feature1: PropTypes.string.isRequired,
      feature2: PropTypes.string.isRequired,
      correlation: PropTypes.number.isRequired
    }))
  }),
  selectedStock: PropTypes.string,
  onStockChange: PropTypes.func
};

export default FeatureAnalysisPanel;
