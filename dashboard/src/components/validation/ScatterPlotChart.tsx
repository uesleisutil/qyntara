import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card } from './Card';

interface PredictionPoint {
  ticker: string;
  date: string;
  predicted: number;
  actual: number;
  error: number;
}

interface ScatterPlotChartProps {
  data: PredictionPoint[];
  loading?: boolean;
  error?: Error;
  height?: number;
}

/**
 * ScatterPlotChart - Displays predicted vs actual returns scatter plot
 * 
 * Requirements:
 * - 11.1: Display scatter plot on Validation tab
 * - 11.2: Plot predicted returns on x-axis
 * - 11.3: Plot actual returns on y-axis
 * - 11.4: Display diagonal reference line (perfect predictions)
 * - 11.5: Color-code points by prediction error magnitude
 * - 11.6: Display correlation coefficient
 * - 11.7: Hover tooltips with ticker details
 * - 11.8: Calculate and display R-squared value
 */
export const ScatterPlotChart: React.FC<ScatterPlotChartProps> = ({
  data,
  loading = false,
  error,
  height = 500,
}) => {
  // Calculate statistics
  const statistics = useMemo(() => {
    if (!data || data.length === 0) {
      return { correlation: 0, rSquared: 0, meanError: 0, stdError: 0 };
    }

    const n = data.length;
    const predictedValues = data.map((d) => d.predicted);
    const actualValues = data.map((d) => d.actual);
    const errors = data.map((d) => d.error);

    // Calculate means
    const meanPredicted = predictedValues.reduce((a, b) => a + b, 0) / n;
    const meanActual = actualValues.reduce((a, b) => a + b, 0) / n;
    const meanError = errors.reduce((a, b) => a + b, 0) / n;

    // Calculate correlation coefficient
    let numerator = 0;
    let denomPredicted = 0;
    let denomActual = 0;

    for (let i = 0; i < n; i++) {
      const diffPredicted = predictedValues[i] - meanPredicted;
      const diffActual = actualValues[i] - meanActual;
      numerator += diffPredicted * diffActual;
      denomPredicted += diffPredicted * diffPredicted;
      denomActual += diffActual * diffActual;
    }

    const correlation =
      denomPredicted === 0 || denomActual === 0
        ? 0
        : numerator / Math.sqrt(denomPredicted * denomActual);

    // Calculate R-squared
    const rSquared = correlation * correlation;

    // Calculate standard deviation of errors
    const variance =
      errors.reduce((sum, err) => sum + Math.pow(err - meanError, 2), 0) / n;
    const stdError = Math.sqrt(variance);

    return { correlation, rSquared, meanError, stdError };
  }, [data]);

  // Color-code points by error magnitude
  const coloredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((point) => {
      const absError = Math.abs(point.error);
      const errorMagnitude = absError / (statistics.stdError || 1);

      let fill: string;
      if (errorMagnitude > 3) {
        fill = '#c04040'; // Red - outlier (>3 std devs)
      } else if (errorMagnitude > 2) {
        fill = '#d4a84b'; // Orange - high error (>2 std devs)
      } else if (errorMagnitude > 1) {
        fill = '#e0b85c'; // Yellow - medium error (>1 std dev)
      } else {
        fill = '#4ead8a'; // Green - low error
      }

      return {
        ...point,
        fill,
        errorMagnitude,
      };
    });
  }, [data, statistics.stdError]);

  // Calculate axis ranges
  const axisRange = useMemo(() => {
    if (!data || data.length === 0) return { min: -10, max: 10 };

    const allValues = [
      ...data.map((d) => d.predicted),
      ...data.map((d) => d.actual),
    ];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = (max - min) * 0.1;

    return {
      min: Math.floor(min - padding),
      max: Math.ceil(max + padding),
    };
  }, [data]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const point = payload[0].payload;
      return (
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #d4e5dc',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#1a2e26' }}>
            {point.ticker}
          </p>
          <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#5a7268' }}>
            Date: {point.date}
          </p>
          <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#5a7268' }}>
            Predicted: {point.predicted.toFixed(2)}%
          </p>
          <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#5a7268' }}>
            Actual: {point.actual.toFixed(2)}%
          </p>
          <p
            style={{
              margin: '4px 0',
              fontSize: '0.875rem',
              color: point.error > 0 ? '#c04040' : '#4ead8a',
              fontWeight: 'bold',
            }}
          >
            Error: {point.error.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading scatter plot...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#c04040' }}>
          <p>Error loading scatter plot: {error.message}</p>
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#5a7268' }}>
          <p>No data available for scatter plot</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ padding: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
            Predicted vs Actual Returns
          </h3>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
            <div>
              <span style={{ color: '#5a7268' }}>Correlation: </span>
              <span style={{ fontWeight: 'bold', color: '#1a2e26' }}>
                {statistics.correlation.toFixed(3)}
              </span>
            </div>
            <div>
              <span style={{ color: '#5a7268' }}>R²: </span>
              <span style={{ fontWeight: 'bold', color: '#1a2e26' }}>
                {statistics.rSquared.toFixed(3)}
              </span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart
            margin={{ top: 20, right: 30, bottom: 60, left: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#d4e5dc" />
            <XAxis
              type="number"
              dataKey="predicted"
              name="Predicted Return"
              domain={[axisRange.min, axisRange.max]}
              label={{
                value: 'Predicted Return (%)',
                position: 'bottom',
                offset: 40,
                style: { fontSize: '0.875rem', fill: '#5a7268' },
              }}
              tick={{ fontSize: '0.75rem', fill: '#5a7268' }}
            />
            <YAxis
              type="number"
              dataKey="actual"
              name="Actual Return"
              domain={[axisRange.min, axisRange.max]}
              label={{
                value: 'Actual Return (%)',
                angle: -90,
                position: 'left',
                offset: 40,
                style: { fontSize: '0.875rem', fill: '#5a7268' },
              }}
              tick={{ fontSize: '0.75rem', fill: '#5a7268' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              content={() => (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '1rem',
                    fontSize: '0.75rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#4ead8a',
                      }}
                    />
                    <span>Low Error (&lt;1σ)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#e0b85c',
                      }}
                    />
                    <span>Medium Error (1-2σ)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#d4a84b',
                      }}
                    />
                    <span>High Error (2-3σ)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#c04040',
                      }}
                    />
                    <span>Outlier (&gt;3σ)</span>
                  </div>
                </div>
              )}
            />
            {/* Diagonal reference line for perfect predictions */}
            <ReferenceLine
              segment={[
                { x: axisRange.min, y: axisRange.min },
                { x: axisRange.max, y: axisRange.max },
              ]}
              stroke="#8fa89c"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: 'Perfect Prediction',
                position: 'insideTopRight',
                style: { fontSize: '0.75rem', fill: '#5a7268' },
              }}
            />
            <Scatter
              name="Predictions"
              data={coloredData}
              fill="#5a9e87"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default ScatterPlotChart;
