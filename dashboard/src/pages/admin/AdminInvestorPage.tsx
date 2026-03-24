import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  TrendingUp, DollarSign, Users, Brain, Shield, Zap, BarChart3,
  Target, Globe, Layers, Activity, CheckCircle, ArrowUpRight,
  Server, Database, Bot, Crown, Briefcase, LineChart, TestTubes,
  Eye, Cpu, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { UNIVERSE_SIZE_FALLBACK, PRO_PRICE } from '../../constants';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

interface LiveMetrics {
  userCount: number;
  totalReturn: number | null;
  winRate: number | null;
  monthlyCost: number | null;
  modelAccuracy: number | null;
  dataQuality: number | null;
}

const fmt = (v: any, d = 1) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const AdminInvestorPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<LiveMetrics>({
    userCount: 0, totalReturn: null, winRate: null,
    monthlyCost: null, modelAccuracy: null, dataQuality: null,
  });
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      const headers = { 'x-api-key': API_KEY };

      try {
        const [usersRes, perfRes, costsRes, qualityRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/auth/stats`),
          fetch(`${API_BASE_URL}/api/monitoring/model-performance`, { headers }),
          fetch(`${API_BASE_URL}/api/monitoring/costs`, { headers }),
          fetch(`${API_BASE_URL}/api/monitoring/data-quality`, { headers }),
        ]);

        const m: LiveMetrics = { ...metrics };

        if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
          const d = await usersRes.value.json();
          m.userCount = d.userCount || 0;
        }
        if (perfRes.status === 'fulfilled' && perfRes.value.ok) {
          const d = await perfRes.value.json();
          m.modelAccuracy = d.accuracy ?? d.hit_rate ?? null;
          m.totalReturn = d.cumulative_return ?? d.total_return ?? null;
          m.winRate = d.win_rate ?? d.hit_rate ?? null;
        }
        if (costsRes.status === 'fulfilled' && costsRes.value.ok) {
          const d = await costsRes.value.json();
          m.monthlyCost = d.total ?? d.monthly_total ?? null;
        }
        if (qualityRes.status === 'fulfilled' && qualityRes.value.ok) {
          const d = await qualityRes.value.json();
          m.dataQuality = d.completeness ?? d.overall_score ?? null;
        }

        setMetrics(m);
      } catch (err) {
        console.error('Investor metrics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12,
    padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  const accentGradient = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
  const goldGradient = 'linear-gradient(135deg, #f59e0b, #d97706)';

  const toggleSection = (id: string) => {
    setExpandedSection(prev => prev === id ? null : id);
  };

  const SectionHeader: React.FC<{ id: string; icon: React.ReactNode; title: string; subtitle: string; color: string }> = ({ id, icon, title, subtitle, color }) => (
    <button
      onClick={() => toggleSection(id)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '1rem 1.25rem', background: darkMode ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.03)',
        border: `1px solid ${darkMode ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)'}`,
        borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = darkMode ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.03)'; }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>{title}</div>
        <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>{subtitle}</div>
      </div>
      {expandedSection === id ? <ChevronUp size={18} color={theme.textSecondary} /> : <ChevronDown size={18} color={theme.textSecondary} />}
    </button>
  );

  const AdminLink: React.FC<{ path: string; label: string; icon: React.ReactNode }> = ({ path, label, icon }) => (
    <button
      onClick={() => navigate(path)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.4rem 0.75rem', borderRadius: 8,
        background: darkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)',
        border: `1px solid ${darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)'}`,
        color: '#3b82f6', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = darkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)'; }}
    >
      {icon} {label} <ExternalLink size={11} />
    </button>
  );

  const Pill: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
      background: `${color}18`, color, border: `1px solid ${color}30`,
    }}>
      {children}
    </span>
  );

  // Skeleton loader
  if (loading) {
    const sk: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1e293b' : '#e2e8f0'} 25%, ${darkMode ? '#334155' : '#f1f5f9'} 50%, ${darkMode ? '#1e293b' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ ...sk, height: 32, width: 300, marginBottom: 8 }} />
        <div style={{ ...sk, height: 16, width: 500, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: 24 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ ...sk, height: 100 }} />)}
        </div>
        {[1,2,3].map(i => <div key={i} style={{ ...sk, height: 60, marginBottom: 12 }} />)}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: goldGradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={20} color="white" />
          </div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, margin: 0 }}>
            Qyntara — Investor Deck
          </h1>
        </div>
        <p style={{ color: theme.textSecondary, fontSize: '0.82rem', margin: 0, marginTop: '0.35rem', lineHeight: 1.6 }}>
          Plataforma de recomendação de ações da B3 com Machine Learning. Dados ao vivo do sistema em produção.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 1: VISÃO EXECUTIVA — KPIs ao vivo
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{
        ...cardStyle, marginBottom: '1.25rem', padding: '1rem 1.25rem',
        background: darkMode ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.03)',
        borderColor: darkMode ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.12)',
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          📊 KPIs ao Vivo — Dados Reais do Sistema em Produção
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'Usuários', value: metrics.userCount || '—', icon: <Users size={16} color="#3b82f6" />, color: '#3b82f6' },
            { label: 'Ações Monitoradas', value: UNIVERSE_SIZE_FALLBACK, icon: <BarChart3 size={16} color="#10b981" />, color: '#10b981' },
            { label: 'Custo Mensal AWS', value: metrics.monthlyCost != null ? `$${fmt(metrics.monthlyCost)}` : '~$0.95', icon: <Server size={16} color="#f59e0b" />, color: '#f59e0b' },
            { label: 'Preço Pro', value: PRO_PRICE + '/mês', icon: <Crown size={16} color="#8b5cf6" />, color: '#8b5cf6' },
          ].map((kpi, i) => (
            <div key={i} style={{
              ...cardStyle, padding: '0.75rem', textAlign: 'center',
              background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)',
            }}>
              <div style={{ marginBottom: '0.35rem' }}>{kpi.icon}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 2: O PROBLEMA & A OPORTUNIDADE
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Target size={16} color="#ef4444" /> O Problema
        </div>
        <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7, marginBottom: '1rem' }}>
          O investidor pessoa física brasileiro enfrenta um mercado com <strong style={{ color: theme.text }}>+400 ações na B3</strong>, 
          sem ferramentas acessíveis de análise quantitativa. Casas de análise tradicionais cobram <strong style={{ color: theme.text }}>R$ 30–100/mês</strong> por 
          relatórios subjetivos, sem transparência nos modelos ou backtesting verificável. 
          O mercado de investidores PF no Brasil tem <strong style={{ color: theme.text }}>+5 milhões de CPFs na B3</strong> (crescimento de 35% ao ano).
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Zap size={16} color="#10b981" /> A Solução: Qyntara
        </div>
        <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7 }}>
          Plataforma SaaS que usa <strong style={{ color: theme.text }}>Machine Learning (SageMaker)</strong> para ranquear as {UNIVERSE_SIZE_FALLBACK} ações 
          mais líquidas da B3 diariamente, com previsão de preço a 20 dias, sinais de compra/venda, 
          explicabilidade via SHAP, backtesting histórico e monitoramento completo de MLOps. 
          Tudo por <strong style={{ color: '#f59e0b' }}>{PRO_PRICE}/mês</strong> — fração do custo de uma casa de análise.
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 3: PRODUTO — Funcionalidades com links para admin
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', marginTop: '0.5rem' }}>
        🚀 Produto — Funcionalidades Detalhadas (clique para expandir)
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {/* 3.1 Recomendações */}
        <SectionHeader id="recs" icon={<BarChart3 size={18} color="white" />} title="Recomendações Diárias com ML" subtitle={`${UNIVERSE_SIZE_FALLBACK} ações ranqueadas por score de ML todos os dias`} color="#3b82f6" />
        {expandedSection === 'recs' && (
          <div style={{ ...cardStyle, marginLeft: '0.5rem', borderLeft: '3px solid #3b82f6' }}>
            <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7, marginBottom: '0.75rem' }}>
              O modelo de ML treinado no <strong style={{ color: theme.text }}>Amazon SageMaker</strong> analisa 60 dias de contexto 
              para prever o preço de cada ação nos próximos 20 dias úteis. O sistema gera automaticamente:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {['Score de compra/venda', 'Preço previsto T+20', 'Retorno esperado %', 'Volatilidade 20d', 'Nível de confiança', 'Stop-Loss sugerido', 'Take-Profit sugerido'].map(f => (
                <Pill key={f} color="#3b82f6"><CheckCircle size={10} /> {f}</Pill>
              ))}
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.75rem' }}>
              Usuários Free veem as top 5 ações com valores parcialmente ocultos. 
              Usuários Pro desbloqueiam todas as {UNIVERSE_SIZE_FALLBACK} ações com colunas exclusivas (confiança, stop-loss, take-profit).
            </div>
            <AdminLink path="/dashboard/recommendations" label="Ver Recomendações (visão usuário)" icon={<BarChart3 size={13} />} />
          </div>
        )}

        {/* 3.2 Explicabilidade */}
        <SectionHeader id="explain" icon={<Brain size={18} color="white" />} title="Explicabilidade (SHAP Values)" subtitle="Transparência total: o usuário sabe POR QUE cada ação foi recomendada" color="#8b5cf6" />
        {expandedSection === 'explain' && (
          <div style={{ ...cardStyle, marginLeft: '0.5rem', borderLeft: '3px solid #8b5cf6' }}>
            <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7, marginBottom: '0.75rem' }}>
              Diferencial competitivo: nenhuma casa de análise mostra o <strong style={{ color: theme.text }}>porquê</strong> de cada recomendação. 
              O Qyntara usa <strong style={{ color: theme.text }}>SHAP (SHapley Additive exPlanations)</strong> para decompor a contribuição de cada feature:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {['SHAP Waterfall por ação', 'Feature Impact global', 'Análise de sensibilidade', 'Texto explicativo em linguagem natural', 'Comparação entre ações'].map(f => (
                <Pill key={f} color="#8b5cf6"><Brain size={10} /> {f}</Pill>
              ))}
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.75rem' }}>
              O investidor entende que "PETR4 tem score alto porque momentum de 20d está forte e volatilidade está baixa" — 
              não é uma caixa preta. Isso gera confiança e retenção.
            </div>
            <AdminLink path="/dashboard/explainability" label="Ver Explicabilidade" icon={<Brain size={13} />} />
          </div>
        )}

        {/* 3.3 Backtesting */}
        <SectionHeader id="backtest" icon={<TestTubes size={18} color="white" />} title="Backtesting Histórico" subtitle="Simulação de estratégias com dados reais — prova de conceito verificável" color="#10b981" />
        {expandedSection === 'backtest' && (
          <div style={{ ...cardStyle, marginLeft: '0.5rem', borderLeft: '3px solid #10b981' }}>
            <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7, marginBottom: '0.75rem' }}>
              O módulo de backtesting permite ao usuário simular como as recomendações do modelo teriam performado historicamente:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {['Walk-forward analysis', 'Comparação vs IBOV', 'Métricas de risco (Sharpe, Sortino, Max Drawdown)', 'Gráfico de evolução patrimonial', 'Análise de cenários', 'Stress testing', 'Diagrama Sankey de fluxo', 'Waterfall de retornos'].map(f => (
                <Pill key={f} color="#10b981"><CheckCircle size={10} /> {f}</Pill>
              ))}
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.75rem' }}>
              Isso é raro em plataformas para PF. O investidor pode verificar se o modelo realmente funciona antes de seguir as recomendações.
            </div>
            <AdminLink path="/dashboard/backtesting" label="Ver Backtesting" icon={<TestTubes size={13} />} />
          </div>
        )}

        {/* 3.4 Performance */}
        <SectionHeader id="perf" icon={<LineChart size={18} color="white" />} title="Performance do Modelo" subtitle="Métricas reais de acurácia calculadas com preços de mercado" color="#f59e0b" />
        {expandedSection === 'perf' && (
          <div style={{ ...cardStyle, marginLeft: '0.5rem', borderLeft: '3px solid #f59e0b' }}>
            <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7, marginBottom: '0.75rem' }}>
              A aba de performance calcula métricas <strong style={{ color: theme.text }}>reais</strong> comparando previsões passadas com preços de mercado:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {['MAPE (erro médio)', 'Hit Rate (acerto direcional)', 'Retorno acumulado', 'Alpha vs IBOV', 'Sharpe Ratio', 'Confusion Matrix', 'Benchmark comparison'].map(f => (
                <Pill key={f} color="#f59e0b"><Activity size={10} /> {f}</Pill>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <AdminLink path="/admin/performance" label="Admin: Performance" icon={<Activity size={13} />} />
              <AdminLink path="/dashboard/performance" label="Visão Usuário" icon={<LineChart size={13} />} />
            </div>
          </div>
        )}

        {/* 3.5 Carteiras */}
        <SectionHeader id="carteiras" icon={<Briefcase size={18} color="white" />} title="Carteiras Personalizadas & Modelo" subtitle="Usuário cria carteiras, Pro recebe carteira modelo otimizada por Markowitz" color="#6366f1" />
        {expandedSection === 'carteiras' && (
          <div style={{ ...cardStyle, marginLeft: '0.5rem', borderLeft: '3px solid #6366f1' }}>
            <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7, marginBottom: '0.75rem' }}>
              Funcionalidades de portfólio que aumentam engajamento e retenção:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {['Carteiras personalizadas ilimitadas', 'Carteira Modelo (Pro) — Top 5 otimizadas', 'Alocação por Markowitz', 'Tracking por safra (Pro)', 'Alertas de preço', 'Meta de rentabilidade'].map(f => (
                <Pill key={f} color="#6366f1"><Briefcase size={10} /> {f}</Pill>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <AdminLink path="/dashboard/carteiras" label="Carteiras" icon={<Briefcase size={13} />} />
              <AdminLink path="/dashboard/portfolio" label="Carteira Modelo (Pro)" icon={<Crown size={13} />} />
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 4: INFRAESTRUTURA MLOps — O que o admin monitora
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', marginTop: '0.5rem' }}>
        🔒 Painel Admin — Monitoramento MLOps Completo
      </div>

      <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7, marginBottom: '1rem' }}>
          O painel administrativo é o diferencial técnico do Qyntara. Enquanto o usuário vê recomendações, 
          o admin tem <strong style={{ color: theme.text }}>visibilidade total sobre a saúde do sistema de ML</strong>. 
          Isso garante qualidade contínua e permite escalar com confiança. Cada aba abaixo é acessível apenas por admins:
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '0.75rem' }}>
          {/* Admin Overview */}
          <div style={{ ...cardStyle, background: darkMode ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <BarChart3 size={16} color="#3b82f6" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>Visão Geral</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Dashboard executivo com KPIs do modelo, custos, qualidade de dados e health checks de todos os serviços AWS (API Gateway, Lambda, S3, DynamoDB, ML Pipeline).
            </div>
            <AdminLink path="/admin" label="Abrir" icon={<BarChart3 size={13} />} />
          </div>

          {/* Drift Detection */}
          <div style={{ ...cardStyle, background: darkMode ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Brain size={16} color="#8b5cf6" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>Drift Detection</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Monitora 3 tipos de drift: Data Drift (KS test), Concept Drift (mudança na relação features→target) e Degradação de Performance. Gera alertas automáticos de retreinamento.
            </div>
            <AdminLink path="/admin/drift" label="Abrir" icon={<Brain size={13} />} />
          </div>

          {/* Costs */}
          <div style={{ ...cardStyle, background: darkMode ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <DollarSign size={16} color="#f59e0b" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>Custos AWS</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Monitoramento de custos por serviço (Lambda, S3, SageMaker, CloudWatch), detecção de anomalias, alertas de budget, calculadora de ROI e projeções. Custo atual: ~$0.95/mês.
            </div>
            <AdminLink path="/admin/costs" label="Abrir" icon={<DollarSign size={13} />} />
          </div>

          {/* Data Quality */}
          <div style={{ ...cardStyle, background: darkMode ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Database size={16} color="#10b981" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>Qualidade de Dados</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Completude dos dados, freshness (atualização), cobertura do universo, detecção de anomalias nos dados de entrada. Garante que o modelo treina com dados limpos.
            </div>
            <AdminLink path="/admin/data-quality" label="Abrir" icon={<Database size={13} />} />
          </div>

          {/* Models & Features */}
          <div style={{ ...cardStyle, background: darkMode ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Layers size={16} color="#6366f1" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>Modelos & Features</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Versionamento de modelos, feature store, importância de features, triggers de retreinamento, pipeline status e agendamento automático de treinos.
            </div>
            <AdminLink path="/admin/models" label="Abrir" icon={<Layers size={13} />} />
          </div>

          {/* Validation */}
          <div style={{ ...cardStyle, background: darkMode ? 'rgba(236,72,153,0.05)' : 'rgba(236,72,153,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <CheckCircle size={16} color="#ec4899" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>Validação</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Scatter plots de previsto vs real, análise temporal de acurácia, detecção de outliers. Prova concreta de que o modelo funciona com dados reais de mercado.
            </div>
            <AdminLink path="/admin/validation" label="Abrir" icon={<CheckCircle size={13} />} />
          </div>

          {/* Users */}
          <div style={{ ...cardStyle, background: darkMode ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Users size={16} color="#ef4444" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>Gestão de Usuários</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Gerenciamento de usuários, atribuição de planos (Free/Pro), controle de roles (admin/analyst/viewer), duração de assinatura e métricas de crescimento.
            </div>
            <AdminLink path="/admin/users" label="Abrir" icon={<Users size={13} />} />
          </div>

          {/* AI Agents */}
          <div style={{ ...cardStyle, background: darkMode ? 'rgba(14,165,233,0.05)' : 'rgba(14,165,233,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Bot size={16} color="#0ea5e9" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>Agentes IA & Chat</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Configuração de agentes de IA para suporte, notificações inteligentes e chat admin. Infraestrutura pronta para escalar atendimento com IA.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <AdminLink path="/admin/agents" label="Agentes" icon={<Bot size={13} />} />
              <AdminLink path="/admin/chat" label="Chat" icon={<Bot size={13} />} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 5: ARQUITETURA TÉCNICA
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Cpu size={16} color="#6366f1" /> Arquitetura Técnica
        </div>
        <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7, marginBottom: '1rem' }}>
          Stack 100% serverless na AWS, otimizada para custo mínimo e escalabilidade automática:
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
          {[
            { layer: 'Frontend', items: ['React 18 + TypeScript', 'Recharts + D3.js', 'TanStack Table', 'React Query', 'Tailwind CSS', 'Service Worker (PWA)'], color: '#3b82f6' },
            { layer: 'Backend', items: ['AWS Lambda (Python 3.11)', 'API Gateway (REST)', 'WebSocket Gateway', 'Cognito (Auth)', 'Stripe (Pagamentos)'], color: '#10b981' },
            { layer: 'ML Pipeline', items: ['Amazon SageMaker', 'DeepAR+ (forecasting)', 'SHAP (explicabilidade)', 'Auto-retrain triggers', 'Feature Store (S3)'], color: '#8b5cf6' },
            { layer: 'Dados', items: ['S3 (data lake)', 'DynamoDB (users/config)', 'ElastiCache Redis', 'CloudFront CDN', 'CloudWatch (logs)'], color: '#f59e0b' },
          ].map((stack, i) => (
            <div key={i} style={{ ...cardStyle, padding: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: stack.color, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {stack.layer}
              </div>
              {stack.items.map((item, j) => (
                <div key={j} style={{ fontSize: '0.73rem', color: theme.textSecondary, padding: '0.15rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle size={10} color={stack.color} style={{ flexShrink: 0 }} /> {item}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{
          padding: '0.75rem 1rem', borderRadius: 8,
          background: darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)',
          border: `1px solid ${darkMode ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.12)'}`,
          fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6,
        }}>
          💡 <strong style={{ color: theme.text }}>Custo operacional ultra-baixo:</strong> A arquitetura serverless permite operar com ~$0.95/mês 
          (Lambda ~$0.75, S3 ~$0.10, CloudWatch ~$0.10). Treinos no SageMaker custam ~$0.06 por execução. 
          Isso significa que <strong style={{ color: '#10b981' }}>1 assinante Pro já cobre o custo de infraestrutura de centenas de usuários</strong>.
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 6: MODELO DE NEGÓCIO & UNIT ECONOMICS
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <DollarSign size={16} color="#10b981" /> Modelo de Negócio & Unit Economics
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ ...cardStyle, padding: '1rem', textAlign: 'center', background: darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)' }}>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>Modelo</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>Freemium → Pro</div>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.25rem' }}>Free atrai, Pro monetiza</div>
          </div>
          <div style={{ ...cardStyle, padding: '1rem', textAlign: 'center', background: darkMode ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.03)' }}>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>ARPU (Pro)</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b' }}>{PRO_PRICE}/mês</div>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.25rem' }}>R$ 588/ano por assinante</div>
          </div>
          <div style={{ ...cardStyle, padding: '1rem', textAlign: 'center', background: darkMode ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.03)' }}>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>Custo Marginal</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#3b82f6' }}>~R$ 0,02</div>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.25rem' }}>por usuário/mês (serverless)</div>
          </div>
          <div style={{ ...cardStyle, padding: '1rem', textAlign: 'center', background: darkMode ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.03)' }}>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>Margem Bruta</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#8b5cf6' }}>&gt;99%</div>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.25rem' }}>SaaS puro, sem custo variável relevante</div>
          </div>
        </div>

        <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7 }}>
          <strong style={{ color: theme.text }}>Projeção conservadora:</strong> Com 5% de conversão Free→Pro e 1.000 usuários, 
          são 50 assinantes × R$ 49 = <strong style={{ color: '#10b981' }}>R$ 2.450/mês de MRR</strong> com custo de infra de ~R$ 5/mês. 
          Com 10.000 usuários (0.2% do mercado endereçável), o MRR chega a <strong style={{ color: '#10b981' }}>R$ 24.500/mês</strong>.
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 7: DIFERENCIAIS COMPETITIVOS
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Shield size={16} color="#6366f1" /> Diferenciais Competitivos
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: '0.5rem' }}>
          {[
            {
              title: 'Transparência Total (SHAP)',
              desc: 'Único no mercado PF brasileiro a mostrar POR QUE cada ação foi recomendada, com decomposição de features.',
              icon: <Eye size={16} />, color: '#8b5cf6',
            },
            {
              title: 'Backtesting Verificável',
              desc: 'Usuário pode simular estratégias com dados históricos reais. Casas de análise não oferecem isso.',
              icon: <TestTubes size={16} />, color: '#10b981',
            },
            {
              title: 'MLOps de Nível Enterprise',
              desc: 'Drift detection, auto-retrain, data quality monitoring. Infraestrutura de hedge fund, preço de app.',
              icon: <Activity size={16} />, color: '#3b82f6',
            },
            {
              title: 'Custo Operacional Irrisório',
              desc: 'Serverless puro: ~$0.95/mês para operar. Margem bruta >99%. Escala sem dor.',
              icon: <DollarSign size={16} />, color: '#f59e0b',
            },
            {
              title: 'Produto Completo em Produção',
              desc: 'Não é MVP. Dashboard com 11+ abas, auth, pagamentos Stripe, PWA, dark mode, mobile-first.',
              icon: <Globe size={16} />, color: '#ef4444',
            },
            {
              title: 'Mercado em Expansão',
              desc: '+5M de CPFs na B3, crescendo 35%/ano. Geração que quer dados, não opiniões.',
              icon: <ArrowUpRight size={16} />, color: '#ec4899',
            },
          ].map((d, i) => (
            <div key={i} style={{
              display: 'flex', gap: '0.6rem', padding: '0.75rem',
              borderRadius: 8, background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              border: `1px solid ${theme.border}`,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${d.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: d.color }}>
                {d.icon}
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: theme.text, marginBottom: '0.2rem' }}>{d.title}</div>
                <div style={{ fontSize: '0.73rem', color: theme.textSecondary, lineHeight: 1.5 }}>{d.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 8: UNIVERSO DE AÇÕES
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Globe size={16} color="#3b82f6" /> Universo de Ações Monitoradas ({UNIVERSE_SIZE_FALLBACK} ativos)
        </div>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.75rem' }}>
          Top 50 ações da B3 por retorno acumulado de 5 anos + liquidez. Cobertura de todos os setores:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {[
            { sector: 'Tecnologia', tickers: ['MGLU3', 'LWSA3', 'PETZ3', 'VAMO3', 'RENT3'], color: '#3b82f6' },
            { sector: 'Energia', tickers: ['PETR4', 'PETR3', 'PRIO3', 'RECV3', 'RRRP3'], color: '#f59e0b' },
            { sector: 'Mineração', tickers: ['VALE3', 'CSNA3', 'GGBR4', 'USIM5', 'GOAU4'], color: '#94a3b8' },
            { sector: 'Bancos', tickers: ['ITUB4', 'BBDC4', 'BBAS3', 'SANB11', 'BPAC11'], color: '#10b981' },
            { sector: 'Varejo', tickers: ['LREN3', 'ARZZ3', 'SOMA3', 'GUAR3', 'VIVA3'], color: '#ec4899' },
            { sector: 'Construção', tickers: ['MRVE3', 'CYRE3', 'EZTC3', 'TEND3', 'JHSF3'], color: '#8b5cf6' },
            { sector: 'Utilities', tickers: ['ELET3', 'ELET6', 'TAEE11', 'CMIG4', 'CPLE6'], color: '#06b6d4' },
            { sector: 'Saúde', tickers: ['HAPV3', 'RDOR3', 'FLRY3', 'GNDI3', 'QUAL3'], color: '#ef4444' },
            { sector: 'Agro', tickers: ['SLCE3', 'BEEF3', 'JBSS3', 'MRFG3', 'BRFS3'], color: '#22c55e' },
            { sector: 'Infra', tickers: ['CCRO3', 'ECOR3', 'TIMS3', 'VIVT3', 'CSAN3'], color: '#a855f7' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: s.color, minWidth: 65 }}>{s.sector}:</span>
              {s.tickers.map(t => (
                <span key={t} style={{
                  fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 4,
                  background: `${s.color}12`, color: s.color, border: `1px solid ${s.color}25`,
                  fontFamily: 'monospace', fontWeight: 500,
                }}>{t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 9: ROADMAP
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Target size={16} color="#f59e0b" /> Roadmap & Uso do Investimento
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.5rem' }}>
          {[
            { phase: 'Atual ✅', items: ['Dashboard completo (11+ abas)', 'ML pipeline automatizado', 'Auth + Stripe + PWA', 'Painel admin MLOps'], color: '#10b981' },
            { phase: 'Próximo 🔜', items: ['App mobile nativo (React Native)', 'Alertas WhatsApp/Telegram', 'Mais modelos de ML (ensemble)', 'Cobertura de FIIs e ETFs'], color: '#3b82f6' },
            { phase: 'Futuro 🚀', items: ['API para B2B (fintechs)', 'Expansão para outros mercados', 'Social trading features', 'Plano Enterprise para assessorias'], color: '#8b5cf6' },
          ].map((p, i) => (
            <div key={i} style={{ ...cardStyle, padding: '0.75rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: p.color, marginBottom: '0.5rem' }}>{p.phase}</div>
              {p.items.map((item, j) => (
                <div key={j} style={{ fontSize: '0.73rem', color: theme.textSecondary, padding: '0.15rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle size={10} color={p.color} style={{ flexShrink: 0 }} /> {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEÇÃO 10: CTA FINAL
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{
        ...cardStyle, textAlign: 'center', padding: '2rem 1.5rem',
        background: darkMode ? 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.08))' : 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(139,92,246,0.03))',
        borderColor: darkMode ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)',
      }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: theme.text, marginBottom: '0.5rem' }}>
          Produto em produção. Receita recorrente. Margem &gt;99%.
        </div>
        <div style={{ fontSize: '0.85rem', color: theme.textSecondary, marginBottom: '1.25rem', lineHeight: 1.6, maxWidth: 600, margin: '0 auto 1.25rem' }}>
          O Qyntara já está rodando com usuários reais, pipeline de ML automatizado e infraestrutura escalável. 
          Navegue pelas abas admin acima para ver os dados ao vivo. Cada link abre a aba real do sistema.
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/admin')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: accentGradient, color: 'white', fontSize: '0.9rem', fontWeight: 600,
              transition: 'transform 0.15s, opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <BarChart3 size={18} /> Explorar Painel Admin
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem', borderRadius: 10, cursor: 'pointer',
              background: 'transparent', color: theme.text, fontSize: '0.9rem', fontWeight: 600,
              border: `1px solid ${theme.border}`, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = theme.hover; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Eye size={18} /> Ver como Usuário
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminInvestorPage;
