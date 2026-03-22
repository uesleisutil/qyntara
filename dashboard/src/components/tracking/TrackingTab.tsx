import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, XCircle, TrendingUp, TrendingDown, BarChart3, Target } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../shared/InfoTooltip';

interface TrackingTabProps { darkMode?: boolean; }

interface Validation {
  ticker: string;
  prediction_date: string;
  target_date: string;
  predicted_return: number;
  actual_return: number | null;
  error: number | null;
  direction_correct: boolean | null;
  days_elapsed: number;
}

interface Safra {
  date: string;
  targetDate: string;
  items: Validation[];
  completed: number;
  pending: number;
  avgPredicted: number;
  avgActual: number | null;
  directionAccuracy: number | null;
  mae: number | null;
  buySignals: Validation[];
  sellSignals: Validation[];
}

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const TrackingTab: React.FC<TrackingTabProps> = ({ darkMode = false }) => {
  const [validations, setValidations] = useState<Validation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSafra, setExpandedSafra] = useState<string | null>(null);
  const [filterSignal, setFilterSignal] = useState<'all' | 'buy' | 'sell'>('all');

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    hover: darkMode ? '#334155' : '#f1f5f9',
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`,
    borderRadius: 12, padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  useEffect(() => { fetchValidations(); }, []);

  const fetchValidations = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/recommendations/validation`, { headers: { 'x-api-key': API_KEY } });
      if (!res.ok) throw new Error('Falha ao carregar dados de acompanhamento');
      const data = await res.json();
      setValidations(data.validations || []);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  // Group by prediction_date (safra)
  const safras: Safra[] = React.useMemo(() => {
    const grouped: Record<string, Validation[]> = {};
    validations.forEach(v => {
      if (!grouped[v.prediction_date]) grouped[v.prediction_date] = [];
      grouped[v.prediction_date].push(v);
    });

    return Object.entries(grouped)
      .map(([date, items]) => {
        const completed = items.filter(i => i.actual_return !== null);
        const pending = items.filter(i => i.actual_return === null);
        const avgPredicted = items.reduce((s, i) => s + i.predicted_return, 0) / items.length;
        const avgActual = completed.length > 0
          ? completed.reduce((s, i) => s + (i.actual_return || 0), 0) / completed.length
          : null;
        const dirCorrect = completed.filter(i => i.direction_correct === true);
        const directionAccuracy = completed.length > 0 ? dirCorrect.length / completed.length : null;
        const mae = completed.length > 0
          ? completed.reduce((s, i) => s + Math.abs(i.error || 0), 0) / completed.length
          : null;
        const buySignals = items.filter(i => i.predicted_return >= 0.03); // ~1.5 score threshold approx
        const sellSignals = items.filter(i => i.predicted_return <= -0.03);

        return {
          date, targetDate: items[0]?.target_date || '',
          items, completed: completed.length, pending: pending.length,
          avgPredicted, avgActual, directionAccuracy, mae,
          buySignals, sellSignals,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [validations]);

  // Global stats
  const totalPredictions = validations.length;
  const totalCompleted = validations.filter(v => v.actual_return !== null).length;
  const totalPending = totalPredictions - totalCompleted;
  const completedItems = validations.filter(v => v.actual_return !== null);
  const globalDirAccuracy = completedItems.length > 0
    ? completedItems.filter(v => v.direction_correct === true).length / completedItems.length
    : null;
  const globalMAE = completedItems.length > 0
    ? completedItems.reduce((s, v) => s + Math.abs(v.error || 0), 0) / completedItems.length
    : null;

  if (loading) {
    const skeletonPulse: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1e293b' : '#e2e8f0'} 25%, ${darkMode ? '#334155' : '#f1f5f9'} 50%, ${darkMode ? '#1e293b' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ ...skeletonPulse, height: 28, width: 250, marginBottom: 8 }} />
          <div style={{ ...skeletonPulse, height: 16, width: 350 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ ...cardStyle, padding: '1rem' }}>
              <div style={{ ...skeletonPulse, height: 14, width: 80, marginBottom: 8 }} />
              <div style={{ ...skeletonPulse, height: 28, width: 60 }} />
            </div>
          ))}
        </div>
        {[1,2,3].map(i => <div key={i} style={{ ...skeletonPulse, height: 80, marginBottom: 8 }} />)}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>
          Acompanhamento por Safra
        </h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0 }}>
          Previsão vs realidade — cada safra é um dia de recomendações com vencimento em 20 pregões
        </p>
      </div>

      {error && (
        <div style={{ ...cardStyle, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* How it works */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
        borderColor: darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
          💡 <strong style={{ color: theme.text }}>Como funciona:</strong> Cada dia o modelo gera previsões de retorno para 20 pregões à frente. Quando esse prazo vence, comparamos a previsão com o que realmente aconteceu. Isso permite avaliar se o modelo está acertando a direção (sobe/desce) e a magnitude dos retornos. Safras <span style={{ color: '#f59e0b' }}>⏳ pendentes</span> ainda não venceram.
        </div>
      </div>

      {/* Global KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total de Previsões', value: `${totalPredictions}`, color: '#3b82f6', icon: <BarChart3 size={16} />,
            tip: 'Número total de previsões individuais (ticker × dia) nos últimos 30 dias.' },
          { label: 'Concluídas', value: `${totalCompleted}`, color: '#10b981', icon: <CheckCircle size={16} />,
            tip: 'Previsões cujo prazo de 20 pregões já venceu e temos o retorno real para comparar.' },
          { label: 'Pendentes', value: `${totalPending}`, color: '#f59e0b', icon: <Clock size={16} />,
            tip: 'Previsões que ainda não venceram — o prazo de 20 pregões ainda não passou.' },
          { label: 'Acurácia Direcional', value: globalDirAccuracy !== null ? `${fmt(globalDirAccuracy * 100, 1)}%` : '—',
            color: globalDirAccuracy !== null && globalDirAccuracy >= 0.55 ? '#10b981' : '#f59e0b', icon: <Target size={16} />,
            tip: 'Percentual de vezes que o modelo acertou a direção (se a ação subiu ou desceu). Acima de 55% é bom para mercado financeiro.' },
          { label: 'Erro Médio (MAE)', value: globalMAE !== null ? `${fmt(globalMAE * 100, 2)}%` : '—',
            color: theme.textSecondary, icon: <TrendingDown size={16} />,
            tip: 'Erro absoluto médio entre o retorno previsto e o real. Quanto menor, mais preciso o modelo.' },
          { label: 'Safras', value: `${safras.length}`, color: '#8b5cf6', icon: <TrendingUp size={16} />,
            tip: 'Número de dias distintos com previsões. Cada dia é uma "safra" de recomendações.' },
        ].map((kpi, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={12} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</span>
              <span style={{ fontSize: 'clamp(1.1rem, 3vw, 1.35rem)', fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {([
          { key: 'all', label: 'Todas as safras' },
          { key: 'buy', label: 'Sinais de compra' },
          { key: 'sell', label: 'Sinais de venda' },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFilterSignal(f.key)} style={{
            padding: '0.4rem 0.75rem', borderRadius: 20, border: `1px solid ${filterSignal === f.key ? '#3b82f6' : theme.border}`,
            background: filterSignal === f.key ? '#3b82f6' : 'transparent',
            color: filterSignal === f.key ? 'white' : theme.textSecondary,
            fontSize: '0.78rem', fontWeight: filterSignal === f.key ? 600 : 400,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>{f.label}</button>
        ))}
      </div>

      {/* Safra Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {safras.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: theme.textSecondary }}>
            Nenhuma safra encontrada.
          </div>
        ) : safras.map(safra => {
          const isExpanded = expandedSafra === safra.date;
          const isCompleted = safra.completed > 0 && safra.pending === 0;
          const isPartial = safra.completed > 0 && safra.pending > 0;
          const statusColor = isCompleted ? '#10b981' : isPartial ? '#3b82f6' : '#f59e0b';
          const statusLabel = isCompleted ? 'Concluída' : isPartial ? 'Parcial' : 'Pendente';
          const statusIcon = isCompleted ? <CheckCircle size={14} /> : isPartial ? <BarChart3 size={14} /> : <Clock size={14} />;

          const displayItems = filterSignal === 'buy' ? safra.buySignals
            : filterSignal === 'sell' ? safra.sellSignals
            : safra.items;

          if (displayItems.length === 0) return null;

          return (
            <div key={safra.date} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              {/* Safra Header */}
              <button onClick={() => setExpandedSafra(isExpanded ? null : safra.date)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: 'clamp(0.65rem, 2vw, 0.85rem) clamp(0.75rem, 3vw, 1.25rem)',
                background: 'transparent', border: 'none', cursor: 'pointer', color: theme.text,
                textAlign: 'left', transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = theme.hover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Date */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text }}>
                    Safra {new Date(safra.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
                    Vencimento: {new Date(safra.targetDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    {' · '}{displayItems.length} previsões
                  </div>
                </div>

                {/* Status badge */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600,
                  background: `${statusColor}15`, color: statusColor, flexShrink: 0,
                }}>
                  {statusIcon} {statusLabel}
                </span>

                {/* Quick metrics */}
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', color: theme.textSecondary }}>Previsto</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: safra.avgPredicted >= 0 ? '#10b981' : '#ef4444' }}>
                      {safra.avgPredicted >= 0 ? '+' : ''}{fmt(safra.avgPredicted * 100, 1)}%
                    </div>
                  </div>
                  {safra.avgActual !== null && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.65rem', color: theme.textSecondary }}>Real</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: safra.avgActual >= 0 ? '#10b981' : '#ef4444' }}>
                        {safra.avgActual >= 0 ? '+' : ''}{fmt(safra.avgActual * 100, 1)}%
                      </div>
                    </div>
                  )}
                  {safra.directionAccuracy !== null && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.65rem', color: theme.textSecondary }}>Acurácia</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: safra.directionAccuracy >= 0.55 ? '#10b981' : '#f59e0b' }}>
                        {fmt(safra.directionAccuracy * 100, 0)}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Expand arrow */}
                <span style={{
                  fontSize: '0.9rem', color: theme.textSecondary, transition: 'transform 0.2s',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0,
                }}>▾</span>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${theme.border}`, padding: 0 }}>
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                          {['Ticker', 'Ret. Previsto', 'Ret. Real', 'Erro', 'Direção', 'Status'].map(h => (
                            <th key={h} style={{
                              padding: '0.5rem 0.6rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600,
                              color: theme.textSecondary, background: darkMode ? '#0f172a' : '#f8fafc',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayItems.sort((a, b) => Math.abs(b.predicted_return) - Math.abs(a.predicted_return)).map((item, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                            <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600, color: theme.text, fontSize: '0.82rem' }}>{item.ticker}</td>
                            <td style={{ padding: '0.45rem 0.6rem', color: item.predicted_return >= 0 ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.82rem' }}>
                              {item.predicted_return >= 0 ? '+' : ''}{fmt(item.predicted_return * 100, 2)}%
                            </td>
                            <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }}>
                              {item.actual_return !== null ? (
                                <span style={{ color: item.actual_return >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                  {item.actual_return >= 0 ? '+' : ''}{fmt(item.actual_return * 100, 2)}%
                                </span>
                              ) : <span style={{ color: theme.textSecondary }}>—</span>}
                            </td>
                            <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', color: theme.textSecondary }}>
                              {item.error !== null ? `${fmt(Math.abs(item.error) * 100, 2)}%` : '—'}
                            </td>
                            <td style={{ padding: '0.45rem 0.6rem' }}>
                              {item.direction_correct === true && <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.78rem' }}><CheckCircle size={13} /> Acertou</span>}
                              {item.direction_correct === false && <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.78rem' }}><XCircle size={13} /> Errou</span>}
                              {item.direction_correct === null && <span style={{ color: theme.textSecondary, fontSize: '0.78rem' }}>—</span>}
                            </td>
                            <td style={{ padding: '0.45rem 0.6rem' }}>
                              {item.actual_return !== null ? (
                                <span style={{ padding: '0.15rem 0.4rem', borderRadius: 8, fontSize: '0.68rem', fontWeight: 600, background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>Concluída</span>
                              ) : (
                                <span style={{ padding: '0.15rem 0.4rem', borderRadius: 8, fontSize: '0.68rem', fontWeight: 600, background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>Pendente</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrackingTab;
