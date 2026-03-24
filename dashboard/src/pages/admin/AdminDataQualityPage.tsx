import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Database, Clock, Shield, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../../components/shared/InfoTooltip';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const fmt = (v: any, d = 1) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const AdminDataQualityPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tickerSearch, setTickerSearch] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('completeness');
  const [sortBy, setSortBy] = useState<'ticker' | 'completeness'>('completeness');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchQuality = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/monitoring/data-quality`, { headers: { 'x-api-key': API_KEY } });
      if (res.ok) setData(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchQuality(); }, []);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1836' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  const getStatusIcon = (value: number) => {
    if (value >= 0.95) return <CheckCircle size={16} color="#10b981" />;
    if (value >= 0.8) return <AlertTriangle size={16} color="#f59e0b" />;
    return <XCircle size={16} color="#ef4444" />;
  };

  const getStatusColor = (value: number) => value >= 0.95 ? '#10b981' : value >= 0.8 ? '#f59e0b' : '#ef4444';

  if (loading) {
    const sk: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1a1836' : '#e2e8f0'} 25%, ${darkMode ? '#2a2745' : '#f1f5f9'} 50%, ${darkMode ? '#1a1836' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ ...sk, height: 28, width: 200, marginBottom: 8 }} />
          <div style={{ ...sk, height: 16, width: 320 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ ...cardStyle, padding: '1rem' }}>
              <div style={{ ...sk, height: 12, width: 80, marginBottom: 8 }} />
              <div style={{ ...sk, height: 24, width: 60 }} />
            </div>
          ))}
        </div>
        <div style={{ ...sk, height: 100, marginBottom: '1rem', borderRadius: 12 }} />
        <div style={{ ...sk, height: 200, borderRadius: 12 }} />
      </div>
    );
  }

  if (!data) {
    return <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem', color: theme.textSecondary }}>Sem dados de qualidade disponíveis.</div>;
  }

  const completeness = data.completeness || {};
  const freshness = data.freshness || {};
  const coverage = data.coverage || {};
  const anomalies = data.anomalies || {};

  const tickers = completeness.tickers || [];
  const trends = completeness.trends || [];
  const sources = freshness.sources || [];
  const excludedTickers = coverage.excludedTickers || [];
  const anomalyList = anomalies.anomalies || [];
  const bySeverity = anomalies.bySeverity || {};
  const byType = anomalies.byType || {};

  const overallCompleteness = completeness.overallCompleteness ?? 0;
  const coverageRate = coverage.coverageRate ?? 0;
  const freshnessRate = freshness.currentSourcesPercentage ?? 0;
  const totalAnomalies = anomalies.totalAnomalies ?? 0;

  // Filter and sort tickers
  const filteredTickers = tickers
    .filter((t: any) => !tickerSearch || t.ticker.toLowerCase().includes(tickerSearch.toLowerCase()))
    .sort((a: any, b: any) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker) * dir;
      return (a.completenessRate - b.completenessRate) * dir;
    });

  const lowCompleteness = tickers.filter((t: any) => t.completenessRate < 0.95);
  const perfectTickers = tickers.filter((t: any) => t.completenessRate >= 1.0);

  const toggleSection = (s: string) => setExpandedSection(expandedSection === s ? null : s);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Qualidade de Dados</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0 }}>
            Completude, freshness, cobertura e anomalias dos dados do modelo
            {completeness.dateRange && <span> · {completeness.dateRange.start} a {completeness.dateRange.end}</span>}
          </p>
        </div>
        <button onClick={fetchQuality} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* How it works */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
        borderColor: darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
          💡 <strong style={{ color: theme.text }}>Como funciona:</strong> O sistema monitora 4 dimensões de qualidade: <strong style={{ color: theme.text }}>Completude</strong> (dados presentes vs esperados), <strong style={{ color: theme.text }}>Freshness</strong> (fontes atualizadas no prazo), <strong style={{ color: theme.text }}>Cobertura</strong> (tickers cobertos pelo modelo) e <strong style={{ color: theme.text }}>Anomalias</strong> (gaps, outliers e inconsistências).
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Completude Geral', value: overallCompleteness, icon: <Database size={16} />, color: getStatusColor(overallCompleteness), tip: 'Percentual médio de dados presentes vs esperados para todos os tickers.' },
          { label: 'Cobertura', value: coverageRate, icon: <Shield size={16} />, color: getStatusColor(coverageRate), tip: `${coverage.coveredTickers || 0} de ${coverage.universeSize || 0} tickers cobertos pelo modelo.` },
          { label: 'Freshness', value: freshnessRate, icon: <Clock size={16} />, color: getStatusColor(freshnessRate), tip: 'Percentual de fontes de dados atualizadas dentro do prazo esperado.' },
        ].map((kpi, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={12} />
              </span>
              {getStatusIcon(kpi.value)}
            </div>
            <div style={{ fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', fontWeight: 700, color: kpi.color, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</span>
              {fmt(kpi.value * 100)}%
            </div>
            <div style={{ marginTop: '0.4rem', height: 6, borderRadius: 3, background: darkMode ? '#2a2745' : '#e2e8f0' }}>
              <div style={{ height: '100%', borderRadius: 3, background: kpi.color, width: `${kpi.value * 100}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        ))}
        {/* Anomalies */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              Anomalias <InfoTooltip text="Número total de anomalias detectadas nos dados (gaps, outliers, inconsistências)." darkMode={darkMode} size={12} />
            </span>
            {totalAnomalies > 0 ? <AlertTriangle size={16} color="#ef4444" /> : <CheckCircle size={16} color="#10b981" />}
          </div>
          <div style={{ fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', fontWeight: 700, color: totalAnomalies > 0 ? '#ef4444' : '#10b981' }}>
            {totalAnomalies}
          </div>
          {totalAnomalies > 0 && (
            <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginTop: '0.3rem' }}>
              Alta: {bySeverity.high || 0} · Média: {bySeverity.medium || 0} · Baixa: {bySeverity.low || 0}
            </div>
          )}
        </div>
        {/* Extra stats */}
        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.4rem' }}>Tickers 100%</div>
          <div style={{ fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', fontWeight: 700, color: '#10b981' }}>{perfectTickers.length}</div>
          <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginTop: '0.3rem' }}>de {tickers.length} total</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.4rem' }}>Tickers {'<'} 95%</div>
          <div style={{ fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', fontWeight: 700, color: lowCompleteness.length > 0 ? '#ef4444' : '#10b981' }}>{lowCompleteness.length}</div>
          <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginTop: '0.3rem' }}>precisam atenção</div>
        </div>
      </div>

      {/* Completeness Trend Chart */}
      {trends.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>Tendência de Completude ({trends.length} dias)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 80 }}>
            {trends.map((t: any, i: number) => {
              const h = (t.completeness || 0) * 100;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }} title={`${t.date}: ${fmt(t.completeness * 100)}%`}>
                  <div style={{ width: '100%', height: `${h}%`, minHeight: 2, borderRadius: '2px 2px 0 0', background: getStatusColor(t.completeness), transition: 'height 0.3s' }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
            <span style={{ fontSize: '0.62rem', color: theme.textSecondary }}>{trends[0]?.date}</span>
            <span style={{ fontSize: '0.62rem', color: theme.textSecondary }}>{trends[trends.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Section: Freshness */}
      <div style={{ ...cardStyle, marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
        <button onClick={() => toggleSection('freshness')} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1rem',
          background: 'transparent', border: 'none', cursor: 'pointer', color: theme.text, textAlign: 'left',
        }}>
          {expandedSection === 'freshness' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Clock size={16} color="#8b5cf6" />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Freshness das Fontes</span>
          <span style={{ fontSize: '0.7rem', color: theme.textSecondary, marginLeft: 'auto' }}>{sources.length} fontes</span>
        </button>
        {expandedSection === 'freshness' && sources.length > 0 && (
          <div style={{ borderTop: `1px solid ${theme.border}`, padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sources.map((s: any, i: number) => {
                const statusColor = s.status === 'fresh' ? '#10b981' : s.status === 'warning' ? '#f59e0b' : '#ef4444';
                const statusLabel = s.status === 'fresh' ? 'Atualizado' : s.status === 'warning' ? 'Atenção' : 'Desatualizado';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 8, border: `1px solid ${theme.border}`, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>{s.source}</div>
                      <div style={{ fontSize: '0.68rem', color: theme.textSecondary }}>Frequência: {s.expectedFrequency} · Última: {s.lastUpdate}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{fmt(s.age, 1)}h atrás</span>
                      <span style={{ padding: '0.15rem 0.45rem', borderRadius: 10, fontSize: '0.68rem', fontWeight: 600, background: `${statusColor}15`, color: statusColor }}>{statusLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Section: Coverage */}
      <div style={{ ...cardStyle, marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
        <button onClick={() => toggleSection('coverage')} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1rem',
          background: 'transparent', border: 'none', cursor: 'pointer', color: theme.text, textAlign: 'left',
        }}>
          {expandedSection === 'coverage' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Shield size={16} color="#8b5cf6" />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Cobertura do Universo</span>
          <span style={{ fontSize: '0.7rem', color: theme.textSecondary, marginLeft: 'auto' }}>{coverage.coveredTickers || 0}/{coverage.universeSize || 0} cobertos</span>
        </button>
        {expandedSection === 'coverage' && (
          <div style={{ borderTop: `1px solid ${theme.border}`, padding: '0.75rem 1rem' }}>
            {excludedTickers.length > 0 && (
              <>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem' }}>
                  Tickers Excluídos ({excludedTickers.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {excludedTickers.map((t: any, i: number) => (
                    <div key={i} style={{
                      padding: '0.25rem 0.5rem', borderRadius: 6, fontSize: '0.72rem',
                      background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)',
                    }} title={t.reason}>
                      {t.ticker} <span style={{ opacity: 0.7, fontSize: '0.65rem' }}>({t.reason})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Section: Anomalies */}
      {totalAnomalies > 0 && (
        <div style={{ ...cardStyle, marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
          <button onClick={() => toggleSection('anomalies')} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1rem',
            background: 'transparent', border: 'none', cursor: 'pointer', color: theme.text, textAlign: 'left',
          }}>
            {expandedSection === 'anomalies' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <AlertTriangle size={16} color="#ef4444" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Anomalias Detectadas</span>
            <span style={{ fontSize: '0.7rem', color: '#ef4444', marginLeft: 'auto' }}>{totalAnomalies}</span>
          </button>
          {expandedSection === 'anomalies' && (
            <div style={{ borderTop: `1px solid ${theme.border}`, padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: theme.textSecondary }}>
                <span>Por tipo: Gap {byType.gap || 0} · Outlier {byType.outlier || 0} · Inconsistência {byType.inconsistency || 0}</span>
              </div>
              {anomalyList.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {anomalyList.slice(0, 20).map((a: any, i: number) => (
                    <div key={i} style={{ padding: '0.4rem 0.6rem', borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: '0.75rem', color: theme.text }}>
                      <span style={{ fontWeight: 600 }}>{a.ticker || a.feature || '—'}</span>
                      {a.type && <span style={{ color: theme.textSecondary }}> · {a.type}</span>}
                      {a.severity && <span style={{ color: a.severity === 'high' ? '#ef4444' : a.severity === 'medium' ? '#f59e0b' : theme.textSecondary }}> · {a.severity}</span>}
                      {a.description && <span style={{ color: theme.textSecondary }}> — {a.description}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section: All Tickers Completeness */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <button onClick={() => toggleSection('completeness')} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1rem',
          background: 'transparent', border: 'none', cursor: 'pointer', color: theme.text, textAlign: 'left',
        }}>
          {expandedSection === 'completeness' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Database size={16} color="#10b981" />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Completude por Ticker</span>
          <span style={{ fontSize: '0.7rem', color: theme.textSecondary, marginLeft: 'auto' }}>{tickers.length} tickers</span>
        </button>
        {expandedSection === 'completeness' && (
          <div style={{ borderTop: `1px solid ${theme.border}` }}>
            {/* Search + Sort */}
            <div style={{ padding: '0.6rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ position: 'relative', flex: '1 1 150px', minWidth: 0 }}>
                <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: theme.textSecondary }} />
                <input type="text" placeholder="Buscar ticker..." value={tickerSearch} onChange={e => setTickerSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem 0.4rem 0.4rem 1.8rem', background: darkMode ? '#0c0a1a' : '#f8fafc', border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ padding: '0.4rem 0.5rem', background: darkMode ? '#0c0a1a' : '#f8fafc', border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, fontSize: '0.78rem', outline: 'none', cursor: 'pointer' }}>
                <option value="completeness">Ordenar: Completude</option>
                <option value="ticker">Ordenar: Ticker</option>
              </select>
              <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} style={{ padding: '0.4rem 0.6rem', background: darkMode ? '#0c0a1a' : '#f8fafc', border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, fontSize: '0.78rem', cursor: 'pointer' }}>
                {sortDir === 'asc' ? '↑' : '↓'}
              </button>
              <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{filteredTickers.length} resultados</span>
            </div>

            {/* Ticker table */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 550 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {['Ticker', 'Completude', 'Esperado', 'Presente', 'Tendência (7d)', 'Status'].map(h => (
                      <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: theme.textSecondary, background: darkMode ? '#0c0a1a' : '#f8fafc' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTickers.map((t: any) => {
                    const pct = t.completenessRate;
                    const color = getStatusColor(pct);
                    const trend = t.trend || [];
                    return (
                      <tr key={t.ticker} style={{ borderBottom: `1px solid ${theme.border}` }}
                        onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#2a2745' : '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600, color: theme.text, fontSize: '0.82rem' }}>{t.ticker}</td>
                        <td style={{ padding: '0.45rem 0.6rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: darkMode ? '#2a2745' : '#e2e8f0', maxWidth: 80, overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct * 100}%` }} />
                            </div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color, minWidth: 40 }}>{fmt(pct * 100)}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', color: theme.textSecondary }}>{t.expectedDataPoints}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', color: theme.text }}>{t.presentDataPoints}</td>
                        <td style={{ padding: '0.45rem 0.6rem' }}>
                          {trend.length > 0 ? (
                            <svg width={56} height={16} style={{ display: 'block' }}>
                              {trend.map((v: number, i: number) => {
                                const x = (i / Math.max(trend.length - 1, 1)) * 52 + 2;
                                const y = 14 - v * 12;
                                return i === 0 ? null : (
                                  <line key={i} x1={(((i - 1) / Math.max(trend.length - 1, 1)) * 52) + 2} y1={14 - trend[i - 1] * 12} x2={x} y2={y}
                                    stroke={getStatusColor(v)} strokeWidth={1.5} />
                                );
                              })}
                            </svg>
                          ) : <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>—</span>}
                        </td>
                        <td style={{ padding: '0.45rem 0.6rem' }}>
                          {pct >= 0.95 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', color: '#10b981' }}><CheckCircle size={12} /> OK</span>
                          ) : pct >= 0.5 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', color: '#f59e0b' }}><AlertTriangle size={12} /> Parcial</span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', color: '#ef4444' }}><XCircle size={12} /> Baixa</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDataQualityPage;
