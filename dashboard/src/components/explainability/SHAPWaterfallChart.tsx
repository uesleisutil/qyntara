/**
 * SHAPWaterfallChart Component
 * 
 * Displays waterfall chart showing SHAP feature contributions
 * - Shows base value and final prediction
 * - Color-codes by contribution direction
 * - Sorts by absolute SHAP magnitude
 * - Displays top 15 features
 * - Provides tooltips
 * 
 * Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7, 29.8
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TrendingUp, AlertCircle } from 'lucide-react';

interface ShapValue {
  feature: string;
  value: number;
  featureValue: number;
}

interface SHAPWaterfallChartProps {
  ticker: string;
  darkMode?: boolean;
}

const SHAPWaterfallChart: React.FC<SHAPWaterfallChartProps> = ({ ticker, darkMode = false }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    baseValue: number;
    prediction: number;
    shapValues: ShapValue[];
  } | null>(null);

  const theme = useMemo(() => ({
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  }), [darkMode]);

  useEffect(() => {
    // Mock data for demonstration - replace with actual API call
    const fetchSHAPData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock SHAP data
        const mockData = {
          baseValue: 25.50,
          prediction: 28.75,
          shapValues: [
            { feature: 'RSI_14', value: 0.85, featureValue: 65.2 },
            { feature: 'Volume_MA_20', value: 0.62, featureValue: 1250000 },
            { feature: 'Price_MA_50', value: 0.48, featureValue: 26.8 },
            { feature: 'MACD', value: 0.35, featureValue: 0.42 },
            { feature: 'Bollinger_Width', value: 0.28, featureValue: 0.15 },
            { feature: 'ATR_14', value: -0.22, featureValue: 1.2 },
            { feature: 'Stochastic', value: 0.18, featureValue: 72.5 },
            { feature: 'ROE', value: 0.15, featureValue: 0.18 },
            { feature: 'P/E_Ratio', value: -0.32, featureValue: 18.5 },
            { feature: 'Debt_to_Equity', value: -0.28, featureValue: 0.65 },
            { feature: 'EPS_Growth', value: 0.42, featureValue: 0.12 },
            { feature: 'Dividend_Yield', value: 0.12, featureValue: 0.045 },
            { feature: 'Market_Cap', value: -0.15, featureValue: 85000000000 },
            { feature: 'Beta', value: -0.18, featureValue: 1.25 },
            { feature: 'Momentum_20', value: 0.25, featureValue: 0.08 },
          ]
        };
        
        setData(mockData);
      } catch (err) {
        setError('Failed to load SHAP data');
      } finally {
        setLoading(false);
      }
    };

    fetchSHAPData();
  }, [ticker]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    // Sort by absolute SHAP value and take top 15
    const sortedData = [...data.shapValues]
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 15);

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    // Dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 150 };
    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Calculate cumulative values for waterfall
    let cumulative = data.baseValue;
    const waterfallData = sortedData.map(d => {
      const start = cumulative;
      cumulative += d.value;
      return {
        ...d,
        start,
        end: cumulative
      };
    });

    // Scales
    const yScale = d3.scaleBand()
      .domain(sortedData.map(d => d.feature))
      .range([0, height])
      .padding(0.2);

    const xExtent = d3.extent([
      data.baseValue,
      data.prediction,
      ...waterfallData.map(d => d.start),
      ...waterfallData.map(d => d.end)
    ]) as [number, number];
    
    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([0, width])
      .nice();

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(8))
      .style('color', theme.textSecondary)
      .style('font-size', '11px');

    svg.append('g')
      .call(d3.axisLeft(yScale))
      .style('color', theme.text)
      .style('font-size', '12px');

    // Add base value line
    svg.append('line')
      .attr('x1', xScale(data.baseValue))
      .attr('x2', xScale(data.baseValue))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', theme.textSecondary)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    // Add prediction line
    svg.append('line')
      .attr('x1', xScale(data.prediction))
      .attr('x2', xScale(data.prediction))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,4');

    // Create tooltip
    const tooltip = d3.select('body')
      .append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', darkMode ? '#1e293b' : 'white')
      .style('border', `1px solid ${theme.border}`)
      .style('border-radius', '8px')
      .style('padding', '12px')
      .style('font-size', '12px')
      .style('color', theme.text)
      .style('box-shadow', '0 4px 6px rgba(0,0,0,0.1)')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    // Add bars
    svg.selectAll('.bar')
      .data(waterfallData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(Math.min(d.start, d.end)))
      .attr('y', d => yScale(d.feature) || 0)
      .attr('width', d => Math.abs(xScale(d.end) - xScale(d.start)))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => d.value > 0 ? '#10b981' : '#ef4444')
      .attr('opacity', 0.8)
      .style('cursor', 'pointer')
      .on('mouseover', function(_event, d) {
        d3.select(this).attr('opacity', 1);
        tooltip
          .style('visibility', 'visible')
          .html(`
            <div style="font-weight: 600; margin-bottom: 6px;">${d.feature}</div>
            <div style="color: ${theme.textSecondary}; margin-bottom: 4px;">
              Feature Value: ${d.featureValue.toFixed(4)}
            </div>
            <div style="font-weight: 600; color: ${d.value > 0 ? '#10b981' : '#ef4444'};">
              SHAP Impact: ${d.value > 0 ? '+' : ''}${d.value.toFixed(4)}
            </div>
            <div style="color: ${theme.textSecondary}; margin-top: 4px; font-size: 11px;">
              ${d.value > 0 ? 'Increases' : 'Decreases'} prediction
            </div>
          `);
      })
      .on('mousemove', function(event) {
        tooltip
          .style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 0.8);
        tooltip.style('visibility', 'hidden');
      });

    // Add value labels on bars
    svg.selectAll('.label')
      .data(waterfallData)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', d => xScale(d.end) + (d.value > 0 ? 5 : -5))
      .attr('y', d => (yScale(d.feature) || 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => d.value > 0 ? 'start' : 'end')
      .attr('fill', theme.text)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text(d => `${d.value > 0 ? '+' : ''}${d.value.toFixed(3)}`);

    // Cleanup tooltip on unmount
    return () => {
      tooltip.remove();
    };
  }, [data, darkMode, theme]);

  if (loading) {
    return (
      <div style={{
        backgroundColor: theme.cardBg,
        padding: '2rem',
        borderRadius: '12px',
        textAlign: 'center',
        boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <p style={{ color: theme.textSecondary, margin: 0 }}>Loading SHAP values...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        backgroundColor: theme.cardBg,
        padding: '2rem',
        borderRadius: '12px',
        textAlign: 'center',
        boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <AlertCircle size={24} color="#ef4444" style={{ margin: '0 auto 0.5rem' }} />
        <p style={{ color: theme.textSecondary, margin: 0 }}>{error || 'No data available'}</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: theme.cardBg,
      padding: '1.5rem',
      borderRadius: '12px',
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <TrendingUp size={20} color="#3b82f6" />
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: theme.text }}>
          SHAP Feature Contributions - {ticker}
        </h3>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        padding: '1rem',
        backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        borderRadius: '8px'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
            Base Value
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: theme.text }}>
            R$ {data.baseValue.toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
            Final Prediction
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#3b82f6' }}>
            R$ {data.prediction.toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg ref={svgRef}></svg>
      </div>

      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        borderRadius: '8px',
        fontSize: '0.8125rem',
        color: theme.textSecondary
      }}>
        <strong>How to read:</strong> Green bars increase the prediction, red bars decrease it. 
        The length of each bar shows the magnitude of the feature's impact. 
        Features are sorted by absolute impact (largest first).
      </div>
    </div>
  );
};

export default SHAPWaterfallChart;
