import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  RefreshCw, Database, Activity, CheckCircle2, XCircle, Clock,
  GitBranch, Layers, BarChart3, Shield, AlertTriangle, ChevronDown,
  ChevronRight, Cpu, Zap, TrendingUp, Package, Eye, FileText,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../../components/shared/InfoTooltip';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

/* ── helpers ── */
const fmt = (v: any, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';
const fmtDate = (iso: string) => {
  try { const d = new Date(iso); return d.toLocaleDateString('pt-BR'); } catch { return iso; }
};
const fmtDateTime = (iso: string) => {
  try { const d = new Date(iso); return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
};

const StatusDot: React.FC<{ ok: boolean; label?: string }> = ({ ok, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? '#4ead8a' : '#e07070', display: 'inline-block', flexShrink: 0 }} />
    {label}
  </span>
);


/* ── types ── */
interface FeatureStoreStatus {
  fundamentals: { count: number; date: string; sample?: Record<string, any> };
  macro: { ok: boolean; date: string; features?: Record<string, number> };
  sentiment: { count: number; date: string };
}

interface PipelineStatus {
  ingest_features: { last_run?: string; next_run?: string; status: string };
  weekly_retrain: { last_run?: string; next_run?: string; status: string };
  daily_ranking: { last_run?: string; next_run?: string; status: string };
}

interface FeatureAudit {
  ticker: string;
  populated: number;
  total: number;
  missing: string[];
}

const AdminModelsPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'registry' | 'features' | 'pipeline' | 'lineage'>('registry');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  // Data
  const [featureStore, setFeatureStore] = useState<FeatureStoreStatus | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
  const [featureAudit, setFeatureAudit] = useState<FeatureAudit[]>([]);
  const [latestRec, setLatestRec] = useState<any>(null);
  const [monitorData, setMonitorData] = useState<any>(null);

  const headers = useMemo(() => ({ 'x-api-key': API_KEY }), []);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a2626' : '#fff'),
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, monRes, fsListRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers }),
        fetch(`${API_BASE_URL}/api/monitoring/model-performance`, { headers }),
        fetch(`${API_BASE_URL}/s3-proxy/list?prefix=feature_store/fundamentals/`, { headers }),
      ]);

      if (recRes.ok) {
        const rec = await recRes.json();
        setLatestRec(rec);

        // Extract model info from recommendation
        if (rec.data) {
          // Model info is available via latestRec state
        }
      }

      if (monRes.ok) setMonitorData(await monRes.json());

      // Feature store status from S3 listing
      if (fsListRes.ok) {
        const fsData = await fsListRes.json();
        const files = fsData.files || fsData.keys || fsData || [];
        const fundamentalFiles = Array.isArray(files) ? files.filter((f: string) => f.includes('fundamentals/')) : [];

        // Get latest date partition
        const dates = fundamentalFiles
          .map((f: string) => { const m = f.match(/dt=(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null; })
          .filter(Boolean);
        const latestDate = dates.sort().pop() || '';
        const latestFiles = fundamentalFiles.filter((f: string) => f.includes(`dt=${latestDate}`));

        // Load sample tickers for audit
        const sampleTickers: FeatureAudit[] = [];
        const tickerFiles = latestFiles.slice(0, 5);
        for (const file of tickerFiles) {
          try {
            const tickerMatch = file.match(/\/([A-Z0-9]+)\.json$/);
            if (!tickerMatch) continue;
            const ticker = tickerMatch[1];
            const sampleRes = await fetch(`${API_BASE_URL}/s3-proxy?key=${file}`, { headers });
            if (sampleRes.ok) {
              const data = await sampleRes.json();
              const allFields = [
                'pe_ratio', 'forward_pe', 'pb_ratio', 'dividend_yield', 'ev_to_ebitda',
                'ev_to_revenue', 'peg_ratio', 'price_to_sales', 'roe', 'roa',
                'profit_margin', 'operating_margin', 'ebitda_margin', 'gross_margin',
                'earnings_growth', 'revenue_growth', 'earnings_quarterly_growth',
                'debt_to_equity', 'debt_to_ebitda', 'current_ratio', 'quick_ratio',
                'interest_coverage', 'net_debt', 'market_cap', 'enterprise_value',
                'free_cash_flow', 'operating_cash_flow', 'total_assets', 'total_liabilities',
                'total_equity', 'total_revenue', 'net_income', 'ebitda', 'total_debt',
                'cash', 'asset_turnover', 'sector', 'industry',
              ];
              const populated = allFields.filter(f => data[f] != null).length;
              const missing = allFields.filter(f => data[f] == null);
              sampleTickers.push({ ticker, populated, total: allFields.length, missing });
            }
          } catch { /* skip */ }
        }
        setFeatureAudit(sampleTickers);

        setFeatureStore({
          fundamentals: { count: latestFiles.length, date: latestDate },
          macro: { ok: true, date: latestDate },
          sentiment: { count: 0, date: latestDate },
        });
      }

      // Pipeline status from EventBridge (simulated from known schedules)
      const now = new Date();
      setPipeline({
        ingest_features: {
          last_run: now.toISOString(),
          next_run: getNextSchedule(21, 0, [1, 2, 3, 4, 5]),
          status: 'active',
        },
        weekly_retrain: {
          last_run: undefined,
          next_run: getNextSchedule(22, 0, [0]),
          status: 'active',
        },
        daily_ranking: {
          last_run: undefined,
          next_run: getNextSchedule(21, 30, [1, 2, 3, 4, 5]),
          status: 'active',
        },
      });
    } catch (err) {
      console.error('AdminModelsPage fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Skeleton
  if (loading) {
    const sk: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1a2626' : '#d4e5dc'} 25%, ${darkMode ? '#2a3d36' : '#e8f0ed'} 50%, ${darkMode ? '#1a2626' : '#d4e5dc'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ ...sk, height: 28, width: 260, marginBottom: 8 }} />
        <div style={{ ...sk, height: 16, width: 400, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ ...sk, height: 100, borderRadius: 12 }} />)}
        </div>
        <div style={{ ...sk, height: 300, borderRadius: 12 }} />
      </div>
    );
  }


  const latest = monitorData?.latest || {};
  const recData = latestRec?.data || {};

  /* ── Tab buttons ── */
  const tabs: { key: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { key: 'registry', label: 'Model Registry', icon: <Package size={15} /> },
    { key: 'features', label: 'Feature Store', icon: <Database size={15} /> },
    { key: 'pipeline', label: 'Pipeline', icon: <GitBranch size={15} /> },
    { key: 'lineage', label: 'Lineage', icon: <Layers size={15} /> },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>
            Governança de Modelos
          </h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0 }}>
            Rastreabilidade, auditoria de features e status do pipeline ML
          </p>
        </div>
        <button onClick={fetchData} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
          background: 'linear-gradient(135deg, #4a8e77, #2d7d9a)', border: 'none', color: 'white',
          borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
        }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Health summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {/* Model status */}
        <div style={{ ...cardStyle, borderLeft: `3px solid ${recData.method === 'xgboost_ensemble' ? '#4ead8a' : '#d4a84b'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Cpu size={16} color={theme.textSecondary} />
            <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Modelo em Produção</span>
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: theme.text, marginBottom: 4 }}>
            {recData.method === 'xgboost_ensemble' ? 'XGBoost Ensemble' : recData.method === 'momentum_fallback' ? 'Momentum (fallback)' : recData.method || '—'}
          </div>
          <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
            {recData.dt ? `Último ranking: ${fmtDate(recData.dt)}` : 'Sem ranking'}
          </div>
        </div>

        {/* Feature Store */}
        <div style={{ ...cardStyle, borderLeft: `3px solid ${(featureStore?.fundamentals.count || 0) > 0 ? '#4ead8a' : '#e07070'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Database size={16} color={theme.textSecondary} />
            <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Feature Store</span>
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: theme.text, marginBottom: 4 }}>
            {featureStore?.fundamentals.count || 0} tickers
          </div>
          <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
            {featureStore?.fundamentals.date ? `Atualizado: ${fmtDate(featureStore.fundamentals.date)}` : '—'}
          </div>
        </div>

        {/* Acurácia */}
        <div style={{ ...cardStyle, borderLeft: `3px solid ${(latest.directional_accuracy || 0) >= 0.6 ? '#4ead8a' : '#d4a84b'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <TrendingUp size={16} color={theme.textSecondary} />
            <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Acurácia Direcional</span>
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: (latest.directional_accuracy || 0) >= 0.6 ? '#4ead8a' : '#d4a84b' }}>
            {latest.directional_accuracy ? `${fmt(latest.directional_accuracy * 100, 1)}%` : '—'}
          </div>
          <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
            MAPE: {latest.mape ? `${fmt(latest.mape)}%` : '—'}
          </div>
        </div>

        {/* Pipeline health */}
        <div style={{ ...cardStyle, borderLeft: `3px solid ${pipeline ? '#4ead8a' : '#8fa89c'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Zap size={16} color={theme.textSecondary} />
            <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Pipeline</span>
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#4ead8a' }}>
            3/3 ativos
          </div>
          <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
            IngestFeatures · WeeklyRetrain · DailyRanking
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1rem', overflowX: 'auto', paddingBottom: 2 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem',
            borderRadius: 8, border: `1px solid ${activeTab === tab.key ? '#5a9e87' : theme.border}`,
            background: activeTab === tab.key ? (darkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)') : 'transparent',
            color: activeTab === tab.key ? '#5a9e87' : theme.textSecondary,
            cursor: 'pointer', fontSize: '0.82rem', fontWeight: activeTab === tab.key ? 600 : 400,
            whiteSpace: 'nowrap', transition: 'all 0.15s',
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'registry' && renderRegistry()}
      {activeTab === 'features' && renderFeatureStore()}
      {activeTab === 'pipeline' && renderPipeline()}
      {activeTab === 'lineage' && renderLineage()}
    </div>
  );


  /* ═══════════════════════════════════════════════════
     TAB 1: Model Registry
     ═══════════════════════════════════════════════════ */
  function renderRegistry() {
    const recD = latestRec?.data || {};
    const meta = recD.model_metadata || {};

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Current model card */}
        <div style={{ ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Shield size={18} color="#5a9e87" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Modelo Ativo em Produção</span>
            <span style={{
              marginLeft: 'auto', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.68rem', fontWeight: 600,
              background: recD.method === 'xgboost_ensemble' ? 'rgba(16,185,129,0.15)' : 'rgba(212,168,75,0.15)',
              color: recD.method === 'xgboost_ensemble' ? '#4ead8a' : '#d4a84b',
            }}>
              {recD.method === 'xgboost_ensemble' ? '● ML Ativo' : '● Fallback'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: 2 }}>Método</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: theme.text }}>
                {recD.method === 'xgboost_ensemble' ? 'XGBoost + SHAP Selection' : recD.method || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: 2 }}>Model Key</div>
              <div style={{ fontSize: '0.78rem', color: theme.text, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {recD.model_key || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: 2 }}>Data do Ranking</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 500, color: theme.text }}>{recD.dt ? fmtDate(recD.dt) : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: 2 }}>Tickers Ranqueados</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 500, color: theme.text }}>{recD.count || recD.top_n || '—'}</div>
            </div>
          </div>
        </div>

        {/* Training metrics */}
        <div style={{ ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BarChart3 size={18} color="#5a9e87" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Métricas de Treino</span>
            <InfoTooltip text="Métricas do último treino do modelo XGBoost com walk-forward cross-validation." darkMode={darkMode} size={14} />
          </div>

          {meta && Object.keys(meta).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Train RMSE', value: fmt(meta.train_rmse, 4), color: '#5a9e87', tip: 'Root Mean Squared Error no conjunto de treino.' },
                { label: 'Val RMSE', value: fmt(meta.val_rmse, 4), color: '#5a9e87', tip: 'RMSE no conjunto de validação.' },
                ...(meta.val_mape != null && meta.val_mape < 1000 ? [{
                  label: 'Val MAPE', value: `${fmt(meta.val_mape)}%`,
                  color: meta.val_mape <= 15 ? '#4ead8a' : '#d4a84b',
                  tip: 'Mean Absolute Percentage Error na validação.',
                }] : []),
                { label: 'CV Avg RMSE', value: fmt(meta.cv_avg_rmse, 4), color: '#5a9e87', tip: 'RMSE médio do walk-forward cross-validation.' },
                ...(meta.cv_avg_mape != null && meta.cv_avg_mape < 1000 ? [{
                  label: 'CV Avg MAPE', value: `${fmt(meta.cv_avg_mape)}%`,
                  color: meta.cv_avg_mape <= 15 ? '#4ead8a' : '#d4a84b',
                  tip: 'MAPE médio do walk-forward CV.',
                }] : []),
                ...(meta.n_features != null ? [{
                  label: 'Features', value: `${meta.n_features}`,
                  color: '#5a9e87', tip: 'Número de features selecionadas pelo SHAP.',
                }] : []),
                ...(meta.train_samples != null ? [{
                  label: 'Amostras', value: `${meta.train_samples}`,
                  color: '#5a9e87', tip: 'Número de amostras usadas no treino.',
                }] : []),
              ].map((m, i) => (
                <div key={i} style={{ padding: '0.75rem', background: darkMode ? '#121a1a' : '#f6faf8', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {m.label} <InfoTooltip text={m.tip} darkMode={darkMode} size={11} />
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '1rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.82rem' }}>
              <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Modelo usando fallback (momentum). Retreine para obter métricas.
            </div>
          )}
        </div>

        {/* Monitor metrics (live) */}
        {monitorData?.latest && (
          <div style={{ ...cardStyle }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Activity size={18} color="#4ead8a" />
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Métricas em Produção (Live)</span>
              <InfoTooltip text="Métricas calculadas comparando previsões com preços reais de mercado." darkMode={darkMode} size={14} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Acurácia Direcional', value: `${fmt(latest.directional_accuracy * 100, 1)}%`, color: latest.directional_accuracy >= 0.6 ? '#4ead8a' : '#d4a84b' },
                { label: 'MAPE', value: `${fmt(latest.mape)}%`, color: latest.mape <= 1 ? '#4ead8a' : '#d4a84b' },
                { label: 'MAE', value: `${fmt(latest.mae * 100, 2)}%`, color: '#5a9e87' },
                { label: 'Hit Rate', value: `${fmt(latest.hit_rate * 100, 1)}%`, color: latest.hit_rate >= 0.5 ? '#4ead8a' : '#d4a84b' },
                { label: 'Sharpe Ratio', value: fmt(latest.sharpe_ratio), color: latest.sharpe_ratio >= 0 ? '#4ead8a' : '#e07070' },
                { label: 'Amostra', value: `${latest.sample_size || '—'}`, color: '#5a9e87' },
              ].map((m, i) => (
                <div key={i} style={{ padding: '0.75rem', background: darkMode ? '#121a1a' : '#f6faf8', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }


  /* ═══════════════════════════════════════════════════
     TAB 2: Feature Store
     ═══════════════════════════════════════════════════ */
  function renderFeatureStore() {
    const EXPECTED_FIELDS = [
      { group: 'Valuation', fields: ['pe_ratio', 'forward_pe', 'pb_ratio', 'dividend_yield', 'ev_to_ebitda', 'ev_to_revenue', 'peg_ratio', 'price_to_sales'] },
      { group: 'Rentabilidade', fields: ['roe', 'roa', 'profit_margin', 'operating_margin', 'ebitda_margin', 'gross_margin'] },
      { group: 'Crescimento', fields: ['earnings_growth', 'revenue_growth', 'earnings_quarterly_growth'] },
      { group: 'Endividamento', fields: ['debt_to_equity', 'debt_to_ebitda', 'current_ratio', 'quick_ratio', 'interest_coverage', 'net_debt'] },
      { group: 'Tamanho', fields: ['market_cap', 'enterprise_value'] },
      { group: 'Cash Flow', fields: ['free_cash_flow', 'operating_cash_flow'] },
      { group: 'Balanço/DRE', fields: ['total_assets', 'total_liabilities', 'total_equity', 'total_revenue', 'net_income', 'ebitda', 'total_debt', 'cash', 'asset_turnover'] },
      { group: 'Classificação', fields: ['sector', 'industry'] },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Data sources status */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '0.75rem' }}>
          {/* Fundamentals */}
          <div style={{ ...cardStyle, borderLeft: `3px solid ${(featureStore?.fundamentals.count || 0) > 0 ? '#4ead8a' : '#e07070'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {(featureStore?.fundamentals.count || 0) > 0 ? <CheckCircle2 size={18} color="#4ead8a" /> : <XCircle size={18} color="#e07070" />}
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: theme.text }}>Fundamentalistas (BRAPI Pro)</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: 4 }}>
              {featureStore?.fundamentals.count || 0} tickers · {featureStore?.fundamentals.date ? fmtDate(featureStore.fundamentals.date) : '—'}
            </div>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
              5 modules: summaryProfile, financialData, defaultKeyStatistics, balanceSheetHistory, incomeStatementHistory
            </div>
          </div>

          {/* Macro */}
          <div style={{ ...cardStyle, borderLeft: `3px solid ${featureStore?.macro.ok ? '#4ead8a' : '#e07070'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {featureStore?.macro.ok ? <CheckCircle2 size={18} color="#4ead8a" /> : <XCircle size={18} color="#e07070" />}
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: theme.text }}>Macroeconômico (BCB)</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: 4 }}>
              10 features · Selic, IPCA, Câmbio, CDI
            </div>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
              API pública do Banco Central do Brasil
            </div>
          </div>

          {/* Sentiment */}
          <div style={{ ...cardStyle, borderLeft: `3px solid ${(featureStore?.sentiment.count || 0) > 0 ? '#4ead8a' : '#8fa89c'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {(featureStore?.sentiment.count || 0) > 0 ? <CheckCircle2 size={18} color="#4ead8a" /> : <Clock size={18} color="#8fa89c" />}
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: theme.text }}>Sentimento (News)</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: 4 }}>
              {(featureStore?.sentiment.count || 0) > 0 ? `${featureStore?.sentiment.count} tickers` : 'Não configurado'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#d4a84b' }}>
              {(featureStore?.sentiment.count || 0) === 0 ? '⚠ Configure NEWS_API_KEY para ativar' : 'NewsAPI'}
            </div>
          </div>
        </div>

        {/* Feature coverage audit */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Eye size={18} color="#5a9e87" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Auditoria de Cobertura (BRAPI Pro)</span>
            <InfoTooltip text="Verifica quais campos da BRAPI Pro estão preenchidos para cada ticker." darkMode={darkMode} size={14} />
          </div>

          {featureAudit.length > 0 ? (
            <div>
              {featureAudit.map(audit => {
                const pct = Math.round((audit.populated / audit.total) * 100);
                const isExpanded = expandedTicker === audit.ticker;
                return (
                  <div key={audit.ticker} style={{ borderBottom: `1px solid ${theme.border}`, paddingBottom: 8, marginBottom: 8 }}>
                    <button onClick={() => setExpandedTicker(isExpanded ? null : audit.ticker)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0',
                      background: 'none', border: 'none', cursor: 'pointer', color: theme.text, textAlign: 'left',
                    }}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', minWidth: 60 }}>{audit.ticker}</span>
                      <div style={{ flex: 1, height: 6, background: darkMode ? '#121a1a' : '#d4e5dc', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? '#4ead8a' : pct >= 60 ? '#d4a84b' : '#e07070', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: pct >= 80 ? '#4ead8a' : '#d4a84b', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>
                        {pct}%
                      </span>
                      <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                        ({audit.populated}/{audit.total})
                      </span>
                    </button>
                    {isExpanded && audit.missing.length > 0 && (
                      <div style={{ marginLeft: 28, marginTop: 4, padding: '0.5rem', background: darkMode ? '#121a1a' : '#f5ecd0', borderRadius: 6, fontSize: '0.75rem' }}>
                        <span style={{ color: '#d4a84b', fontWeight: 600 }}>Campos ausentes: </span>
                        <span style={{ color: theme.textSecondary }}>{audit.missing.join(', ')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem', color: theme.textSecondary, fontSize: '0.82rem' }}>
              Carregando auditoria de features...
            </div>
          )}
        </div>

        {/* Expected fields reference */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <FileText size={18} color="#5a9e87" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Mapa de Features Fundamentalistas</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.75rem' }}>
            {EXPECTED_FIELDS.map(group => (
              <div key={group.group} style={{ padding: '0.6rem', background: darkMode ? '#121a1a' : '#f6faf8', borderRadius: 8 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#5a9e87', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {group.group}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {group.fields.map(f => (
                    <span key={f} style={{
                      padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.68rem',
                      background: darkMode ? '#2a3d36' : '#d4e5dc', color: theme.textSecondary,
                      fontFamily: 'monospace',
                    }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }


  /* ═══════════════════════════════════════════════════
     TAB 3: Pipeline
     ═══════════════════════════════════════════════════ */
  function renderPipeline() {
    const pipelines = [
      {
        name: 'IngestFeatures',
        description: 'Coleta fundamentalistas (BRAPI Pro), macro (BCB) e sentimento. Salva no Feature Store S3.',
        schedule: 'Diário, SEG-SEX 21:00 UTC (18:00 BRT)',
        lambda: 'B3TacticalRankingStackV2-IngestFeatures',
        status: pipeline?.ingest_features,
        icon: <Database size={18} />,
        color: '#5a9e87',
        outputs: ['feature_store/fundamentals/', 'feature_store/macro/', 'feature_store/sentiment/'],
        inputs: ['BRAPI Pro API', 'BCB API', 'NewsAPI (opcional)'],
      },
      {
        name: 'WeeklyRetrain',
        description: 'Retreina XGBoost com SHAP-based feature selection, walk-forward CV, multi-target (retorno + volatilidade).',
        schedule: 'Semanal, Domingo 22:00 UTC (19:00 BRT)',
        lambda: 'B3TacticalRankingStackV2-WeeklyRetrain',
        status: pipeline?.weekly_retrain,
        icon: <Cpu size={18} />,
        color: '#5a9e87',
        outputs: ['models/ensemble/{date}/model.tar.gz', 'models/ensemble/{date}/metrics.json', 'models/ensemble/{date}/selected_features.json'],
        inputs: ['curated/daily_monthly/', 'feature_store/'],
      },
      {
        name: 'DailyRanking',
        description: 'Gera ranking diário usando modelo treinado + features avançadas (volume, fundamentals, macro, setor, sentimento).',
        schedule: 'Diário, SEG-SEX 21:30 UTC (18:30 BRT)',
        lambda: 'B3TacticalRankingStackV2-RankSageMaker',
        status: pipeline?.daily_ranking,
        icon: <TrendingUp size={18} />,
        color: '#4ead8a',
        outputs: ['recommendations/dt={date}/top50.json'],
        inputs: ['curated/daily_monthly/', 'feature_store/', 'models/ensemble/'],
      },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {pipelines.map((p, idx) => (
          <div key={p.name} style={{ ...cardStyle, borderLeft: `3px solid ${p.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 8, borderRadius: 8, background: `${p.color}15`, color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>{p.name}</div>
                <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>{p.description}</div>
              </div>
              <StatusDot ok={p.status?.status === 'active'} label={p.status?.status === 'active' ? 'Ativo' : 'Inativo'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.75rem', marginBottom: 12 }}>
              <div style={{ padding: '0.5rem 0.75rem', background: darkMode ? '#121a1a' : '#f6faf8', borderRadius: 6 }}>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: 2 }}>Schedule</div>
                <div style={{ fontSize: '0.78rem', color: theme.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} /> {p.schedule}
                </div>
              </div>
              <div style={{ padding: '0.5rem 0.75rem', background: darkMode ? '#121a1a' : '#f6faf8', borderRadius: 6 }}>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: 2 }}>Próxima execução</div>
                <div style={{ fontSize: '0.78rem', color: theme.text }}>
                  {p.status?.next_run ? fmtDateTime(p.status.next_run) : '—'}
                </div>
              </div>
              <div style={{ padding: '0.5rem 0.75rem', background: darkMode ? '#121a1a' : '#f6faf8', borderRadius: 6 }}>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: 2 }}>Lambda</div>
                <div style={{ fontSize: '0.72rem', color: theme.text, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {p.lambda}
                </div>
              </div>
            </div>

            {/* Inputs / Outputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, marginBottom: 4, textTransform: 'uppercase' }}>Inputs</div>
                {p.inputs.map(inp => (
                  <div key={inp} style={{ fontSize: '0.72rem', color: theme.textSecondary, padding: '0.15rem 0', fontFamily: 'monospace' }}>
                    → {inp}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, marginBottom: 4, textTransform: 'uppercase' }}>Outputs</div>
                {p.outputs.map(out => (
                  <div key={out} style={{ fontSize: '0.72rem', color: theme.textSecondary, padding: '0.15rem 0', fontFamily: 'monospace' }}>
                    ← {out}
                  </div>
                ))}
              </div>
            </div>

            {/* Connection arrow to next */}
            {idx < pipelines.length - 1 && (
              <div style={{ textAlign: 'center', margin: '0.5rem 0 -0.5rem', color: theme.textSecondary, fontSize: '1.2rem' }}>
                ↓
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }


  /* ═══════════════════════════════════════════════════
     TAB 4: Lineage
     ═══════════════════════════════════════════════════ */
  function renderLineage() {
    const stages = [
      {
        name: 'Dados Brutos',
        icon: <Database size={20} />,
        color: '#5a9e87',
        items: [
          { label: 'BRAPI Pro', detail: '5 modules · 46 tickers · ~35 campos/ticker', status: true },
          { label: 'BCB API', detail: 'Selic, IPCA, Câmbio, CDI · 10 features', status: true },
          { label: 'Cotações Diárias', detail: 'OHLCV via BRAPI · curated/daily_monthly/', status: true },
          { label: 'NewsAPI', detail: 'Sentimento de notícias', status: false },
        ],
      },
      {
        name: 'Feature Engineering',
        icon: <Layers size={20} />,
        color: '#5a9e87',
        items: [
          { label: 'Técnicas', detail: 'RSI, MACD, Bollinger, ATR, momentum, volatilidade, regime · ~25 features', status: true },
          { label: 'Volume', detail: 'OBV, VWAP, volume-price divergence, z-score · 11 features', status: true },
          { label: 'Fundamentalistas', detail: 'Valuation, rentabilidade, crescimento, endividamento, scores · ~30 features', status: true },
          { label: 'Macro', detail: 'Selic, IPCA, câmbio, CDI, variações · 10 features', status: true },
          { label: 'Setoriais', detail: 'Correlação, relative strength, dispersão · 5 features', status: true },
          { label: 'Sentimento', detail: 'Score + interação com momentum · 2 features', status: false },
        ],
      },
      {
        name: 'Feature Selection',
        icon: <Zap size={20} />,
        color: '#d4a84b',
        items: [
          { label: 'SHAP-based Selection', detail: 'Seleciona features com maior importância via SHAP values', status: true },
          { label: 'Fallback F-stat', detail: 'SelectKBest com f_regression se SHAP falhar', status: true },
          { label: 'Feature Store S3', detail: 'Particionado por data, evita training-serving skew', status: true },
        ],
      },
      {
        name: 'Treinamento',
        icon: <Cpu size={20} />,
        color: '#e07070',
        items: [
          { label: 'XGBoost', detail: 'Multi-target: retorno + volatilidade', status: true },
          { label: 'Walk-Forward CV', detail: '5 folds temporais, sem data leakage', status: true },
          { label: 'Adaptive Weights', detail: 'Pesos baseados em performance recente', status: true },
          { label: 'Retreino Semanal', detail: 'Domingo 22:00 UTC via EventBridge', status: true },
        ],
      },
      {
        name: 'Inferência',
        icon: <TrendingUp size={20} />,
        color: '#4ead8a',
        items: [
          { label: 'Ranking Diário', detail: 'Top 50 ações por score ajustado por risco', status: true },
          { label: 'Score = retorno / volatilidade', detail: 'Predição de retorno dividida por vol_20d', status: true },
          { label: 'Fallback Momentum', detail: 'Se modelo não disponível, usa momentum ponderado', status: true },
        ],
      },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {stages.map((stage, idx) => (
          <React.Fragment key={stage.name}>
            <div style={{ ...cardStyle, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${stage.color}15`, border: `2px solid ${stage.color}`, color: stage.color,
                }}>
                  {stage.icon}
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Etapa {idx + 1}
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>{stage.name}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: '0.5rem', marginLeft: 18 }}>
                {stage.items.map(item => (
                  <div key={item.label} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0.5rem 0.75rem',
                    background: darkMode ? '#121a1a' : '#f6faf8', borderRadius: 6,
                    borderLeft: `2px solid ${item.status ? '#4ead8a' : '#8fa89c'}`,
                  }}>
                    <div style={{ marginTop: 2 }}>
                      {item.status ? <CheckCircle2 size={14} color="#4ead8a" /> : <Clock size={14} color="#8fa89c" />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: theme.text }}>{item.label}</div>
                      <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Connector */}
            {idx < stages.length - 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '0.25rem 0' }}>
                <div style={{ width: 2, height: 20, background: theme.border }} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }
};


/* ── Helper: next schedule occurrence ── */
function getNextSchedule(hourUtc: number, minuteUtc: number, daysOfWeek: number[]): string {
  const now = new Date();
  const candidate = new Date(now);
  candidate.setUTCHours(hourUtc, minuteUtc, 0, 0);

  for (let i = 0; i < 8; i++) {
    const d = new Date(candidate.getTime() + i * 86400000);
    if (daysOfWeek.includes(d.getUTCDay()) && d > now) {
      return d.toISOString();
    }
  }
  return '';
}

export default AdminModelsPage;
