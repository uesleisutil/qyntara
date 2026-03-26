import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  RefreshCw, Database, Activity, CheckCircle2, XCircle, Clock,
  GitBranch, Layers, BarChart3, Shield, AlertTriangle, ChevronDown,
  ChevronRight, Cpu, Zap, TrendingUp, Eye, FileText,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../../components/shared/ui/InfoTooltip';
import { fmt, fmtDate } from '../../lib/formatters';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const fmtDateTime = (iso: string) => {
  try { const d = new Date(iso); return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
};

const StatusDot: React.FC<{ ok: boolean; label?: string }> = ({ ok, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? '#10b981' : '#ef4444', display: 'inline-block', flexShrink: 0 }} />
    {label}
  </span>
);

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
  const [activeTab, setActiveTab] = useState<'ensemble' | 'features' | 'pipeline' | 'lineage'>('ensemble');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

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
    } catch (err) { console.error('AdminModelsPage fetch error:', err); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
          {[1,2,3,4].map(i => <div key={i} style={{ ...sk, height: 100, borderRadius: 12 }} />)}
        </div>
        <div style={{ ...sk, height: 300, borderRadius: 12 }} />
      </div>
    );
  }

  const latest = monitorData?.latest || {};
  const recData = latestRec?.data || {};
  const meta = recData.model_metadata || {};

  const tabs: { key: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { key: 'ensemble', label: 'Modelos & Ensemble', icon: <Cpu size={15} /> },
    { key: 'features', label: 'Feature Store', icon: <Database size={15} /> },
    { key: 'pipeline', label: 'Pipeline', icon: <GitBranch size={15} /> },
    { key: 'lineage', label: 'Lineage', icon: <Layers size={15} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>
            Modelos & Features
          </h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0 }}>
            Ensemble DL, performance individual dos modelos, feature store e pipeline
          </p>
        </div>
        <button onClick={fetchData} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white',
          borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
        }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ ...cardStyle, borderLeft: `3px solid ${recData.method?.startsWith('dl_') ? '#10b981' : '#f59e0b'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Cpu size={16} color={theme.textSecondary} />
            <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Modelo em Produção</span>
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: theme.text, marginBottom: 4 }}>
            {recData.method?.startsWith('dl_') ? 'DL Ensemble (3 Modelos)' : recData.method === 'momentum_fallback' ? 'Momentum (fallback)' : recData.method || '—'}
          </div>
          <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
            {recData.dt ? `Último ranking: ${fmtDate(recData.dt)}` : 'Sem ranking'}
          </div>
        </div>

        <div style={{ ...cardStyle, borderLeft: `3px solid ${(featureStore?.fundamentals.count || 0) > 0 ? '#10b981' : '#ef4444'}` }}>
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

        <div style={{ ...cardStyle, borderLeft: `3px solid ${(latest.directional_accuracy || 0) >= 0.6 ? '#10b981' : '#f59e0b'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <TrendingUp size={16} color={theme.textSecondary} />
            <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Acurácia Dir. (Live)</span>
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: (latest.directional_accuracy || 0) >= 0.6 ? '#10b981' : '#f59e0b' }}>
            {latest.directional_accuracy ? `${fmt(latest.directional_accuracy * 100, 1)}%` : meta.directional_accuracy ? `${fmt(meta.directional_accuracy * 100, 1)}%` : '—'}
          </div>
          <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
            {latest.directional_accuracy ? 'Produção (preços reais)' : meta.directional_accuracy ? 'Validação (treino)' : '—'}
          </div>
        </div>

        <div style={{ ...cardStyle, borderLeft: `3px solid ${pipeline ? '#10b981' : '#6b7280'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Zap size={16} color={theme.textSecondary} />
            <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Pipeline</span>
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>3/3 ativos</div>
          <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>IngestFeatures · WeeklyRetrain · DailyRanking</div>
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
            cursor: 'pointer', fontSize: '0.82rem', fontWeight: activeTab === tab.key ? 600 : 400,
            whiteSpace: 'nowrap', transition: 'all 0.15s',
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'ensemble' && renderEnsemble()}
      {activeTab === 'features' && renderFeatureStore()}
      {activeTab === 'pipeline' && renderPipeline()}
      {activeTab === 'lineage' && renderLineage()}
    </div>
  );


  /* ═══════════════════════════════════════════════════
     TAB 1: Ensemble — Arquitetura, modelos individuais e composição final
     ═══════════════════════════════════════════════════ */
  function renderEnsemble() {
    const individualMetrics = meta?.individual_metrics || {};
    const weights = meta?.weights || {};
    const hasIndividual = Object.keys(individualMetrics).length > 0;

    const modelLabels: Record<string, { emoji: string; name: string; desc: string; color: string }> = {
      transformer_bilstm: { emoji: '🧠', name: 'Transformer + BiLSTM', desc: 'Multi-head self-attention + BiLSTM com attention pooling. Captura dependências temporais longas e padrões sequenciais complexos.', color: '#8b5cf6' },
      tab_transformer: { emoji: '🔮', name: 'TabTransformer', desc: 'Transformer para dados tabulares — cada feature vira um token com embedding próprio. CLS token agrega interações entre features.', color: '#3b82f6' },
      dilated_cnn: { emoji: '🌊', name: 'WaveNet Dilated CNN', desc: 'Convoluções dilatadas (1,2,4,8,16) com gated activation. Captura padrões em múltiplas escalas temporais simultaneamente.', color: '#10b981' },
      // Legacy (backward compat)
      residual_mlp: { emoji: '🔗', name: 'Residual MLP', desc: 'MLP com blocos residuais (modelo legado).', color: '#6b7280' },
      temporal_cnn: { emoji: '📊', name: 'Temporal 1D-CNN', desc: '1D-CNN (modelo legado).', color: '#6b7280' },
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* How ensemble works */}
        <div style={{
          ...cardStyle, padding: '0.75rem 1rem',
          background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
          borderColor: darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
        }}>
          <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
            💡 <strong style={{ color: theme.text }}>Arquitetura Ensemble:</strong> O modelo final combina 3 redes DL com pesos adaptativos inversamente proporcionais ao RMSE de validação.
            Cada modelo é treinado independentemente com walk-forward CV, e o ensemble pondera as predições para gerar o score final de cada ação.
            Score = predição_ensemble / volatilidade_20d (ajuste por risco).
          </div>
        </div>

        {/* Ensemble composition card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Shield size={18} color="#3b82f6" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Composição do Ensemble</span>
            <span style={{
              marginLeft: 'auto', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.68rem', fontWeight: 600,
              background: recData.method?.startsWith('dl_') ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: recData.method?.startsWith('dl_') ? '#10b981' : '#f59e0b',
            }}>
              {recData.method?.startsWith('dl_') ? '● DL Ativo' : '● Fallback'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '0.75rem', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: 2 }}>Método</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: theme.text }}>
                {recData.method?.startsWith('dl_') ? 'DL Ensemble Ponderado' : recData.method || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: 2 }}>Model Key</div>
              <div style={{ fontSize: '0.78rem', color: theme.text, fontFamily: 'monospace', wordBreak: 'break-all' }}>{recData.model_key || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: 2 }}>Data do Ranking</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 500, color: theme.text }}>{recData.dt ? fmtDate(recData.dt) : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: 2 }}>Tickers Ranqueados</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 500, color: theme.text }}>{recData.count || recData.top_n || '—'}</div>
            </div>
          </div>

          {/* Weight distribution bar */}
          {hasIndividual && (
            <div>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Distribuição de Pesos do Ensemble
              </div>
              <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
                {Object.entries(weights).map(([name, w]: [string, any]) => {
                  const info = modelLabels[name] || { emoji: '?', name, color: '#6b7280' };
                  const pct = (w * 100);
                  return (
                    <div key={name} style={{
                      width: `${pct}%`, background: info.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.68rem', fontWeight: 700, color: '#fff', transition: 'width 0.3s',
                      minWidth: pct > 5 ? 'auto' : 0,
                    }}>
                      {pct >= 15 && `${info.emoji} ${fmt(pct, 1)}%`}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: 6, flexWrap: 'wrap' }}>
                {Object.entries(weights).map(([name, w]: [string, any]) => {
                  const info = modelLabels[name] || { emoji: '?', name, color: '#6b7280' };
                  return (
                    <span key={name} style={{ fontSize: '0.68rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: info.color, display: 'inline-block' }} />
                      {info.name}: {fmt(w * 100, 1)}%
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Individual model cards */}
        {hasIndividual ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '0.75rem' }}>
            {Object.entries(individualMetrics).map(([name, m]: [string, any]) => {
              const info = modelLabels[name] || { emoji: '?', name, desc: '', color: '#6b7280' };
              const weight = weights[name];
              const metrics = [
                { label: 'Val RMSE', value: fmt(m.val_rmse ?? m.rmse, 4), tip: 'Root Mean Squared Error na validação.' },
                { label: 'Acurácia Dir.', value: m.directional_accuracy != null ? `${fmt(m.directional_accuracy * 100, 1)}%` : '—', tip: 'Percentual de acertos na direção (alta/baixa).' },
                { label: 'Épocas', value: m.epochs_trained != null ? `${m.epochs_trained}` : '—', tip: 'Épocas treinadas (com early stopping).' },
                { label: 'Val MAE', value: fmt(m.val_mae ?? m.mae, 4), tip: 'Mean Absolute Error na validação.' },
              ];

              return (
                <div key={name} style={{ ...cardStyle, borderLeft: `3px solid ${info.color}`, position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '1.1rem' }}>{info.emoji}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text }}>{info.name}</span>
                    {weight != null && (
                      <span style={{
                        marginLeft: 'auto', padding: '0.15rem 0.5rem', borderRadius: 12, fontSize: '0.68rem', fontWeight: 700,
                        background: `${info.color}20`, color: info.color,
                      }}>
                        peso: {fmt(weight * 100, 1)}%
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>
                    {info.desc}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {metrics.map((item, j) => (
                      <div key={j} style={{ padding: '0.5rem', background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 6 }}>
                        <div style={{ fontSize: '0.65rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                          {item.label} <InfoTooltip text={item.tip} darkMode={darkMode} size={10} />
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: theme.text }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ ...cardStyle, textAlign: 'center', color: theme.textSecondary, fontSize: '0.82rem' }}>
            <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Modelo usando fallback (momentum). Retreine para obter métricas individuais do ensemble.
          </div>
        )}

        {/* Ensemble training info */}
        {meta && Object.keys(meta).length > 0 && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <BarChart3 size={18} color="#3b82f6" />
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Informações de Treino</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: '0.6rem' }}>
              {[
                ...(meta.n_features != null ? [{ label: 'Features', value: `${meta.n_features}`, color: '#3b82f6', tip: 'Número de features usadas pelo ensemble.' }] : []),
                ...(meta.train_samples != null ? [{ label: 'Amostras', value: `${meta.train_samples}`, color: '#3b82f6', tip: 'Amostras de treino.' }] : []),
                ...(meta.train_date ? [{ label: 'Data do Treino', value: fmtDate(meta.train_date), color: '#3b82f6', tip: 'Data do último treino.' }] : []),
                ...(meta.architecture ? [{ label: 'Arquitetura', value: meta.architecture, color: '#3b82f6', tip: 'Tipo de ensemble.' }] : []),
              ].map((m, i) => (
                <div key={i} style={{ padding: '0.6rem', background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                    {m.label} <InfoTooltip text={m.tip} darkMode={darkMode} size={10} />
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live production metrics */}
        {monitorData?.latest && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Activity size={18} color="#10b981" />
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Métricas em Produção (Live)</span>
              <InfoTooltip text="Métricas calculadas comparando previsões do ensemble com preços reais de mercado." darkMode={darkMode} size={14} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: '0.6rem' }}>
              {[
                { label: 'Acurácia Direcional', value: `${fmt(latest.directional_accuracy * 100, 1)}%`, color: latest.directional_accuracy >= 0.6 ? '#10b981' : '#f59e0b' },
                { label: 'MAPE', value: `${fmt(latest.mape, 2)}%`, color: latest.mape <= 1 ? '#10b981' : latest.mape <= 2 ? '#f59e0b' : '#ef4444' },
                { label: 'MAE', value: `${fmt(latest.mae * 100, 2)}%`, color: latest.mae <= 0.05 ? '#10b981' : '#f59e0b' },
                { label: 'Hit Rate', value: `${fmt(latest.hit_rate * 100, 1)}%`, color: latest.hit_rate >= 0.5 ? '#10b981' : '#f59e0b' },
                { label: 'Sharpe Ratio', value: fmt(latest.sharpe_ratio, 2), color: latest.sharpe_ratio >= 0 ? '#10b981' : '#ef4444' },
                { label: 'Amostra', value: `${latest.sample_size || '—'}`, color: '#3b82f6' },
              ].map((m, i) => (
                <div key={i} style={{ padding: '0.6rem', background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ensemble flow diagram */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Layers size={18} color="#8b5cf6" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Fluxo do Ensemble</span>
            <InfoTooltip text="Diagrama simplificado de como os 3 modelos geram a predição final." darkMode={darkMode} size={14} />
          </div>

          {/* Visual flow */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            {/* Input */}
            <div style={{
              padding: '0.5rem 1.5rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
              background: darkMode ? '#0f1117' : '#f0f9ff', border: `1px solid ${darkMode ? '#2a2e3a' : '#bae6fd'}`, color: theme.text,
            }}>
              📥 Features Normalizadas ({meta.n_features || '92'} features)
            </div>
            <div style={{ width: 2, height: 16, background: theme.border }} />
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>↓ input compartilhado</div>
            <div style={{ width: 2, height: 8, background: theme.border }} />

            {/* 3 models side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '0.5rem', width: '100%', maxWidth: 600 }}>
              {Object.entries(modelLabels).map(([key, info]) => {
                const w = weights[key];
                return (
                  <div key={key} style={{
                    padding: '0.6rem', borderRadius: 8, textAlign: 'center',
                    background: `${info.color}10`, border: `1px solid ${info.color}30`,
                  }}>
                    <div style={{ fontSize: '1rem', marginBottom: 2 }}>{info.emoji}</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: info.color }}>{info.name}</div>
                    {w != null && <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginTop: 2 }}>peso: {fmt(w * 100, 1)}%</div>}
                  </div>
                );
              })}
            </div>

            <div style={{ width: 2, height: 8, background: theme.border }} />
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>↓ média ponderada (1/RMSE)</div>
            <div style={{ width: 2, height: 8, background: theme.border }} />

            {/* Output */}
            <div style={{
              padding: '0.5rem 1.5rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
              background: darkMode ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.05)',
              border: `1px solid rgba(16,185,129,0.3)`, color: '#10b981',
            }}>
              📤 Predição Ensemble → Score = pred / vol_20d → Ranking Top 50
            </div>
          </div>
        </div>
      </div>
    );
  }


  /* ═══════════════════════════════════════════════════
     TAB 2: Feature Store
     ═══════════════════════════════════════════════════ */
  function renderFeatureStore() {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Data sources */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '0.75rem' }}>
          <div style={{ ...cardStyle, borderLeft: `3px solid ${(featureStore?.fundamentals.count || 0) > 0 ? '#10b981' : '#ef4444'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {(featureStore?.fundamentals.count || 0) > 0 ? <CheckCircle2 size={18} color="#10b981" /> : <XCircle size={18} color="#ef4444" />}
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: theme.text }}>Fundamentalistas (BRAPI Pro)</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: 4 }}>
              {featureStore?.fundamentals.count || 0} tickers · {featureStore?.fundamentals.date ? fmtDate(featureStore.fundamentals.date) : '—'}
            </div>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
              5 modules: summaryProfile, financialData, defaultKeyStatistics, balanceSheetHistory, incomeStatementHistory
            </div>
          </div>
          <div style={{ ...cardStyle, borderLeft: `3px solid ${featureStore?.macro.ok ? '#10b981' : '#ef4444'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {featureStore?.macro.ok ? <CheckCircle2 size={18} color="#10b981" /> : <XCircle size={18} color="#ef4444" />}
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: theme.text }}>Macroeconômico (BCB)</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: 4 }}>10 features · Selic, IPCA, Câmbio, CDI</div>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>API pública do Banco Central do Brasil</div>
          </div>
          <div style={{ ...cardStyle, borderLeft: `3px solid ${(featureStore?.sentiment.count || 0) > 0 ? '#10b981' : '#6b7280'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {(featureStore?.sentiment.count || 0) > 0 ? <CheckCircle2 size={18} color="#10b981" /> : <Clock size={18} color="#94a3b8" />}
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: theme.text }}>Sentimento (News)</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: 4 }}>
              {(featureStore?.sentiment.count || 0) > 0 ? `${featureStore?.sentiment.count} tickers` : 'Não configurado'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#f59e0b' }}>
              {(featureStore?.sentiment.count || 0) === 0 ? '⚠ Configure NEWS_API_KEY para ativar' : 'NewsAPI'}
            </div>
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
                const isExpanded = expandedTicker === audit.ticker;
                return (
                  <div key={audit.ticker} style={{ borderBottom: `1px solid ${theme.border}`, paddingBottom: 8, marginBottom: 8 }}>
                    <button onClick={() => setExpandedTicker(isExpanded ? null : audit.ticker)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0',
                      background: 'none', border: 'none', cursor: 'pointer', color: theme.text, textAlign: 'left',
                    }}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', minWidth: 60 }}>{audit.ticker}</span>
                      <div style={{ flex: 1, height: 6, background: darkMode ? '#0f1117' : '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: pct >= 80 ? '#10b981' : '#f59e0b', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{pct}%</span>
                      <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>({audit.populated}/{audit.total})</span>
                    </button>
                    {isExpanded && audit.missing.length > 0 && (
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
            <div style={{ textAlign: 'center', padding: '1rem', color: theme.textSecondary, fontSize: '0.82rem' }}>
              Carregando auditoria de features...
            </div>
          )}
        </div>

        {/* Expected fields reference */}
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
     TAB 3: Pipeline
     ═══════════════════════════════════════════════════ */
  function renderPipeline() {
    const pipelines = [
      {
        name: 'IngestFeatures', description: 'Coleta fundamentalistas (BRAPI Pro), macro (BCB) e sentimento. Salva no Feature Store S3.',
        schedule: 'Diário, SEG-SEX 21:00 UTC (18:00 BRT)', lambda: 'B3TacticalRankingStackV2-IngestFeatures',
        status: pipeline?.ingest_features, icon: <Database size={18} />, color: '#3b82f6',
        outputs: ['feature_store/fundamentals/', 'feature_store/macro/', 'feature_store/sentiment/'],
        inputs: ['BRAPI Pro API', 'BCB API', 'NewsAPI (opcional)'],
      },
      {
        name: 'WeeklyRetrain (Staged)', description: 'Retreina ensemble DL em 4 etapas: treina cada modelo individualmente (Transformer+BiLSTM → TabTransformer → DilatedCNN) e depois combina com pesos adaptativos.',
        schedule: 'Semanal, Domingo 22:00 UTC (19:00 BRT)', lambda: 'B3TacticalRankingStackV2-TrainSageMaker',
        status: pipeline?.weekly_retrain, icon: <Cpu size={18} />, color: '#8b5cf6',
        outputs: [
          'models/deep_learning/{date}/individual/transformer_bilstm/',
          'models/deep_learning/{date}/individual/tab_transformer/',
          'models/deep_learning/{date}/individual/dilated_cnn/',
          'models/deep_learning/{date}/model.tar.gz (ensemble final)',
        ],
        inputs: ['curated/daily_monthly/ (730 dias)', 'feature_store/fundamentals/', 'feature_store/macro/', 'feature_store/sentiment/'],
      },
      {
        name: 'DailyRanking', description: 'Carrega ensemble DL (3 modelos), gera predições ponderadas e ranking top 50 ajustado por risco.',
        schedule: 'Diário, SEG-SEX 21:30 UTC (18:30 BRT)', lambda: 'B3TacticalRankingStackV2-RankSageMaker',
        status: pipeline?.daily_ranking, icon: <TrendingUp size={18} />, color: '#10b981',
        outputs: ['recommendations/dt={date}/top50.json'],
        inputs: ['curated/daily_monthly/', 'feature_store/', 'models/deep_learning/{date}/model.tar.gz'],
      },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {pipelines.map((p, idx) => (
          <div key={p.name} style={{ ...cardStyle, borderLeft: `3px solid ${p.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 8, borderRadius: 8, background: `${p.color}15`, color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>{p.name}</div>
                <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>{p.description}</div>
              </div>
              <StatusDot ok={p.status?.status === 'active'} label={p.status?.status === 'active' ? 'Ativo' : 'Inativo'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.75rem', marginBottom: 12 }}>
              <div style={{ padding: '0.5rem 0.75rem', background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 6 }}>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: 2 }}>Schedule</div>
                <div style={{ fontSize: '0.78rem', color: theme.text, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {p.schedule}</div>
              </div>
              <div style={{ padding: '0.5rem 0.75rem', background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 6 }}>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: 2 }}>Próxima execução</div>
                <div style={{ fontSize: '0.78rem', color: theme.text }}>{p.status?.next_run ? fmtDateTime(p.status.next_run) : '—'}</div>
              </div>
              <div style={{ padding: '0.5rem 0.75rem', background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 6 }}>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: 2 }}>Lambda</div>
                <div style={{ fontSize: '0.72rem', color: theme.text, fontFamily: 'monospace', wordBreak: 'break-all' }}>{p.lambda}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, marginBottom: 4, textTransform: 'uppercase' }}>Inputs</div>
                {p.inputs.map(inp => <div key={inp} style={{ fontSize: '0.72rem', color: theme.textSecondary, padding: '0.15rem 0', fontFamily: 'monospace' }}>→ {inp}</div>)}
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, marginBottom: 4, textTransform: 'uppercase' }}>Outputs</div>
                {p.outputs.map(out => <div key={out} style={{ fontSize: '0.72rem', color: theme.textSecondary, padding: '0.15rem 0', fontFamily: 'monospace' }}>← {out}</div>)}
              </div>
            </div>
            {idx < pipelines.length - 1 && <div style={{ textAlign: 'center', margin: '0.5rem 0 -0.5rem', color: theme.textSecondary, fontSize: '1.2rem' }}>↓</div>}
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
        name: 'Dados Brutos', icon: <Database size={20} />, color: '#3b82f6',
        items: [
          { label: 'BRAPI Pro', detail: '5 modules · 46 tickers · ~35 campos/ticker', status: true },
          { label: 'BCB API', detail: 'Selic, IPCA, Câmbio, CDI · 10 features', status: true },
          { label: 'Cotações Diárias', detail: 'OHLCV via BRAPI · curated/daily_monthly/', status: true },
          { label: 'NewsAPI', detail: 'Sentimento de notícias', status: false },
        ],
      },
      {
        name: 'Feature Engineering', icon: <Layers size={20} />, color: '#3b82f6',
        items: [
          { label: 'Técnicas', detail: 'RSI, MACD, Bollinger, ATR, momentum, volatilidade, regime · ~30 features', status: true },
          { label: 'Volume', detail: 'OBV, VWAP, volume-price divergence, z-score · ~15 features', status: true },
          { label: 'Fundamentalistas', detail: 'Valuation, rentabilidade, crescimento, endividamento, scores · ~25 features', status: true },
          { label: 'Macro', detail: 'Selic, IPCA, câmbio, CDI, variações · 10 features', status: true },
          { label: 'Setoriais', detail: 'Correlação, relative strength, dispersão · ~8 features', status: true },
          { label: 'Sentimento', detail: 'Score + interação com momentum · 2 features', status: false },
        ],
      },
      {
        name: 'Feature Selection', icon: <Zap size={20} />, color: '#f59e0b',
        items: [
          { label: 'StandardScaler', detail: 'Normalização de features para input do modelo DL', status: true },
          { label: 'Walk-Forward CV', detail: 'Validação temporal sem data leakage', status: true },
          { label: 'Feature Store S3', detail: 'Particionado por data, evita training-serving skew', status: true },
        ],
      },
      {
        name: 'Treinamento (Ensemble)', icon: <Cpu size={20} />, color: '#ef4444',
        items: [
          { label: 'Transformer + BiLSTM', detail: 'Multi-head self-attention + BiLSTM + attention pooling', status: true },
          { label: 'TabTransformer', detail: 'Feature tokenization + CLS token + Transformer encoder para interações entre features', status: true },
          { label: 'WaveNet Dilated CNN', detail: 'Convoluções dilatadas (1,2,4,8,16) com gated activation (sigmoid × tanh)', status: true },
          { label: 'Ensemble Ponderado', detail: 'Pesos inversamente proporcionais ao RMSE de validação', status: true },
          { label: 'Early Stopping', detail: 'Patience=20, Asymmetric Focal Loss (γ=2) + HuberLoss, OneCycleLR', status: true },
          { label: 'Retreino Semanal', detail: 'Domingo 22:00 UTC via EventBridge', status: true },
        ],
      },
      {
        name: 'Inferência', icon: <TrendingUp size={20} />, color: '#10b981',
        items: [
          { label: 'Ranking Diário', detail: 'Top 50 ações por score ajustado por risco (ensemble de 3 modelos)', status: true },
          { label: 'Score = retorno / volatilidade', detail: 'Predição ensemble dividida por vol_20d', status: true },
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
                  <div style={{ fontSize: '0.68rem', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Etapa {idx + 1}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>{stage.name}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: '0.5rem', marginLeft: 18 }}>
                {stage.items.map(item => (
                  <div key={item.label} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0.5rem 0.75rem',
                    background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 6,
                    borderLeft: `2px solid ${item.status ? '#10b981' : '#6b7280'}`,
                  }}>
                    <div style={{ marginTop: 2 }}>
                      {item.status ? <CheckCircle2 size={14} color="#10b981" /> : <Clock size={14} color="#94a3b8" />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: theme.text }}>{item.label}</div>
                      <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
