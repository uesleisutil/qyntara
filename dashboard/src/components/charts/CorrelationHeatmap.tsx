import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { BaseChart } from './BaseChart';
import './PerformanceComponents.css';

interface CorrelationData {
  features: string[];
  correlations: number[][];
}

interface CorrelationHeatmapProps {
  data: CorrelationData;
  loading?: boolean;
  error?: Error;
  height?: number;
  width?: number;
  onCellClick?: (feature1: string, feature2: string, correlation: number) => void;
}

export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({
  data,
  loading,
  error,
  height = 600,
  width,
  onCellClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const containerWidth = width || containerRef.current.clientWidth;
    const margin = { top: 100, right: 50, bottom: 100, left: 100 };
    const chartWidth = containerWidth - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', containerWidth)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const { features, correlations } = data;
    const n = features.length;

    // Calculate cell size
    const cellSize = Math.min(chartWidth / n, chartHeight / n);

    // Scales
    const xScale = d3.scaleBand()
      .domain(features)
      .range([0, cellSize * n])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(features)
      .range([0, cellSize * n])
      .padding(0.05);

    // Color scale: red (-1) to white (0) to blue (+1)
    const colorScale = d3.scaleLinear<string>()
      .domain([-1, 0, 1])
      .range(['#d32f2f', '#ffffff', '#1976d2']);

    // Prepare cell data
    const cellData: Array<{
      x: string;
      y: string;
      value: number;
      xIndex: number;
      yIndex: number;
    }> = [];

    features.forEach((xFeature, i) => {
      features.forEach((yFeature, j) => {
        cellData.push({
          x: xFeature,
          y: yFeature,
          value: correlations[i][j],
          xIndex: i,
          yIndex: j,
        });
      });
    });

    // Draw cells
    const cells = g.selectAll('.heatmap-cell')
      .data(cellData)
      .enter()
      .append('g')
      .attr('class', 'heatmap-cell')
      .attr('transform', d => `translate(${xScale(d.x)},${yScale(d.y)})`);

    cells.append('rect')
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => colorScale(d.value))
      .attr('stroke', d => Math.abs(d.value) > 0.7 ? '#ff9800' : 'none')
      .attr('stroke-width', 2)
      .attr('rx', 2)
      .style('cursor', onCellClick ? 'pointer' : 'default')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 0.8);
        
        if (tooltipRef.current) {
          const tooltip = d3.select(tooltipRef.current);
          tooltip
            .style('display', 'block')
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
            .html(`
              <strong>${d.x}</strong> vs <strong>${d.y}</strong><br/>
              Correlation: <strong>${d.value.toFixed(3)}</strong>
              ${Math.abs(d.value) > 0.7 ? '<br/><span style="color: #ff9800;">⚠️ Strong correlation</span>' : ''}
            `);
        }
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 1);
        if (tooltipRef.current) {
          d3.select(tooltipRef.current).style('display', 'none');
        }
      })
      .on('click', function(_event, d) {
        if (onCellClick) {
          onCellClick(d.x, d.y, d.value);
        }
      });

    // Add correlation values in cells (only for larger cells)
    if (cellSize > 40) {
      cells.append('text')
        .attr('x', xScale.bandwidth() / 2)
        .attr('y', yScale.bandwidth() / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', Math.min(cellSize / 4, 10))
        .attr('fill', d => Math.abs(d.value) > 0.5 ? '#fff' : '#000')
        .attr('pointer-events', 'none')
        .text(d => d.value.toFixed(2));
    }

    // X-axis labels
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${cellSize * n + 5})`)
      .selectAll('text')
      .data(features)
      .enter()
      .append('text')
      .attr('x', d => (xScale(d) || 0) + xScale.bandwidth() / 2)
      .attr('y', 0)
      .attr('text-anchor', 'start')
      .attr('transform', d => {
        const x = (xScale(d) || 0) + xScale.bandwidth() / 2;
        return `rotate(45, ${x}, 0)`;
      })
      .attr('font-size', Math.min(cellSize / 3, 11))
      .text(d => d);

    // Y-axis labels
    g.append('g')
      .attr('class', 'y-axis')
      .attr('transform', 'translate(-5,0)')
      .selectAll('text')
      .data(features)
      .enter()
      .append('text')
      .attr('x', 0)
      .attr('y', d => (yScale(d) || 0) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', Math.min(cellSize / 3, 11))
      .text(d => d);

    // Add color legend
    const legendWidth = 200;
    const legendHeight = 20;
    const legendX = chartWidth - legendWidth - 20;
    const legendY = -60;

    const legendScale = d3.scaleLinear()
      .domain([-1, 1])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d => d.toString());

    const legendGradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'correlation-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%');

    legendGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#d32f2f');

    legendGradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', '#ffffff');

    legendGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#1976d2');

    const legend = g.append('g')
      .attr('transform', `translate(${legendX},${legendY})`);

    legend.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#correlation-gradient)')
      .attr('stroke', '#ccc');

    legend.append('g')
      .attr('transform', `translate(0,${legendHeight})`)
      .call(legendAxis)
      .selectAll('text')
      .attr('font-size', 10);

    legend.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('font-weight', 600)
      .text('Correlation');

  }, [data, height, width, onCellClick]);

  return (
    <BaseChart
      loading={loading}
      error={error}
      height={height}
      title="Feature Correlation Heatmap"
      description="Pearson correlation between features (|r| > 0.7 highlighted)"
    >
      <div ref={containerRef} className="correlation-heatmap-container">
        <svg ref={svgRef} />
        <div ref={tooltipRef} className="correlation-tooltip" />
      </div>
    </BaseChart>
  );
};

export default CorrelationHeatmap;
