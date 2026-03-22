import React, { useState, useEffect } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import SHAPWaterfallChart from './SHAPWaterfallChart';
import SensitivityAnalysis from './SensitivityAnalysis';
import FeatureImpactChart from './FeatureImpactChart';
import ExplanationText from './ExplanationText';

interface ExplainabilityTabProps {
  darkMode?: boolean;
}

interface TickerData {
  ticker: string;
  last_close: number;
  pred_price_t_plus_20: number;
  exp_return_20: number;
  vol_20d: number;
  score: number;
}

const ExplainabilityTab: React.FC<ExplainabilityTabProps> = ({ darkMode = false }) => {
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };

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
          if (recs.length > 0 && !selectedTicker) setSelectedTicker(recs[0].ticker);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchTickers();
  }, []);

  const currentTicker = tickers.find(t => t.ticker === selectedTicker) || null;

  if (loading) {
    return (
      <div style={{ backgroundColor: theme.cardBg, padding: '2rem', borderRadius: 12, textAlign: 'center' }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
        <span style={{ color: theme.textSecondary }}>Carregando dados...</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        backgroundColor: theme.cardBg, padding: 'clamp(0.75rem, 3vw, 1.25rem)', borderRadius: 12, marginBottom: '1.25rem',
        boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Info size={20} color="#3b82f6" />
          <h2 style={{ margin: 0, fontSize: 'clamp(1rem, 3vw, 1.25rem)', fontWeight: 700, color: theme.text }}>
            Explicabilidade do Modelo
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>Ação:</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '1 1 180px', maxWidth: 340 }}>
            <button onClick={() => {
              const idx = tickers.findIndex(t => t.ticker === selectedTicker);
              if (idx > 0) setSelectedTicker(tickers[idx - 1].ticker);
            }}
              disabled={tickers.findIndex(t => t.ticker === selectedTicker) <= 0}
              style={{
                width: 32, height: 32, borderRadius: 6, border: `1px solid ${theme.border}`,
                background: 'transparent', color: theme.textSecondary, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                opacity: tickers.findIndex(t => t.ticker === selectedTicker) <= 0 ? 0.3 : 1,
                transition: 'all 0.15s',
              }}
              aria-label="Ação anterior"
            >‹</button>
            <select
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem', fontSize: '0.9rem', border: `1px solid ${theme.border}`,
                borderRadius: 8, backgroundColor: theme.cardBg, color: theme.text, cursor: 'pointer',
                minWidth: 0, flex: 1, transition: 'border-color 0.2s', outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
              onBlur={e => { e.currentTarget.style.borderColor = theme.border; }}
            >
              {tickers.map(t => (
                <option key={t.ticker} value={t.ticker}>
                  {t.ticker} (Score: {t.score.toFixed(2)})
                </option>
              ))}
            </select>
            <button onClick={() => {
              const idx = tickers.findIndex(t => t.ticker === selectedTicker);
              if (idx < tickers.length - 1) setSelectedTicker(tickers[idx + 1].ticker);
            }}
              disabled={tickers.findIndex(t => t.ticker === selectedTicker) >= tickers.length - 1}
              style={{
                width: 32, height: 32, borderRadius: 6, border: `1px solid ${theme.border}`,
                background: 'transparent', color: theme.textSecondary, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                opacity: tickers.findIndex(t => t.ticker === selectedTicker) >= tickers.length - 1 ? 0.3 : 1,
                transition: 'all 0.15s',
              }}
              aria-label="Próxima ação"
            >›</button>
          </div>
          {currentTicker && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600,
                background: darkMode ? '#0f172a' : '#f0f9ff', color: '#3b82f6',
                border: `1px solid rgba(59,130,246,0.2)`,
              }}>
                R$ {currentTicker.last_close.toFixed(2)} → R$ {currentTicker.pred_price_t_plus_20.toFixed(2)}
              </span>
              <span style={{
                padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600,
                background: currentTicker.exp_return_20 >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: currentTicker.exp_return_20 >= 0 ? '#10b981' : '#ef4444',
              }}>
                Ret: {(currentTicker.exp_return_20 * 100).toFixed(1)}%
              </span>
              <span style={{
                padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600,
                background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
              }}>
                Vol: {(currentTicker.vol_20d * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {currentTicker && (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <SHAPWaterfallChart ticker={selectedTicker} tickerData={currentTicker} darkMode={darkMode} />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <ExplanationText ticker={selectedTicker} tickerData={currentTicker} darkMode={darkMode} />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <SensitivityAnalysis ticker={selectedTicker} tickerData={currentTicker} darkMode={darkMode} />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <FeatureImpactChart tickers={tickers} darkMode={darkMode} />
          </div>
        </>
      )}
    </div>
  );
};

export default ExplainabilityTab;
