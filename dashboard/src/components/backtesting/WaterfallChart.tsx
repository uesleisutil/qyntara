import React, { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { BarChart3 } from 'lucide-react';

/**
 * WaterfallChart - Display return decomposition using D3.js
 * 
 * Requirements:
 * - 55.1: Display waterfall chart on Backtesting tab
 * - 55.2: Show starting portfolio value as first bar
 * - 55.3: Show return contribution from each position as intermediate bars
 * - 55.4: Show ending portfolio value as final bar
 * - 55.5: Color positive contributions green, negative red
 * - 55.6: Display contribution values on bars
 * - 55.7: Sort positions by contribution magnitude
 * - 55.8: Display top 20 contributors
 * - 55.9: Group small contributions into "Other"
 * - 55.10: Allow time period selector
 */

interface WaterfallChartProps {
  returnDecomposition: Array<{
    ticker: string;
    contribution: number;
  }>;
  initialValue: number;
  finalValue: number;
  darkMode?: boolean;
}

export const WaterfallChart: React.FC<WaterfallChartProps> = ({
  returnDecomposition,
  initialValue,
  finalValue,
  darkMode = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const theme = useMemo(() => ({
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  }), [darkMode]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    // Sort by contribution magnitude and take top 20
    const sortedData = [...returnDecomposition]
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 20);

    // Group small contributions
    const topContributors = sortedData.slice(0, 19);
    const otherContribution = sortedData.slice(19).reduce((sum, item) => sum + item.contribution, 0);
    
    if (otherContribution !== 0) {
      topContributors.push({ ticker: 'Other', contribution: otherContribution });
    }

    // Prepare waterfall data
    const waterfallData: Array<{
      label: string;
      value: number;
      start: number;
      end: number;
      isTotal: boolean;
    }> = [];

    let cumulative = initialValue;
    
    // Starting value
    waterfallData.push({
      label: 'Initial',
      value: initialValue,
      start: 0,
      end: initialValue,
      isTotal: true,
    });

    // Contributions
    topContributors.forEach(item => {
      const contributionValue = item.contribution;
      waterfallData.push({
        label: item.ticker,
        value: contributionValue,
        start: cumulative,
        end: cumulative + contributionValue,
        isTotal: false,
      });
      cumulative += contributionValue;
    });

    // Final value
    waterfallData.push({
      label: 'Final',
      value: finalValue,
      start: 0,
      end: finalValue,
      isTotal: true,
    });

    // Set up dimensions
    const margin = { top: 20, right: 30, bottom: 80, left: 80 };
    const width = containerRef.current.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleBand()
      .domain(waterfallData.map(d => d.label))
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(waterfallData, d => Math.max(d.start, d.end)) || finalValue])
      .nice()
      .range([height, 0]);

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .style('fill', theme.textSecondary)
      .style('font-size', '0.75rem');

    svg.append('g')
      .call(d3.axisLeft(y).tickFormat(d => `R$ ${(d as number / 1000).toFixed(0)}k`))
      .selectAll('text')
      .style('fill', theme.textSecondary)
      .style('font-size', '0.75rem');

    // Bars
    svg.selectAll('.bar')
      .data(waterfallData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.label) || 0)
      .attr('y', d => y(Math.max(d.start, d.end)))
      .attr('width', x.bandwidth())
      .attr('height', d => Math.abs(y(d.start) - y(d.end)))
      .attr('fill', d => {
        if (d.isTotal) return '#3b82f6';
        return d.value >= 0 ? '#10b981' : '#dc2626';
      })
      .attr('opacity', 0.8);

    // Value labels
    svg.selectAll('.label')
      .data(waterfallData)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', d => (x(d.label) || 0) + x.bandwidth() / 2)
      .attr('y', d => y(Math.max(d.start, d.end)) - 5)
      .attr('text-anchor', 'middle')
      .style('fill', theme.text)
      .style('font-size', '0.75rem')
      .style('font-weight', '600')
      .text(d => {
        if (d.isTotal) {
          return `R$ ${(d.value / 1000).toFixed(0)}k`;
        }
        return `${d.value >= 0 ? '+' : ''}${(d.value / 1000).toFixed(1)}k`;
      });

  }, [returnDecomposition, initialValue, finalValue, darkMode, theme]);

  return (
    <div style={{
      backgroundColor: theme.cardBg,
      borderRadius: '12px',
      padding: '1.5rem',
      border: `1px solid ${theme.border}`,
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem', 
        marginBottom: '1.5rem' 
      }}>
        <BarChart3 size={20} color={darkMode ? '#94a3b8' : '#64748b'} />
        <h2 style={{ 
          margin: 0, 
          fontSize: '1.25rem', 
          fontWeight: '700', 
          color: theme.text 
        }}>
          Return Decomposition
        </h2>
      </div>

      <div ref={containerRef} style={{ width: '100%', overflowX: 'auto' }}>
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

export default WaterfallChart;
