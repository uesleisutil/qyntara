import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { BaseChart } from './BaseChart';
import './PerformanceComponents.css';

interface ConfusionMatrixData {
  predicted: {
    up: { actual: { up: number; down: number; neutral: number } };
    down: { actual: { up: number; down: number; neutral: number } };
    neutral: { actual: { up: number; down: number; neutral: number } };
  };
  precision: { up: number; down: number; neutral: number };
  recall: { up: number; down: number; neutral: number };
}

interface ConfusionMatrixChartProps {
  data: ConfusionMatrixData;
  loading?: boolean;
  error?: Error;
  height?: number;
  width?: number;
}

export const ConfusionMatrixChart: React.FC<ConfusionMatrixChartProps> = ({
  data,
  loading,
  error,
  height = 500,
  width,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Get container dimensions
    const containerWidth = width || containerRef.current.clientWidth;
    const margin = { top: 80, right: 120, bottom: 60, left: 120 };
    const chartWidth = containerWidth - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', containerWidth)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare matrix data
    const categories = ['up', 'down', 'neutral'];
    const matrixData: Array<{
      predicted: string;
      actual: string;
      count: number;
      percentage: number;
    }> = [];

    let totalPredictions = 0;
    categories.forEach(predicted => {
      categories.forEach(actual => {
        const count = data.predicted[predicted as keyof typeof data.predicted].actual[actual as 'up' | 'down' | 'neutral'];
        totalPredictions += count;
        matrixData.push({ predicted, actual, count, percentage: 0 });
      });
    });

    // Calculate percentages
    matrixData.forEach(d => {
      d.percentage = totalPredictions > 0 ? (d.count / totalPredictions) * 100 : 0;
    });

    // Scales
    const cellSize = Math.min(chartWidth, chartHeight) / 3;
    
    const xScale = d3.scaleBand()
      .domain(categories)
      .range([0, cellSize * 3])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(categories)
      .range([0, cellSize * 3])
      .padding(0.05);

    // Color scale based on percentage
    const maxPercentage = d3.max(matrixData, d => d.percentage) || 100;
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, maxPercentage]);

    // Draw cells
    const cells = g.selectAll('.cell')
      .data(matrixData)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', d => `translate(${xScale(d.actual)},${yScale(d.predicted)})`);

    cells.append('rect')
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => colorScale(d.percentage))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('rx', 4);

    // Add count text
    cells.append('text')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', yScale.bandwidth() / 2 - 10)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', d => d.percentage > maxPercentage * 0.5 ? '#fff' : '#000')
      .attr('font-size', '18px')
      .attr('font-weight', 'bold')
      .text(d => d.count);

    // Add percentage text
    cells.append('text')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', yScale.bandwidth() / 2 + 15)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', d => d.percentage > maxPercentage * 0.5 ? '#fff' : '#666')
      .attr('font-size', '12px')
      .text(d => `${d.percentage.toFixed(1)}%`);

    // Add axes labels
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${cellSize * 3 + 10})`)
      .selectAll('text')
      .data(categories)
      .enter()
      .append('text')
      .attr('x', d => (xScale(d) || 0) + xScale.bandwidth() / 2)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .text(d => d.toUpperCase());

    g.append('g')
      .attr('class', 'y-axis')
      .attr('transform', 'translate(-10,0)')
      .selectAll('text')
      .data(categories)
      .enter()
      .append('text')
      .attr('x', 0)
      .attr('y', d => (yScale(d) || 0) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .text(d => d.toUpperCase());

    // Add axis titles
    g.append('text')
      .attr('x', cellSize * 1.5)
      .attr('y', cellSize * 3 + 40)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .text('Actual Direction');

    g.append('text')
      .attr('transform', `translate(-60,${cellSize * 1.5}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .text('Predicted Direction');

    // Add precision and recall metrics
    const metricsY = cellSize * 3 + 80;
    
    // Precision
    g.append('text')
      .attr('x', 0)
      .attr('y', metricsY)
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .text('Precision:');

    categories.forEach((cat) => {
      g.append('text')
        .attr('x', xScale(cat)! + xScale.bandwidth() / 2)
        .attr('y', metricsY)
        .attr('text-anchor', 'middle')
        .attr('font-size', '13px')
        .text(`${(data.precision[cat as keyof typeof data.precision] * 100).toFixed(1)}%`);
    });

    // Recall
    const recallX = cellSize * 3 + 20;
    
    g.append('text')
      .attr('x', recallX)
      .attr('y', -10)
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .text('Recall');

    categories.forEach((cat) => {
      g.append('text')
        .attr('x', recallX)
        .attr('y', yScale(cat)! + yScale.bandwidth() / 2)
        .attr('text-anchor', 'start')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '13px')
        .text(`${(data.recall[cat as keyof typeof data.recall] * 100).toFixed(1)}%`);
    });

  }, [data, height, width]);

  return (
    <BaseChart
      loading={loading}
      error={error}
      height={height}
      title="Directional Prediction Confusion Matrix"
      description="Prediction accuracy for up/down/neutral market movements"
    >
      <div ref={containerRef} className="confusion-matrix-container">
        <svg ref={svgRef} />
      </div>
    </BaseChart>
  );
};

export default ConfusionMatrixChart;
