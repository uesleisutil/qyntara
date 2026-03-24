import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RefreshCw, Brain, TrendingUp, BarChart3,
  DollarSign, Globe, Building2, Newspaper, Layers, Lock,
  Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { getSignal, getSignalColor } from '../../constants';
import { useIsPro, useFreeTicker } from '../shared/pro/ProGate';
import ProValue from '../shared/pro/ProValue';
import ProBlur from '../shared/pro/ProBlur';
import SHAPWaterfallChart from './SHAPWaterfallChart';
import SensitivityAnalysis from './SensitivityAnalysis';
import FeatureImpactChart from './FeatureImpactChart';
import ExplanationText from './ExplanationText';
import { markChecklistItem } from '../shared/features/ActivationChecklist';

interface ExplainabilityTabProps { darkMode?: boolean; }

interface TickerData {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

/* ── Feature category metadata ── */
const FEATURE_CATEGORIES = [
  { key: 'tecnicas', icon: TrendingUp, label: 'Técnicas', count: '~25', color: '#3b82f6',
    desc: 'Retornos, médias móveis, RSI, MACD, Bollinger, momentum' },
  { key: 'volume', icon: BarChart3, label: 'Volume', count: '11', color: '#3b82f6',
    desc: 'OBV, VWAP, divergência volume-preço, z-score de volume' },
  { key: 'fundamentalistas', icon: DollarSign, label: 'Fundamentalistas', count: '~30', color: '#10b981',
    desc: 'ROE, P/L, P/VP, DY, margens, dívida/PL, EBITDA, FCF (BRAPI Pro)' },
  { key: 'macro', icon: Globe, label: 'Macroeconômicas', count: '10', color: '#f59e0b',
    desc: 'Selic, IPCA, câmbio USD/BRL, CDI, variações e tendências' },
  { key: 'setoriais', icon: Building2, label: 'Setoriais', count: '5', color: '#ec4899',
    desc: 'Correlação setorial, força relativa, dispersão do setor' },
  { key: 'sentimento', icon: Newspaper, label: 'Sentimento', count: '2', color: '#06b6d4',
    desc: 'Score de sentimento de notícias, volume de menções' },
];

const ExplainabilityTab: React.FC<ExplainabilityTabProps> = ({ darkMode = false }) => {
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tickerSearch, setTickerSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPro = useIsPro();
  const freeTicker = useFreeTicker();

  const theme = useMemo(() => ({
    bg: darkMode ? '#0f1117' : '#f8fafc',
    cardBg: darkMode ? '#1a1d27' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f1117',
    textSecondary: darkMode ? '#9ba1b0' : '#64748b',
    border: darkMode ? '#2a2e3a' : '#e2e8f0',
    subtle: darkMode ? '#0f1117' : '#f8fafc',
  }), [darkMode]);

  useEffect(() => {
    const fetchTickers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, {
          headers: { 'x-api-key': API_KEY },
        });
        if (res.ok) {
          const data = await res.json();
          const recs: TickerData[] = data.recommendations || [];
          recs.sort((a, b) => b.score - a.score);
          setTickers(recs);
          if (recs.length > 0) {
            // For free users with a freeTicker, auto-select it
            if (freeTicker && recs.some(r => r.ticker.toUpperCase() === freeTicker.toUpperCase())) {
              setSelectedTicker(prev => prev || freeTicker.toUpperCase());
            } else {
              setSelectedTicker(prev => prev || recs[0].ticker);
            }
          }
          markChecklistItem('viewedExplainability');
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchTickers();
  }, [freeTicker]);

  const currentTicker = tickers.find(t => t.ticker === selectedTicker) || null;
  const signal = currentTicker ? getSignal(currentTicker.score) : 'Neutro';
  const signalColor = getSignalColor(signal);
  // Free users have full access only to their selected free ticker
  const hasTickerAccess = isPro || (!!freeTicker && selectedTicker.toUpperCase() === freeTicker.toUpperCase());

  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.cardBg, borderRadius: 12, marginBottom: '1.25rem',
    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
  };

