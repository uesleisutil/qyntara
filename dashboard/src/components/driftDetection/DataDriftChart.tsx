import React, { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { AlertTriangle, TrendingUp, Info } from 'lucide-react';

interface FeatureDriftData {
  feature: string;
  ksStatistic: number;
  pValue: number;
  drifted: boolean;
  magnitude: number;
  currentDistribution: number[];
  baselineDistribution: number[];
}

interface DataDriftChartProps {
  driftData: FeatureDriftData[];
  darkMode?: boolean;
  isMobile?: boolean;
}

export const DataDriftChart: React.FC<DataDriftChartProps> = ({
  driftData = [], darkMode = false, isMobile = false,
}) => {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'feature' | 'ksStatistic' | 'pValue' | 'magnitude'>('pValue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const theme = {
    cardBg: darkMode ? '#1e293b' : '#fff',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    success: '#10b981', warning: '#f59e0b', error: '#ef4444',
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1rem',
  };

  const driftedFeatures = driftData.filter(f => f.drifted);

  const sortedFeatures = [...driftedFeatures].sort((a, b) => {
    const aVal = a[sortColumn]; const bVal = b[sortColumn];
    const m = sortDirection === 'asc' ? 1 : -1;
    if (typeof aVal === 'string' && typeof bVal === 'string') return m * aVal.localeCompare(bVal);
    return m * ((aVal as number) - (bVal as number));
  });

  const handleSort = (col: typeof sortColumn) => {
    if (sortColumn === col) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(col); setSortDirection('asc'); }
  };

  const getHistogramData = (f: FeatureDriftData) =>
    Array.from({ length: f.currentDistribution.length }, (_, i) => ({
      bin: i, current: f.currentDistribution[i] || 0, baseline: f.baselineDistribution[i] || 0,
    }));

  const selectedFeatureData = selectedFeature ? driftData.find(f => f.feature === selectedFeature) : null;

  const SortIcon = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) return null;
    return <span style={{ marginLeft: '0.25rem' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Banner resumo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1rem', borderRadius: 10,
        background: driftedFeatures.length > 0
          ? (darkMode ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)')
          : (darkMode ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)'),
        border: `1px solid ${driftedFeatures.length > 0
          ? (darkMode ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.3)')
          : (darkMode ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.3)')}`,
      }}>
        {driftedFeatures.length > 0
          ? <AlertTriangle size={22} color="#f59e0b" />
          : <Info size={22} color="#10b981" />}
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: theme.text }}>
            {driftedFeatures.length} de {driftData.length} features com drift detectado
          </p>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: theme.textSecondary }}>
            Features com p-valor &lt; 0.05 são sinalizadas como driftadas (teste Kolmogorov-Smirnov)
          </p>
        </div>
      </div>

      {/* Tabela de features driftadas */}
      <div style={cardStyle}>
        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>
          Features com Drift
        </h4>
        {driftedFeatures.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: theme.textSecondary }}>
            <TrendingUp size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Nenhum drift detectado</p>
            <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.78rem' }}>Todas as distribuições estão estáveis</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                  {[
                    { key: 'feature' as const, label: 'Feature' },
                    { key: 'ksStatistic' as const, label: 'Estatística KS' },
                    { key: 'pValue' as const, label: 'P-Valor' },
                    { key: 'magnitude' as const, label: 'Magnitude' },
                  ].map(h => (
                    <th key={h.key} onClick={() => handleSort(h.key)} style={{
                      padding: '0.6rem', textAlign: h.key === 'feature' ? 'left' : 'right',
                      fontWeight: 600, color: sortColumn === h.key ? '#3b82f6' : theme.textSecondary,
                      cursor: 'pointer', userSelect: 'none', fontSize: '0.75rem',
                      background: darkMode ? '#0f172a' : '#f8fafc', whiteSpace: 'nowrap',
                    }}>
                      {h.label} <SortIcon column={h.key} />
                    </th>
                  ))}
                  <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 600, color: theme.textSecondary, fontSize: '0.75rem', background: darkMode ? '#0f172a' : '#f8fafc' }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedFeatures.map(f => (
                  <tr key={f.feature} onClick={() => setSelectedFeature(selectedFeature === f.feature ? null : f.feature)}
                    style={{
                      borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', transition: 'background 0.15s',
                      background: selectedFeature === f.feature ? (darkMode ? '#334155' : '#f1f5f9') : 'transparent',
                    }}
                    onMouseEnter={e => { if (selectedFeature !== f.feature) e.currentTarget.style.background = darkMode ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.03)'; }}
                    onMouseLeave={e => { if (selectedFeature !== f.feature) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '0.6rem', color: theme.text, fontWeight: 500 }}>{f.feature}</td>
                    <td style={{ padding: '0.6rem', textAlign: 'right', color: theme.text, fontFamily: 'monospace' }}>{f.ksStatistic.toFixed(4)}</td>
                    <td style={{ padding: '0.6rem', textAlign: 'right', color: theme.text, fontFamily: 'monospace' }}>{f.pValue.toFixed(4)}</td>
                    <td style={{ padding: '0.6rem', textAlign: 'right', color: theme.text, fontFamily: 'monospace' }}>{f.magnitude.toFixed(2)}</td>
                    <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                        padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600,
                        background: f.pValue < 0.01
                          ? (darkMode ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)')
                          : (darkMode ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)'),
                        color: f.pValue < 0.01 ? '#ef4444' : '#f59e0b',
                      }}>
                        <AlertTriangle size={11} />
                        {f.pValue < 0.01 ? 'Alto' : 'Moderado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Gráfico de comparação de distribuição */}
      {selectedFeatureData && (
        <div style={cardStyle}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>
            Comparação de Distribuição: {selectedFeatureData.feature}
          </h4>
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: '0.75rem', padding: '0.85rem', background: darkMode ? '#0f172a' : '#f8fafc',
            borderRadius: 8, marginBottom: '1rem',
          }}>
            {[
              { label: 'ESTATÍSTICA KS', value: selectedFeatureData.ksStatistic.toFixed(4), color: theme.text },
              { label: 'P-VALOR', value: selectedFeatureData.pValue.toFixed(4), color: selectedFeatureData.pValue < 0.05 ? theme.error : theme.success },
              { label: 'MAGNITUDE', value: selectedFeatureData.magnitude.toFixed(2), color: theme.text },
            ].map((m, i) => (
              <div key={i}>
                <p style={{ margin: 0, fontSize: '0.7rem', color: theme.textSecondary, fontWeight: 600 }}>{m.label}</p>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 700, color: m.color, fontFamily: 'monospace' }}>{m.value}</p>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={isMobile ? 280 : 360}>
            <BarChart data={getHistogramData(selectedFeatureData)} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis dataKey="bin" stroke={theme.textSecondary} label={{ value: 'Bins da Distribuição', position: 'insideBottom', offset: -10, style: { fill: theme.textSecondary, fontSize: 12 } }} />
              <YAxis stroke={theme.textSecondary} label={{ value: 'Frequência', angle: -90, position: 'insideLeft', style: { fill: theme.textSecondary, fontSize: 12 } }} />
              <Tooltip contentStyle={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text }} formatter={(v: number) => v.toFixed(4)} />
              <Legend wrapperStyle={{ color: theme.text }} />
              <Bar dataKey="baseline" fill="#3b82f6" fillOpacity={0.6} name="Distribuição Baseline" />
              <Bar dataKey="current" fill="#ef4444" fillOpacity={0.6} name="Distribuição Atual" />
            </BarChart>
          </ResponsiveContainer>

          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: darkMode ? '#0f172a' : '#f8fafc', borderRadius: 8, fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
            <strong style={{ color: theme.text }}>Interpretação:</strong> O teste Kolmogorov-Smirnov mede a distância máxima entre as funções de distribuição acumulada. Um p-valor &lt; 0.05 indica drift significativo, sugerindo que a distribuição da feature mudou em relação ao baseline.
          </div>
        </div>
      )}

      {/* Instrução quando nenhuma feature selecionada */}
      {!selectedFeatureData && driftedFeatures.length > 0 && (
        <div style={{ ...cardStyle, padding: '2rem', textAlign: 'center', color: theme.textSecondary }}>
          <Info size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            Clique em uma feature na tabela acima para visualizar a comparação de distribuição
          </p>
        </div>
      )}
    </div>
  );
};

export default DataDriftChart;
