import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BaseChart } from './BaseChart';
import { BaseChartProps, useChartColors, getRechartsTheme } from '@lib/chartConfig';
import { useUI } from '@contexts/UIContext';

interface BarChartProps extends BaseChartProps {
  xKey: string;
  yKeys: string[];
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  title?: string;
  description?: string;
  horizontal?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  xKey,
  yKeys,
  colors,
  showLegend = true,
  showGrid = true,
  showTooltip = true,
  loading,
  error,
  height = 300,
  responsive = true,
  title,
  description,
  horizontal = false,
  onElementClick,
}) => {
  const chartColors = useChartColors();
  const { theme } = useUI();
  const rechartsTheme = getRechartsTheme(theme);

  const barColors = colors || chartColors.gradient;

  return (
    <BaseChart
      data={data}
      loading={loading}
      error={error}
      height={height}
      responsive={responsive}
      title={title}
      description={description}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onClick={onElementClick}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray={rechartsTheme.grid.strokeDasharray}
              stroke={rechartsTheme.grid.stroke}
            />
          )}
          {horizontal ? (
            <>
              <XAxis
                type="number"
                stroke={rechartsTheme.axis.stroke}
                style={{ fontSize: rechartsTheme.axis.fontSize }}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                stroke={rechartsTheme.axis.stroke}
                style={{ fontSize: rechartsTheme.axis.fontSize }}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                stroke={rechartsTheme.axis.stroke}
                style={{ fontSize: rechartsTheme.axis.fontSize }}
              />
              <YAxis
                stroke={rechartsTheme.axis.stroke}
                style={{ fontSize: rechartsTheme.axis.fontSize }}
              />
            </>
          )}
          {showTooltip && (
            <Tooltip
              contentStyle={{
                backgroundColor: rechartsTheme.tooltip.backgroundColor,
                border: rechartsTheme.tooltip.border,
                borderRadius: rechartsTheme.tooltip.borderRadius,
                color: rechartsTheme.tooltip.color,
              }}
            />
          )}
          {showLegend && (
            <Legend
              wrapperStyle={{
                fontSize: rechartsTheme.legend.fontSize,
                color: rechartsTheme.legend.color,
              }}
            />
          )}
          {yKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              fill={barColors[index % barColors.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </BaseChart>
  );
};
