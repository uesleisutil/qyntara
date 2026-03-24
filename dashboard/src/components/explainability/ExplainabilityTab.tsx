import React, { useState, useEffect, useMemo } from 'react';
import {
  Info, RefreshCw, Brain, TrendingUp, BarChart3,
  DollarSign, Globe, Building2, Newspaper, Layers,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { getSignal, getSignalColor } from '../../constants';
import { useIsPro } from '../shared/ProGate';
import ProValue from '../shared/ProValue';
import ProBlur from '../shared/ProBlur';
import SHAPWaterfallChart from './SHAPWaterfallChart';
import SensitivityAnalysis from './SensitivityAnalysis';
import FeatureImpactChart from './FeatureImpactChart';
import ExplanationText from './ExplanationText';
import { markChecklistItem } from '../shared/ActivationChecklist';

interface ExplainabilityTabProps { darkMode?: boolean; }

interface TickerData {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

/* ── Feature category metadata ── */
const FEATURE_CATEGORIES = [
  { key: 'tecnicas', icon: TrendingUp, label: 'Técnicas', count: '~25', color: '#5a9e87',
    desc: 'Retornos, médias móveis, RSI, MACD, Bollinger, momentum' },
  { key: 'volume', icon: BarChart3, label: 'Volume', count: '11', color: '#5a9e87',
    desc: 'OBV, VWAP, divergência volume-preço, z-score de volume' },
  { key: 'fundamentalistas', icon: DollarSign, label: 'Fundamentalistas', count: '~30', color: '#4ead8a',
    desc: 'ROE, P/L, P/VP, DY, margens, dívida/PL, EBITDA, FCF (BRAPI Pro)' },
  { key: 'macro', icon: Globe, label: 'Macroeconômicas', count: '10', color: '#d4a84b',
    desc: 'Selic, IPCA, câmbio USD/BRL, CDI, variações e tendências' },
  { key: 'setoriais', icon: Building2, label: 'Setoriais', count: '5', color: '#d4a84b',
    desc: 'Correlação setorial, força relativa, dispersão do setor' },
  { key: 'sentimento', icon: Newspaper, label: 'Sentimento', count: '2', color: '#5ab0a0',
    desc: 'Score de sentimento de notícias, volume de menções' },
];

const ExplainabilityTab: React.FC<ExplainabilityTabProps> = ({ darkMode = false }) => {
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);
  const isPro = useIsPro();

  const theme = useMemo(() => ({
    bg: darkMode ? '#121a1a' : '#f6faf8',
    cardBg: darkMode ? '#1a2626' : 'white',
    text: darkMode ? '#e8f0ed' : '#121a1a',
    textSecondary: darkMode ? '#8fa89c' : '#5a7268',
    border: darkMode ? '#2a3d36' : '#d4e5dc',
    subtle: darkMode ? '#121a1a' : '#f6faf8',
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
          if (recs.length > 0) setSelectedTicker(prev => prev || recs[0].ticker);
          markChecklistItem('viewedExplainability');
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchTickers();
  }, []);

  const currentTicker = tickers.find(t => t.ticker === selectedTicker) || null;
  const signal = currentTicker ? getSignal(currentTicker.score) : 'Neutro';
  const signalColor = getSignalColor(signal);

  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.cardBg, borderRadius: 12, marginBottom: '1.25rem',
    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
  };

  if (loading) {
    return (
      <div style={{ ...cardStyle, padding: '3rem', textAlign: 'center' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} color="#5a9e87" />
        <div style={{ color: theme.textSecondary, fontSize: '0.85rem' }}>Carregando dados do modelo...</div>
      </div>
    );
  }

  return (
    <div>
      {/* ═══ 1. MODEL OVERVIEW — free for all ═══ */}
      <div style={{ ...cardStyle, padding: 'clamp(1rem, 3vw, 1.5rem)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Brain size={20} color="#5a9e87" />
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
          <Layers size={14} color="#5a9e87" />
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
      <div style={{ ...cardStyle, padding: 'clamp(0.75rem, 3vw, 1.25rem)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Info size={18} color="#5a9e87" />
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text }}>Selecione uma ação para explorar</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => {
            const idx = tickers.findIndex(t => t.ticker === selectedTicker);
            if (idx > 0) setSelectedTicker(tickers[idx - 1].ticker);
          }}
            disabled={tickers.findIndex(t => t.ticker === selectedTicker) <= 0}
            style={{
              width: 32, height: 32, borderRadius: 8, border: `1px solid ${theme.border}`,
              background: 'transparent', color: theme.textSecondary, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              opacity: tickers.findIndex(t => t.ticker === selectedTicker) <= 0 ? 0.3 : 1,
            }} aria-label="Ação anterior">‹</button>
          <select value={selectedTicker} onChange={e => setSelectedTicker(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem', fontSize: '0.88rem', border: `1px solid ${theme.border}`,
              borderRadius: 8, backgroundColor: theme.cardBg, color: theme.text, cursor: 'pointer',
              flex: '1 1 180px', minWidth: 0, outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#5a9e87'; }}
            onBlur={e => { e.currentTarget.style.borderColor = theme.border; }}>
            {tickers.map(t => {
              const s = getSignal(t.score);
              return (
                <option key={t.ticker} value={t.ticker}>
                  {t.ticker} — {s} (Score: {t.score.toFixed(2)})
                </option>
              );
            })}
          </select>
          <button onClick={() => {
            const idx = tickers.findIndex(t => t.ticker === selectedTicker);
            if (idx < tickers.length - 1) setSelectedTicker(tickers[idx + 1].ticker);
          }}
            disabled={tickers.findIndex(t => t.ticker === selectedTicker) >= tickers.length - 1}
            style={{
              width: 32, height: 32, borderRadius: 8, border: `1px solid ${theme.border}`,
              background: 'transparent', color: theme.textSecondary, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              opacity: tickers.findIndex(t => t.ticker === selectedTicker) >= tickers.length - 1 ? 0.3 : 1,
            }} aria-label="Próxima ação">›</button>
        </div>
      </div>

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
                Score: <strong style={{ color: '#5a9e87' }}>{currentTicker.score.toFixed(2)}</strong>
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
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: currentTicker.exp_return_20 >= 0 ? '#4ead8a' : '#e07070' }}>
                  <ProValue isPro={isPro} placeholder="R$ ••••">R$ {currentTicker.pred_price_t_plus_20.toFixed(2)}</ProValue>
                </div>
              </div>
              {/* Retorno — Pro */}
              <div style={{ padding: '0.75rem', borderRadius: 8, backgroundColor: theme.subtle }}>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: '0.2rem' }}>Retorno Esperado</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: currentTicker.exp_return_20 >= 0 ? '#4ead8a' : '#e07070' }}>
                  <ProValue isPro={isPro} placeholder="±••%">
                    {currentTicker.exp_return_20 >= 0 ? '+' : ''}{(currentTicker.exp_return_20 * 100).toFixed(1)}%
                  </ProValue>
                </div>
              </div>
              {/* Volatilidade — Pro */}
              <div style={{ padding: '0.75rem', borderRadius: 8, backgroundColor: theme.subtle }}>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginBottom: '0.2rem' }}>Volatilidade 20d</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#d4a84b' }}>
                  <ProValue isPro={isPro} placeholder="••%">{(currentTicker.vol_20d * 100).toFixed(1)}%</ProValue>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ 4. SHAP WATERFALL — Pro gated ═══ */}
          <div style={{ marginBottom: '1.25rem' }}>
            <ProBlur isPro={isPro} darkMode={darkMode} label="Contribuição dos Fatores (SHAP)" storageKey="b3tr_blur_shap">
              <SHAPWaterfallChart ticker={selectedTicker} tickerData={currentTicker} darkMode={darkMode} isPro={isPro} />
            </ProBlur>
          </div>

          {/* ═══ 5. EXPLANATION TEXT — partial free ═══ */}
          <div style={{ marginBottom: '1.25rem' }}>
            <ExplanationText ticker={selectedTicker} tickerData={currentTicker} darkMode={darkMode} isPro={isPro} />
          </div>

          {/* ═══ 6. FUNDAMENTALS SNAPSHOT — Pro gated ═══ */}
          <div style={{ marginBottom: '1.25rem' }}>
            <ProBlur isPro={isPro} darkMode={darkMode} label="Dados Fundamentalistas (BRAPI Pro)" storageKey="b3tr_blur_fundamentals">
              <FundamentalsSnapshot ticker={selectedTicker} darkMode={darkMode} theme={theme} />
            </ProBlur>
          </div>

          {/* ═══ 7. MACRO SNAPSHOT — Pro gated ═══ */}
          <div style={{ marginBottom: '1.25rem' }}>
            <ProBlur isPro={isPro} darkMode={darkMode} label="Fatores Macroeconômicos" storageKey="b3tr_blur_macro">
              <MacroSnapshot darkMode={darkMode} theme={theme} />
            </ProBlur>
          </div>

          {/* ═══ 8. SENSITIVITY — Pro gated ═══ */}
          <div style={{ marginBottom: '1.25rem' }}>
            <ProBlur isPro={isPro} darkMode={darkMode} label="Análise de Sensibilidade" storageKey="b3tr_blur_sensitivity">
              <SensitivityAnalysis ticker={selectedTicker} tickerData={currentTicker} darkMode={darkMode} isPro={isPro} />
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
        <DollarSign size={18} color="#4ead8a" />
        <h3 style={{ margin: 0, fontSize: 'clamp(0.95rem, 3vw, 1.125rem)', fontWeight: 600, color: theme.text }}>
          Dados Fundamentalistas — {ticker}
        </h3>
        <span style={{
          fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 8,
          background: 'rgba(16,185,129,0.12)', color: '#4ead8a',
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
  { label: 'Selic', value: '14.25%', trend: 'estável', color: '#5a9e87', desc: 'Taxa básica de juros' },
  { label: 'IPCA 12m', value: '4.87%', trend: '↑', color: '#e07070', desc: 'Inflação acumulada' },
  { label: 'USD/BRL', value: 'R$ 5.72', trend: '↓', color: '#4ead8a', desc: 'Câmbio dólar' },
  { label: 'CDI', value: '14.15%', trend: 'estável', color: '#5a9e87', desc: 'Taxa interbancária' },
  { label: 'Δ Selic 3m', value: '+0.50pp', trend: '↑', color: '#d4a84b', desc: 'Variação trimestral' },
  { label: 'Δ Câmbio 1m', value: '-1.2%', trend: '↓', color: '#4ead8a', desc: 'Variação mensal' },
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
    { label: 'Selic', value: selic != null ? `${selic.toFixed(2)}%` : '—', trend: trendOf(selicChange), color: '#5a9e87', desc: 'Taxa básica de juros' },
    { label: 'IPCA 12m', value: ipca != null ? `${(ipca * 12).toFixed(2)}%` : '—', trend: trendOf(ipca != null ? ipca - 0.4 : null), color: '#e07070', desc: 'Inflação acumulada' },
    { label: 'USD/BRL', value: cambio != null ? `R$ ${cambio.toFixed(2)}` : '—', trend: trendOf(cambioChange), color: cambioChange != null && cambioChange < 0 ? '#4ead8a' : '#e07070', desc: 'Câmbio dólar' },
    { label: 'CDI', value: cdi != null ? `${cdi.toFixed(2)}%` : '—', trend: 'estável', color: '#5a9e87', desc: 'Taxa interbancária' },
    { label: 'Δ Selic 3m', value: selicChange != null ? `${selicChange > 0 ? '+' : ''}${(selicChange * 100).toFixed(2)}pp` : '—', trend: trendOf(selicChange), color: '#d4a84b', desc: 'Variação trimestral' },
    { label: 'Δ Câmbio 1m', value: cambioChange != null ? `${(cambioChange * 100).toFixed(1)}%` : '—', trend: trendOf(cambioChange), color: cambioChange != null && cambioChange < 0 ? '#4ead8a' : '#e07070', desc: 'Variação mensal' },
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
      <Globe size={18} color="#d4a84b" />
      <h3 style={{ margin: 0, fontSize: 'clamp(0.95rem, 3vw, 1.125rem)', fontWeight: 600, color: theme.text }}>
        Fatores Macroeconômicos
      </h3>
      <span style={{
        fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 8,
        background: 'rgba(212,168,75,0.12)', color: '#d4a84b',
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
            <span style={{ fontSize: '0.65rem', color: ind.trend.includes('↑') ? '#e07070' : ind.trend.includes('↓') ? '#4ead8a' : theme.textSecondary }}>
              {ind.trend}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: ind.color, marginTop: '0.1rem' }}>{ind.label}</div>
        </div>
      ))}
    </div>
    <div style={{
      marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 8,
      background: darkMode ? 'rgba(212,168,75,0.06)' : 'rgba(212,168,75,0.04)',
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
