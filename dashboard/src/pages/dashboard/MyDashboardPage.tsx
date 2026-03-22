import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { LayoutDashboard, RefreshCw, Clock } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD } from '../../constants';
import DailyHighlight from '../../components/shared/DailyHighlight';
import SignalChangesDropdown from '../../components/shared/SignalChangesDropdown';
import MyPositionsPanel from '../../components/shared/MyPositionsPanel';
import PersonalPerformance from '../../components/shared/PersonalPerformance';
import GoalTracker from '../../components/shared/GoalTracker';
import PriceAlerts from '../../components/shared/PriceAlerts';
import StockComparator from '../../components/explainability/StockComparator';
import { useIsPro } from '../../components/shared/ProGate';
import InfoTooltip from '../../components/shared/InfoTooltip';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }
interface Rec {
  ticker: string; last_close: number; pred_price_t_plus_20: number;
  exp_return_20: number; vol_20d: number; score: number;
}

const MyDashboardPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const isPro = useIsPro();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, {
        headers: { 'x-api-key': API_KEY },
      });
      if (res.ok) {
        const data = await res.json();
        setRecs(data.recommendations || []);
        setDate(data.date || '');
        setLastUpdated(new Date());
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const topTicker = recs.length ? recs.reduce((a, b) => a.score > b.score ? a : b) : null;
  const totalBuy = recs.filter(r => r.score >= SCORE_BUY_THRESHOLD).length;
  const totalSell = recs.filter(r => r.score <= SCORE_SELL_THRESHOLD).length;
  const totalNeutral = recs.length - totalBuy - totalSell;

  const getRelativeTime = (d: Date) => {
    const diff = Math.round((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'agora mesmo';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    return `há ${Math.floor(diff / 86400)}d`;
  };

  if (loading) {
    const pulse: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1e293b' : '#e2e8f0'} 25%, ${darkMode ? '#334155' : '#f1f5f9'} 50%, ${darkMode ? '#1e293b' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ ...pulse, height: 28, width: 250, marginBottom: 16 }} />
        <div style={{ ...pulse, height: 80, marginBottom: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ ...pulse, height: 200 }} />
          <div style={{ ...pulse, height: 200 }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <LayoutDashboard size={20} color="#3b82f6" />
            <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, margin: 0 }}>
              Meu Dashboard
            </h1>
            <InfoTooltip text="Visão geral personalizada com suas posições, destaques do dia, novidades e comparador de ações." darkMode={darkMode} size={13} />
          </div>
          <p style={{ color: theme.textSecondary, fontSize: '0.78rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            Resumo personalizado do dia
            {date && <span> — {date}</span>}
            {lastUpdated && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.12rem 0.45rem', borderRadius: 10 }}>
                <Clock size={10} /> {getRelativeTime(lastUpdated)}
              </span>
            )}
          </p>
        </div>
        <button onClick={fetchData} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: 'white',
          fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
          WebkitAppearance: 'none' as any,
        }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Destaque do Dia */}
      {recs.length > 0 && topTicker && (
        <DailyHighlight
          darkMode={darkMode} theme={theme}
          topTicker={topTicker}
          totalBuy={totalBuy} totalSell={totalSell} totalNeutral={totalNeutral}
          date={date}
        />
      )}

      {/* Novidades */}
      <SignalChangesDropdown darkMode={darkMode} theme={theme} />

      {/* Posições & Performance */}
      {isPro && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '0.75rem', marginBottom: '0.75rem', marginTop: '0.75rem' }}>
          <div>
            <PersonalPerformance darkMode={darkMode} theme={theme} />
          </div>
          <div>
            <GoalTracker darkMode={darkMode} theme={theme} />
          </div>
        </div>
      )}

      <div style={{ marginBottom: '0.75rem' }}>
        <MyPositionsPanel darkMode={darkMode} theme={theme} />
      </div>

      {isPro && (
        <div style={{ marginBottom: '0.75rem' }}>
          <PriceAlerts darkMode={darkMode} theme={theme} />
        </div>
      )}

      {/* Comparador de Ações */}
      {recs.length > 0 && (
        <StockComparator tickers={recs} darkMode={darkMode} />
      )}
    </div>
  );
};

export default MyDashboardPage;
