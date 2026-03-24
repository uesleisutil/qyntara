import React, { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { GitBranch } from 'lucide-react';

/**
 * SankeyDiagram - Display sector flows using D3.js
 * 
 * Requirements:
 * - 56.1: Display Sankey diagram on Backtesting tab
 * - 56.2: Show portfolio allocation by sector at start period
 * - 56.3: Show portfolio allocation by sector at end period
 * - 56.4: Display flows between sectors showing rebalancing
 * - 56.5: Size flows proportionally to capital moved
 * - 56.6: Color-code sectors consistently
 * - 56.7: Display sector names and allocation percentages
 * - 56.8: Add hover tooltips with exact amounts
 * - 56.9: Add start and end date selectors
 * - 56.10: Highlight largest sector rotations
 */

interface SankeyDiagramProps {
  sectorFlows: Array<{
    from: string;
    to: string;
    amount: number;
  }>;
  portfolioData: Array<{
    date: string;
    value: number;
    positions: Array<{
      ticker: string;
      shares: number;
      value: number;
      weight: number;
    }>;
  }>;
  darkMode?: boolean;
}

export const SankeyDiagram: React.FC<SankeyDiagramProps> = ({
  sectorFlows,
  portfolioData,
  darkMode = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const theme = useMemo(() => ({
    cardBg: darkMode ? '#1a1836' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#9895b0' : '#64748b',
    border: darkMode ? '#2a2745' : '#e2e8f0',
  }), [darkMode]);

  const sectorColors: Record<string, string> = useMemo(() => ({
    'Financials': '#8b5cf6',
    'Energy': '#f59e0b',
    'Materials': '#8b5cf6',
    'Industrials': '#10b981',
    'Consumer': '#ec4899',
    'Healthcare': '#06b6d4',
    'Technology': '#6366f1',
    'Utilities': '#14b8a6',
    'Real Estate': '#f97316',
    'Telecom': '#a855f7',
  }), []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || sectorFlows.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    // Prepare nodes and links
    const nodes: Array<{ name: string }> = [];
    const links: Array<{ source: number; target: number; value: number }> = [];
    const nodeMap = new Map<string, number>();

    // Create nodes
    sectorFlows.forEach(flow => {
      if (!nodeMap.has(flow.from)) {
        nodeMap.set(flow.from, nodes.length);
        nodes.push({ name: flow.from });
      }
      if (!nodeMap.has(flow.to)) {
        nodeMap.set(flow.to, nodes.length);
        nodes.push({ name: flow.to });
      }
    });

    // Create links
    sectorFlows.forEach(flow => {
      const sourceIndex = nodeMap.get(flow.from);
      const targetIndex = nodeMap.get(flow.to);
      if (sourceIndex !== undefined && targetIndex !== undefined) {
        links.push({
          source: sourceIndex,
          target: targetIndex,
          value: flow.amount,
        });
      }
    });

    // Set up dimensions
    const margin = { top: 20, right: 150, bottom: 20, left: 150 };
    const width = containerRef.current.clientWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create sankey generator
    const sankeyGenerator = sankey<{ name: string }, { source: number; target: number; value: number }>()
      .nodeWidth(20)
      .nodePadding(20)
      .extent([[0, 0], [width, height]]);

    const { nodes: sankeyNodes, links: sankeyLinks } = sankeyGenerator({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d })),
    });

    // Draw links
    svg.append('g')
      .selectAll('path')
      .data(sankeyLinks)
      .enter()
      .append('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', d => {
        const sourceName = (d.source as any).name;
        return sectorColors[sourceName] || '#9895b0';
      })
      .attr('stroke-width', d => Math.max(1, d.width || 0))
      .attr('fill', 'none')
      .attr('opacity', 0.3)
      .on('mouseover', function(_event, _d) {
        d3.select(this).attr('opacity', 0.6);
      })
      .on('mouseout', function(_event, _d) {
        d3.select(this).attr('opacity', 0.3);
      })
      .append('title')
      .text(d => {
        const sourceName = (d.source as any).name;
        const targetName = (d.target as any).name;
        return `${sourceName} → ${targetName}\nR$ ${(d.value / 1000).toFixed(1)}k`;
      });

    // Draw nodes
    svg.append('g')
      .selectAll('rect')
      .data(sankeyNodes)
      .enter()
      .append('rect')
      .attr('x', d => d.x0 || 0)
      .attr('y', d => d.y0 || 0)
      .attr('height', d => (d.y1 || 0) - (d.y0 || 0))
      .attr('width', d => (d.x1 || 0) - (d.x0 || 0))
      .attr('fill', d => sectorColors[d.name] || '#9895b0')
      .attr('opacity', 0.8)
      .append('title')
      .text(d => `${d.name}\nR$ ${((d.value || 0) / 1000).toFixed(1)}k`);

    // Add node labels
    svg.append('g')
      .selectAll('text')
      .data(sankeyNodes)
      .enter()
      .append('text')
      .attr('x', d => (d.x0 || 0) < width / 2 ? (d.x1 || 0) + 6 : (d.x0 || 0) - 6)
      .attr('y', d => ((d.y1 || 0) + (d.y0 || 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => (d.x0 || 0) < width / 2 ? 'start' : 'end')
      .style('fill', theme.text)
      .style('font-size', '0.875rem')
      .style('font-weight', '600')
      .text(d => d.name);

  }, [sectorFlows, portfolioData, darkMode, theme, sectorColors]);

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
        <GitBranch size={20} color={darkMode ? '#9895b0' : '#64748b'} />
        <h2 style={{ 
          margin: 0, 
          fontSize: '1.25rem', 
          fontWeight: '700', 
          color: theme.text 
        }}>
          Sector Flows
        </h2>
      </div>

      <div ref={containerRef} style={{ width: '100%', overflowX: 'auto' }}>
        <svg ref={svgRef}></svg>
      </div>

      {sectorFlows.length === 0 && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: theme.textSecondary,
        }}>
          No sector flow data available
        </div>
      )}
    </div>
  );
};

export default SankeyDiagram;
