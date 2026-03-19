import React, { useMemo, useState } from 'react';
import { BaseChart } from './BaseChart';
import './PerformanceComponents.css';

interface ModelPerformance {
  modelId: string;
  modelName: string;
  mape: number;
  accuracy: number;
  sharpeRatio: number;
  correlation?: number;
}

interface ModelBreakdownTableProps {
  data: ModelPerformance[];
  loading?: boolean;
  error?: Error;
  height?: number;
}

type SortField = 'modelName' | 'mape' | 'accuracy' | 'sharpeRatio';
type SortDirection = 'asc' | 'desc';

export const ModelBreakdownTable: React.FC<ModelBreakdownTableProps> = ({
  data,
  loading,
  error,
  height = 400,
}) => {
  const [sortField, setSortField] = useState<SortField>('mape');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Find best performing model for each metric
  const bestModels = useMemo(() => {
    if (!data || data.length === 0) return {};

    return {
      mape: data.reduce((best, model) => 
        model.mape < best.mape ? model : best
      ).modelId,
      accuracy: data.reduce((best, model) => 
        model.accuracy > best.accuracy ? model : best
      ).modelId,
      sharpeRatio: data.reduce((best, model) => 
        model.sharpeRatio > best.sharpeRatio ? model : best
      ).modelId,
    };
  }, [data]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!data) return [];

    const sorted = [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle string comparison for modelName
      if (sortField === 'modelName') {
        return sortDirection === 'asc' 
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }

      // Numeric comparison
      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });

    return sorted;
  }, [data, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'mape' ? 'asc' : 'desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="sort-icon" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 3l3 4H3z" opacity="0.3" />
          <path d="M6 9l3-4H3z" opacity="0.3" />
        </svg>
      );
    }
    
    return sortDirection === 'asc' ? (
      <svg className="sort-icon" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 3l3 4H3z" />
      </svg>
    ) : (
      <svg className="sort-icon" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 9l3-4H3z" />
      </svg>
    );
  };

  const isBestModel = (modelId: string, metric: keyof typeof bestModels) => {
    return bestModels[metric] === modelId;
  };

  return (
    <BaseChart
      loading={loading}
      error={error}
      height={height}
      title="Individual Model Performance Breakdown"
      description="Compare performance metrics across all models in the ensemble"
    >
      <div className="model-breakdown-table-container">
        <table className="model-breakdown-table">
          <thead>
            <tr>
              <th 
                className="sortable"
                onClick={() => handleSort('modelName')}
              >
                Model {getSortIcon('modelName')}
              </th>
              <th 
                className="sortable numeric"
                onClick={() => handleSort('mape')}
                title="Mean Absolute Percentage Error (lower is better)"
              >
                MAPE {getSortIcon('mape')}
              </th>
              <th 
                className="sortable numeric"
                onClick={() => handleSort('accuracy')}
                title="Prediction accuracy percentage"
              >
                Accuracy {getSortIcon('accuracy')}
              </th>
              <th 
                className="sortable numeric"
                onClick={() => handleSort('sharpeRatio')}
                title="Risk-adjusted return metric"
              >
                Sharpe Ratio {getSortIcon('sharpeRatio')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((model) => (
              <tr key={model.modelId}>
                <td className="model-name">{model.modelName}</td>
                <td className={`numeric ${isBestModel(model.modelId, 'mape') ? 'best-metric' : ''}`}>
                  {model.mape.toFixed(2)}%
                  {isBestModel(model.modelId, 'mape') && (
                    <span className="best-badge" title="Best MAPE">★</span>
                  )}
                </td>
                <td className={`numeric ${isBestModel(model.modelId, 'accuracy') ? 'best-metric' : ''}`}>
                  {model.accuracy.toFixed(2)}%
                  {isBestModel(model.modelId, 'accuracy') && (
                    <span className="best-badge" title="Best Accuracy">★</span>
                  )}
                </td>
                <td className={`numeric ${isBestModel(model.modelId, 'sharpeRatio') ? 'best-metric' : ''}`}>
                  {model.sharpeRatio.toFixed(3)}
                  {isBestModel(model.modelId, 'sharpeRatio') && (
                    <span className="best-badge" title="Best Sharpe Ratio">★</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sortedData.length === 0 && !loading && !error && (
          <div className="empty-state">
            <p>No model performance data available</p>
          </div>
        )}
      </div>
    </BaseChart>
  );
};

export default ModelBreakdownTable;
