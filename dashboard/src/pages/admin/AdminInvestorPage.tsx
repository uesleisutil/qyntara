import { brand } from '../../styles/theme';
import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  TrendingUp, DollarSign, Users, Brain, Shield, Zap, BarChart3,
  Target, Globe, Layers, Activity, CheckCircle, ArrowUpRight,
  Server, Database, Bot, Crown, Briefcase, LineChart, TestTubes,
  Eye, Cpu, ChevronDown, ChevronUp, ExternalLink, Lock,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { UNIVERSE_SIZE_FALLBACK, PRO_PRICE } from '../../constants';
import { fmt, fmtUsd, fmtBrl } from '../../lib/formatters';
import { useCanViewCosts } from '../../components/shared/pro/ProGate';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

interface CostBreakdown {
  monthlyProjectionUsd: number;
  monthlyProjectionBrl: number;
  total7dUsd: number;
  total7dBrl: number;
  byComponent: { training: number; inference: number; storage: number; compute: number; monitoring: number; other: number };
  byService: Record<string, number>;
  costPerRecUsd: number;
  costPerRecBrl: number;
  sagemakerPerExec: number;
}

interface LiveMetrics {
  userCount: number;
  totalReturn: number | null;
  winRate: number | null;
  modelAccuracy: number | null;
  dataQuality: number | null;
  costs: CostBreakdown | null;
}


const AdminInvestorPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canViewCosts = useCanViewCosts();
  /** When access is off, real values never reach the DOM — only blurred placeholders */
  const redactedStyle: React.CSSProperties = { filter: 'blur(8px)', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none', clipPath: 'inset(0)' };
  const redact = (real: string, ph: string) => canViewCosts ? real : ph;
  const [metrics, setMetrics] = useState<LiveMetrics>({
    userCount: 0, totalReturn: null, winRate: null,
    modelAccuracy: null, dataQuality: null, costs: null,
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
          const d = await usersRes.value.json(); m.userCount = d.userCount || 0;
        }
        if (perfRes.status === 'fulfilled' && perfRes.value.ok) {
          const d = await perfRes.value.json();
          m.modelAccuracy = d.accuracy ?? d.hit_rate ?? null;
          m.totalReturn = d.cumulative_return ?? d.total_return ?? null;
          m.winRate = d.win_rate ?? d.hit_rate ?? null;
        }
        if (costsRes.status === 'fulfilled' && costsRes.value.ok) {
          const d = await costsRes.value.json();
          const latest = d.latest || {};
          const proj = latest.monthly_projection || {};
          const t7d = latest.total_7_days || {};
          const byComp = latest.costs_by_component || {};
          const bySvc = latest.costs_by_service || {};
          const recs = latest.recommendations || {};
          // Estimate SageMaker per-execution cost: training component / 30 days
          const sagemakerTraining = byComp.training || 0;
          const sagemakerPerExec = sagemakerTraining > 0 ? (sagemakerTraining / 7) : 0; // daily from 7d window
          m.costs = {
            monthlyProjectionUsd: proj.usd ?? 0,
            monthlyProjectionBrl: proj.brl ?? 0,
            total7dUsd: t7d.usd ?? 0,
            total7dBrl: t7d.brl ?? 0,
            byComponent: {
              training: byComp.training ?? 0,
              inference: byComp.inference ?? 0,
              storage: byComp.storage ?? 0,
              compute: byComp.compute ?? 0,
              monitoring: byComp.monitoring ?? 0,
              other: byComp.other ?? 0,
            },
            byService: bySvc,
            costPerRecUsd: recs.cost_per_recommendation_usd ?? 0,
            costPerRecBrl: recs.cost_per_recommendation_brl ?? 0,
            sagemakerPerExec,
          };
        }
        if (qualityRes.status === 'fulfilled' && qualityRes.value.ok) {
          const d = await qualityRes.value.json(); m.dataQuality = d.completeness ?? d.overall_score ?? null;
        }
        setMetrics(m);
      } catch (err) { console.error('Investor metrics fetch error:', err); }
      finally { setLoading(false); }
    };
    fetchMetrics();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Shared styles ── */
  const accent = '#3b82f6';
  const accentGradient = 'linear-gradient(135deg, #3b82f6, #3b82f6)';

  const card: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 16,
    padding: 'clamp(1rem, 3vw, 1.5rem)',
  };

  const sectionNum = (n: number, color: string) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 8, fontSize: '0.75rem', fontWeight: 700,
      background: `${color}15`, color, border: `1px solid ${color}30`, flexShrink: 0,
    }}>{String(n).padStart(2, '0')}</span>
  );

  const SectionTitle: React.FC<{ num: number; icon: React.ReactNode; title: string; color: string }> = ({ num, icon, title, color }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
      {sectionNum(num, color)}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {icon}
        <span style={{ fontSize: '1rem', fontWeight: 700, color: theme.text }}>{title}</span>
      </div>
    </div>
  );

  const toggleSection = (id: string) => setExpandedSection(prev => prev === id ? null : id);

  const sectionHeaderBtn = (id: string, icon: React.ReactNode, title: string, subtitle: string, color: string) => (
    <button key={`sh-${id}`} onClick={() => toggleSection(id)} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.85rem 1rem', background: expandedSection === id ? `${color}12` : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'),
      border: `1px solid ${expandedSection === id ? `${color}30` : theme.border}`,
      borderRadius: 12, cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.2s',
    }}
      onMouseEnter={e => { if (expandedSection !== id) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'; }}
      onMouseLeave={e => { if (expandedSection !== id) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'; }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 9, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: theme.text }}>{title}</div>
        <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: 1 }}>{subtitle}</div>
      </div>
      {expandedSection === id ? <ChevronUp size={16} color={theme.textSecondary} /> : <ChevronDown size={16} color={theme.textSecondary} />}
    </button>
  );

  const navLinkBtn = (path: string, label: string, icon: React.ReactNode) => {
    const needsAdmin = path.startsWith('/admin');
    const disabled = needsAdmin && !isAdmin;
    return (
      <button key={`nl-${path}`} onClick={() => { if (!disabled) navigate(path); }}
        title={disabled ? 'Acesso restrito a administradores' : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          padding: '0.35rem 0.7rem', borderRadius: 8,
          background: disabled ? (darkMode ? 'rgba(100,100,100,0.06)' : 'rgba(100,100,100,0.03)') : `${accent}10`,
          border: `1px solid ${disabled ? (darkMode ? 'rgba(100,100,100,0.12)' : 'rgba(100,100,100,0.08)') : `${accent}25`}`,
          color: disabled ? (darkMode ? '#555' : '#999') : accent,
          fontSize: '0.75rem', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1, transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${accent}18`; }}
        onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = `${accent}10`; }}
      >
        {icon} {label} {disabled ? <Lock size={10} /> : <ExternalLink size={10} />}
      </button>
    );
  };

  const pill = (color: string, children: React.ReactNode, key?: string) => (
    <span key={key} style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600,
      background: `${color}12`, color, border: `1px solid ${color}22`,
    }}>{children}</span>
  );

  /* ── Skeleton ── */
  if (loading) {
    const sk: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1e293b' : '#e2e8f0'} 25%, ${darkMode ? '#334155' : '#f1f5f9'} 50%, ${darkMode ? '#1e293b' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 12,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ ...sk, height: 80, marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ ...sk, height: 90 }} />)}
        </div>
        {[1,2,3].map(i => <div key={i} style={{ ...sk, height: 56, marginBottom: 10 }} />)}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* ═══ HERO HEADER ═══ */}
      <div style={{
        ...card, marginBottom: '1.5rem', padding: '1.75rem 1.5rem',
        background: darkMode
          ? `linear-gradient(135deg, ${brand.alpha(0.1)} 0%, ${brand.alpha(0.06)} 100%)`
          : `linear-gradient(135deg, ${brand.alpha(0.06)} 0%, ${brand.alpha(0.03)} 100%)`,
        borderColor: darkMode ? brand.alpha(0.2) : brand.alpha(0.12),
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: `${accent}08`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: accentGradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>Q</span>
            </div>
            <div>
              <h1 style={{ fontSize: 'clamp(1.3rem, 4vw, 1.6rem)', fontWeight: 800, color: theme.text, margin: 0, letterSpacing: '-0.02em' }}>
                Qyntara — Investor Deck
              </h1>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: 2 }}>
                Confidencial · Março 2026
              </div>
            </div>
          </div>
          <p style={{ color: theme.textSecondary, fontSize: '0.85rem', margin: 0, lineHeight: 1.65, maxWidth: 640 }}>
            Plataforma SaaS de recomendação de ações da B3 com Deep Learning.
            Dados ao vivo do sistema em produção.
          </p>
        </div>
      </div>

      {/* ═══ 01 — KPIs AO VIVO ═══ */}
      <div style={{ ...card, marginBottom: '1.5rem' }}>
        <SectionTitle num={1} icon={<Activity size={16} color="#f59e0b" />} title="KPIs ao Vivo" color="#f59e0b" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'Usuários Ativos', value: metrics.userCount || '—', icon: <Users size={18} color="#3b82f6" />, color: '#3b82f6' },
            { label: 'Universo B3', value: UNIVERSE_SIZE_FALLBACK, icon: <BarChart3 size={18} color="#10b981" />, color: '#10b981' },
            ...[{ label: 'Custo AWS/mês', value: redact(metrics.costs ? fmtUsd(metrics.costs.monthlyProjectionUsd) : '—', '$ ••••'), icon: <Server size={18} color="#f59e0b" />, color: '#f59e0b', blur: true }],
            { label: 'Preço Pro', value: PRO_PRICE + '/mês', icon: <Crown size={18} color="#3b82f6" />, color: '#3b82f6' },
          ].map((kpi, i) => (
            <div key={i} style={{
              padding: '1rem', borderRadius: 12, textAlign: 'center',
              background: darkMode ? `${kpi.color}08` : `${kpi.color}05`,
              border: `1px solid ${kpi.color}18`,
            }}>
              <div style={{ marginBottom: '0.4rem', opacity: 0.9 }}>{kpi.icon}</div>
              <div style={{ fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', fontWeight: 800, color: kpi.color, letterSpacing: '-0.02em', ...((kpi as any).blur && !canViewCosts ? redactedStyle : {}) }}>{kpi.value}</div>
              <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginTop: '0.15rem', fontWeight: 500 }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 02 — PROBLEMA & OPORTUNIDADE ═══ */}
      <div style={{ ...card, marginBottom: '1.5rem' }}>
        <SectionTitle num={2} icon={<Target size={16} color="#ef4444" />} title="Problema & Oportunidade" color="#ef4444" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Target size={13} /> O Problema
            </div>
            <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.75 }}>
              O investidor PF brasileiro enfrenta <span style={{ color: theme.text, fontWeight: 600 }}>+400 ações na B3</span> sem
              ferramentas acessíveis de análise quantitativa. Casas de análise cobram <span style={{ color: theme.text, fontWeight: 600 }}>R$ 30–100/mês</span> por
              relatórios subjetivos, sem transparência ou backtesting. Mercado endereçável: <span style={{ color: theme.text, fontWeight: 600 }}>+5M de CPFs na B3</span> (crescimento de 35%/ano).
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Zap size={13} /> A Solução
            </div>
            <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.75 }}>
              SaaS com <span style={{ color: theme.text, fontWeight: 600 }}>DL Ensemble (Transformer+BiLSTM · TabTransformer · FT-Transformer)</span> que ranqueia as {UNIVERSE_SIZE_FALLBACK} ações
              mais líquidas diariamente. Previsão a 20 dias, sinais de compra/venda, explicabilidade SHAP,
              backtesting e DLOps completo. Tudo por <span style={{ color: '#f59e0b', fontWeight: 700 }}>{PRO_PRICE}/mês</span>.
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 03 — PRODUTO ═══ */}
      <div style={{ ...card, marginBottom: '1.5rem' }}>
        <SectionTitle num={3} icon={<Layers size={16} color="#3b82f6" />} title="Produto" color="#3b82f6" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sectionHeaderBtn("recs", <BarChart3 size={16} color="white" />, "Recomendações Diárias", `${UNIVERSE_SIZE_FALLBACK} ações ranqueadas por score de DL`, "#3b82f6")}
          {expandedSection === 'recs' && (
            <div style={{ ...card, marginLeft: '0.75rem', borderLeft: `3px solid #3b82f6`, borderRadius: '4px 12px 12px 4px' }}>
              <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7, marginBottom: '0.75rem' }}>
                Modelo treinado no Amazon SageMaker analisa 60 dias de contexto para prever preços nos próximos 20 pregões:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                {['Score compra/venda', 'Preço previsto T+20', 'Retorno esperado', 'Volatilidade 20d', 'Confiança', 'Stop-Loss', 'Take-Profit'].map(f => (
                  pill("#3b82f6", <><CheckCircle size={9} /> {f}</>, f)
                ))}
              </div>
              {navLinkBtn("/dashboard/recommendations", "Ver Recomendações", <BarChart3 size={12} />)}
            </div>
          )}

          {sectionHeaderBtn("explain", <Brain size={16} color="white" />, "Explicabilidade (SHAP)", "Transparência: o usuário sabe POR QUE cada ação foi recomendada", "#3b82f6")}
          {expandedSection === 'explain' && (
            <div style={{ ...card, marginLeft: '0.75rem', borderLeft: `3px solid #3b82f6`, borderRadius: '4px 12px 12px 4px' }}>
              <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7, marginBottom: '0.75rem' }}>
                Diferencial competitivo: SHAP decompõe a contribuição de cada feature. O investidor entende que
                "PETR4 tem score alto porque momentum de 20d está forte e volatilidade está baixa" — não é caixa preta.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                {['SHAP Waterfall', 'Feature Impact', 'Sensibilidade', 'Texto em linguagem natural'].map(f => (
                  pill("#3b82f6", <><Brain size={9} /> {f}</>, f)
                ))}
              </div>
              {navLinkBtn("/dashboard/explainability", "Ver Explicabilidade", <Brain size={12} />)}
            </div>
          )}

          {sectionHeaderBtn("backtest", <TestTubes size={16} color="white" />, "Backtesting Histórico", "Simulação com dados reais — prova de conceito verificável", "#10b981")}
          {expandedSection === 'backtest' && (
            <div style={{ ...card, marginLeft: '0.75rem', borderLeft: `3px solid #10b981`, borderRadius: '4px 12px 12px 4px' }}>
              <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7, marginBottom: '0.75rem' }}>
                Simulação walk-forward com dados históricos reais. Raro em plataformas para PF — o investidor verifica se o modelo funciona antes de seguir.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                {['Walk-forward', 'vs IBOV', 'Sharpe / Sortino / Max DD', 'Cenários', 'Stress testing'].map(f => (
                  pill("#10b981", <><CheckCircle size={9} /> {f}</>, f)
                ))}
              </div>
              {navLinkBtn("/dashboard/backtesting", "Ver Backtesting", <TestTubes size={12} />)}
            </div>
          )}

          {sectionHeaderBtn("perf", <LineChart size={16} color="white" />, "Performance do Modelo", "Métricas reais de acurácia com preços de mercado", "#f59e0b")}
          {expandedSection === 'perf' && (
            <div style={{ ...card, marginLeft: '0.75rem', borderLeft: `3px solid #f59e0b`, borderRadius: '4px 12px 12px 4px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                {['MAPE', 'Hit Rate', 'Retorno acumulado', 'Alpha vs IBOV', 'Sharpe', 'Confusion Matrix'].map(f => (
                  pill("#f59e0b", <><Activity size={9} /> {f}</>, f)
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {navLinkBtn("/admin/performance", "Admin", <Activity size={12} />)}
                {navLinkBtn("/dashboard/performance", "Visão Usuário", <LineChart size={12} />)}
              </div>
            </div>
          )}

          {sectionHeaderBtn("carteiras", <Briefcase size={16} color="white" />, "Carteiras & Portfólio", "Carteiras personalizadas + Carteira Modelo otimizada por Markowitz", "#3b82f6")}
          {expandedSection === 'carteiras' && (
            <div style={{ ...card, marginLeft: '0.75rem', borderLeft: `3px solid #3b82f6`, borderRadius: '4px 12px 12px 4px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                {['Carteiras ilimitadas', 'Carteira Modelo (Pro)', 'Markowitz', 'Tracking por safra', 'Alertas'].map(f => (
                  pill("#3b82f6", <><Briefcase size={9} /> {f}</>, f)
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {navLinkBtn("/dashboard/carteiras", "Carteiras", <Briefcase size={12} />)}
                {navLinkBtn("/dashboard/portfolio", "Carteira Modelo", <Crown size={12} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ 04 — PAINEL ADMIN / DLOps ═══ */}
      <div style={{ ...card, marginBottom: '1.5rem' }}>
        <SectionTitle num={4} icon={<Shield size={16} color="#ef4444" />} title="Painel Admin — DLOps" color="#ef4444" />
        <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7, marginBottom: '1rem' }}>
          Visibilidade total sobre a saúde do sistema de DL. Ensemble de modelos, custos, qualidade de dados e gestão de usuários.
          {!isAdmin && <span style={{ color: '#f59e0b', fontWeight: 500 }}> Links admin requerem permissão de administrador.</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '0.6rem' }}>
          {[
            { icon: <Layers size={15} />, title: 'Modelos & Features', desc: 'Ensemble DL, performance individual, feature store, pipeline.', path: '/admin/models', color: '#3b82f6' },
            { icon: <DollarSign size={15} />, title: 'Custos AWS', desc: 'Custos por serviço, anomalias, budget alerts, ROI.', path: '/admin/costs', color: '#f59e0b' },
            { icon: <Database size={15} />, title: 'Qualidade de Dados', desc: 'Completude, freshness, cobertura, anomalias.', path: '/admin/data-quality', color: '#10b981' },
            { icon: <CheckCircle size={15} />, title: 'Validação', desc: 'Previsto vs real, acurácia temporal, outliers.', path: '/admin/validation', color: '#ec4899' },
            { icon: <Users size={15} />, title: 'Usuários', desc: 'Planos, roles, assinaturas, métricas de crescimento.', path: '/admin/users', color: '#ef4444' },
            { icon: <Bot size={15} />, title: 'Agentes IA & Chat', desc: 'Suporte IA, notificações inteligentes, chat admin.', path: '/admin/agents', color: '#0ea5e9' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: '0.6rem', padding: '0.75rem', borderRadius: 10,
              background: darkMode ? `${item.color}06` : `${item.color}03`,
              border: `1px solid ${item.color}15`, transition: 'border-color 0.2s',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, background: `${item.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: item.color,
              }}>{item.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, marginBottom: '0.15rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.5, marginBottom: '0.4rem' }}>{item.desc}</div>
                {navLinkBtn(item.path, "Abrir", item.icon)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 05 — ARQUITETURA ═══ */}
      <div style={{ ...card, marginBottom: '1.5rem' }}>
        <SectionTitle num={5} icon={<Cpu size={16} color="#3b82f6" />} title="Arquitetura Técnica" color="#3b82f6" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
          {[
            { layer: 'Frontend', items: ['React 18 + TypeScript', 'Recharts + D3.js', 'TanStack Table', 'React Query', 'PWA + Service Worker'], color: '#3b82f6' },
            { layer: 'Backend', items: ['AWS Lambda (Python)', 'API Gateway (REST)', 'Cognito (Auth)', 'Stripe (Pagamentos)', 'WebSocket'], color: '#10b981' },
            { layer: 'DL Pipeline', items: ['Amazon SageMaker', 'DeepAR+ (forecasting)', 'SHAP (explicabilidade)', 'Auto-retrain triggers', 'Feature Store (S3)'], color: '#3b82f6' },
            { layer: 'Dados', items: ['S3 (data lake)', 'DynamoDB', 'CloudFront CDN', 'CloudWatch (logs)'], color: '#f59e0b' },
          ].map((stack, i) => (
            <div key={i} style={{ padding: '0.75rem', borderRadius: 10, background: darkMode ? `${stack.color}06` : `${stack.color}03`, border: `1px solid ${stack.color}15` }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: stack.color, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {stack.layer}
              </div>
              {stack.items.map((item, j) => (
                <div key={j} style={{ fontSize: '0.72rem', color: theme.textSecondary, padding: '0.12rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle size={9} color={stack.color} style={{ flexShrink: 0 }} /> {item}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{
          padding: '0.75rem 1rem', borderRadius: 10,
          background: darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)',
          border: `1px solid ${darkMode ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)'}`,
          fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.65,
        }}>
          <span style={{ color: theme.text, fontWeight: 600 }}>Custo operacional ultra-baixo:</span>{' '}
          {metrics.costs ? (
              <span style={canViewCosts ? {} : redactedStyle}>
                {redact(
                  `${fmtUsd(metrics.costs.monthlyProjectionUsd)}/mês (Lambda ${fmtUsd(metrics.costs.byComponent.compute)}, S3 ${fmtUsd(metrics.costs.byComponent.storage)}, CloudWatch ${fmtUsd(metrics.costs.byComponent.monitoring)}${metrics.costs.byComponent.training > 0 ? `, SageMaker ${fmtUsd(metrics.costs.byComponent.training + metrics.costs.byComponent.inference)}` : ''} — últimos 7 dias).${metrics.costs.sagemakerPerExec > 0 ? ` Treino SageMaker: ${fmtUsd(metrics.costs.sagemakerPerExec, 4)}/execução.` : ''}`,
                  '$••••/mês (Lambda $••••, S3 $••••, CloudWatch $•••• — últimos 7 dias).'
                )}
              </span>
            ) : 'Carregando dados reais...'}
          <span style={{ color: '#10b981', fontWeight: 600 }}> 1 assinante Pro já cobre a infra de centenas de usuários.</span>
        </div>
      </div>

      {/* ═══ 06 — UNIT ECONOMICS ═══ */}
      <div style={{ ...card, marginBottom: '1.5rem' }}>
        <SectionTitle num={6} icon={<DollarSign size={16} color="#10b981" />} title="Unit Economics" color="#10b981" />
        {(() => {
          const c = metrics.costs;
          const users = metrics.userCount || 1;
          const marginalCostBrl = c ? (c.monthlyProjectionBrl / users) : null;
          const proRevenue = 49; // R$ 49/mês
          const marginPct = c && c.monthlyProjectionBrl > 0 ? Math.min(99.9, ((proRevenue - (c.monthlyProjectionBrl / Math.max(users, 1))) / proRevenue) * 100) : null;
          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Modelo', value: 'Freemium → Pro', sub: 'Free atrai, Pro monetiza', color: '#10b981' },
                  { label: 'ARPU (Pro)', value: PRO_PRICE + '/mês', sub: 'R$ 588/ano', color: '#f59e0b' },
                  ...[
                    { label: 'Custo/Usuário', value: redact(marginalCostBrl != null ? fmtBrl(marginalCostBrl) : '—', 'R$ ••••'), sub: 'por usuário/mês', color: '#3b82f6', blur: true },
                    { label: 'Margem Bruta', value: redact(marginPct != null ? `${fmt(marginPct, 0)}%` : '—', '••%'), sub: 'SaaS serverless', color: '#3b82f6', blur: true },
                  ],
                ].map((m, i) => (
                  <div key={i} style={{
                    padding: '0.85rem', borderRadius: 10, textAlign: 'center',
                    background: darkMode ? `${m.color}06` : `${m.color}03`, border: `1px solid ${m.color}15`,
                  }}>
                    <div style={{ fontSize: '0.65rem', color: theme.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{m.label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: m.color, margin: '0.25rem 0 0.1rem', letterSpacing: '-0.02em', ...((m as any).blur && !canViewCosts ? redactedStyle : {}) }}>{m.value}</div>
                    <div style={{ fontSize: '0.68rem', color: theme.textSecondary }}>{m.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7 }}>
                <span style={{ color: theme.text, fontWeight: 600 }}>Projeção conservadora:</span> 5% conversão Free→Pro com 1.000 usuários
                = 50 × R$ 49 = <span style={{ color: '#10b981', fontWeight: 700 }}>R$ 2.450/mês MRR</span>
                {c && <> (custo infra <span style={canViewCosts ? {} : redactedStyle}>{redact(fmtBrl(c.monthlyProjectionBrl), 'R$ ••••')}</span>)</>}.
                Com 10.000 usuários: <span style={{ color: '#10b981', fontWeight: 700 }}>R$ 24.500/mês MRR</span>.
              </div>
            </>
          );
        })()}
      </div>

      {/* ═══ 07 — DIFERENCIAIS ═══ */}
      <div style={{ ...card, marginBottom: '1.5rem' }}>
        <SectionTitle num={7} icon={<Shield size={16} color="#3b82f6" />} title="Diferenciais Competitivos" color="#3b82f6" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '0.5rem' }}>
          {[
            { title: 'Transparência Total (SHAP)', desc: 'Único no mercado PF a mostrar POR QUE cada ação foi recomendada.', icon: <Eye size={15} />, color: '#3b82f6' },
            { title: 'Backtesting Verificável', desc: 'Simulação com dados reais. Casas de análise não oferecem isso.', icon: <TestTubes size={15} />, color: '#10b981' },
            { title: 'DLOps Enterprise', desc: 'Drift detection, auto-retrain, data quality. Infra de hedge fund, preço de app.', icon: <Activity size={15} />, color: '#3b82f6' },
            { title: 'Custo Irrisório', desc: redact(metrics.costs ? `Serverless: ${fmtUsd(metrics.costs.monthlyProjectionUsd)}/mês. Escala sem dor.` : 'Serverless puro. Escala sem dor.', 'Serverless: $••••/mês. Escala sem dor.'), icon: <DollarSign size={15} />, color: '#f59e0b', blurDesc: true },
            { title: 'Produto Completo', desc: '11+ abas, auth, Stripe, PWA, dark mode, mobile-first. Não é MVP.', icon: <Globe size={15} />, color: '#ef4444' },
            { title: 'Mercado em Expansão', desc: '+5M CPFs na B3, +35%/ano. Geração que quer dados, não opiniões.', icon: <ArrowUpRight size={15} />, color: '#ec4899' },
          ].map((d, i) => (
            <div key={i} style={{
              display: 'flex', gap: '0.6rem', padding: '0.7rem', borderRadius: 10,
              background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', border: `1px solid ${theme.border}`,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `${d.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: d.color }}>
                {d.icon}
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: theme.text, marginBottom: '0.15rem' }}>{d.title}</div>
                <div style={{ fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.5, ...((d as any).blurDesc && !canViewCosts ? redactedStyle : {}) }}>{d.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 08 — UNIVERSO ═══ */}
      <div style={{ ...card, marginBottom: '1.5rem' }}>
        <SectionTitle num={8} icon={<Globe size={16} color="#3b82f6" />} title={`Universo de Ações (${UNIVERSE_SIZE_FALLBACK})`} color="#3b82f6" />
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.75rem' }}>
          Top {UNIVERSE_SIZE_FALLBACK} ações da B3 por retorno acumulado de 5 anos + liquidez. Cobertura multi-setorial:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.6rem' }}>
          {[
            { sector: 'Tecnologia', tickers: ['MGLU3', 'LWSA3', 'PETZ3', 'VAMO3', 'RENT3'], color: '#3b82f6' },
            { sector: 'Energia', tickers: ['PETR4', 'PETR3', 'PRIO3', 'RECV3', 'RRRP3'], color: '#f59e0b' },
            { sector: 'Mineração', tickers: ['VALE3', 'CSNA3', 'GGBR4', 'USIM5', 'GOAU4'], color: '#94a3b8' },
            { sector: 'Bancos', tickers: ['ITUB4', 'BBDC4', 'BBAS3', 'SANB11', 'BPAC11'], color: '#10b981' },
            { sector: 'Varejo', tickers: ['LREN3', 'ARZZ3', 'SOMA3', 'GUAR3', 'VIVA3'], color: '#ec4899' },
            { sector: 'Construção', tickers: ['MRVE3', 'CYRE3', 'EZTC3', 'TEND3', 'JHSF3'], color: '#3b82f6' },
            { sector: 'Utilities', tickers: ['ELET3', 'ELET6', 'TAEE11', 'CMIG4', 'CPLE6'], color: '#06b6d4' },
            { sector: 'Saúde', tickers: ['HAPV3', 'RDOR3', 'FLRY3', 'GNDI3', 'QUAL3'], color: '#ef4444' },
            { sector: 'Agro', tickers: ['SLCE3', 'BEEF3', 'JBSS3', 'MRFG3', 'BRFS3'], color: '#22c55e' },
            { sector: 'Infra', tickers: ['CCRO3', 'ECOR3', 'TIMS3', 'VIVT3', 'CSAN3'], color: '#a855f7' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: s.color, minWidth: 68 }}>{s.sector}:</span>
              {s.tickers.map(t => (
                <span key={t} style={{
                  fontSize: '0.66rem', padding: '0.1rem 0.35rem', borderRadius: 4,
                  background: `${s.color}10`, color: s.color, border: `1px solid ${s.color}20`,
                  fontFamily: 'monospace', fontWeight: 600,
                }}>{t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 09 — ROADMAP ═══ */}
      <div style={{ ...card, marginBottom: '1.5rem' }}>
        <SectionTitle num={9} icon={<TrendingUp size={16} color="#f59e0b" />} title="Roadmap" color="#f59e0b" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.6rem' }}>
          {[
            { phase: 'Atual', badge: '✅ Live', items: ['Dashboard 11+ abas', 'DL pipeline automatizado', 'Auth + Stripe + PWA', 'Painel admin DLOps'], color: '#10b981' },
            { phase: 'Próximo', badge: 'Q2 2026', items: ['App mobile (React Native)', 'Alertas WhatsApp/Telegram', 'Ensemble de modelos', 'FIIs e ETFs'], color: '#3b82f6' },
            { phase: 'Futuro', badge: 'Q4 2026+', items: ['API B2B (fintechs)', 'Outros mercados', 'Social trading', 'Plano Enterprise'], color: '#3b82f6' },
          ].map((p, i) => (
            <div key={i} style={{ padding: '0.85rem', borderRadius: 10, background: darkMode ? `${p.color}06` : `${p.color}03`, border: `1px solid ${p.color}15` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: p.color }}>{p.phase}</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '0.1rem 0.4rem', borderRadius: 6, background: `${p.color}15`, color: p.color }}>{p.badge}</span>
              </div>
              {p.items.map((item, j) => (
                <div key={j} style={{ fontSize: '0.72rem', color: theme.textSecondary, padding: '0.12rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle size={9} color={p.color} style={{ flexShrink: 0 }} /> {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ CTA ═══ */}
      <div style={{
        ...card, textAlign: 'center', padding: '2rem 1.5rem',
        background: darkMode
          ? `linear-gradient(135deg, ${brand.alpha(0.1)}, ${brand.alpha(0.06)})`
          : `linear-gradient(135deg, ${brand.alpha(0.05)}, ${brand.alpha(0.02)})`,
        borderColor: darkMode ? brand.alpha(0.2) : brand.alpha(0.1),
      }}>
        <div style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)', fontWeight: 800, color: theme.text, marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
          Produto em produção. Receita recorrente.
        </div>
        <div style={{ fontSize: '0.82rem', color: theme.textSecondary, marginBottom: '1.25rem', lineHeight: 1.65, maxWidth: 560, margin: '0 auto 1.25rem' }}>
          Pipeline de DL automatizado, infraestrutura escalável e usuários reais.
          Navegue pelas seções acima para explorar os dados ao vivo.
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button onClick={() => navigate('/admin')} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.7rem 1.4rem', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: accentGradient, color: 'white', fontSize: '0.85rem', fontWeight: 600,
              transition: 'transform 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <BarChart3 size={16} /> Explorar Painel Admin
            </button>
          )}
          <button onClick={() => navigate('/dashboard')} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.7rem 1.4rem', borderRadius: 10, cursor: 'pointer',
            background: 'transparent', color: theme.text, fontSize: '0.85rem', fontWeight: 600,
            border: `1px solid ${theme.border}`, transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = theme.hover; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Eye size={16} /> Ver como Usuário
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminInvestorPage;