  if (loading) {
    return (
      <div style={{ ...cardStyle, padding: '3rem', textAlign: 'center' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} color="#3b82f6" />
        <div style={{ color: theme.textSecondary, fontSize: '0.85rem' }}>Carregando dados do modelo...</div>
      </div>
    );
  }

  return (
    <div>
      {/* ═══ 1. MODEL OVERVIEW — free for all ═══ */}
      <div style={{ ...cardStyle, padding: 'clamp(1rem, 3vw, 1.5rem)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Brain size={20} color="#3b82f6" />
          <h2 style={{ margin: 0, fontSize: 'clamp(1rem, 3vw, 1.2rem)', fontWeight: 700, color: theme.text }}>
            Visão Geral do Modelo
          </h2>
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.6 }}>
          O modelo ensemble utiliza <strong style={{ color: theme.text }}>~83 features</strong> de 6 categorias de dados
          para prever o retorno de cada ação nos próximos 20 pregões. Features são selecionadas automaticamente via SHAP.
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))',
          gap: '0.75rem',
        }}>
          {FEATURE_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <div key={cat.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                padding: '0.85rem', borderRadius: 10,
                backgroundColor: theme.subtle,
                border: `1px solid ${theme.border}`,
                transition: 'border-color 0.2s',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: `${cat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} color={cat.color} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>{cat.label}</span>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 10,
                      background: `${cat.color}18`, color: cat.color,
                    }}>{cat.count}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.4 }}>{cat.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{
          marginTop: '1rem', padding: '0.6rem 0.85rem', borderRadius: 8,
          background: darkMode ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.04)',
          border: `1px solid ${darkMode ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)'}`,
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <Layers size={14} color="#3b82f6" />
          <span style={{ fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.5 }}>
            Pipeline: <strong style={{ color: theme.text }}>Ingestão diária</strong> (21h UTC) →
            <strong style={{ color: theme.text }}> Feature Store S3</strong> →
            <strong style={{ color: theme.text }}> SHAP Selection</strong> →
            <strong style={{ color: theme.text }}> Ensemble Training</strong> (semanal) →
            <strong style={{ color: theme.text }}> Ranking diário</strong>
          </span>
        </div>
      </div>

      {/* ═══ 2. TICKER SELECTOR ═══ */}
      {(() => {
        const filtered = tickers.filter(t =>
          t.ticker.toLowerCase().includes(tickerSearch.toLowerCase())
        );
        const scrollByAmount = (dir: number) => {
          scrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
        };
        const currentIdx = tickers.findIndex(t => t.ticker === selectedTicker);

        return (
          <div style={{
            ...cardStyle,
            padding: 0,
            border: `1.5px solid ${darkMode ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)'}`,
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: 'clamp(0.75rem, 3vw, 1rem) clamp(0.75rem, 3vw, 1.25rem)',
              background: darkMode ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.03)',
              borderBottom: `1px solid ${darkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}`,
              display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Search size={16} color="#3b82f6" />
              </div>
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: theme.text, flex: '1 1 auto' }}>
                Selecione uma ação para explorar
              </span>
              <span style={{
                fontSize: '0.7rem', color: theme.textSecondary, fontWeight: 500,
              }}>
                {currentIdx + 1} / {tickers.length}
              </span>
            </div>

            {/* Search + nav */}
            <div style={{
              padding: 'clamp(0.6rem, 2vw, 0.85rem) clamp(0.75rem, 3vw, 1.25rem)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 0 }}>
                <Search size={14} style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: theme.textSecondary, pointerEvents: 'none',
                }} />
                <input
                  type="text"
                  placeholder="Buscar ticker..."
                  value={tickerSearch}
                  onChange={e => setTickerSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem',
                    fontSize: '0.82rem', border: `1px solid ${theme.border}`,
                    borderRadius: 8, backgroundColor: theme.subtle, color: theme.text,
                    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = theme.border; }}
                />
              </div>
              <button onClick={() => scrollByAmount(-1)}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: `1px solid ${theme.border}`,
                  background: 'transparent', color: theme.textSecondary, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }} aria-label="Scroll esquerda"><ChevronLeft size={16} /></button>
              <button onClick={() => scrollByAmount(1)}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: `1px solid ${theme.border}`,
                  background: 'transparent', color: theme.textSecondary, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }} aria-label="Scroll direita"><ChevronRight size={16} /></button>
            </div>

            {/* Ticker chips */}
            <div
              ref={scrollRef}
              style={{
                display: 'flex', gap: '0.4rem', overflowX: 'auto',
                padding: '0 clamp(0.75rem, 3vw, 1.25rem) clamp(0.75rem, 3vw, 1rem)',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {filtered.map(t => {
                const s = getSignal(t.score);
                const sColor = getSignalColor(s);
                const isActive = t.ticker === selectedTicker;
                const locked = !isPro && !!freeTicker && t.ticker.toUpperCase() !== freeTicker.toUpperCase();
                return (
                  <button
                    key={t.ticker}
                    onClick={() => setSelectedTicker(t.ticker)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.4rem 0.7rem', borderRadius: 8, flexShrink: 0,
                      fontSize: '0.78rem', fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer', transition: 'all 0.15s',
                      border: isActive
                        ? `1.5px solid ${sColor.text}`
                        : `1px solid ${theme.border}`,
                      background: isActive
                        ? (darkMode ? `${sColor.text}18` : `${sColor.text}0c`)
                        : 'transparent',
                      color: isActive ? sColor.text : theme.textSecondary,
                      WebkitAppearance: 'none' as any,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {locked && <Lock size={11} style={{ opacity: 0.6 }} />}
                    <span style={{ fontWeight: isActive ? 700 : 600, color: isActive ? theme.text : theme.textSecondary }}>
                      {t.ticker}
                    </span>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 700,
                      padding: '0.08rem 0.35rem', borderRadius: 6,
                      background: isActive ? sColor.bg : `${sColor.text}12`,
                      color: sColor.text,
                      border: isActive ? `1px solid ${sColor.border}` : 'none',
                    }}>
                      {s === 'Compra' ? '▲' : s === 'Venda' ? '▼' : '—'} {t.score.toFixed(2)}
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div style={{ padding: '0.5rem', fontSize: '0.8rem', color: theme.textSecondary }}>
                  Nenhum ticker encontrado
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Locked ticker banner for free users */}
      {!hasTickerAccess && selectedTicker && (
        <div style={{
          ...cardStyle, padding: '0.75rem 1rem',
          background: darkMode ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)',
          border: '1px solid rgba(245,158,11,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
        }}>
          <Lock size={14} color="#f59e0b" />
          <span style={{ fontSize: '0.8rem', color: theme.textSecondary, flex: 1 }}>
            {freeTicker
              ? <>Conteúdo bloqueado. Sua ação gratuita é <strong style={{ color: '#3b82f6' }}>{freeTicker}</strong>. </>
              : <>Selecione sua ação gratuita nas <a href="#/dashboard/settings" style={{ color: '#3b82f6' }}>Configurações</a>. </>
            }
            <a href="#/dashboard/upgrade" style={{ color: '#f59e0b', fontWeight: 600, textDecoration: 'none' }}>
              Assine o Pro para desbloquear todas.
            </a>
          </span>
        </div>
      )}

      {currentTicker && (
        <>
          {/* ═══ 3. SIGNAL SUMMARY CARD ═══ */}
          <div style={{
            ...cardStyle, padding: 'clamp(1rem, 3vw, 1.5rem)',
            borderLeft: `4px solid ${signalColor.text}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{
                padding: '0.25rem 0.65rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700,
                background: signalColor.bg, color: signalColor.text, border: `1px solid ${signalColor.border}`,
              }}>{signal}</span>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: theme.text }}>{currentTicker.ticker}</span>
              <span style={{ fontSize: '0.8rem', color: theme.textSecondary }}>
                Score: <strong style={{ color: '#3b82f6' }}>{currentTicker.score.toFixed(2)}</strong>
              </span>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))',
              gap: '0.75rem',
            }}>
              {/* Preço atual — free */}
              <div style={{ padding: '0.75rem', borderRadius: 8, backgroundColor: theme.subtle }}>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: '0.2rem' }}>Preço Atual</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: theme.text }}>
                  R$ {currentTicker.last_close.toFixed(2)}
                </div>
              </div>
              {/* Previsão — Pro */}
              <div style={{ padding: '0.75rem', borderRadius: 8, backgroundColor: theme.subtle }}>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: '0.2rem' }}>Previsão 20d</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: currentTicker.exp_return_20 >= 0 ? '#10b981' : '#ef4444' }}>
                  <ProValue isPro={hasTickerAccess} placeholder="R$ ••••">R$ {currentTicker.pred_price_t_plus_20.toFixed(2)}</ProValue>
                </div>
              </div>
              {/* Retorno — Pro */}
              <div style={{ padding: '0.75rem', borderRadius: 8, backgroundColor: theme.subtle }}>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: '0.2rem' }}>Retorno Esperado</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: currentTicker.exp_return_20 >= 0 ? '#10b981' : '#ef4444' }}>
                  <ProValue isPro={hasTickerAccess} placeholder="±••%">
                    {currentTicker.exp_return_20 >= 0 ? '+' : ''}{(currentTicker.exp_return_20 * 100).toFixed(1)}%
                  </ProValue>
                </div>
              </div>
              {/* Volatilidade — Pro */}
              <div style={{ padding: '0.75rem', borderRadius: 8, backgroundColor: theme.subtle }}>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: '0.2rem' }}>Volatilidade 20d</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b' }}>
                  <ProValue isPro={hasTickerAccess} placeholder="••%">{(currentTicker.vol_20d * 100).toFixed(1)}%</ProValue>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ 4. SHAP WATERFALL — Pro gated ═══ */}
          <div style={{ marginBottom: '1.25rem' }}>
            <ProBlur isPro={hasTickerAccess} darkMode={darkMode} label="Contribuição dos Fatores (SHAP)" storageKey="b3tr_blur_shap">
              <SHAPWaterfallChart ticker={selectedTicker} tickerData={currentTicker} darkMode={darkMode} isPro={hasTickerAccess} />
            </ProBlur>
          </div>

          {/* ═══ 5. EXPLANATION TEXT — partial free ═══ */}
          <div style={{ marginBottom: '1.25rem' }}>
            <ExplanationText ticker={selectedTicker} tickerData={currentTicker} darkMode={darkMode} isPro={hasTickerAccess} />
          </div>

          {/* ═══ 6. FUNDAMENTALS SNAPSHOT — Pro gated ═══ */}
          <div style={{ marginBottom: '1.25rem' }}>
            <ProBlur isPro={hasTickerAccess} darkMode={darkMode} label="Dados Fundamentalistas (BRAPI Pro)" storageKey="b3tr_blur_fundamentals">
              <FundamentalsSnapshot ticker={selectedTicker} darkMode={darkMode} theme={theme} />
            </ProBlur>
          </div>

          {/* ═══ 7. MACRO SNAPSHOT — Pro gated ═══ */}
          <div style={{ marginBottom: '1.25rem' }}>
            <ProBlur isPro={hasTickerAccess} darkMode={darkMode} label="Fatores Macroeconômicos" storageKey="b3tr_blur_macro">
              <MacroSnapshot darkMode={darkMode} theme={theme} />
            </ProBlur>
          </div>

          {/* ═══ 8. SENSITIVITY — Pro gated ═══ */}
          <div style={{ marginBottom: '1.25rem' }}>
            <ProBlur isPro={hasTickerAccess} darkMode={darkMode} label="Análise de Sensibilidade" storageKey="b3tr_blur_sensitivity">
              <SensitivityAnalysis ticker={selectedTicker} tickerData={currentTicker} darkMode={darkMode} isPro={hasTickerAccess} />
            </ProBlur>
          </div>

          {/* ═══ 9. AGGREGATE FEATURE IMPACT — free ═══ */}
          <div style={{ marginBottom: '1.25rem' }}>
            <FeatureImpactChart tickers={tickers} darkMode={darkMode} />
          </div>
        </>
      )}
    </div>
  );
};

/* ── Fundamentals Snapshot (inline component) ── */
interface SnapshotProps { ticker?: string; darkMode: boolean; theme: Record<string, string>; }

const FUNDAMENTAL_FIELDS = [
  { label: 'ROE', key: 'roe', fmt: (v: number) => `${(v * 100).toFixed(1)}%`, category: 'Rentabilidade' },
  { label: 'P/L', key: 'pl', fmt: (v: number) => v.toFixed(2), category: 'Valuation' },
  { label: 'P/VP', key: 'pvp', fmt: (v: number) => v.toFixed(2), category: 'Valuation' },
  { label: 'Dividend Yield', key: 'dy', fmt: (v: number) => `${(v * 100).toFixed(1)}%`, category: 'Retorno' },
  { label: 'Margem Líquida', key: 'net_margin', fmt: (v: number) => `${(v * 100).toFixed(1)}%`, category: 'Rentabilidade' },
  { label: 'Dívida/PL', key: 'debt_equity', fmt: (v: number) => v.toFixed(2), category: 'Endividamento' },
  { label: 'EBITDA', key: 'ebitda', fmt: (v: number) => `R$ ${(v / 1e6).toFixed(0)}M`, category: 'Resultado' },
  { label: 'Margem EBITDA', key: 'ebitda_margin', fmt: (v: number) => `${(v * 100).toFixed(1)}%`, category: 'Rentabilidade' },
  { label: 'FCF', key: 'free_cash_flow', fmt: (v: number) => `R$ ${(v / 1e6).toFixed(0)}M`, category: 'Caixa' },
  { label: 'ROA', key: 'roa', fmt: (v: number) => `${(v * 100).toFixed(1)}%`, category: 'Rentabilidade' },
  { label: 'Receita Líquida', key: 'net_revenue', fmt: (v: number) => `R$ ${(v / 1e9).toFixed(1)}B`, category: 'Resultado' },
  { label: 'Lucro Líquido', key: 'net_income', fmt: (v: number) => `R$ ${(v / 1e6).toFixed(0)}M`, category: 'Resultado' },
];

/* Sample fundamentals for display — fallback when API is unavailable */
const SAMPLE_FUNDAMENTALS: Record<string, Record<string, number>> = {
  PETR4: { roe: 0.265, pl: 5.34, pvp: 1.41, dy: 0.064, net_margin: 0.222, debt_equity: 1.62, ebitda: 68e9, ebitda_margin: 0.42, free_cash_flow: 32e9, roa: 0.12, net_revenue: 162e9, net_income: 36e9 },
  VALE3: { roe: 0.22, pl: 6.1, pvp: 1.55, dy: 0.085, net_margin: 0.28, debt_equity: 0.45, ebitda: 82e9, ebitda_margin: 0.48, free_cash_flow: 28e9, roa: 0.14, net_revenue: 170e9, net_income: 48e9 },
  ITUB4: { roe: 0.20, pl: 8.2, pvp: 1.8, dy: 0.045, net_margin: 0.25, debt_equity: 8.5, ebitda: 0, ebitda_margin: 0, free_cash_flow: 0, roa: 0.015, net_revenue: 95e9, net_income: 24e9 },
};

/** Maps API field names to our display keys */
const API_TO_DISPLAY_MAP: Record<string, string> = {
  roe: 'roe', pe_ratio: 'pl', pb_ratio: 'pvp', dividend_yield: 'dy',
  profit_margin: 'net_margin', debt_to_equity: 'debt_equity', ebitda: 'ebitda',
  ebitda_margin: 'ebitda_margin', free_cash_flow: 'free_cash_flow', roa: 'roa',
  total_revenue: 'net_revenue', net_income: 'net_income',
};

const FundamentalsSnapshot: React.FC<SnapshotProps> = ({ ticker = '', darkMode, theme }) => {
  const [data, setData] = React.useState<Record<string, number>>(SAMPLE_FUNDAMENTALS[ticker] || SAMPLE_FUNDAMENTALS['PETR4']);
  const [source, setSource] = React.useState<'api' | 'fallback'>('fallback');
  const [dataDate, setDataDate] = React.useState<string>('');

  React.useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/ticker/${ticker}/fundamentals`, {
          headers: { 'x-api-key': API_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const f = json.fundamentals || {};
        const mapped: Record<string, number> = {};
        for (const [apiKey, displayKey] of Object.entries(API_TO_DISPLAY_MAP)) {
          if (f[apiKey] != null) mapped[displayKey as string] = f[apiKey];
        }
        if (Object.keys(mapped).length > 0) {
          setData(mapped);
          setSource('api');
          setDataDate(json.date || '');
        }
      } catch {
        // Keep fallback data
        setData(SAMPLE_FUNDAMENTALS[ticker] || SAMPLE_FUNDAMENTALS['PETR4']);
        setSource('fallback');
      }
    })();
    return () => { cancelled = true; };
  }, [ticker]);
  const categories = [...new Set(FUNDAMENTAL_FIELDS.map(f => f.category))];

  return (
    <div style={{
      backgroundColor: theme.cardBg, padding: 'clamp(0.75rem, 3vw, 1.5rem)', borderRadius: 12,
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <DollarSign size={18} color="#10b981" />
        <h3 style={{ margin: 0, fontSize: 'clamp(0.95rem, 3vw, 1.125rem)', fontWeight: 600, color: theme.text }}>
          Dados Fundamentalistas — {ticker}
        </h3>
        <span style={{
          fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 8,
          background: 'rgba(16,185,129,0.12)', color: '#10b981',
        }}>BRAPI Pro</span>
      </div>
      <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.5 }}>
        Indicadores fundamentalistas extraídos via BRAPI Pro (balanceSheet, incomeStatement, defaultKeyStatistics, financialData, summaryProfile).
        Estes dados alimentam ~30 features do modelo.
      </p>
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: theme.textSecondary, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {cat}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(130px, 100%), 1fr))',
            gap: '0.5rem',
          }}>
            {FUNDAMENTAL_FIELDS.filter(f => f.category === cat).map(field => {
              const val = data[field.key];
              return (
                <div key={field.key} style={{
                  padding: '0.6rem', borderRadius: 8, backgroundColor: theme.subtle,
                  border: `1px solid ${theme.border}`,
                }}>
                  <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: '0.15rem' }}>{field.label}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: theme.text }}>
                    {val != null ? field.fmt(val) : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{
        marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 8,
        background: darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.04)',
        fontSize: '0.7rem', color: theme.textSecondary, lineHeight: 1.5,
      }}>
        {source === 'api'
          ? `✅ Dados reais do Feature Store (BRAPI Pro) — atualizado em ${dataDate}. O modelo calcula features derivadas como variações trimestrais, z-scores setoriais e rankings relativos.`
          : '⚠️ Dados de referência (API indisponível). O modelo calcula features derivadas como variações trimestrais, z-scores setoriais e rankings relativos a partir destes dados brutos.'}
      </div>
    </div>
  );
};

