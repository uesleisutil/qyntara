import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface RecommendationMarker {
  date: string;
  score: number;
}

interface CandlestickChartProps {
  data: PriceData[];
  recommendations?: RecommendationMarker[];
  width?: number;
  height?: number;
  showMovingAverages?: boolean;
  movingAveragePeriods?: number[];
  onTimeRangeChange?: (range: string) => void;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  recommendations = [],
  // @ts-ignore - width is used in chartWidth calculation
  width = 800,
  height = 500,
  showMovingAverages = true,
  movingAveragePeriods = [20, 50, 200],
  onTimeRangeChange,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [timeRange, setTimeRange] = useState('1Y');
  const [hoveredData, setHoveredData] = useState<PriceData | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Filter data based on time range
    const filteredData = filterDataByTimeRange(data, timeRange);
    if (filteredData.length === 0) return;

    // Dimensions
    const margin = { top: 20, right: 60, bottom: 80, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const priceHeight = (height - margin.top - margin.bottom) * 0.7;
    const volumeHeight = (height - margin.top - margin.bottom) * 0.25;
    const gap = 10;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Parse dates
    const parseDate = d3.timeParse('%Y-%m-%d');
    const parsedData = filteredData.map(d => ({
      ...d,
      parsedDate: parseDate(d.date) || new Date(),
    }));

    // Scales
    const xScale = d3.scaleBand()
      .domain(parsedData.map(d => d.date))
      .range([0, chartWidth])
      .padding(0.3);

    const yPriceScale = d3.scaleLinear()
      .domain([
        (d3.min(parsedData, d => d.low) || 0) * 0.98,
        (d3.max(parsedData, d => d.high) || 0) * 1.02,
      ] as [number, number])
      .range([priceHeight, 0]);

    const yVolumeScale = d3.scaleLinear()
      .domain([0, d3.max(parsedData, d => d.volume) || 0])
      .range([volumeHeight, 0]);

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .tickValues(xScale.domain().filter((_, i) => i % Math.ceil(parsedData.length / 10) === 0))
      .tickFormat(d => {
        const date = parseDate(d as string);
        return date ? d3.timeFormat('%b %d')(date) : '';
      });

    const yPriceAxis = d3.axisLeft(yPriceScale)
      .ticks(8)
      .tickFormat(d => `R$ ${d3.format('.2f')(d as number)}`);

    const yVolumeAxis = d3.axisLeft(yVolumeScale)
      .ticks(4)
      .tickFormat(d => d3.format('.2s')(d as number));

    // Draw price chart area
    const priceGroup = g.append('g')
      .attr('class', 'price-chart');

    // Draw volume chart area
    const volumeGroup = g.append('g')
      .attr('class', 'volume-chart')
      .attr('transform', `translate(0,${priceHeight + gap})`);

    // Draw candlesticks
    const candleWidth = xScale.bandwidth();

    priceGroup.selectAll('.candle')
      .data(parsedData)
      .enter()
      .append('g')
      .attr('class', 'candle')
      .attr('transform', d => `translate(${xScale(d.date)},0)`)
      .each(function(d) {
        const candle = d3.select(this);
        const isUp = d.close >= d.open;
        const color = isUp ? '#10b981' : '#ef4444';

        // High-low line
        candle.append('line')
          .attr('x1', candleWidth / 2)
          .attr('x2', candleWidth / 2)
          .attr('y1', yPriceScale(d.high))
          .attr('y2', yPriceScale(d.low))
          .attr('stroke', color)
          .attr('stroke-width', 1);

        // Open-close rectangle
        candle.append('rect')
          .attr('x', 0)
          .attr('y', yPriceScale(Math.max(d.open, d.close)))
          .attr('width', candleWidth)
          .attr('height', Math.max(1, Math.abs(yPriceScale(d.open) - yPriceScale(d.close))))
          .attr('fill', color)
          .attr('stroke', color)
          .attr('stroke-width', 1);
      });

    // Draw volume bars
    volumeGroup.selectAll('.volume-bar')
      .data(parsedData)
      .enter()
      .append('rect')
      .attr('class', 'volume-bar')
      .attr('x', d => xScale(d.date) || 0)
      .attr('y', d => yVolumeScale(d.volume))
      .attr('width', candleWidth)
      .attr('height', d => volumeHeight - yVolumeScale(d.volume))
      .attr('fill', d => d.close >= d.open ? '#10b98180' : '#ef444480');

    // Draw moving averages
    if (showMovingAverages) {
      const maColors = ['#8b5cf6', '#f59e0b', '#8b5cf6'];
      
      movingAveragePeriods.forEach((period, idx) => {
        const ma = calculateMovingAverage(parsedData, period);
        
        const line = d3.line<{ date: string; value: number }>()
          .x(d => (xScale(d.date) || 0) + candleWidth / 2)
          .y(d => yPriceScale(d.value))
          .curve(d3.curveMonotoneX);

        priceGroup.append('path')
          .datum(ma)
          .attr('class', `ma-${period}`)
          .attr('fill', 'none')
          .attr('stroke', maColors[idx % maColors.length])
          .attr('stroke-width', 1.5)
          .attr('d', line);
      });
    }

    // Draw recommendation markers
    if (recommendations.length > 0) {
      const recGroup = priceGroup.append('g')
        .attr('class', 'recommendations');

      recommendations.forEach(rec => {
        const dataPoint = parsedData.find(d => d.date === rec.date);
        if (dataPoint) {
          recGroup.append('circle')
            .attr('cx', (xScale(rec.date) || 0) + candleWidth / 2)
            .attr('cy', yPriceScale(dataPoint.high) - 10)
            .attr('r', 5)
            .attr('fill', '#8b5cf6')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .append('title')
            .text(`Recommendation: ${rec.score.toFixed(2)}`);
        }
      });
    }

    // Draw axes
    priceGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${priceHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    priceGroup.append('g')
      .attr('class', 'y-axis')
      .call(yPriceAxis);

    volumeGroup.append('g')
      .attr('class', 'y-axis')
      .call(yVolumeAxis);

    // Add labels
    priceGroup.append('text')
      .attr('class', 'y-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 15)
      .attr('x', -priceHeight / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Price (R$)');

    volumeGroup.append('text')
      .attr('class', 'y-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 15)
      .attr('x', -volumeHeight / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Volume');

    // Add hover interaction
    svg.append('rect')
      .attr('class', 'overlay')
      .attr('x', margin.left)
      .attr('y', margin.top)
      .attr('width', chartWidth)
      .attr('height', priceHeight + gap + volumeHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mousemove', function(event) {
        const [mouseX] = d3.pointer(event);
        const x = mouseX - margin.left;
        const index = Math.floor(x / (chartWidth / parsedData.length));
        if (index >= 0 && index < parsedData.length) {
          setHoveredData(parsedData[index]);
        }
      })
      .on('mouseleave', () => setHoveredData(null));

    // Zoom and pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 10])
      .translateExtent([[0, 0], [width, height]])
      .extent([[0, 0], [width, height]])
      .on('zoom', (event) => {
        const transform = event.transform;
        const newXScale = transform.rescaleX(xScale);
        
        // Update candlesticks
        priceGroup.selectAll('.candle')
          .attr('transform', (d: any) => `translate(${newXScale(d.date)},0)`);
        
        // Update volume bars
        volumeGroup.selectAll('.volume-bar')
          .attr('x', (d: any) => newXScale(d.date) || 0);
        
        // Update x-axis
        priceGroup.select('.x-axis').call(xAxis.scale(newXScale) as any);
      });

    svg.call(zoom as any);

  }, [data, timeRange, recommendations, showMovingAverages, movingAveragePeriods, width, height]);

  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
    onTimeRangeChange?.(range);
  };

  return (
    <div className="candlestick-chart-container">
      <div className="chart-controls" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        {['1M', '3M', '6M', '1Y'].map(range => (
          <button
            key={range}
            onClick={() => handleTimeRangeChange(range)}
            className={`time-range-btn ${timeRange === range ? 'active' : ''}`}
            style={{
              padding: '0.5rem 1rem',
              background: timeRange === range ? '#8b5cf6' : '#f1f5f9',
              color: timeRange === range ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: timeRange === range ? 'bold' : 'normal',
            }}
          >
            {range}
          </button>
        ))}
      </div>

      <svg ref={svgRef} style={{ display: 'block' }} />

      {hoveredData && (
        <div
          className="chart-tooltip"
          style={{
            position: 'absolute',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '0.5rem',
            borderRadius: '4px',
            fontSize: '0.875rem',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <div><strong>{hoveredData.date}</strong></div>
          <div>Open: R$ {hoveredData.open.toFixed(2)}</div>
          <div>High: R$ {hoveredData.high.toFixed(2)}</div>
          <div>Low: R$ {hoveredData.low.toFixed(2)}</div>
          <div>Close: R$ {hoveredData.close.toFixed(2)}</div>
          <div>Volume: {d3.format(',')(hoveredData.volume)}</div>
        </div>
      )}

      {showMovingAverages && (
        <div className="ma-legend" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
          <strong>Moving Averages:</strong>
          {movingAveragePeriods.map((period, idx) => {
            const colors = ['#8b5cf6', '#f59e0b', '#8b5cf6'];
            return (
              <span key={period} style={{ marginLeft: '1rem' }}>
                <span style={{ color: colors[idx % colors.length] }}>●</span> {period}-day
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Helper functions
function filterDataByTimeRange(data: PriceData[], range: string): PriceData[] {
  const now = new Date();
  const cutoffDate = new Date();

  switch (range) {
    case '1M':
      cutoffDate.setMonth(now.getMonth() - 1);
      break;
    case '3M':
      cutoffDate.setMonth(now.getMonth() - 3);
      break;
    case '6M':
      cutoffDate.setMonth(now.getMonth() - 6);
      break;
    case '1Y':
      cutoffDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      return data;
  }

  return data.filter(d => new Date(d.date) >= cutoffDate);
}

function calculateMovingAverage(data: any[], period: number): { date: string; value: number }[] {
  const result: { date: string; value: number }[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
    result.push({ date: data[i].date, value: avg });
  }

  return result;
}
