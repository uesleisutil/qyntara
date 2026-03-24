import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw, CheckCircle, AlertTriangle, Clock, Search, Target, BarChart3 } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../../components/shared/ui/InfoTooltip';
import { fmt } from '../../lib/formatters';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const AdminValidationPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tickerSearch, setTickerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'validated' | 'pending'>('ALL');

  const fetchValidation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/recommendations/validation`, { headers: { 'x-api-key': API_KEY } });
      if (res.ok) { setData(await res.json()); setLastUpdated(new Date()); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchValidation(); }, []);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1836' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12,
    padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  const getRelativeTime = (d: Date) => {
    const diff = Math.round((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'agora mesmo';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    return `há ${Math.floor(diff / 3600)}h`;
  };

  if (loading) {
    const sk: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1a1836' : '#e2e8f0'} 25%, ${darkMode ? '#2a2745' : '#f1f5f9'} 50%, ${darkMode ? '#1a1836' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ ...sk, height: 28, width: 180, marginBottom: 8 }} />
          <div style={{ ...sk, height: 16, width: 300 }} />
        </div>
        <div style={{ ...sk, height: 52, marginBottom: '1rem', borderRadius: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ ...cardStyle, padding: '1rem' }}>
              <div style={{ ...sk, height: 14, width: 70, marginBottom: 8 }} />
              <div style={{ ...sk, height: 28, width: 50 }} />
            </div>
          ))}
        </div>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ ...sk, height: 48, marginBottom: 4 }} />
        ))}
      </div>
    );
  }

  if (!data) {
    return <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem', color: theme.textSecondary }}>Sem dados de validação disponíveis.</div>;
  }

  const summary = data?.summary || {};
  const validations = data?.validations || [];

  const completed = summary.completed_validations || 0;
  const pending = summary.pending_validations || 0;
  const total = summary.total_predictions || 0;
  const dirAcc = summary.directional_accuracy;
  const mae = summary.mean_absolute_error;
  const rmse = summary.rmse;

  const allPending = completed === 0 && pending > 0;

  // Filter validations
  const filtered = validations.filter((v: any) => {
    const hasActual = v.actual_return != null;
    if (statusFilter === 'validated' && !hasActual) return false;
    if (statusFilter === 'pending' && hasActual) return false;
    if (tickerSearch && !v.ticker?.toLowerCase().includes(tickerSearch.toLowerCase())) return false;
    return true;
  });

  const validatedCount = validations.filter((v: any) => v.actual_return != null).length;
  const pendingCount = validations.length - validatedCount;

  const kpis = [
    { label: 'Total Predições', value: total.toString(), color: '#8b5cf6', icon: <BarChart3 size={16} />, tip: 'Número total de predições feitas pelo modelo no período.' },
    { label: 'Validadas', value: completed.toString(), color: '#10b981', icon: <CheckCircle size={16} />, tip: 'Predições que já podem ser comparadas com preços reais (20+ dias passados).' },
    { label: 'Pendentes', value: pending.toString(), color: '#f59e0b', icon: <Clock size={16} />, tip: 'Predições aguardando 20 pregões para validação contra preços reais.' },
    { label: 'Acurácia Direcional', value: dirAcc != null ? `${fmt(dirAcc * 100, 1)}%` : allPending ? 'Aguardando' : '—', color: dirAcc != null && dirAcc >= 0.6 ? '#10b981' : '#f59e0b', icon: <Target size={16} />, tip: 'Percentual de predições que acertaram a direção (alta/baixa).' },
    { label: 'Erro Médio Absoluto', value: mae != null ? `${fmt(mae * 100)}%` : allPending ? 'Aguardando' : '—', color: mae != null && mae < 0.05 ? '#10b981' : '#ef4444', icon: <AlertTriangle size={16} />, tip: 'Erro médio absoluto entre retorno previsto e realizado.' },
    { label: 'RMSE', value: rmse != null ? fmt(rmse, 4) : allPending ? 'Aguardando' : '—', color: '#06b6d4', icon: <BarChart3 size={16} />, tip: 'Root Mean Square Error — penaliza erros grandes mais que o MAE.' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>✅ Validação</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            Predicted vs Actual — análise de acurácia
            {data?.period && <span>— {data.period.start_date} a {data.period.end_date}</span>}
            {lastUpdated && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.5rem', borderRadius: 10 }}>
                <Clock size={10} /> {getRelativeTime(lastUpdated)}
              </span>
            )}
          </p>
        </div>
        <button onClick={fetchValidation} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 2px 8px rgba(124,58,237,0.25)', WebkitAppearance: 'none' as any }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Verdict Card */}
      {allPending ? (
        <div style={{
          ...cardStyle, marginBottom: '1rem', padding: '0.85rem 1rem',
          background: darkMode ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.03)',
          borderColor: 'rgba(59,130,246,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          <Clock size={20} color="#8b5cf6" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#8b5cf6' }}>Aguardando validação</div>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
              {pending} predições precisam de ~20 pregões para serem validadas contra preços reais. As métricas de acurácia serão calculadas automaticamente.
            </div>
          </div>
        </div>
      ) : completed > 0 && (
        <div style={{
          ...cardStyle, marginBottom: '1rem', padding: '0.85rem 1rem',
          background: dirAcc != null && dirAcc >= 0.6 ? (darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)') : (darkMode ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.03)'),
          borderColor: dirAcc != null && dirAcc >= 0.6 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          {dirAcc != null && dirAcc >= 0.6 ? <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0 }} /> : <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0 }} />}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: dirAcc != null && dirAcc >= 0.6 ? '#10b981' : '#f59e0b' }}>
              {dirAcc != null && dirAcc >= 0.6 ? 'Modelo com boa acurácia' : 'Acurácia abaixo do ideal'}
            </div>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
              {completed} de {total} predições validadas. {pending > 0 ? `${pending} ainda pendentes.` : ''}
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
        borderColor: darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
          💡 <strong style={{ color: theme.text }}>Como funciona:</strong> Cada predição do modelo tem um horizonte de 20 pregões (~1 mês). Após esse período, comparamos o retorno previsto com o retorno real. A acurácia direcional mede se o modelo acertou a direção (alta/baixa), enquanto MAE e RMSE medem a magnitude do erro.
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {kpis.map((kpi, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={12} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</span>
              <span style={{ fontSize: 'clamp(1rem, 3vw, 1.35rem)', fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      {validations.length > 0 && (
        <>
          <div style={{ ...cardStyle, marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: theme.textSecondary }} />
              <input type="text" placeholder="Buscar ticker..." value={tickerSearch} onChange={e => setTickerSearch(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', background: darkMode ? '#0c0a1a' : '#f8fafc', border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; }}
                onBlur={e => { e.currentTarget.style.borderColor = theme.border; }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {([
                { key: 'ALL', label: 'Todos', count: validations.length, color: '#8b5cf6' },
                { key: 'validated', label: 'Validados', count: validatedCount, color: '#10b981' },
                { key: 'pending', label: 'Pendentes', count: pendingCount, color: '#f59e0b' },
              ] as const).map(chip => {
                const active = statusFilter === chip.key;
                return (
                  <button key={chip.key} onClick={() => setStatusFilter(chip.key)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderRadius: 20,
                      background: active ? chip.color : 'transparent',
                      color: active ? 'white' : chip.color,
                      border: `1px solid ${active ? chip.color : theme.border}`,
                      fontWeight: active ? 600 : 400, cursor: 'pointer',
                      WebkitAppearance: 'none' as any, minHeight: 32,
                    }}>
                    {chip.label} <span style={{ opacity: 0.8, fontSize: '0.7rem' }}>({chip.count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
            {filtered.length} de {validations.length} predições
          </div>

          {/* Table */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxHeight: 500 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {[
                      { label: 'Data', tip: 'Data em que a predição foi feita.' },
                      { label: 'Ticker', tip: 'Código da ação na B3.' },
                      { label: 'Ret. previsto', tip: 'Retorno previsto pelo modelo para 20 pregões.' },
                      { label: 'Ret. real', tip: 'Retorno real observado após o período.' },
                      { label: 'Erro', tip: 'Diferença absoluta entre previsto e real.' },
                      { label: 'Direção', tip: 'Se o modelo acertou a direção (alta/baixa).' },
                      { label: 'Status', tip: 'Validado = preço real disponível. Pendente = aguardando.' },
                    ].map((h, idx) => (
                      <th key={idx} style={{ padding: '0.6rem 0.6rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: theme.textSecondary, background: darkMode ? '#0c0a1a' : '#f8fafc', whiteSpace: 'nowrap', position: 'sticky', top: 0 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          {h.label} <InfoTooltip text={h.tip} darkMode={darkMode} size={11} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 50).map((v: any, i: number) => {
                    const hasActual = v.actual_return != null;
                    const predRet = v.predicted_return;
                    const actRet = v.actual_return;
                    const error = hasActual && predRet != null ? Math.abs(predRet - actRet) : null;
                    const dirCorrect = v.direction_correct;
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${theme.border}`, transition: 'background 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.03)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', color: theme.textSecondary }}>{v.prediction_date || v.date || '—'}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600, color: theme.text, fontSize: '0.82rem' }}>{v.ticker}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', color: predRet != null && predRet >= 0 ? '#10b981' : '#ef4444' }}>
                          {predRet != null ? `${predRet >= 0 ? '+' : ''}${fmt(predRet * 100)}%` : '—'}
                        </td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', fontWeight: hasActual ? 600 : 400, color: hasActual ? (actRet >= 0 ? '#10b981' : '#ef4444') : theme.textSecondary }}>
                          {hasActual ? `${actRet >= 0 ? '+' : ''}${fmt(actRet * 100)}%` : '—'}
                        </td>
                        <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', color: error != null ? (error > 0.1 ? '#ef4444' : '#10b981') : theme.textSecondary }}>
                          {error != null ? `${fmt(error * 100)}%` : '—'}
                        </td>
                        <td style={{ padding: '0.45rem 0.6rem' }}>
                          {dirCorrect != null ? (
                            dirCorrect ? <span style={{ color: '#10b981', fontSize: '0.78rem' }}>✅ Acertou</span> : <span style={{ color: '#ef4444', fontSize: '0.78rem' }}>❌ Errou</span>
                          ) : <span style={{ color: theme.textSecondary, fontSize: '0.78rem' }}>—</span>}
                        </td>
                        <td style={{ padding: '0.45rem 0.6rem' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600,
                            background: hasActual ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                            color: hasActual ? '#10b981' : '#f59e0b',
                          }}>
                            {hasActual ? '✓ Validado' : '⏳ Pendente'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > 50 && (
              <div style={{ padding: '0.6rem 1rem', borderTop: `1px solid ${theme.border}`, fontSize: '0.75rem', color: theme.textSecondary, textAlign: 'center' }}>
                Mostrando 50 de {filtered.length} predições
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminValidationPage;