/* ── Macro Snapshot (inline component) ── */
const MACRO_FALLBACK = [
  { label: 'Selic', value: '14.25%', trend: 'estável', color: '#3b82f6', desc: 'Taxa básica de juros' },
  { label: 'IPCA 12m', value: '4.87%', trend: '↑', color: '#ef4444', desc: 'Inflação acumulada' },
  { label: 'USD/BRL', value: 'R$ 5.72', trend: '↓', color: '#10b981', desc: 'Câmbio dólar' },
  { label: 'CDI', value: '14.15%', trend: 'estável', color: '#3b82f6', desc: 'Taxa interbancária' },
  { label: 'Δ Selic 3m', value: '+0.50pp', trend: '↑', color: '#f59e0b', desc: 'Variação trimestral' },
  { label: 'Δ Câmbio 1m', value: '-1.2%', trend: '↓', color: '#10b981', desc: 'Variação mensal' },
];

function parseMacroSeries(data: Record<string, any>): typeof MACRO_FALLBACK {
  const latest = (series: any[]): number | null => {
    if (!Array.isArray(series) || !series.length) return null;
    const last = series[series.length - 1];
    const v = parseFloat(String(last?.valor ?? last?.value ?? '').replace(',', '.'));
    return isNaN(v) ? null : v;
  };
  const change = (series: any[], n: number): number | null => {
    if (!Array.isArray(series) || series.length < n + 1) return null;
    const vals = series.slice(-n - 1).map((s: any) => parseFloat(String(s?.valor ?? s?.value ?? '').replace(',', '.')));
    if (vals.some(isNaN) || vals[0] === 0) return null;
    return (vals[vals.length - 1] / vals[0]) - 1;
  };

  const selic = latest(data.selic_meta);
  const ipca = latest(data.ipca_mensal);
  const cambio = latest(data.cambio_usd_brl);
  const cdi = latest(data.cdi_diario);
  const selicChange = change(data.selic_meta, 60); // ~3 months
  const cambioChange = change(data.cambio_usd_brl, 20); // ~1 month

  const trendOf = (v: number | null) => v == null ? 'estável' : v > 0.001 ? '↑' : v < -0.001 ? '↓' : 'estável';

  return [
    { label: 'Selic', value: selic != null ? `${selic.toFixed(2)}%` : '—', trend: trendOf(selicChange), color: '#3b82f6', desc: 'Taxa básica de juros' },
    { label: 'IPCA 12m', value: ipca != null ? `${(ipca * 12).toFixed(2)}%` : '—', trend: trendOf(ipca != null ? ipca - 0.4 : null), color: '#ef4444', desc: 'Inflação acumulada' },
    { label: 'USD/BRL', value: cambio != null ? `R$ ${cambio.toFixed(2)}` : '—', trend: trendOf(cambioChange), color: cambioChange != null && cambioChange < 0 ? '#10b981' : '#ef4444', desc: 'Câmbio dólar' },
    { label: 'CDI', value: cdi != null ? `${cdi.toFixed(2)}%` : '—', trend: 'estável', color: '#3b82f6', desc: 'Taxa interbancária' },
    { label: 'Δ Selic 3m', value: selicChange != null ? `${selicChange > 0 ? '+' : ''}${(selicChange * 100).toFixed(2)}pp` : '—', trend: trendOf(selicChange), color: '#f59e0b', desc: 'Variação trimestral' },
    { label: 'Δ Câmbio 1m', value: cambioChange != null ? `${(cambioChange * 100).toFixed(1)}%` : '—', trend: trendOf(cambioChange), color: cambioChange != null && cambioChange < 0 ? '#10b981' : '#ef4444', desc: 'Variação mensal' },
  ];
}

