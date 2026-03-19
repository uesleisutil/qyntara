import React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
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

interface LineChartProps extends BaseChartProps {
  xKey: string;
  yKeys: string[];
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  title?: string;
  description?: string;
}

export const LineChart: React.FC<LineChartProps> = ({
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
  onElementClick,
}) => {
  const chartColors = useChartColors();
  const { theme } = useUI();
  const rechartsTheme = getRechartsTheme(theme);

  const lineColors = colors || chartColors.gradient;

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
        <RechartsLineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onClick={onElementClick}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray={rechartsTheme.grid.strokeDasharray}
              stroke={rechartsTheme.grid.stroke}
            />
          )}
          <XAxis
            dataKey={xKey}
            stroke={rechartsTheme.axis.stroke}
            style={{ fontSize: rechartsTheme.axis.fontSize }}
          />
          <YAxis
            stroke={rechartsTheme.axis.stroke}
            style={{ fontSize: rechartsTheme.axis.fontSize }}
          />
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
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={lineColors[index % lineColors.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </BaseChart>
  );
};
