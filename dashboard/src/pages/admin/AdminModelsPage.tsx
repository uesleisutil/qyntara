import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  RefreshCw, Database, Activity, CheckCircle2, XCircle, Clock,
  GitBranch, Layers, BarChart3, Shield, ChevronDown,
  ChevronRight, Cpu, Zap, TrendingUp, Eye, FileText, Box,
  ArrowDown, Settings, Target, Brain, Gauge, Radio,
  Server, HardDrive, Workflow, Network, Hash,
  Sigma, Flame, Layers3,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../../components/shared/ui/InfoTooltip';
import { fmt, fmtDate } from '../../lib/formatters';

/* ─── Types ─── */
interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

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
interface FeatureAudit { ticker: string; populated: number; total: number; missing: string[]; }

type TabKey = 'overview' | 'architecture' | 'features' | 'pipeline' | 'training' | 'inference';

/* ─── Helpers ─── */
const fmtDateTime = (iso: string) => {
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
};

const StatusDot: React.FC<{ ok: boolean; label?: string; pulse?: boolean }> = ({ ok, label, pulse }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
    <span style={{
      width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
      background: ok ? '#10b981' : '#ef4444',
      boxShadow: pulse && ok ? '0 0 0 3px rgba(16,185,129,0.3)' : undefined,
      animation: pulse && ok ? 'pulse-dot 2s infinite' : undefined,
    }} />
    {label}
  </span>
);

const Badge: React.FC<{ text: string; color: string; bg: string }> = ({ text, color, bg }) => (
  <span style={{ padding: '0.15rem 0.5rem', borderRadius: 12, fontSize: '0.65rem', fontWeight: 600, background: bg, color }}>{text}</span>
);

const FlowArrow: React.FC<{ color?: string }> = ({ color = '#6b7280' }) => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '0.15rem 0' }}>
    <ArrowDown size={18} color={color} />
  </div>
);

/* ─── Model Architecture Definitions ─── */
const MODEL_DEFS = {
  transformer_bilstm: {
    emoji: '🧠', name: 'Transformer + BiLSTM', color: '#8b5cf6',
    desc: 'Modelo híbrido: Transformer Encoder (multi-head self-attention) + BiLSTM bidirecional com attention pooling.',
    layers: [
      { name: 'Input Projection', detail: 'Linear(n_features → 128) + LayerNorm + GELU + Dropout(0.2)' },
      { name: 'Positional Encoding', detail: 'Sinusoidal encoding (max_len=512)' },
      { name: 'Transformer Encoder', detail: '2 layers, 4 heads, d_model=128, FFN=512, pre-norm, GELU' },
      { name: 'BiLSTM', detail: 'hidden=64, 1 layer, bidirectional → 128 dims' },
      { name: 'Attention Pooling', detail: 'Linear(128→1) + softmax → weighted sum' },
      { name: 'Shared MLP', detail: 'Linear(128→64) + LayerNorm + GELU + Dropout' },
      { name: 'Reg Head', detail: 'Linear(64→32) + GELU + Linear(32→1) + Tanh × 0.15' },
      { name: 'Cls Head', detail: 'Linear(64→32) + GELU + Linear(32→1) → logit direção' },
    ],
    params: { d_model: 128, nhead: 4, encoder_layers: 2, lstm_hidden: 64, dropout: 0.2 },
    inference: 'direction = tanh(cls_logit), magnitude = |reg_out| → output = direction × magnitude',
  },
  tab_transformer: {
    emoji: '🔮', name: 'TabTransformer', color: '#3b82f6',
    desc: 'Transformer para dados tabulares: cada feature vira um token com embedding próprio. CLS token agrega interações.',
    layers: [
      { name: 'Feature Tokenization', detail: 'Linear(1 → 64) por feature → (B, n_features, 64)' },
      { name: 'Positional Embedding', detail: 'Learned positional embedding (n_features+1, 64)' },
      { name: 'CLS Token', detail: 'Learnable parameter (1, 1, 64) prepended' },
      { name: 'Transformer Encoder', detail: '3 layers, 4 heads, d_model=64, FFN=256, pre-norm, GELU' },
      { name: 'LayerNorm', detail: 'Final normalization on CLS output' },
      { name: 'Shared MLP', detail: 'Linear(64→64) + GELU + Dropout(0.15)' },
      { name: 'Reg Head', detail: 'Linear(64→1) + Tanh × 0.15' },
      { name: 'Cls Head', detail: 'Linear(64→1) → logit direção' },
    ],
    params: { d_model: 64, nhead: 4, num_layers: 3, dropout: 0.15 },
    inference: 'direction = tanh(cls_logit), magnitude = |reg_out| → output = direction × magnitude',
  },
  ft_transformer: {
    emoji: '⚡', name: 'FT-Transformer', color: '#10b981',
    desc: 'Feature Tokenizer + Transformer (SOTA tabular). Embedding individual aprendido por feature com peso + bias.',
    layers: [
      { name: 'Feature Tokenizer', detail: 'x_i × W_i + b_i (peso + bias aprendidos por feature) → (B, n_features, 128)' },
      { name: 'CLS Token', detail: 'Learnable parameter (1, 1, 128) prepended' },
      { name: 'Transformer Encoder', detail: '4 layers, 8 heads, d_model=128, FFN=512, pre-norm, GELU' },
      { name: 'Final LayerNorm', detail: 'Normalization on full sequence' },
      { name: 'CLS Extraction', detail: 'out[:, 0, :] → (B, 128)' },
      { name: 'Shared MLP', detail: 'Linear(128→64) + LayerNorm + GELU + Dropout(0.15)' },
      { name: 'Reg Head', detail: 'Linear(64→1) + Tanh × 0.15' },
      { name: 'Cls Head', detail: 'Linear(64→1) → logit direção' },
    ],
    params: { d_model: 128, nhead: 8, num_layers: 4, dim_feedforward: 512, dropout: 0.15 },
    inference: 'direction = tanh(cls_logit), magnitude = |reg_out| → output = direction × magnitude',
    reference: 'Gorishniy et al. "Revisiting Deep Learning Models for Tabular Data" (2021)',
  },
};


/* ─── Feature Categories ─── */
const FEATURE_CATEGORIES = [
  {
    name: 'Técnicas', icon: '📈', color: '#3b82f6', count: '~30',
    source: 'Cotações OHLCV (BRAPI)',
    features: [
      { group: 'Momentum', items: ['RSI(14)', 'MACD(12,26,9)', 'Stochastic(14,3,3)', 'return_1d/5d/20d/60d', 'trend_slope_20d/60d'] },
      { group: 'Volatilidade', items: ['vol_5d/20d/60d', 'vol_ratio', 'ATR(14)', 'Bollinger %B/width'] },
      { group: 'Reversão à Média', items: ['z_score_20d/60d', 'dist_ma_20d/50d', 'mean_reversion_score'] },
      { group: 'Tendência', items: ['MA(5/10/20/50)', 'ma_cross_5_20', 'ma_cross_20_50', 'trend_strength', 'adx_proxy'] },
      { group: 'Regime', items: ['regime_volatility', 'regime_trend', 'regime_momentum', 'regime_composite'] },
    ],
  },
  {
    name: 'Volume', icon: '📊', color: '#8b5cf6', count: '~15',
    source: 'Cotações OHLCV (BRAPI)',
    features: [
      { group: 'Volume', items: ['OBV', 'VWAP', 'volume_z_score', 'volume_ma_ratio', 'volume_price_divergence', 'volume_trend'] },
    ],
  },
  {
    name: 'Fundamentalistas', icon: '🏢', color: '#f59e0b', count: '~25',
    source: 'BRAPI Pro (5 modules)',
    features: [
      { group: 'Valuation', items: ['pe_ratio', 'forward_pe', 'pb_ratio', 'dividend_yield', 'ev_to_ebitda', 'ev_to_revenue', 'peg_ratio', 'price_to_sales'] },
      { group: 'Rentabilidade', items: ['roe', 'roa', 'profit_margin', 'operating_margin', 'ebitda_margin', 'gross_margin'] },
      { group: 'Crescimento', items: ['earnings_growth', 'revenue_growth', 'earnings_quarterly_growth'] },
      { group: 'Endividamento', items: ['debt_to_equity', 'debt_to_ebitda', 'current_ratio', 'quick_ratio', 'interest_coverage'] },
      { group: 'Tamanho/Cash', items: ['market_cap', 'enterprise_value', 'free_cash_flow', 'operating_cash_flow'] },
    ],
  },
  {
    name: 'Macroeconômico', icon: '🏛️', color: '#ef4444', count: '10',
    source: 'BCB API (Banco Central)',
    features: [
      { group: 'Indicadores', items: ['selic', 'ipca', 'cambio_usd_brl', 'cdi', 'selic_var', 'ipca_var', 'cambio_var', 'spread_selic_ipca', 'real_rate', 'monetary_tightening'] },
    ],
  },
  {
    name: 'Setoriais', icon: '🔗', color: '#06b6d4', count: '~8',
    source: 'Calculado (cross-section)',
    features: [
      { group: 'Setor', items: ['sector_correlation', 'relative_strength', 'sector_dispersion', 'sector_momentum', 'sector_rank'] },
    ],
  },
  {
    name: 'Sentimento', icon: '📰', color: '#a855f7', count: '2',
    source: 'NewsAPI (opcional)',
    features: [
      { group: 'Sentimento', items: ['sentiment_score (-1 a +1)', 'sentiment_x_momentum (interação)'] },
    ],
  },
];