const MacroSnapshot: React.FC<Omit<SnapshotProps, 'ticker'>> = ({ darkMode, theme }) => {
  const [indicators, setIndicators] = React.useState(MACRO_FALLBACK);
  const [source, setSource] = React.useState<'api' | 'fallback'>('fallback');
  const [dataDate, setDataDate] = React.useState<string>('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/macro`, {
          headers: { 'x-api-key': API_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const parsed = parseMacroSeries(json.macro || {});
        setIndicators(parsed);
        setSource('api');
        setDataDate(json.date || '');
      } catch {
        // Keep fallback
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
  <div style={{
    backgroundColor: theme.cardBg, padding: 'clamp(0.75rem, 3vw, 1.5rem)', borderRadius: 12,
    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
      <Globe size={18} color="#f59e0b" />
      <h3 style={{ margin: 0, fontSize: 'clamp(0.95rem, 3vw, 1.125rem)', fontWeight: 600, color: theme.text }}>
        Fatores Macroeconômicos
      </h3>
      <span style={{
        fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 8,
        background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
      }}>BCB API</span>
    </div>
    <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.5 }}>
      Indicadores macroeconômicos do Banco Central (séries temporais SGS). O modelo usa valores absolutos, variações e tendências como features.
    </p>
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))',
      gap: '0.6rem',
    }}>
      {indicators.map(ind => (
        <div key={ind.label} style={{
          padding: '0.75rem', borderRadius: 10, backgroundColor: theme.subtle,
          border: `1px solid ${theme.border}`, borderLeft: `3px solid ${ind.color}`,
        }}>
          <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: '0.15rem' }}>{ind.desc}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: theme.text }}>{ind.value}</span>
            <span style={{ fontSize: '0.65rem', color: ind.trend.includes('↑') ? '#ef4444' : ind.trend.includes('↓') ? '#10b981' : theme.textSecondary }}>
              {ind.trend}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: ind.color, marginTop: '0.1rem' }}>{ind.label}</div>
        </div>
      ))}
    </div>
    <div style={{
      marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 8,
      background: darkMode ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)',
      fontSize: '0.7rem', color: theme.textSecondary, lineHeight: 1.5,
    }}>
      💡 {source === 'api'
        ? `Dados reais do BCB (SGS) — atualizado em ${dataDate}. O modelo gera 10 features macro: valores absolutos, variações de 1m/3m, e indicadores de tendência.`
        : 'Dados de referência (API indisponível). O modelo gera 10 features macro: valores absolutos, variações de 1m/3m, e indicadores de tendência para cada série.'}
    </div>
  </div>
  );
};

export default ExplainabilityTab;
