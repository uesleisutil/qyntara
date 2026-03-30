import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { theme } from '../styles';
import { Search, Clock, DollarSign, Droplets, Lock } from 'lucide-react';

interface Market {
  market_id: string; source: string; question: string; yes_price: number;
  no_price: number; volume: number; volume_24h: number; category: string; end_date: string;
  liquidity?: number;
}

export const MarketsPage: React.FC<{ dark?: boolean; onSelectMarket?: (id: string) => void }> = ({ onSelectMarket }) => {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const user = useAuthStore(s => s.user);
  const isGuest = !user;
  const params = new URLSearchParams({ limit: '60', ...(source && { source }), ...(category && { category }), ...(search && { search }) });
  const { data, loading } = useApi<{ markets: Market[]; total: number }>(`/markets?${params}`, 30000);
  const { data: statsData } = useApi<any>('/stats', 60000);
  const markets = data?.markets || [];
  const categories = statsData?.categories as Record<string, number> | undefined;

  return (
    <div>
      {/* Guest banner */}
      {isGuest && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '0.7rem 1rem',
          borderRadius: 10, marginBottom: '1.25rem', border: `1px solid ${theme.border}`, background: theme.card,
        }}>
          <Lock size={14} color={theme.textMuted} />
          <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
            Crie uma conta grátis para ver preços e volumes completos.
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Mercados</h2>
        <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>{data?.total || 0} mercados ativos · Polymarket & Kalshi</p>
      </div>

      {/* Search + source filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200,
          padding: '0.55rem 0.85rem', borderRadius: 10,
          border: `1px solid ${searchFocused ? theme.accentBorder : theme.border}`,
          background: theme.card, transition: 'border-color 0.2s',
        }}>
          <Search size={14} color={searchFocused ? theme.accent : theme.textMuted} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Buscar mercados..." style={{
              border: 'none', outline: 'none', background: 'transparent',
              color: theme.text, fontSize: '0.82rem', width: '100%', fontFamily: 'inherit',
            }} />
        </div>
        {['', 'polymarket', 'kalshi'].map(s => (
          <button key={s} onClick={() => setSource(s)} style={{
            padding: '0.55rem 0.9rem', borderRadius: 10,
            border: `1px solid ${source === s ? theme.accentBorder : theme.border}`,
            background: source === s ? theme.accentBg : 'transparent',
            color: source === s ? theme.accent : theme.textMuted,
            cursor: 'pointer', fontSize: '0.75rem', fontWeight: source === s ? 600 : 400,
            transition: 'all 0.15s',
          }}>{s === '' ? 'Todos' : s === 'polymarket' ? '🟣 Poly' : '🔵 Kalshi'}</button>
        ))}
      </div>

      {/* Category pills */}
      {categories && Object.keys(categories).length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button onClick={() => setCategory('')} style={{
            padding: '0.35rem 0.75rem', borderRadius: 100, fontSize: '0.68rem',
            fontWeight: category === '' ? 600 : 400,
            border: `1px solid ${category === '' ? theme.accentBorder : theme.border}`,
            background: category === '' ? theme.accentBg : 'transparent',
            color: category === '' ? theme.accent : theme.textMuted,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>Todas</button>
          {Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
            <button key={cat} onClick={() => setCategory(cat)} style={{
              padding: '0.35rem 0.75rem', borderRadius: 100, fontSize: '0.68rem',
              fontWeight: category === cat ? 600 : 400,
              border: `1px solid ${category === cat ? theme.accentBorder : theme.border}`,
              background: category === cat ? theme.accentBg : 'transparent',
              color: category === cat ? theme.accent : theme.textMuted,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>{cat} <span style={{ opacity: 0.4 }}>{count}</span></button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && !markets.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{
              height: 68, borderRadius: 12, border: `1px solid ${theme.border}`,
              background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`,
              backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.08}s`,
            }} />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: theme.textMuted }}>
          <p style={{ fontSize: '0.9rem', marginBottom: 4 }}>Nenhum mercado encontrado.</p>
          <p style={{ fontSize: '0.72rem' }}>Tente outra busca ou mude o filtro.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {markets.map((m, i) => (
            <MarketRow key={`${m.source}-${m.market_id}`} m={m} i={i} onSelect={onSelectMarket} isGuest={isGuest} />
          ))}
        </div>
      )}
    </div>
  );
};

const MarketRow: React.FC<{ m: Market; i: number; onSelect?: (id: string) => void; isGuest: boolean }> = ({ m, i, onSelect, isGuest }) => {
  const [hov, setHov] = useState(false);
  const pct = (m.yes_price * 100).toFixed(1);
  const color = m.yes_price > 0.6 ? theme.green : m.yes_price < 0.4 ? theme.red : theme.yellow;
  const days = m.end_date ? Math.max(0, Math.ceil((new Date(m.end_date).getTime() - Date.now()) / 86400000)) : null;

  return (
    <div
      onClick={() => onSelect?.(m.market_id)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem',
        borderRadius: 10, cursor: 'pointer',
        background: hov ? theme.card : 'transparent',
        transition: 'background 0.15s',
        animation: `fadeIn 0.3s ease ${Math.min(i * 0.03, 0.5)}s both`,
      }}
    >
      {/* Source dot */}
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: m.source === 'polymarket' ? theme.purple : theme.blue,
      }} />

      {/* Question */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.82rem', fontWeight: 500, lineHeight: 1.35,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{m.question}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: '0.65rem', color: theme.textMuted }}>
          {isGuest ? (
            <span aria-hidden style={{ filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none' }} onCopy={e => e.preventDefault()}>$███ · $███</span>
          ) : (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><DollarSign size={10} />{fmtVol(m.volume_24h)} 24h</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Droplets size={10} />{fmtVol(m.liquidity || 0)}</span>
            </>
          )}
          {days !== null && <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: days < 3 ? theme.red : theme.textMuted }}><Clock size={10} />{days}d</span>}
          {m.category && <span style={{ opacity: 0.5 }}>{m.category}</span>}
        </div>
      </div>

      {/* Price */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 52 }}>
        {isGuest ? (
          <span aria-hidden style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', fontSize: '1rem', fontWeight: 700 }} onCopy={e => e.preventDefault()}>██</span>
        ) : (
          <div style={{ fontSize: '1rem', fontWeight: 700, color, letterSpacing: '-0.02em' }}>
            {pct}<span style={{ fontSize: '0.6rem', fontWeight: 400 }}>¢</span>
          </div>
        )}
        <div style={{ fontSize: '0.55rem', color: theme.textMuted }}>YES</div>
      </div>

      {/* Mini bar */}
      <div style={{ width: 48, flexShrink: 0, filter: isGuest ? 'blur(4px)' : 'none' }}>
        <div style={{ height: 4, borderRadius: 2, background: theme.border, overflow: 'hidden' }}>
          <div style={{ width: `${m.yes_price * 100}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.5s' }} />
        </div>
      </div>
    </div>
  );
};

function fmtVol(v: number): string {
  if (!v) return '$0';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
