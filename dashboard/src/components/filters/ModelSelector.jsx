import PropTypes from 'prop-types';

/**
 * ModelSelector - Model selection component with multi-select support
 * 
 * Features:
 * - Single or multi-select mode
 * - Visual toggle buttons for multi-select
 * - Dropdown for single select
 * - Select all / Clear all for multi-select
 */
const ModelSelector = ({ value, onChange, multiSelect = false }) => {
  const models = [
    { id: 'deepar', name: 'DeepAR', color: 'bg-blue-600' },
    { id: 'lstm', name: 'LSTM', color: 'bg-green-600' },
    { id: 'prophet', name: 'Prophet', color: 'bg-yellow-600' },
    { id: 'xgboost', name: 'XGBoost', color: 'bg-red-600' }
  ];

  if (multiSelect) {
    const handleToggle = (modelId) => {
      if (Array.isArray(value)) {
        if (value.includes(modelId)) {
          onChange(value.filter(m => m !== modelId));
        } else {
          onChange([...value, modelId]);
        }
      } else {
        onChange([modelId]);
      }
    };

    const handleSelectAll = () => {
      onChange(models.map(m => m.id));
    };

    const handleClearAll = () => {
      onChange([]);
    };

    const selectedCount = Array.isArray(value) ? value.length : 0;

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Select Models
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              disabled={selectedCount === models.length}
              className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Select All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={handleClearAll}
              disabled={selectedCount === 0}
              className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Clear All
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {models.map((model) => {
            const isSelected = Array.isArray(value) && value.includes(model.id);
            return (
              <button
                key={model.id}
                onClick={() => handleToggle(model.id)}
                className={`px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                  isSelected
                    ? `${model.color} text-white border-transparent shadow-md`
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                {model.name}
                {isSelected && (
                  <span className="ml-2">✓</span>
                )}
              </button>
            );
          })}
        </div>
        {selectedCount > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            {selectedCount} model{selectedCount !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Model
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">All Models</option>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
    </div>
  );
};

ModelSelector.propTypes = {
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string)
  ]),
  onChange: PropTypes.func.isRequired,
  multiSelect: PropTypes.bool
};

export default ModelSelector;
