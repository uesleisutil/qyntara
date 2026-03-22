import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { AlertTriangle, TrendingDown, Info } from 'lucide-react';

interface ConceptDriftData {
  feature: string;
  currentCorrelation: number;
  baselineCorrelation: number;
  change: number;
  drifted: boolean;
}

interface ConceptDriftHeatmapProps {
  conceptDriftData: ConceptDriftData[];
  darkMode?: boolean;
  isMobile?: boolean;
}

export const ConceptDriftHeatmap: React.FC<ConceptDriftHeatmapProps> = ({
  conceptDriftData = [], darkMode = false, isMobile = false,
}) => {
  const heatmapRef = useRef<SVGSVGElement>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'feature' | 'currentCorrelation' | 'baselineCorrelation' | 'change'>('change');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const theme = React.useMemo(() => ({
    cardBg: darkMode ? '#1e293b' : '#fff',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    success: '#10b981', warning: '#f59e0b', error: '#ef4444',
  }), [darkMode]);

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1rem',
  };

  const overallDriftScore = conceptDriftData.length > 0
    ? conceptDriftData.reduce((sum, d) => sum + Math.abs(d.change), 0) / conceptDriftData.length : 0;
  const driftedFeatures = conceptDriftData.filter(f => f.drifted);
  const strongestDriftFeatures = [...conceptDriftData].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 10);

  const sortedFeatures = [...driftedFeatures].sort((a, b) => {
    const aVal = a[sortColumn]; const bVal = b[sortColumn];
    const m = sortDirection === 'asc' ? 1 : -1;
    if (typeof aVal === 'string' && typeof bVal === 'string') return m * aVal.localeCompare(bVal);
    return m * ((aVal as number) - (bVal as number));
  });

  const handleSort = (col: typeof sortColumn) => {
    if (sortColumn === col) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(col); setSortDirection(col === 'change' ? 'desc' : 'asc'); }
  };

  const SortIcon = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) return null;
    return <span style={{ marginLeft: '0.25rem' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  // D3 heatmap
  useEffect(() => {
    if (process.env.NODE_ENV === 'test' || !heatmapRef.current || strongestDriftFeatures.length === 0) return;
    const svg = d3.select(heatmapRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 40, right: 100, bottom: 60, left: 150 };
    const width = isMobile ? 350 : 800;
    const height = Math.max(300, strongestDriftFeatures.length * 30);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet');
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const yScale = d3.scaleBand().domain(strongestDriftFeatures.map(d => d.feature)).range([0, innerHeight]).padding(0.1);
    const xScale = d3.scaleBand().domain(['Baseline', 'Atual', 'Mudança']).range([0, innerWidth]).padding(0.1);
    const correlationColorScale = d3.scaleSequential(d3.interpolateRdBu).domain([1, -1]);
    const changeColorScale = (change: number) => {
      const abs = Math.abs(change);
      if (abs >= 0.2) return '#ef4444';
      if (abs >= 0.15) return '#f59e0b';
      return '#10b981';
    };

    strongestDriftFeatures.forEach(feature => {
      const y = yScale(feature.feature) || 0;
      const cellH = yScale.bandwidth();
      const fontSize = isMobile ? 10 : 12;

      // Baseline
      g.append('rect').attr('x', xScale('Baseline') || 0).attr('y', y).attr('width', xScale.bandwidth()).attr('height', cellH)
        .attr('fill', correlationColorScale(feature.baselineCorrelation)).attr('stroke', theme.border).attr('stroke-width', 1)
        .style('cursor', 'pointer').on('click', () => setSelectedFeature(feature.feature))
        .append('title').text(`${feature.feature}\nBaseline: ${feature.baselineCorrelation.toFixed(3)}`);
      g.append('text').attr('x', (xScale('Baseline') || 0) + xScale.bandwidth() / 2).attr('y', y + cellH / 2)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('font-size', fontSize)
        .attr('fill', Math.abs(feature.baselineCorrelation) > 0.5 ? 'white' : theme.text).attr('pointer-events', 'none')
        .text(feature.baselineCorrelation.toFixed(2));

      // Atual
      g.append('rect').attr('x', xScale('Atual') || 0).attr('y', y).attr('width', xScale.bandwidth()).attr('height', cellH)
        .attr('fill', correlationColorScale(feature.currentCorrelation)).attr('stroke', theme.border).attr('stroke-width', 1)
        .style('cursor', 'pointer').on('click', () => setSelectedFeature(feature.feature))
        .append('title').text(`${feature.feature}\nAtual: ${feature.currentCorrelation.toFixed(3)}`);
      g.append('text').attr('x', (xScale('Atual') || 0) + xScale.bandwidth() / 2).attr('y', y + cellH / 2)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('font-size', fontSize)
        .attr('fill', Math.abs(feature.currentCorrelation) > 0.5 ? 'white' : theme.text).attr('pointer-events', 'none')
        .text(feature.currentCorrelation.toFixed(2));

      // Mudança
      g.append('rect').attr('x', xScale('Mudança') || 0).attr('y', y).attr('width', xScale.bandwidth()).attr('height', cellH)
        .attr('fill', changeColorScale(feature.change)).attr('stroke', theme.border).attr('stroke-width', feature.drifted ? 2 : 1)
        .style('cursor', 'pointer').on('click', () => setSelectedFeature(feature.feature))
        .append('title').text(`${feature.feature}\nMudança: ${feature.change >= 0 ? '+' : ''}${feature.change.toFixed(3)}\n${feature.drifted ? 'DRIFT DETECTADO' : 'Estável'}`);
      g.append('text').attr('x', (xScale('Mudança') || 0) + xScale.bandwidth() / 2).attr('y', y + cellH / 2)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('font-size', fontSize)
        .attr('font-weight', feature.drifted ? 'bold' : 'normal').attr('fill', 'white').attr('pointer-events', 'none')
        .text(`${feature.change >= 0 ? '+' : ''}${feature.change.toFixed(2)}`);
    });

    g.append('g').call(d3.axisLeft(yScale)).selectAll('text').attr('font-size', isMobile ? 10 : 12).attr('fill', theme.text);
    g.append('g').attr('transform', `translate(0,${innerHeight})`).call(d3.axisBottom(xScale)).selectAll('text').attr('font-size', isMobile ? 10 : 12).attr('fill', theme.text);
    g.append('text').attr('x', innerWidth / 2).attr('y', -20).attr('text-anchor', 'middle').attr('font-size', isMobile ? 14 : 16).attr('font-weight', 'bold').attr('fill', theme.text).text('Mudanças na Correlação Feature-Target');

    // Legend
    const legendWidth = 200; const legendHeight = 20;
    const legendX = innerWidth - legendWidth; const legendY = -35;
    const legendScale = d3.scaleLinear().domain([-1, 1]).range([0, legendWidth]);
    const legendAxis = d3.axisBottom(legendScale).ticks(5).tickFormat(d => Number(d).toFixed(1));
    const legendGradient = svg.append('defs').append('linearGradient').attr('id', 'correlation-gradient').attr('x1', '0%').attr('x2', '100%');
    legendGradient.selectAll('stop').data(d3.range(-1, 1.1, 0.1)).enter().append('stop')
      .attr('offset', d => `${((d + 1) / 2) * 100}%`).attr('stop-color', d => correlationColorScale(d));
    const legend = g.append('g').attr('transform', `translate(${legendX},${legendY})`);
    legend.append('rect').attr('width', legendWidth).attr('height', legendHeight).style('fill', 'url(#correlation-gradient)').attr('stroke', theme.border);
    legend.append('g').attr('transform', `translate(0,${legendHeight})`).call(legendAxis).selectAll('text').attr('font-size', 10).attr('fill', theme.text);
  }, [strongestDriftFeatures, darkMode, isMobile, theme]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '0.75rem' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <TrendingDown size={16} color={overallDriftScore > 0.2 ? theme.error : theme.success} />
            <span style={{ fontSize: '0.75rem', color: theme.textSecondary, fontWeight: 600 }}>Score Geral de Drift</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: overallDriftScore > 0.2 ? theme.error : theme.text, fontFamily: 'monospace' }}>
            {overallDriftScore.toFixed(3)}
          </p>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.7rem', color: theme.textSecondary }}>Mudança média absoluta de correlação</p>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <AlertTriangle size={16} color={driftedFeatures.length > 0 ? theme.warning : theme.success} />
            <span style={{ fontSize: '0.75rem', color: theme.textSecondary, fontWeight: 600 }}>Features Driftadas</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: theme.text }}>{driftedFeatures.length} / {conceptDriftData.length}</p>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.7rem', color: theme.textSecondary }}>Features com |mudança| &gt; 0.2</p>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <Info size={16} color={theme.textSecondary} />
            <span style={{ fontSize: '0.75rem', color: theme.textSecondary, fontWeight: 600 }}>% Drift</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: theme.text }}>
            {conceptDriftData.length > 0 ? ((driftedFeatures.length / conceptDriftData.length) * 100).toFixed(1) : '0.0'}%
          </p>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.7rem', color: theme.textSecondary }}>Percentual de features driftadas</p>
        </div>
      </div>

      {/* Heatmap */}
      <div style={cardStyle}>
        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>
          Heatmap de Mudança de Correlação
        </h4>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', color: theme.textSecondary }}>
          Top 10 features por mudança absoluta de correlação
        </p>
        {strongestDriftFeatures.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: theme.textSecondary }}>
            <Info size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <p style={{ margin: 0 }}>Nenhum dado de concept drift disponível</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <svg ref={heatmapRef} style={{ display: 'block', margin: '0 auto' }} />
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: darkMode ? '#0f172a' : '#f8fafc', borderRadius: 8, fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
              <strong style={{ color: theme.text }}>Interpretação:</strong>
              <ul style={{ margin: '0.3rem 0 0 0', paddingLeft: '1.2rem' }}>
                <li><strong>Baseline/Atual:</strong> Azul = correlação positiva, vermelho = correlação negativa</li>
                <li><strong>Mudança:</strong> Vermelho = drift detectado (|mudança| ≥ 0.2), laranja = alerta (≥ 0.15), verde = estável</li>
                <li>Concept drift ocorre quando a relação entre features e variável-alvo muda significativamente</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Tabela de features driftadas */}
      <div style={cardStyle}>
        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>
          Features com Concept Drift Mais Forte
        </h4>
        {driftedFeatures.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: theme.textSecondary }}>
            <Info size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <p style={{ margin: 0 }}>Nenhum concept drift detectado</p>
            <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.78rem' }}>Todas as correlações feature-target estão estáveis</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                  {[
                    { key: 'feature' as const, label: 'Feature', align: 'left' },
                    { key: 'baselineCorrelation' as const, label: 'Corr. Baseline', align: 'right' },
                    { key: 'currentCorrelation' as const, label: 'Corr. Atual', align: 'right' },
                    { key: 'change' as const, label: 'Mudança', align: 'right' },
                  ].map(h => (
                    <th key={h.key} onClick={() => handleSort(h.key)} style={{
                      padding: '0.6rem', textAlign: h.align as any, fontWeight: 600,
                      color: sortColumn === h.key ? '#3b82f6' : theme.textSecondary,
                      cursor: 'pointer', userSelect: 'none', fontSize: '0.75rem',
                      background: darkMode ? '#0f172a' : '#f8fafc', whiteSpace: 'nowrap',
                    }}>
                      {h.label} <SortIcon column={h.key} />
                    </th>
                  ))}
                  <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 600, color: theme.textSecondary, fontSize: '0.75rem', background: darkMode ? '#0f172a' : '#f8fafc' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedFeatures.map(f => (
                  <tr key={f.feature} onClick={() => setSelectedFeature(f.feature)}
                    style={{ borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', transition: 'background 0.15s',
                      background: selectedFeature === f.feature ? (darkMode ? '#334155' : '#f1f5f9') : 'transparent' }}
                    onMouseEnter={e => { if (selectedFeature !== f.feature) e.currentTarget.style.background = darkMode ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.03)'; }}
                    onMouseLeave={e => { if (selectedFeature !== f.feature) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '0.6rem', color: theme.text, fontWeight: 500 }}>{f.feature}</td>
                    <td style={{ padding: '0.6rem', textAlign: 'right', color: theme.text, fontFamily: 'monospace' }}>{f.baselineCorrelation.toFixed(3)}</td>
                    <td style={{ padding: '0.6rem', textAlign: 'right', color: theme.text, fontFamily: 'monospace' }}>{f.currentCorrelation.toFixed(3)}</td>
                    <td style={{ padding: '0.6rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: Math.abs(f.change) >= 0.2 ? 700 : 400, color: Math.abs(f.change) >= 0.2 ? theme.error : theme.text }}>
                      {f.change >= 0 ? '+' : ''}{f.change.toFixed(3)}
                    </td>
                    <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                        padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600,
                        background: Math.abs(f.change) >= 0.3
                          ? (darkMode ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)')
                          : (darkMode ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)'),
                        color: Math.abs(f.change) >= 0.3 ? '#ef4444' : '#f59e0b',
                      }}>
                        <AlertTriangle size={11} />
                        {Math.abs(f.change) >= 0.3 ? 'Alto' : 'Moderado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConceptDriftHeatmap;
