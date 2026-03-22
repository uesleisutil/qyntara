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
          <select
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem', fontSize: '0.9rem', border: `1px solid ${theme.border}`,
              borderRadius: 8, backgroundColor: theme.cardBg, color: theme.text, cursor: 'pointer',
              minWidth: 0, flex: '1 1 180px', maxWidth: 280,
            }}
          >
            {tickers.map(t => (
              <option key={t.ticker} value={t.ticker}>
                {t.ticker} (Score: {t.score.toFixed(2)})
              </option>
            ))}
          </select>
          {currentTicker && (
            <span style={{ fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.4 }}>
              R$ {currentTicker.last_close.toFixed(2)} → R$ {currentTicker.pred_price_t_plus_20.toFixed(2)} | 
              Ret: {(currentTicker.exp_return_20 * 100).toFixed(1)}% | Vol: {(currentTicker.vol_20d * 100).toFixed(1)}%
            </span>
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
