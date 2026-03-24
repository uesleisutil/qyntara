import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { DollarSign, TrendingDown, TrendingUp, RefreshCw, AlertTriangle, Clock, XCircle, CheckCircle, EyeOff } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../../components/shared/ui/InfoTooltip';
import { fmt } from '../../lib/formatters';
import { useCanViewCosts } from '../../components/shared/pro/ProGate';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

/** Style applied to redacted placeholders — blur + block selection/copy */
const redactedStyle: React.CSSProperties = {
  filter: 'blur(8px)',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  pointerEvents: 'none',
  clipPath: 'inset(0)',       // prevents blur bleed outside bounds
};

const PLACEHOLDER = 'R$ ••••••';

const AdminCostsPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const canViewCosts = useCanViewCosts();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /**
   * Renders real value when allowed, otherwise a blurred placeholder.
   * The real value is NEVER placed in the DOM when access is off.
   */
  const R: React.FC<{ children: React.ReactNode; ph?: string }> = ({ children, ph }) =>
    canViewCosts
      ? <>{children}</>
      : <span style={redactedStyle} aria-hidden="true">{ph || PLACEHOLDER}</span>;

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/monitoring/costs`, { headers: { 'x-api-key': API_KEY } });
      if (res.ok) { setData(await res.json()); setLastUpdated(new Date()); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCosts(); }, []);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1d27' : '#fff'),
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
      background: `linear-gradient(90deg, ${darkMode ? '#1a1d27' : '#e2e8f0'} 25%, ${darkMode ? '#2a2e3a' : '#f1f5f9'} 50%, ${darkMode ? '#1a1d27' : '#e2e8f0'} 75%)`,
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ ...cardStyle, padding: '1rem' }}>
              <div style={{ ...sk, height: 14, width: 80, marginBottom: 8 }} />
              <div style={{ ...sk, height: 28, width: 60 }} />
            </div>
          ))}
        </div>
        <div style={{ ...sk, height: 60, marginBottom: '1rem', borderRadius: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '1rem' }}>
          <div style={{ ...sk, height: 200, borderRadius: 12 }} />
          <div style={{ ...sk, height: 200, borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  if (!data) {
    return <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem', color: theme.textSecondary }}>Sem dados de custos disponíveis.</div>;
  }

  const latest = data?.latest || {};
  const threshold = latest.threshold || {};
  const projection = latest.monthly_projection || {};
  const total7d = latest.total_7_days || {};
  const byService = latest.costs_by_service || {};
  const byComponent = latest.costs_by_component || {};
  const anomalies = latest.anomalies || [];

  const sortedServices = Object.entries(byService).sort(([, a]: any, [, b]: any) => b - a).filter(([, v]: any) => v > 0);
  const maxServiceCost = sortedServices.length > 0 ? (sortedServices[0][1] as number) : 1;

  const budgetOk = !threshold.exceeded && !threshold.warning;

  const kpis = [
    { label: 'Projeção Mensal (BRL)', value: `R$ ${fmt(projection.brl)}`, ph: 'R$ ••••', color: '#f59e0b', icon: <DollarSign size={16} />, tip: 'Projeção de custo total AWS para o mês atual, convertido em reais.', sensitive: true },
    { label: 'Custo 7 dias (USD)', value: `${fmt(total7d.usd)}`, ph: '$ ••••', color: '#3b82f6', icon: <TrendingDown size={16} />, tip: 'Custo total acumulado dos últimos 7 dias em dólares.', sensitive: true },
    { label: 'Orçamento Usado', value: `${fmt(threshold.percentage, 1)}%`, ph: '••%', color: threshold.exceeded ? '#ef4444' : threshold.warning ? '#f59e0b' : '#10b981', icon: threshold.exceeded ? <TrendingUp size={16} /> : <TrendingDown size={16} />, tip: 'Percentual do orçamento mensal já consumido pela projeção atual.', sensitive: true },
    { label: 'Anomalias', value: `${anomalies.length}`, ph: '', color: anomalies.length > 0 ? '#ef4444' : '#10b981', icon: <AlertTriangle size={16} />, tip: 'Serviços com custos significativamente acima da média histórica.', sensitive: false },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>💰 Custos AWS</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            Monitoramento de custos e otimização
            {latest.date && <span>— Última: {latest.date}</span>}
            {lastUpdated && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.5rem', borderRadius: 10 }}>
                <Clock size={10} /> {getRelativeTime(lastUpdated)}
              </span>
            )}
          </p>
        </div>
        <button onClick={fetchCosts} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 2px 8px rgba(37,99,235,0.25)', WebkitAppearance: 'none' as any }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Blur notice banner */}
      {!canViewCosts && (
        <div style={{
          ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
          background: darkMode ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)',
          borderColor: 'rgba(245,158,11,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.6rem',
        }}>
          <EyeOff size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.8rem', color: theme.textSecondary }}>
            Dados sensíveis estão ocultos. Ative o acesso em <span style={{ color: '#f59e0b', fontWeight: 600 }}>Usuários → Dados Sensíveis</span> para visualizar.
          </div>
        </div>
      )}

      {/* Verdict Card */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.85rem 1rem',
        background: budgetOk ? (darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)') : (darkMode ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.03)'),
        borderColor: budgetOk ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        {budgetOk ? <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0 }} /> : <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0 }} />}
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: budgetOk ? '#10b981' : '#ef4444' }}>
            {budgetOk ? 'Custos dentro do orçamento' : threshold.exceeded ? 'Orçamento mensal excedido' : 'Custos próximos do limite'}
          </div>
          <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
            {budgetOk
              ? 'Todos os serviços operando dentro dos limites de custo esperados.'
              : <>Projeção atual: <R ph="R$ •••• de R$ •••• (••%)">R$ {fmt(projection.brl)} de R$ {fmt(threshold.limit_brl, 0)} ({fmt(threshold.percentage, 1)}%)</R></>}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
        borderColor: darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
          💡 <strong style={{ color: theme.text }}>Como funciona:</strong> Os custos são coletados diariamente via AWS Cost Explorer. A projeção mensal extrapola o gasto dos últimos 7 dias. Anomalias são detectadas quando um serviço excede 2× a média histórica.
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {kpis.map((kpi, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={12} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</span>
              <span style={{ fontSize: 'clamp(1rem, 3vw, 1.35rem)', fontWeight: 700, color: kpi.color }}>
                {kpi.sensitive ? <R ph={kpi.ph}>{kpi.value}</R> : kpi.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Budget bar */}
      {threshold.limit_brl && (
        <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              Orçamento Mensal <InfoTooltip text="Barra de progresso do orçamento. Verde = saudável, Amarelo = atenção (>80%), Vermelho = excedido (>100%)." darkMode={darkMode} size={12} />
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: threshold.exceeded ? '#ef4444' : '#10b981' }}>
              <R ph="R$ •••• / R$ ••••">R$ {fmt(projection.brl)} / R$ {fmt(threshold.limit_brl, 0)}</R>
            </span>
          </div>
          <div style={{ height: 12, borderRadius: 6, background: darkMode ? '#2a2e3a' : '#e2e8f0' }}>
            <div style={{ height: '100%', borderRadius: 6, background: threshold.exceeded ? '#ef4444' : threshold.warning ? '#f59e0b' : '#10b981', width: `${Math.min(threshold.percentage || 0, 100)}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {/* By Service */}
        {sortedServices.length > 0 && (
          <div style={cardStyle}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Custo por Serviço (7 dias)
              <InfoTooltip text="Distribuição de custos por serviço AWS nos últimos 7 dias. Barras proporcionais ao maior custo." darkMode={darkMode} size={12} />
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sortedServices.map(([service, cost]: any) => (
                <div key={service}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.8rem', color: theme.text, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{service}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f59e0b' }}><R ph="$ ••••">{fmt(cost)}</R></span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: darkMode ? '#2a2e3a' : '#e2e8f0' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #2563eb, #3b82f6)', width: `${(cost / maxServiceCost) * 100}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By Component */}
        {Object.keys(byComponent).length > 0 && (
          <div style={cardStyle}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Custo por Componente
              <InfoTooltip text="Custos agrupados por componente lógico do sistema (modelo, API, storage, etc.)." darkMode={darkMode} size={12} />
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(byComponent).sort(([, a]: any, [, b]: any) => b - a).map(([comp, cost]: any) => (
                <div key={comp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0' }}>
                  <span style={{ fontSize: '0.85rem', color: theme.text, textTransform: 'capitalize' }}>{comp}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: cost > 0 ? '#f59e0b' : theme.textSecondary }}><R ph="$ ••••">{fmt(cost)}</R></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} color="#f59e0b" /> Anomalias de Custo
            <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: 10, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 600 }}>{anomalies.length}</span>
            <InfoTooltip text="Serviços com custos significativamente acima da média. Custo atual vs média histórica mostrados para cada serviço." darkMode={darkMode} size={12} />
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {anomalies.map((a: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: 8, background: a.severity === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${a.severity === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`, flexWrap: 'wrap', gap: '0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {a.severity === 'critical' ? <XCircle size={14} color="#ef4444" /> : <AlertTriangle size={14} color="#f59e0b" />}
                  <span style={{ fontSize: '0.82rem', color: theme.text }}>{a.service}</span>
                  <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
                    <R ph="$•••• (avg: $••••)">{fmt(a.current_cost_usd)} (avg: {fmt(a.average_cost_usd)})</R>
                  </span>
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: a.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>
                  <R ph="+••%">+{fmt(a.change_percentage, 0)}%</R>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCostsPage;