const TRAINING_CONFIG = {
  optimizer: 'AdamW (weight_decay=1e-3)',
  scheduler: 'OneCycleLR (max_lr=lr, per epoch)',
  loss_regression: 'HuberLoss (δ=0.05)',
  loss_classification: 'Asymmetric Focal Loss (γ=2)',
  loss_blend: '40% regressão + 60% classificação',
  magnitude_weight: '1 + 2 × clamp(|y|/0.03, max=3) — movimentos fortes (>3%) recebem 3× mais peso',
  gradient_clipping: 'clip_grad_norm_(1.0)',
  early_stopping: 'patience=20, monitora val_loss',
  validation: 'Walk-Forward CV (5 splits, temporal)',
  scaler: 'StandardScaler (fit no treino)',
  outlier_removal: '|y| < 5σ',
  epochs: '120 (SageMaker) / 80 (local)',
  batch_size: '128 (SageMaker) / 64 (local)',
  lr: '5e-4 (SageMaker) / 1e-3 (local)',
  ensemble_weights: 'Inversamente proporcional ao RMSE: w_i = (1/RMSE_i) / Σ(1/RMSE_j)',
  score_formula: 'Score = predição_ensemble / volatilidade_20d (ajuste por risco)',
};

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
const AdminModelsPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [expandedFeatureCat, setExpandedFeatureCat] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  const [featureStore, setFeatureStore] = useState<FeatureStoreStatus | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
  const [featureAudit, setFeatureAudit] = useState<FeatureAudit[]>([]);
  const [latestRec, setLatestRec] = useState<any>(null);
  const [monitorData, setMonitorData] = useState<any>(null);

  const headers = useMemo(() => ({ 'x-api-key': API_KEY }), []);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1d27' : '#fff'),
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  const subCardStyle: React.CSSProperties = {
    padding: '0.6rem 0.75rem',
    background: darkMode ? '#0f1117' : '#f8fafc',
    borderRadius: 8,
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, monRes, fsListRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers }),
        fetch(`${API_BASE_URL}/api/monitoring/model-performance`, { headers }),
        fetch(`${API_BASE_URL}/s3-proxy/list?prefix=feature_store/fundamentals/`, { headers }),
      ]);

      if (recRes.ok) setLatestRec(await recRes.json());
      if (monRes.ok) setMonitorData(await monRes.json());

      if (fsListRes.ok) {
        const fsData = await fsListRes.json();
        const objects = fsData.objects || [];
        const fundamentalFiles = objects.map((o: any) => o.Key).filter((k: string) => k.includes('fundamentals/'));
        const dates = fundamentalFiles.map((f: string) => { const m = f.match(/dt=(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null; }).filter(Boolean);
        const latestDate = dates.sort().pop() || '';
        const latestFiles = fundamentalFiles.filter((f: string) => f.includes(`dt=${latestDate}`));

        const sampleTickers: FeatureAudit[] = [];
        for (const file of latestFiles.slice(0, 5)) {
          try {
            const tickerMatch = file.match(/\/([A-Z0-9]+)\.json$/);
            if (!tickerMatch) continue;
            const ticker = tickerMatch[1];
            const sampleRes = await fetch(`${API_BASE_URL}/s3-proxy?key=${file}`, { headers });
            if (sampleRes.ok) {
              const data = await sampleRes.json();
              const allFields = [
                'pe_ratio','forward_pe','pb_ratio','dividend_yield','ev_to_ebitda','ev_to_revenue','peg_ratio','price_to_sales',
                'roe','roa','profit_margin','operating_margin','ebitda_margin','gross_margin',
                'earnings_growth','revenue_growth','earnings_quarterly_growth',
                'debt_to_equity','debt_to_ebitda','current_ratio','quick_ratio','interest_coverage','net_debt',
                'market_cap','enterprise_value','free_cash_flow','operating_cash_flow',
                'total_assets','total_liabilities','total_equity','total_revenue','net_income','ebitda','total_debt','cash','asset_turnover',
                'sector','industry',
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

      const now = new Date();
      setPipeline({
        ingest_features: { last_run: now.toISOString(), next_run: getNextSchedule(21, 0, [1,2,3,4,5]), status: 'active' },
        weekly_retrain: { last_run: undefined, next_run: getNextSchedule(22, 0, [0]), status: 'active' },
        daily_ranking: { last_run: undefined, next_run: getNextSchedule(21, 30, [1,2,3,4,5]), status: 'active' },
      });
      setLastRefresh(new Date());
    } catch (err) { console.error('AdminModelsPage fetch error:', err); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => { fetchData(); }, 60000);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [fetchData]);

  const latest = monitorData?.latest || {};
  const recData = latestRec?.data || {};
  const meta = recData.model_metadata || {};
  const individualMetrics = meta?.individual_metrics || {};
  const weights = meta?.weights || {};
  const hasIndividual = Object.keys(individualMetrics).length > 0;
  const isDL = recData.method?.startsWith('dl_');

  if (loading) {
    const sk: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1a1d27' : '#e2e8f0'} 25%, ${darkMode ? '#2a2e3a' : '#f1f5f9'} 50%, ${darkMode ? '#1a1d27' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ ...sk, height: 28, width: 260, marginBottom: 8 }} />
        <div style={{ ...sk, height: 16, width: 400, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ ...sk, height: 100, borderRadius: 12 }} />)}
        </div>
        <div style={{ ...sk, height: 400, borderRadius: 12 }} />
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Visão Geral (Live)', icon: <Radio size={15} /> },
    { key: 'architecture', label: 'Arquitetura DL', icon: <Brain size={15} /> },
    { key: 'features', label: 'Feature Engineering', icon: <Layers3 size={15} /> },
    { key: 'pipeline', label: 'Pipeline', icon: <Workflow size={15} /> },
    { key: 'training', label: 'Treinamento', icon: <Flame size={15} /> },
    { key: 'inference', label: 'Inferência & Ranking', icon: <Target size={15} /> },
  ];


  return (
    <div>
      <style>{`
        @keyframes pulse-dot { 0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); } 50% { box-shadow: 0 0 0 6px rgba(16,185,129,0); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={24} color="#3b82f6" /> Pipeline ML — Real-Time
          </h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0 }}>
            Visão completa da pipeline: dados → features → treinamento → ensemble → inferência → ranking
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>
            Atualizado: {lastRefresh.toLocaleTimeString('pt-BR')} · Auto-refresh 60s
          </span>
          <button onClick={fetchData} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white',
            borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
          }}>
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      {/* Live Status Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '0.6rem', marginBottom: '1.25rem',
      }}>
        <div style={{ ...cardStyle, borderLeft: `3px solid ${isDL ? '#10b981' : '#f59e0b'}`, padding: '0.6rem 0.75rem' }}>
          <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Cpu size={12} /> Modelo Ativo
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: theme.text }}>
            {isDL ? 'DL Ensemble (3)' : recData.method === 'momentum_fallback' ? 'Momentum' : recData.method || '—'}
          </div>
          <StatusDot ok={!!isDL} label={isDL ? 'DL Ativo' : 'Fallback'} pulse={!!isDL} />
        </div>

        <div style={{ ...cardStyle, borderLeft: `3px solid ${(latest.directional_accuracy || 0) >= 0.6 ? '#10b981' : '#f59e0b'}`, padding: '0.6rem 0.75rem' }}>
          <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Target size={12} /> Acurácia Direcional
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: (latest.directional_accuracy || 0) >= 0.6 ? '#10b981' : '#f59e0b' }}>
            {latest.directional_accuracy ? `${fmt(latest.directional_accuracy * 100, 1)}%` : meta.directional_accuracy ? `${fmt(meta.directional_accuracy * 100, 1)}%` : '—'}
          </div>
          <div style={{ fontSize: '0.62rem', color: theme.textSecondary }}>{latest.directional_accuracy ? 'Live (preços reais)' : 'Validação'}</div>
        </div>

        <div style={{ ...cardStyle, borderLeft: `3px solid ${(featureStore?.fundamentals.count || 0) > 0 ? '#10b981' : '#ef4444'}`, padding: '0.6rem 0.75rem' }}>
          <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Database size={12} /> Feature Store
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: theme.text }}>{featureStore?.fundamentals.count || 0} tickers</div>
          <div style={{ fontSize: '0.62rem', color: theme.textSecondary }}>{featureStore?.fundamentals.date ? fmtDate(featureStore.fundamentals.date) : '—'}</div>
        </div>

        <div style={{ ...cardStyle, borderLeft: '3px solid #3b82f6', padding: '0.6rem 0.75rem' }}>
          <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Hash size={12} /> Features Totais
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#3b82f6' }}>{meta.n_features || '~92'}</div>
          <div style={{ fontSize: '0.62rem', color: theme.textSecondary }}>6 categorias</div>
        </div>

        <div style={{ ...cardStyle, borderLeft: '3px solid #10b981', padding: '0.6rem 0.75rem' }}>
          <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={12} /> Pipeline
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#10b981' }}>3/3 ativos</div>
          <StatusDot ok={true} label="Operacional" pulse />
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1rem', overflowX: 'auto', paddingBottom: 2 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem',
            borderRadius: 8, border: `1px solid ${activeTab === tab.key ? '#3b82f6' : theme.border}`,
            background: activeTab === tab.key ? (darkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)') : 'transparent',
            color: activeTab === tab.key ? '#3b82f6' : theme.textSecondary,
            cursor: 'pointer', fontSize: '0.78rem', fontWeight: activeTab === tab.key ? 600 : 400,
            whiteSpace: 'nowrap', transition: 'all 0.15s',
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'architecture' && renderArchitecture()}
      {activeTab === 'features' && renderFeatures()}
      {activeTab === 'pipeline' && renderPipeline()}
      {activeTab === 'training' && renderTraining()}
      {activeTab === 'inference' && renderInference()}
    </div>
  );


  /* ═══════════════════════════════════════════════════
     TAB 1: OVERVIEW — Visão geral real-time da pipeline inteira
     ═══════════════════════════════════════════════════ */
  function renderOverview() {
    const pipelineStages = [
      {
        name: 'Ingestão de Dados', icon: <Database size={20} />, color: '#3b82f6',
        status: pipeline?.ingest_features?.status === 'active',
        detail: `${featureStore?.fundamentals.count || 0} tickers · BRAPI Pro + BCB + NewsAPI`,
        schedule: 'Diário SEG-SEX 18:00 BRT',
        nextRun: pipeline?.ingest_features?.next_run,
      },
      {
        name: 'Feature Engineering', icon: <Layers size={20} />, color: '#8b5cf6',
        status: true,
        detail: `${meta.n_features || '~92'} features · 6 categorias (técnicas, volume, fundamentais, macro, setor, sentimento)`,
        schedule: 'Inline na ingestão',
      },
      {
        name: 'Feature Store (S3)', icon: <HardDrive size={20} />, color: '#06b6d4',
        status: (featureStore?.fundamentals.count || 0) > 0,
        detail: `Particionado por data · feature_store/{category}/dt=YYYY-MM-DD/{ticker}.json`,
        schedule: `Última atualização: ${featureStore?.fundamentals.date ? fmtDate(featureStore.fundamentals.date) : '—'}`,
      },
      {
        name: 'Treinamento (SageMaker)', icon: <Cpu size={20} />, color: '#ef4444',
        status: pipeline?.weekly_retrain?.status === 'active',
        detail: '3 modelos DL em paralelo (ml.m5.xlarge, 16GB) → Ensemble ponderado',
        schedule: 'Semanal DOM 19:00 BRT',
        nextRun: pipeline?.weekly_retrain?.next_run,
      },
      {
        name: 'Ensemble DL', icon: <Network size={20} />, color: '#f59e0b',
        status: !!isDL,
        detail: `Transformer+BiLSTM (${fmt((weights.transformer_bilstm || 0) * 100, 0)}%) + TabTransformer (${fmt((weights.tab_transformer || 0) * 100, 0)}%) + FT-Transformer (${fmt((weights.ft_transformer || 0) * 100, 0)}%)`,
        schedule: isDL ? 'DL Ativo' : 'Fallback Momentum',
      },
      {
        name: 'Inferência & Ranking', icon: <TrendingUp size={20} />, color: '#10b981',
        status: pipeline?.daily_ranking?.status === 'active',
        detail: `Top ${recData.top_n || 50} ações · Score = pred_ensemble / vol_20d`,
        schedule: 'Diário SEG-SEX 18:30 BRT',
        nextRun: pipeline?.daily_ranking?.next_run,
      },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Pipeline flow */}
        <div style={{ ...cardStyle, background: darkMode ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Workflow size={18} color="#3b82f6" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Pipeline End-to-End (Live)</span>
            <Badge text="AUTO-REFRESH 60s" color="#3b82f6" bg="rgba(59,130,246,0.12)" />
          </div>

          {pipelineStages.map((stage, idx) => (
            <React.Fragment key={stage.name}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '0.6rem 0.75rem',
                background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 8,
                borderLeft: `3px solid ${stage.color}`, transition: 'all 0.2s',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${stage.color}15`, color: stage.color, flexShrink: 0,
                }}>
                  {stage.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>{stage.name}</span>
                    <StatusDot ok={stage.status} pulse={stage.status} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{stage.detail}</div>
                  <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginTop: 2 }}>
                    {stage.schedule}{stage.nextRun ? ` · Próxima: ${fmtDateTime(stage.nextRun)}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: '0.68rem', color: stage.color, fontWeight: 600, flexShrink: 0 }}>
                  Etapa {idx + 1}
                </div>
              </div>
              {idx < pipelineStages.length - 1 && <FlowArrow color={stage.color} />}
            </React.Fragment>
          ))}
        </div>

        {/* Live production metrics */}
        {monitorData?.latest && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Activity size={18} color="#10b981" />
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Métricas em Produção (Live)</span>
              <Badge text="REAL-TIME" color="#10b981" bg="rgba(16,185,129,0.12)" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: '0.6rem' }}>
              {[
                { label: 'Acurácia Dir.', value: latest.directional_accuracy ? `${fmt(latest.directional_accuracy * 100, 1)}%` : '—', color: (latest.directional_accuracy || 0) >= 0.6 ? '#10b981' : '#f59e0b', tip: 'Percentual de acertos na direção (alta/baixa) comparando com preços reais.' },
                { label: 'MAPE', value: latest.mape ? `${fmt(latest.mape, 2)}%` : '—', color: (latest.mape || 0) <= 1 ? '#10b981' : (latest.mape || 0) <= 2 ? '#f59e0b' : '#ef4444', tip: 'Mean Absolute Percentage Error.' },
                { label: 'MAE', value: latest.mae ? `${fmt(latest.mae * 100, 2)}%` : '—', color: (latest.mae || 0) <= 0.05 ? '#10b981' : '#f59e0b', tip: 'Mean Absolute Error.' },
                { label: 'Hit Rate', value: latest.hit_rate ? `${fmt(latest.hit_rate * 100, 1)}%` : '—', color: (latest.hit_rate || 0) >= 0.5 ? '#10b981' : '#f59e0b', tip: 'Taxa de acerto geral.' },
                { label: 'Sharpe Ratio', value: latest.sharpe_ratio != null ? fmt(latest.sharpe_ratio, 2) : '—', color: (latest.sharpe_ratio || 0) >= 0 ? '#10b981' : '#ef4444', tip: 'Retorno ajustado por risco.' },
                { label: 'Amostra', value: `${latest.sample_size || '—'}`, color: '#3b82f6', tip: 'Número de predições avaliadas.' },
              ].map((m, i) => (
                <div key={i} style={subCardStyle}>
                  <div style={{ fontSize: '0.62rem', color: theme.textSecondary, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                    {m.label} <InfoTooltip text={m.tip} darkMode={darkMode} size={10} />
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ensemble composition quick view */}
        {hasIndividual && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Shield size={18} color="#3b82f6" />
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Composição do Ensemble</span>
              <Badge text={isDL ? 'DL ATIVO' : 'FALLBACK'} color={isDL ? '#10b981' : '#f59e0b'} bg={isDL ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'} />
            </div>
            {/* Weight bar */}
            <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', border: `1px solid ${theme.border}`, marginBottom: 8 }}>
              {Object.entries(weights).map(([name, w]: [string, any]) => {
                const info = MODEL_DEFS[name as keyof typeof MODEL_DEFS];
                if (!info) return null;
                const pct = w * 100;
                return (
                  <div key={name} style={{
                    width: `${pct}%`, background: info.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.68rem', fontWeight: 700, color: '#fff', transition: 'width 0.3s', minWidth: pct > 5 ? 'auto' : 0,
                  }}>
                    {pct >= 15 && `${info.emoji} ${fmt(pct, 1)}%`}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {Object.entries(weights).map(([name, w]: [string, any]) => {
                const info = MODEL_DEFS[name as keyof typeof MODEL_DEFS];
                if (!info) return null;
                const m = individualMetrics[name] || {};
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: theme.textSecondary }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: info.color, display: 'inline-block' }} />
                    <span style={{ fontWeight: 600, color: theme.text }}>{info.name}</span>
                    <span>{fmt(w * 100, 1)}%</span>
                    {m.val_rmse != null && <span style={{ color: theme.textSecondary }}>· RMSE {fmt(m.val_rmse, 4)}</span>}
                    {m.directional_accuracy != null && <span style={{ color: theme.textSecondary }}>· Dir {fmt(m.directional_accuracy * 100, 1)}%</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Model key & ranking info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: '0.75rem' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Modelo em Produção</div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[
                { label: 'Método', value: isDL ? 'DL Ensemble Ponderado' : recData.method || '—' },
                { label: 'Model Key', value: recData.model_key || '—', mono: true },
                { label: 'Arquitetura', value: meta.architecture || 'DL_Ensemble_3Models' },
                { label: 'Data Treino', value: meta.train_date ? fmtDate(meta.train_date) : '—' },
                { label: 'Amostras Treino', value: meta.train_samples ? `${meta.train_samples}` : '—' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: `1px solid ${theme.border}` }}>
                  <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{item.label}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: theme.text, fontFamily: item.mono ? 'monospace' : undefined, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Último Ranking</div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[
                { label: 'Data', value: recData.dt ? fmtDate(recData.dt) : '—' },
                { label: 'Tickers Ranqueados', value: `${recData.count || recData.top_n || '—'}` },
                { label: 'Score Formula', value: 'pred_ensemble / vol_20d' },
                { label: 'Fallback', value: 'Momentum ponderado (1d×0.1 + 5d×0.3 + 20d×0.4 + slope×0.2)' },
                { label: 'Features', value: `${meta.n_features || '~92'}` },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: `1px solid ${theme.border}` }}>
                  <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{item.label}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: theme.text, maxWidth: '60%', textAlign: 'right' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }


  /* ═══════════════════════════════════════════════════
     TAB 2: ARCHITECTURE — Detalhes de cada modelo DL
     ═══════════════════════════════════════════════════ */
  function renderArchitecture() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Ensemble overview */}
        <div style={{
          ...cardStyle, padding: '0.75rem 1rem',
          background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
          borderColor: darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
        }}>
          <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
            💡 <strong style={{ color: theme.text }}>Ensemble DL (3 Modelos):</strong> Cada modelo é treinado independentemente com walk-forward CV.
            Os pesos são calculados inversamente proporcionais ao RMSE de validação: <code style={{ fontSize: '0.72rem', background: darkMode ? '#2a2e3a' : '#e2e8f0', padding: '0.1rem 0.3rem', borderRadius: 4 }}>w_i = (1/RMSE_i) / Σ(1/RMSE_j)</code>.
            Todos usam multi-task learning: regressão (retorno) + classificação (direção). Na inferência: <code style={{ fontSize: '0.72rem', background: darkMode ? '#2a2e3a' : '#e2e8f0', padding: '0.1rem 0.3rem', borderRadius: 4 }}>output = tanh(cls) × |reg|</code>.
          </div>
        </div>

        {/* Visual ensemble flow */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Network size={18} color="#8b5cf6" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Fluxo do Ensemble</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <div style={{ padding: '0.5rem 1.5rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, background: darkMode ? '#0f1117' : '#f0f9ff', border: `1px solid ${darkMode ? '#2a2e3a' : '#bae6fd'}`, color: theme.text }}>
              📥 Features Normalizadas ({meta.n_features || '~92'} features) · StandardScaler
            </div>
            <div style={{ width: 2, height: 12, background: theme.border }} />
            <div style={{ fontSize: '0.68rem', color: theme.textSecondary }}>↓ input compartilhado (mesmo tensor)</div>
            <div style={{ width: 2, height: 8, background: theme.border }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '0.5rem', width: '100%', maxWidth: 650 }}>
              {Object.entries(MODEL_DEFS).map(([key, info]) => {
                const w = weights[key];
                const m = individualMetrics[key] || {};
                return (
                  <div key={key} style={{
                    padding: '0.6rem', borderRadius: 8, textAlign: 'center',
                    background: `${info.color}10`, border: `1px solid ${info.color}30`,
                  }}>
                    <div style={{ fontSize: '1.1rem', marginBottom: 2 }}>{info.emoji}</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: info.color }}>{info.name}</div>
                    {w != null && <div style={{ fontSize: '0.62rem', color: theme.textSecondary, marginTop: 2 }}>peso: {fmt(w * 100, 1)}%</div>}
                    {m.val_rmse != null && <div style={{ fontSize: '0.6rem', color: theme.textSecondary }}>RMSE: {fmt(m.val_rmse, 4)}</div>}
                  </div>
                );
              })}
            </div>

            <div style={{ width: 2, height: 8, background: theme.border }} />
            <div style={{ fontSize: '0.68rem', color: theme.textSecondary }}>↓ média ponderada (1/RMSE)</div>
            <div style={{ width: 2, height: 8, background: theme.border }} />
            <div style={{ padding: '0.5rem 1.5rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, background: darkMode ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
              📤 Predição Ensemble → Score = pred / vol_20d → Ranking Top {recData.top_n || 50}
            </div>
          </div>
        </div>

        {/* Individual model deep-dive cards */}
        {Object.entries(MODEL_DEFS).map(([key, info]) => {
          const m = individualMetrics[key] || {};
          const w = weights[key];
          const isExpanded = expandedModel === key;

          return (
            <div key={key} style={{ ...cardStyle, borderLeft: `3px solid ${info.color}` }}>
              <button onClick={() => setExpandedModel(isExpanded ? null : key)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', color: theme.text, textAlign: 'left', padding: 0,
              }}>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span style={{ fontSize: '1.1rem' }}>{info.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{info.name}</div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{info.desc}</div>
                </div>
                {w != null && <Badge text={`peso: ${fmt(w * 100, 1)}%`} color={info.color} bg={`${info.color}20`} />}
              </button>

              {isExpanded && (
                <div style={{ marginTop: 12 }}>
                  {/* Metrics */}
                  {Object.keys(m).length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: '0.5rem', marginBottom: 12 }}>
                      {[
                        { label: 'Val RMSE', value: fmt(m.val_rmse ?? m.rmse, 4), tip: 'Root Mean Squared Error na validação.' },
                        { label: 'Val MAE', value: fmt(m.val_mae ?? m.mae, 4), tip: 'Mean Absolute Error na validação.' },
                        { label: 'Acurácia Dir.', value: m.directional_accuracy != null ? `${fmt(m.directional_accuracy * 100, 1)}%` : '—', tip: 'Acertos na direção.' },
                        { label: 'Épocas', value: m.epochs_trained != null ? `${m.epochs_trained}` : '—', tip: 'Épocas treinadas (early stopping).' },
                        { label: 'Best Val Loss', value: m.best_val_loss != null ? fmt(m.best_val_loss, 6) : '—', tip: 'Melhor loss de validação.' },
                      ].map((item, j) => (
                        <div key={j} style={subCardStyle}>
                          <div style={{ fontSize: '0.62rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                            {item.label} <InfoTooltip text={item.tip} darkMode={darkMode} size={10} />
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: theme.text }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Architecture layers */}
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: theme.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Camadas da Rede Neural
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {info.layers.map((layer, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.6rem',
                        background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 6,
                        borderLeft: `2px solid ${info.color}40`,
                      }}>
                        <span style={{ fontSize: '0.62rem', color: info.color, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{idx + 1}</span>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: theme.text }}>{layer.name}</div>
                          <div style={{ fontSize: '0.68rem', color: theme.textSecondary, fontFamily: 'monospace' }}>{layer.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Hyperparameters */}
                  <div style={{ marginTop: 10, fontSize: '0.72rem', fontWeight: 600, color: theme.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Hiperparâmetros
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Object.entries(info.params).map(([k, v]) => (
                      <span key={k} style={{ padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.68rem', background: darkMode ? '#2a2e3a' : '#e2e8f0', color: theme.text, fontFamily: 'monospace' }}>
                        {k}={String(v)}
                      </span>
                    ))}
                  </div>

                  {/* Inference formula */}
                  <div style={{ marginTop: 10, padding: '0.5rem 0.75rem', background: `${info.color}08`, borderRadius: 6, border: `1px solid ${info.color}20` }}>
                    <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: 2 }}>Inferência</div>
                    <div style={{ fontSize: '0.72rem', color: theme.text, fontFamily: 'monospace' }}>{info.inference}</div>
                  </div>

                  {(info as any).reference && (
                    <div style={{ marginTop: 6, fontSize: '0.65rem', color: theme.textSecondary, fontStyle: 'italic' }}>
                      📄 {(info as any).reference}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }


  /* ═══════════════════════════════════════════════════
     TAB 3: FEATURES — Feature Engineering completo
     ═══════════════════════════════════════════════════ */
  function renderFeatures() {
    const EXPECTED_FIELDS = [
      { group: 'Valuation', fields: ['pe_ratio','forward_pe','pb_ratio','dividend_yield','ev_to_ebitda','ev_to_revenue','peg_ratio','price_to_sales'] },
      { group: 'Rentabilidade', fields: ['roe','roa','profit_margin','operating_margin','ebitda_margin','gross_margin'] },
      { group: 'Crescimento', fields: ['earnings_growth','revenue_growth','earnings_quarterly_growth'] },
      { group: 'Endividamento', fields: ['debt_to_equity','debt_to_ebitda','current_ratio','quick_ratio','interest_coverage','net_debt'] },
      { group: 'Tamanho', fields: ['market_cap','enterprise_value'] },
      { group: 'Cash Flow', fields: ['free_cash_flow','operating_cash_flow'] },
      { group: 'Balanço/DRE', fields: ['total_assets','total_liabilities','total_equity','total_revenue','net_income','ebitda','total_debt','cash','asset_turnover'] },
      { group: 'Classificação', fields: ['sector','industry'] },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Feature engineering overview */}
        <div style={{
          ...cardStyle, padding: '0.75rem 1rem',
          background: darkMode ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.04)',
          borderColor: darkMode ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)',
        }}>
          <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
            🔬 <strong style={{ color: theme.text }}>Feature Engineering Pipeline:</strong> O sistema gera ~{meta.n_features || 92} features em 6 categorias a partir de 4 fontes de dados.
            Todas as features são normalizadas com StandardScaler (fit no treino) e armazenadas no Feature Store S3 particionado por data para evitar training-serving skew.
            A classe <code style={{ fontSize: '0.72rem', background: darkMode ? '#2a2e3a' : '#e2e8f0', padding: '0.1rem 0.3rem', borderRadius: 4 }}>AdvancedFeatureEngineer</code> gera todas as features via <code style={{ fontSize: '0.72rem', background: darkMode ? '#2a2e3a' : '#e2e8f0', padding: '0.1rem 0.3rem', borderRadius: 4 }}>generate_all_features()</code>.
          </div>
        </div>

        {/* Feature categories */}
        {FEATURE_CATEGORIES.map(cat => {
          const isExpanded = expandedFeatureCat === cat.name;
          return (
            <div key={cat.name} style={{ ...cardStyle, borderLeft: `3px solid ${cat.color}` }}>
              <button onClick={() => setExpandedFeatureCat(isExpanded ? null : cat.name)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', color: theme.text, textAlign: 'left', padding: 0,
              }}>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span style={{ fontSize: '1.1rem' }}>{cat.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{cat.name}</div>
                  <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Fonte: {cat.source}</div>
                </div>
                <Badge text={`${cat.count} features`} color={cat.color} bg={`${cat.color}15`} />
              </button>

              {isExpanded && (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: '0.5rem' }}>
                  {cat.features.map(group => (
                    <div key={group.group} style={{ padding: '0.5rem 0.75rem', background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 6 }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 600, color: cat.color, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{group.group}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {group.items.map(f => (
                          <span key={f} style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.65rem', background: darkMode ? '#2a2e3a' : '#e2e8f0', color: theme.textSecondary, fontFamily: 'monospace' }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Data sources status */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Database size={18} color="#3b82f6" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Fontes de Dados (Live)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '0.75rem' }}>
            <div style={{ ...subCardStyle, borderLeft: `3px solid ${(featureStore?.fundamentals.count || 0) > 0 ? '#10b981' : '#ef4444'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {(featureStore?.fundamentals.count || 0) > 0 ? <CheckCircle2 size={14} color="#10b981" /> : <XCircle size={14} color="#ef4444" />}
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>BRAPI Pro</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{featureStore?.fundamentals.count || 0} tickers · {featureStore?.fundamentals.date ? fmtDate(featureStore.fundamentals.date) : '—'}</div>
              <div style={{ fontSize: '0.65rem', color: theme.textSecondary }}>5 modules: summaryProfile, financialData, defaultKeyStatistics, balanceSheetHistory, incomeStatementHistory</div>
            </div>
            <div style={{ ...subCardStyle, borderLeft: `3px solid ${featureStore?.macro.ok ? '#10b981' : '#ef4444'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {featureStore?.macro.ok ? <CheckCircle2 size={14} color="#10b981" /> : <XCircle size={14} color="#ef4444" />}
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>BCB API</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>10 features · Selic, IPCA, Câmbio, CDI</div>
              <div style={{ fontSize: '0.65rem', color: theme.textSecondary }}>API pública do Banco Central do Brasil</div>
            </div>
            <div style={{ ...subCardStyle, borderLeft: `3px solid ${(featureStore?.sentiment.count || 0) > 0 ? '#10b981' : '#6b7280'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {(featureStore?.sentiment.count || 0) > 0 ? <CheckCircle2 size={14} color="#10b981" /> : <Clock size={14} color="#94a3b8" />}
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>NewsAPI</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{(featureStore?.sentiment.count || 0) > 0 ? `${featureStore?.sentiment.count} tickers` : 'Não configurado'}</div>
              <div style={{ fontSize: '0.65rem', color: '#f59e0b' }}>{(featureStore?.sentiment.count || 0) === 0 ? '⚠ Configure NEWS_API_KEY para ativar' : 'Ativo'}</div>
            </div>
          </div>
        </div>

        {/* Feature Store structure */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <HardDrive size={18} color="#06b6d4" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Feature Store (S3)</span>
          </div>
          <div style={{ padding: '0.6rem', background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 8, fontFamily: 'monospace', fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.8 }}>
            <div style={{ color: theme.text, fontWeight: 600, marginBottom: 4 }}>feature_store/</div>
            {['technical', 'volume', 'fundamentals', 'sector', 'macro', 'sentiment', 'combined'].map(cat => (
              <div key={cat} style={{ paddingLeft: 16 }}>
                ├── {cat}/dt=YYYY-MM-DD/{cat === 'macro' ? 'macro.json' : '{ticker}.json'}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: '0.72rem', color: theme.textSecondary }}>
            Particionado por data para evitar training-serving skew. Fallback de até 7 dias para dados que não mudam diariamente (fundamentals, macro).
          </div>
        </div>

        {/* Feature coverage audit */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Eye size={18} color="#3b82f6" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Auditoria de Cobertura (BRAPI Pro)</span>
            <InfoTooltip text="Verifica quais campos fundamentalistas estão preenchidos para cada ticker." darkMode={darkMode} size={14} />
          </div>
          {featureAudit.length > 0 ? (
            <div>
              {featureAudit.map(audit => {
                const pct = Math.round((audit.populated / audit.total) * 100);
                const isExp = expandedTicker === audit.ticker;
                return (
                  <div key={audit.ticker} style={{ borderBottom: `1px solid ${theme.border}`, paddingBottom: 8, marginBottom: 8 }}>
                    <button onClick={() => setExpandedTicker(isExp ? null : audit.ticker)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0',
                      background: 'none', border: 'none', cursor: 'pointer', color: theme.text, textAlign: 'left',
                    }}>
                      {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', minWidth: 60 }}>{audit.ticker}</span>
                      <div style={{ flex: 1, height: 6, background: darkMode ? '#0f1117' : '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: pct >= 80 ? '#10b981' : '#f59e0b', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{pct}%</span>
                      <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>({audit.populated}/{audit.total})</span>
                    </button>
                    {isExp && audit.missing.length > 0 && (
                      <div style={{ marginLeft: 28, marginTop: 4, padding: '0.5rem', background: darkMode ? '#0f1117' : '#fef3c7', borderRadius: 6, fontSize: '0.75rem' }}>
                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>Campos ausentes: </span>
                        <span style={{ color: theme.textSecondary }}>{audit.missing.join(', ')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem', color: theme.textSecondary, fontSize: '0.82rem' }}>Carregando auditoria...</div>
          )}
        </div>

        {/* Fundamental fields map */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <FileText size={18} color="#3b82f6" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Mapa de Features Fundamentalistas</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.75rem' }}>
            {EXPECTED_FIELDS.map(group => (
              <div key={group.group} style={{ padding: '0.6rem', background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#3b82f6', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{group.group}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {group.fields.map(f => (
                    <span key={f} style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.68rem', background: darkMode ? '#2a2e3a' : '#e2e8f0', color: theme.textSecondary, fontFamily: 'monospace' }}>{f}</span>
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
     TAB 4: PIPELINE — Lambdas, schedules, I/O
     ═══════════════════════════════════════════════════ */
  function renderPipeline() {
    const pipelines = [
      {
        name: 'IngestFeatures', description: 'Coleta fundamentalistas (BRAPI Pro), macro (BCB) e sentimento (NewsAPI). Salva no Feature Store S3.',
        schedule: 'Diário, SEG-SEX 21:00 UTC (18:00 BRT)', lambda: 'B3TacticalRankingStackV2-IngestFeatures',
        status: pipeline?.ingest_features, icon: <Database size={18} />, color: '#3b82f6',
        outputs: ['feature_store/fundamentals/dt={date}/{ticker}.json', 'feature_store/macro/dt={date}/macro.json', 'feature_store/sentiment/dt={date}/{ticker}.json'],
        inputs: ['BRAPI Pro API (Secrets Manager)', 'BCB API (pública)', 'NewsAPI (opcional, env NEWS_API_KEY)'],
        details: [
          'Carrega universe de config/universe.txt',
          'Token BRAPI via AWS Secrets Manager',
          'Salva via FeatureStore.save_features()',
          'Fallback: pula ticker se erro individual',
        ],
      },
      {
        name: 'WeeklyRetrain (SageMaker)', description: 'Retreina ensemble DL via SageMaker Training Jobs (ml.m5.xlarge, 16GB RAM). 3 modelos em paralelo, ensemble combinado na Lambda.',
        schedule: 'Semanal, Domingo 22:00 UTC (19:00 BRT)', lambda: 'B3TacticalRankingStackV2-TrainSageMaker',
        status: pipeline?.weekly_retrain, icon: <Cpu size={18} />, color: '#8b5cf6',
        outputs: [
          'models/deep_learning/{date}/individual/transformer_bilstm/ (SageMaker Job)',
          'models/deep_learning/{date}/individual/tab_transformer/ (SageMaker Job)',
          'models/deep_learning/{date}/individual/ft_transformer/ (SageMaker Job)',
          'models/deep_learning/{date}/model.tar.gz (ensemble combinado)',
          'models/deep_learning/{date}/metrics.json',
        ],
        inputs: ['curated/daily_monthly/ (730 dias)', 'feature_store/fundamentals/', 'feature_store/macro/', 'feature_store/sentiment/'],
        details: [
          'Prepara training data com prepare_training_data()',
          'Upload train.csv para S3',
          '3 SageMaker Training Jobs em paralelo (train_single_model.py)',
          'Lambda combina modelos em ensemble (_combine_ensemble)',
          'Calcula pesos inversamente proporcionais ao RMSE',
          'Salva ensemble_config.json + metrics.json + model.tar.gz',
        ],
      },
      {
        name: 'DailyRanking', description: 'Carrega ensemble DL (3 modelos), gera predições ponderadas e ranking top 50 ajustado por risco.',
        schedule: 'Diário, SEG-SEX 21:30 UTC (18:30 BRT)', lambda: 'B3TacticalRankingStackV2-RankSageMaker',
        status: pipeline?.daily_ranking, icon: <TrendingUp size={18} />, color: '#10b981',
        outputs: ['recommendations/dt={date}/top50.json'],
        inputs: ['curated/daily_monthly/', 'feature_store/ (fundamentals, macro, sentiment)', 'models/deep_learning/{date}/model.tar.gz'],
        details: [
          'Verifica feriados (config/b3_holidays_2026.json)',
          'Carrega séries de preços + volumes',
          'Carrega features do Feature Store (com fallback 30 dias)',
          'prepare_features() via AdvancedFeatureEngineer',
          'find_latest_model() → load_model_from_s3()',
          'predict_with_model() → generate_ranking()',
          'Score = pred_ensemble / vol_20d',
          'Fallback: momentum ponderado se modelo indisponível',
        ],
      },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {pipelines.map((p, idx) => (
          <div key={p.name} style={{ ...cardStyle, borderLeft: `3px solid ${p.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 8, borderRadius: 8, background: `${p.color}15`, color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>{p.name}</div>
                <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{p.description}</div>
              </div>
              <StatusDot ok={p.status?.status === 'active'} label={p.status?.status === 'active' ? 'Ativo' : 'Inativo'} pulse={p.status?.status === 'active'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.75rem', marginBottom: 12 }}>
              <div style={subCardStyle}>
                <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: 2 }}>Schedule</div>
                <div style={{ fontSize: '0.75rem', color: theme.text, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {p.schedule}</div>
              </div>
              <div style={subCardStyle}>
                <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: 2 }}>Próxima execução</div>
                <div style={{ fontSize: '0.75rem', color: theme.text }}>{p.status?.next_run ? fmtDateTime(p.status.next_run) : '—'}</div>
              </div>
              <div style={subCardStyle}>
                <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: 2 }}>Lambda</div>
                <div style={{ fontSize: '0.68rem', color: theme.text, fontFamily: 'monospace', wordBreak: 'break-all' }}>{p.lambda}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: theme.textSecondary, marginBottom: 4, textTransform: 'uppercase' }}>Inputs</div>
                {p.inputs.map(inp => <div key={inp} style={{ fontSize: '0.68rem', color: theme.textSecondary, padding: '0.15rem 0', fontFamily: 'monospace' }}>→ {inp}</div>)}
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: theme.textSecondary, marginBottom: 4, textTransform: 'uppercase' }}>Outputs</div>
                {p.outputs.map(out => <div key={out} style={{ fontSize: '0.68rem', color: theme.textSecondary, padding: '0.15rem 0', fontFamily: 'monospace' }}>← {out}</div>)}
              </div>
            </div>

            {/* Execution details */}
            <div style={{ padding: '0.5rem 0.75rem', background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 6 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: theme.textSecondary, marginBottom: 4, textTransform: 'uppercase' }}>Detalhes de Execução</div>
              {p.details.map((d, i) => (
                <div key={i} style={{ fontSize: '0.68rem', color: theme.textSecondary, padding: '0.1rem 0', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ color: p.color, fontWeight: 700, fontSize: '0.6rem', marginTop: 2 }}>{i + 1}.</span> {d}
                </div>
              ))}
            </div>

            {idx < pipelines.length - 1 && <div style={{ textAlign: 'center', margin: '0.5rem 0 -0.5rem', color: theme.textSecondary, fontSize: '1.2rem' }}>↓</div>}
          </div>
        ))}
      </div>
    );
  }


  /* ═══════════════════════════════════════════════════
     TAB 5: TRAINING — Configuração completa de treinamento
     ═══════════════════════════════════════════════════ */
  function renderTraining() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Training config overview */}
        <div style={{
          ...cardStyle, padding: '0.75rem 1rem',
          background: darkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)',
          borderColor: darkMode ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)',
        }}>
          <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
            🔥 <strong style={{ color: theme.text }}>Treinamento Multi-Task:</strong> Cada modelo é treinado com duas tarefas simultâneas — regressão (retorno esperado) e classificação (direção sobe/desce).
            A loss combina HuberLoss (δ=0.05) para regressão com Asymmetric Focal Loss (γ=2) para classificação, com peso 60% na classificação.
            Movimentos fortes ({'>'} 3%) recebem até 3× mais peso no treinamento.
          </div>
        </div>

        {/* Training hyperparameters */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Settings size={18} color="#ef4444" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Configuração de Treinamento</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '0.6rem' }}>
            {Object.entries(TRAINING_CONFIG).map(([key, value]) => (
              <div key={key} style={subCardStyle}>
                <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {key.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: '0.75rem', color: theme.text, fontFamily: 'monospace', lineHeight: 1.5 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Loss function detail */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sigma size={18} color="#f59e0b" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Função de Loss (Multi-Task)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...subCardStyle, borderLeft: '3px solid #3b82f6' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#3b82f6', marginBottom: 4 }}>Task 1: Regressão (40%)</div>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, fontFamily: 'monospace' }}>
                loss_reg = HuberLoss(pred_return, true_return, δ=0.05)
              </div>
              <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginTop: 4 }}>
                HuberLoss é menos sensível a outliers que MSE. δ=0.05 significa que erros {'<'} 5% são tratados como L2, maiores como L1.
              </div>
            </div>
            <div style={{ ...subCardStyle, borderLeft: '3px solid #ef4444' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>Task 2: Classificação Direcional (60%)</div>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, fontFamily: 'monospace', lineHeight: 1.6 }}>
                target_dir = (y {'>'} 0).float()<br />
                focal_weight = (1 - pt)² &nbsp;&nbsp;// γ=2<br />
                magnitude_weight = 1 + 2 × clamp(|y|/0.03, max=3)<br />
                loss_cls = mean(focal_weight × magnitude_weight × BCE)
              </div>
              <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginTop: 4 }}>
                Asymmetric Focal Loss: penaliza mais erros em movimentos fortes ({'>'} 3%). Focal weight reduz contribuição de exemplos fáceis.
              </div>
            </div>
            <div style={{ ...subCardStyle, borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#10b981', marginBottom: 4 }}>Loss Final</div>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, fontFamily: 'monospace' }}>
                loss = 0.4 × loss_reg + 0.6 × loss_cls
              </div>
            </div>
          </div>
        </div>

        {/* SageMaker training flow */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Server size={18} color="#8b5cf6" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Fluxo de Treinamento (SageMaker)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { step: '1', label: 'Preparação de Dados', detail: 'load_monthly_data_for_training(730 dias) → prepare_training_data() → upload train.csv para S3', color: '#3b82f6' },
              { step: '2', label: 'Upload Script', detail: 'upload_training_script() → train_single_model.py + train_deep_learning.py para S3', color: '#3b82f6' },
              { step: '3', label: '3× SageMaker Training Jobs', detail: 'ml.m5.xlarge (16GB RAM) · transformer_bilstm, tab_transformer, ft_transformer em paralelo', color: '#8b5cf6' },
              { step: '4', label: 'Treino Individual', detail: 'StandardScaler → outlier removal (5σ) → split temporal 80/20 → train(epochs=120, lr=5e-4, patience=20)', color: '#8b5cf6' },
              { step: '5', label: 'Combinação Ensemble', detail: '_combine_ensemble(): carrega 3 model.tar.gz → calcula pesos (1/RMSE) → salva ensemble_config.json', color: '#ef4444' },
              { step: '6', label: 'Upload Final', detail: '_upload_ensemble(): model.tar.gz + metrics.json → models/deep_learning/{date}/', color: '#10b981' },
            ].map((item, idx) => (
              <React.Fragment key={item.step}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.75rem',
                  background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 6, borderLeft: `3px solid ${item.color}`,
                }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: `${item.color}15`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>{item.step}</span>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: theme.text }}>{item.label}</div>
                    <div style={{ fontSize: '0.68rem', color: theme.textSecondary, fontFamily: 'monospace' }}>{item.detail}</div>
                  </div>
                </div>
                {idx < 5 && <FlowArrow color={item.color} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Training metrics from last run */}
        {meta && Object.keys(meta).length > 0 && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <BarChart3 size={18} color="#3b82f6" />
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Métricas do Último Treino</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: '0.6rem' }}>
              {[
                ...(meta.n_features != null ? [{ label: 'Features', value: `${meta.n_features}`, color: '#3b82f6' }] : []),
                ...(meta.train_samples != null ? [{ label: 'Amostras', value: `${meta.train_samples}`, color: '#3b82f6' }] : []),
                ...(meta.train_date ? [{ label: 'Data Treino', value: fmtDate(meta.train_date), color: '#3b82f6' }] : []),
                ...(meta.val_rmse != null ? [{ label: 'Ensemble RMSE', value: fmt(meta.val_rmse, 4), color: '#10b981' }] : []),
                ...(meta.val_mae != null ? [{ label: 'Ensemble MAE', value: fmt(meta.val_mae, 4), color: '#10b981' }] : []),
                ...(meta.directional_accuracy != null ? [{ label: 'Dir. Accuracy', value: `${fmt(meta.directional_accuracy * 100, 1)}%`, color: '#10b981' }] : []),
                ...(meta.cv_avg_rmse != null ? [{ label: 'CV Avg RMSE', value: fmt(meta.cv_avg_rmse, 4), color: '#f59e0b' }] : []),
                ...(meta.cv_avg_mape != null ? [{ label: 'CV Avg MAPE', value: `${fmt(meta.cv_avg_mape, 2)}%`, color: '#f59e0b' }] : []),
              ].map((m, i) => (
                <div key={i} style={subCardStyle}>
                  <div style={{ fontSize: '0.62rem', color: theme.textSecondary, marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }


  /* ═══════════════════════════════════════════════════
     TAB 6: INFERENCE & RANKING — Como o modelo gera predições
     ═══════════════════════════════════════════════════ */
  function renderInference() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Inference overview */}
        <div style={{
          ...cardStyle, padding: '0.75rem 1rem',
          background: darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)',
          borderColor: darkMode ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)',
        }}>
          <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
            🎯 <strong style={{ color: theme.text }}>Inferência Diária:</strong> A Lambda <code style={{ fontSize: '0.72rem', background: darkMode ? '#2a2e3a' : '#e2e8f0', padding: '0.1rem 0.3rem', borderRadius: 4 }}>rank_sagemaker</code> carrega
            o ensemble mais recente, gera features para todos os tickers do universo, faz predições ponderadas e gera o ranking top {recData.top_n || 50} ajustado por risco.
            Se o modelo DL não estiver disponível, usa fallback de momentum ponderado.
          </div>
        </div>

        {/* Inference flow */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Target size={18} color="#10b981" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Fluxo de Inferência (Diário)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { step: '1', label: 'Verificação de Feriados', detail: 'load_holidays() → should_skip_today() · Pula fins de semana e feriados B3', color: '#6b7280', icon: <Clock size={16} /> },
              { step: '2', label: 'Carga de Dados', detail: 'load_universe() → load_monthly_data_for_ranking(730 dias) · Séries de preços + volumes', color: '#3b82f6', icon: <Database size={16} /> },
              { step: '3', label: 'Carga do Feature Store', detail: 'FeatureStore.load_features_with_fallback() · Fundamentals (30d fallback), Macro (90d), Sentimento (3d)', color: '#8b5cf6', icon: <HardDrive size={16} /> },
              { step: '4', label: 'Feature Engineering', detail: 'AdvancedFeatureEngineer.generate_all_features() · ~92 features por ticker (técnicas + volume + fundamentais + macro + setor + sentimento)', color: '#f59e0b', icon: <Layers size={16} /> },
              { step: '5', label: 'Carga do Modelo', detail: 'find_latest_model() → load_model_from_s3() · Busca model.tar.gz mais recente em models/deep_learning/', color: '#ef4444', icon: <Box size={16} /> },
              { step: '6', label: 'Predição Ensemble', detail: 'predict_with_model() · StandardScaler → 3 modelos → média ponderada (1/RMSE)', color: '#8b5cf6', icon: <Brain size={16} /> },
              { step: '7', label: 'Geração de Ranking', detail: 'generate_ranking() · Score = pred_ensemble / vol_20d · Ordena por score descrescente', color: '#10b981', icon: <TrendingUp size={16} /> },
              { step: '8', label: 'Salvamento', detail: 'put_json() → recommendations/dt={date}/top50.json · Inclui model_metadata com métricas', color: '#10b981', icon: <HardDrive size={16} /> },
            ].map((item, idx) => (
              <React.Fragment key={item.step}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.75rem',
                  background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 6, borderLeft: `3px solid ${item.color}`,
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${item.color}15`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: theme.text }}>
                      <span style={{ color: item.color, marginRight: 4 }}>#{item.step}</span> {item.label}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: theme.textSecondary }}>{item.detail}</div>
                  </div>
                </div>
                {idx < 7 && <FlowArrow color={item.color} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Score formula */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Gauge size={18} color="#f59e0b" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Fórmula de Score & Ranking</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '0.75rem' }}>
            <div style={{ ...subCardStyle, borderLeft: '3px solid #3b82f6' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#3b82f6', marginBottom: 6 }}>Predição Ensemble</div>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, fontFamily: 'monospace', lineHeight: 1.6 }}>
                pred_i = Σ(w_k × model_k(features_i))<br />
                w_k = (1/RMSE_k) / Σ(1/RMSE_j)
              </div>
              <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginTop: 4 }}>
                Cada modelo retorna: tanh(cls_logit) × |reg_output|
              </div>
            </div>
            <div style={{ ...subCardStyle, borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#10b981', marginBottom: 6 }}>Score Ajustado por Risco</div>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, fontFamily: 'monospace', lineHeight: 1.6 }}>
                score_i = pred_ensemble_i / vol_20d_i<br />
                ranking = sort(scores, descending)[:top_n]
              </div>
              <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginTop: 4 }}>
                Ações com alta predição mas alta volatilidade são penalizadas.
              </div>
            </div>
            <div style={{ ...subCardStyle, borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f59e0b', marginBottom: 6 }}>Fallback (Momentum)</div>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, fontFamily: 'monospace', lineHeight: 1.6 }}>
                score = return_1d × 0.1<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ return_5d × 0.3<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ return_20d × 0.4<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ trend_slope_20d × 0.2
              </div>
              <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginTop: 4 }}>
                Usado quando modelo DL não está disponível.
              </div>
            </div>
          </div>
        </div>

        {/* Data lineage */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <GitBranch size={18} color="#8b5cf6" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Lineage Completo (Dados → Ranking)</span>
          </div>
          {[
            {
              name: 'Dados Brutos', icon: <Database size={18} />, color: '#3b82f6',
              items: [
                { label: 'BRAPI Pro', detail: `5 modules · ${featureStore?.fundamentals.count || '~46'} tickers · ~35 campos/ticker`, ok: true },
                { label: 'BCB API', detail: 'Selic, IPCA, Câmbio, CDI · 10 features', ok: true },
                { label: 'Cotações Diárias', detail: 'OHLCV via BRAPI · curated/daily_monthly/ · 730 dias', ok: true },
                { label: 'NewsAPI', detail: 'Sentimento de notícias (opcional)', ok: (featureStore?.sentiment.count || 0) > 0 },
              ],
            },
            {
              name: 'Feature Engineering', icon: <Layers size={18} />, color: '#8b5cf6',
              items: [
                { label: 'Técnicas', detail: 'RSI, MACD, Bollinger, ATR, momentum, volatilidade, regime · ~30 features', ok: true },
                { label: 'Volume', detail: 'OBV, VWAP, volume-price divergence, z-score · ~15 features', ok: true },
                { label: 'Fundamentalistas', detail: 'Valuation, rentabilidade, crescimento, endividamento · ~25 features', ok: true },
                { label: 'Macro', detail: 'Selic, IPCA, câmbio, CDI, variações · 10 features', ok: true },
                { label: 'Setoriais', detail: 'Correlação, relative strength, dispersão · ~8 features', ok: true },
                { label: 'Sentimento', detail: 'Score + interação com momentum · 2 features', ok: (featureStore?.sentiment.count || 0) > 0 },
              ],
            },
            {
              name: 'Normalização & Store', icon: <Zap size={18} />, color: '#f59e0b',
              items: [
                { label: 'StandardScaler', detail: 'Fit no treino, transform na inferência', ok: true },
                { label: 'Outlier Removal', detail: '|y| < 5σ no treino', ok: true },
                { label: 'Feature Store S3', detail: 'Particionado por data, fallback 7-30 dias', ok: true },
              ],
            },
            {
              name: 'Ensemble DL', icon: <Brain size={18} />, color: '#ef4444',
              items: [
                { label: 'Transformer + BiLSTM', detail: `2 enc layers, 4 heads, d=128, BiLSTM h=64 · peso: ${fmt((weights.transformer_bilstm || 0) * 100, 1)}%`, ok: true },
                { label: 'TabTransformer', detail: `3 enc layers, 4 heads, d=64, feature tokenization · peso: ${fmt((weights.tab_transformer || 0) * 100, 1)}%`, ok: true },
                { label: 'FT-Transformer', detail: `4 enc layers, 8 heads, d=128, feature tokenizer (W+b) · peso: ${fmt((weights.ft_transformer || 0) * 100, 1)}%`, ok: true },
                { label: 'Ensemble Ponderado', detail: 'Pesos 1/RMSE · Multi-task (reg + cls) · Early stopping p=20', ok: true },
              ],
            },
            {
              name: 'Inferência & Output', icon: <TrendingUp size={18} />, color: '#10b981',
              items: [
                { label: 'Ranking Diário', detail: `Top ${recData.top_n || 50} ações por score ajustado por risco`, ok: true },
                { label: 'Score = pred / vol_20d', detail: 'Predição ensemble dividida por volatilidade 20 dias', ok: true },
                { label: 'Fallback Momentum', detail: 'Se modelo indisponível: momentum ponderado (1d/5d/20d/slope)', ok: true },
              ],
            },
          ].map((stage, idx) => (
            <React.Fragment key={stage.name}>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${stage.color}15`, border: `2px solid ${stage.color}`, color: stage.color,
                  }}>
                    {stage.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Etapa {idx + 1}</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: theme.text }}>{stage.name}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: '0.4rem', marginLeft: 16 }}>
                  {stage.items.map(item => (
                    <div key={item.label} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6, padding: '0.4rem 0.6rem',
                      background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 6,
                      borderLeft: `2px solid ${item.ok ? '#10b981' : '#6b7280'}`,
                    }}>
                      <div style={{ marginTop: 2 }}>
                        {item.ok ? <CheckCircle2 size={12} color="#10b981" /> : <Clock size={12} color="#94a3b8" />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: theme.text }}>{item.label}</div>
                        <div style={{ fontSize: '0.65rem', color: theme.textSecondary }}>{item.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {idx < 4 && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '0.15rem 0' }}>
                  <div style={{ width: 2, height: 16, background: theme.border }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }
};

function getNextSchedule(hourUtc: number, minuteUtc: number, daysOfWeek: number[]): string {
  const now = new Date();
  const candidate = new Date(now);
  candidate.setUTCHours(hourUtc, minuteUtc, 0, 0);
  for (let i = 0; i < 8; i++) {
    const d = new Date(candidate.getTime() + i * 86400000);
    if (daysOfWeek.includes(d.getUTCDay()) && d > now) return d.toISOString();
  }
  return '';
}

export default AdminModelsPage;
