import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { Card } from './Card';

interface SegmentData {
  range: string;
  accuracy: number;
  mape: number;
  count: number;
  minReturn: number;
  maxReturn: number;
}

interface SegmentationChartProps {
  data: SegmentData[];
  loading?: boolean;
  error?: Error;
  height?: number;
  onCustomRanges?: (ranges: number[]) => void;
}

/**
 * SegmentationChart - Displays model performance segmented by return ranges
 * 
 * Requirements:
 * - 13.1: Display performance segmentation on Validation tab
 * - 13.2: Segment predictions into return ranges (large negative, small negative, neutral, small positive, large positive)
 * - 13.3: Calculate accuracy for each return range segment
 * - 13.4: Calculate MAPE for each return range segment
 * - 13.5: Display number of predictions in each segment
 * - 13.6: Use grouped bar chart to compare metrics across segments
 * - 13.7: Allow users to define custom return range boundaries
 * - 13.8: Highlight segments with accuracy below 50%
 */
export const SegmentationChart: React.FC<SegmentationChartProps> = ({
  data,
  loading = false,
  error,
  height = 400,
  onCustomRanges,
}) => {
  const [showCustomRanges, setShowCustomRanges] = useState(false);
  const [customBoundaries, setCustomBoundaries] = useState<string>('-10,-5,0,5,10');

  // Format data for display
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((segment) => ({
      ...segment,
      // Highlight segments with accuracy below 50%
      accuracyColor: segment.accuracy < 0.5 ? '#c04040' : '#4ead8a',
    }));
  }, [data]);

  // Handle custom range submission
  const handleCustomRanges = () => {
    try {
      const boundaries = customBoundaries
        .split(',')
        .map((b) => parseFloat(b.trim()))
        .filter((b) => !isNaN(b))
        .sort((a, b) => a - b);

      if (boundaries.length < 2) {
        alert('Please provide at least 2 boundary values');
        return;
      }

      if (onCustomRanges) {
        onCustomRanges(boundaries);
      }
      setShowCustomRanges(false);
    } catch (err) {
      alert('Invalid boundary values. Please use comma-separated numbers.');
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const segment = payload[0].payload;
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
            {segment.range}
          </p>
          <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#5a7268' }}>
            Range: {segment.minReturn.toFixed(1)}% to {segment.maxReturn.toFixed(1)}%
          </p>
          <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#5a7268' }}>
            Predictions: {segment.count}
          </p>
          <p
            style={{
              margin: '4px 0',
              fontSize: '0.875rem',
              color: segment.accuracy < 0.5 ? '#c04040' : '#4ead8a',
              fontWeight: 'bold',
            }}
          >
            Accuracy: {(segment.accuracy * 100).toFixed(1)}%
          </p>
          <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#5a7268' }}>
            MAPE: {(segment.mape * 100).toFixed(1)}%
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
          <p>Loading segmentation chart...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#c04040' }}>
          <p>Error loading segmentation chart: {error.message}</p>
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#5a7268' }}>
          <p>No data available for segmentation chart</p>
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
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
            Performance by Return Range
          </h3>
          <button
            onClick={() => setShowCustomRanges(!showCustomRanges)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              border: '1px solid #d4e5dc',
              borderRadius: '6px',
              backgroundColor: 'white',
              color: '#5a7268',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {showCustomRanges ? 'Cancel' : 'Custom Ranges'}
          </button>
        </div>

        {/* Custom range input */}
        {showCustomRanges && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '1rem',
              backgroundColor: '#f6faf8',
              borderRadius: '8px',
              border: '1px solid #d4e5dc',
            }}
          >
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#2a4038',
              }}
            >
              Custom Range Boundaries (comma-separated, e.g., -10,-5,0,5,10):
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={customBoundaries}
                onChange={(e) => setCustomBoundaries(e.target.value)}
                placeholder="-10,-5,0,5,10"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #bdd4c8',
                  borderRadius: '6px',
                }}
              />
              <button
                onClick={handleCustomRanges}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#5a9e87',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Summary statistics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#f6faf8',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#5a7268', marginBottom: '0.25rem' }}>
              Total Predictions
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1a2e26' }}>
              {chartData.reduce((sum, s) => sum + s.count, 0)}
            </div>
          </div>
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#f6faf8',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#5a7268', marginBottom: '0.25rem' }}>
              Avg Accuracy
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1a2e26' }}>
              {(
                (chartData.reduce((sum, s) => sum + s.accuracy * s.count, 0) /
                  chartData.reduce((sum, s) => sum + s.count, 0)) *
                100
              ).toFixed(1)}
              %
            </div>
          </div>
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#f6faf8',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#5a7268', marginBottom: '0.25rem' }}>
              Segments Below 50%
            </div>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: chartData.filter((s) => s.accuracy < 0.5).length > 0 ? '#c04040' : '#4ead8a',
              }}
            >
              {chartData.filter((s) => s.accuracy < 0.5).length}
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, bottom: 60, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#d4e5dc" />
            <XAxis
              dataKey="range"
              tick={{ fontSize: '0.75rem', fill: '#5a7268' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: '0.75rem', fill: '#5a7268' }}
              label={{
                value: 'Accuracy / MAPE',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: '0.875rem', fill: '#5a7268' },
              }}
              domain={[0, 1]}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: '0.75rem', fill: '#5a7268' }}
              label={{
                value: 'Count',
                angle: 90,
                position: 'insideRight',
                style: { fontSize: '0.875rem', fill: '#5a7268' },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '0.875rem' }}
              verticalAlign="top"
              height={36}
            />

            {/* Reference line for 50% accuracy threshold */}
            <ReferenceLine
              yAxisId="left"
              y={0.5}
              stroke="#c04040"
              strokeDasharray="5 5"
              label={{
                value: '50% Threshold',
                position: 'insideTopRight',
                style: { fontSize: '0.75rem', fill: '#c04040' },
              }}
            />

            {/* Accuracy bars with conditional coloring */}
            <Bar yAxisId="left" dataKey="accuracy" name="Accuracy" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.accuracyColor} />
              ))}
            </Bar>

            {/* MAPE bars */}
            <Bar
              yAxisId="left"
              dataKey="mape"
              name="MAPE"
              fill="#d4a84b"
              radius={[4, 4, 0, 0]}
            />

            {/* Count bars */}
            <Bar
              yAxisId="right"
              dataKey="count"
              name="Count"
              fill="#5a7268"
              opacity={0.3}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default SegmentationChart;
