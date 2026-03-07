import PropTypes from 'prop-types';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import MAPETimeSeriesChart from '../charts/MAPETimeSeriesChart';
import ModelComparisonChart from '../charts/ModelComparisonChart';
import StockSelector from '../filters/StockSelector';
import DateRangePicker from '../filters/DateRangePicker';

/**
 * ModelPerformancePanel - Display model performance metrics and comparisons
 * 
 * Features:
 * - Metric cards showing MAPE, coverage, interval width, top performers
 * - Integrated MAPE time series chart
 * - Model comparison radar chart
 * - Stock and date range filters
 * - Trend indicators for each metric
 * 
 * Requirements: 13.1, 13.2, 13.3
 */
const ModelPerformancePanel = ({ 
  data = null,
  selectedStock = null,
  dateRange = { start: '2024-01-01', end: '2024-12-31' },
  onStockChange = () => {},
  onDateRangeChange = () => {}
}) => {
  // Render trend icon based on trend value
  const renderTrendIcon = (trend) => {
    if (!trend) return <Minus size={16} className="text-gray-400" />;
    
    if (trend === 'improving' || trend === 'up') {
      return <TrendingUp size={16} className="text-green-500" />;
    } else if (trend === 'degrading' || trend === 'down') {
      return <TrendingDown size={16} className="text-red-500" />;
    }
    return <Minus size={16} className="text-gray-400" />;
  };

  // Render metric card
  const MetricCard = ({ title, value, target, format = 'number', suffix = '', trend }) => {
    const isPercentage = format === 'percentage';
    const displayValue = value != null 
      ? isPercentage 
        ? `${value.toFixed(1)}%` 
        : `${value}${suffix}`
      : 'N/A';
    
    // Determine if metric meets target
    const meetsTarget = value != null && target != null
      ? (title === 'Ensemble MAPE' || title === 'Avg Interval Width')
        ? value <= target  // Lower is better
        : value >= target  // Higher is better
      : null;

    return (
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">{title}</span>
          {renderTrendIcon(trend)}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900">{displayValue}</span>
          {target != null && (
            <span className={`text-xs ${meetsTarget ? 'text-green-600' : 'text-red-600'}`}>
              Target: {isPercentage ? `${target}%` : target}{suffix}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Handle loading state
  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Model Performance</h2>
        </div>
        <p className="text-gray-500">Loading performance data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Activity className="text-blue-600" size={24} />
        <h2 className="text-xl font-semibold text-gray-900">Model Performance</h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <StockSelector 
            value={selectedStock} 
            onChange={onStockChange}
          />
        </div>
        <div className="flex-1 min-w-[300px]">
          <DateRangePicker 
            value={dateRange} 
            onChange={onDateRangeChange}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard 
          title="Ensemble MAPE"
          value={data.ensemble_mape}
          target={7.0}
          format="percentage"
          trend={data.mape_trend}
        />
        <MetricCard 
          title="Coverage"
          value={data.coverage}
          target={90.0}
          format="percentage"
          trend={data.coverage_trend}
        />
        <MetricCard 
          title="Avg Interval Width"
          value={data.interval_width}
          target={15.0}
          format="percentage"
          trend={data.interval_trend}
        />
        <MetricCard 
          title="Top Performers"
          value={data.top_performers_count}
          target={30}
          format="count"
          suffix=" stocks"
          trend={data.performers_trend}
        />
      </div>

      {/* MAPE Time Series Chart */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">MAPE Evolution</h3>
        <MAPETimeSeriesChart 
          data={data.mape_history || []}
          selectedModels={['ensemble', 'deepar', 'lstm', 'prophet', 'xgboost']}
          showConfidenceBands={true}
        />
      </div>

      {/* Model Comparison Chart */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Model Comparison</h3>
        <ModelComparisonChart 
          data={data.model_comparison || []}
        />
      </div>
    </div>
  );
};

ModelPerformancePanel.propTypes = {
  data: PropTypes.shape({
    ensemble_mape: PropTypes.number,
    coverage: PropTypes.number,
    interval_width: PropTypes.number,
    top_performers_count: PropTypes.number,
    mape_trend: PropTypes.string,
    coverage_trend: PropTypes.string,
    interval_trend: PropTypes.string,
    performers_trend: PropTypes.string,
    mape_history: PropTypes.array,
    model_comparison: PropTypes.array
  }),
  selectedStock: PropTypes.string,
  dateRange: PropTypes.shape({
    start: PropTypes.string.isRequired,
    end: PropTypes.string.isRequired
  }),
  onStockChange: PropTypes.func,
  onDateRangeChange: PropTypes.func
};

export default ModelPerformancePanel;
