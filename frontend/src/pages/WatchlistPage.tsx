import React, { useState } from 'react';
import { useApi, apiFetch } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { theme } from '../styles';
import { Star, Lock, Clock, DollarSign, Droplets } from 'lucide-react';

interface Market {
  market_id: string; source: string; question: string; yes_price: number;
  volume: number; volume_24h: number; category: string; end_date: string;
  liquidity?: number;
}
interface Props { dark?: boolean; onAuthRequired: () => void; onSelectMarket?: (id: string) => void; }

export const WatchlistPage: React.FC<Props> = ({ onAuthRequired, onSelectMarket }) => {
  const user = useAuthStore(s => s.user);
  const { data, loading, refresh } = useApi<{ watchlist: Market[] }>(user ? '/watchlist' : '', 15000);

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Lock size={24} color={theme.textMuted} style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>Favoritos</h3>
        <p style={{ color: theme.textMuted, marginBottom: '1.5rem', fontSize: '0.82rem' }}>Entre para acessar</p>
        <button onClick={onAuthRequired} style={{
          padding: '0.65rem 1.5rem', borderRadius: 8, border: 'none',
          background: theme.text, color: theme.bg, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
        }}>Entrar</button>
      </div>
    );
  }

  const markets = data?.watchlist || [];

  const handleRemove = async (mid: string) => {
    await apiFetch(`/watchlist/${mid}`, { method: 'DELETE' });
    refresh();
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Star size={20} color={theme.yellow} fill={theme.yellow} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em' }}>Favoritos</h2>
        </div>
        <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>{markets.length} mercado{markets.length !== 1 ? 's' : ''} na watchlist</p>
      </div>

      {loading && !markets.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 68, borderRadius: 12, border: `1px solid ${theme.border}`, background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`, backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.08}s` }} />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: theme.textMuted, background: theme.card, borderRadius: 16, border: `1px solid ${theme.border}` }}>
          <Star size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: '0.9rem', marginBottom: 6 }}>Nenhum favorito ainda</p>
          <p style={{ fontSize: '0.75rem' }}>Clique na ⭐ nos mercados para adicionar aqui.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {markets.map((m, i) => (
            <WatchlistRow key={m.market_id} m={m} i={i} onSelect={onSelectMarket} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
};

const WatchlistRow: React.FC<{ m: Market; i: number; onSelect?: (id: string) => void; onRemove: (id: string) => void }> = ({ m, i, onSelect, onRemove }) => {
  const [hov, setHov] = useState(false);
  const pct = (m.yes_price * 100).toFixed(1);
  const color = m.yes_price > 0.6 ? theme.green : m.yes_price < 0.4 ? theme.red : theme.yellow;
  const days = m.end_date ? Math.max(0, Math.ceil((new Date(m.end_date).getTime() - Date.now()) / 86400000)) : null;

  return (
    <div onClick={() => onSelect?.(m.market_id)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem',
        borderRadius: 10, cursor: 'pointer',
        background: hov ? theme.card : 'transparent', transition: 'background 0.15s',
        animation: `fadeIn 0.3s ease ${Math.min(i * 0.04, 0.5)}s both`,
      }}>
      <button onClick={e => { e.stopPropagation(); onRemove(m.market_id); }} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0,
        color: theme.yellow, transition: 'color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.color = theme.red}
      onMouseLeave={e => e.currentTarget.style.color = theme.yellow}>
        <Star size={13} fill={theme.yellow} />
      </button>
      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: m.source === 'polymarket' ? theme.purple : theme.blue }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.question}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: '0.65rem', color: theme.textMuted }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><DollarSign size={10} />{fmtVol(m.volume_24h)} 24h</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Droplets size={10} />{fmtVol(m.liquidity || 0)}</span>
          {days !== null && <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: days < 3 ? theme.red : theme.textMuted }}><Clock size={10} />{days}d</span>}
          {m.category && <span style={{ opacity: 0.5 }}>{m.category}</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 52 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color, letterSpacing: '-0.02em' }}>
          {pct}<span style={{ fontSize: '0.6rem', fontWeight: 400 }}>¢</span>
        </div>
        <div style={{ fontSize: '0.55rem', color: theme.textMuted }}>YES</div>
      </div>
      <div style={{ width: 48, flexShrink: 0 }}>
        <div style={{ height: 4, borderRadius: 2, background: theme.border, overflow: 'hidden' }}>
          <div style={{ width: `${m.yes_price * 100}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.5s' }} />
        </div>
      </div>
    </div>
  );
};

function fmtVol(v: number): string {
  if (!v) return '$0';
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${v.toFixed(0)}`;
}
