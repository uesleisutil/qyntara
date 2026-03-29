import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { theme, cardStyle, badgeStyle } from '../styles';
import { Search, TrendingUp, TrendingDown, ExternalLink, BarChart3, Clock, DollarSign, Droplets } from 'lucide-react';

interface Market {
  market_id: string; source: string; question: string; yes_price: number;
  no_price: number; volume: number; volume_24h: number; category: string; end_date: string;
}

export const MarketsPage: React.FC<{ dark: boolean; onSelectMarket?: (id: string) => void }> = ({ dark, onSelectMarket }) => {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const params = new URLSearchParams({ limit: '50', ...(source && { source }), ...(search && { search }) });
  const { data, loading } = useApi<{ markets: Market[]; total: number }>(`/markets?${params}`, 30000);
  const markets = data?.markets || [];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={20} color={theme.accent} /> Markets
          </h2>
          <p style={{ fontSize: '0.75rem', color: theme.textSecondary, marginTop: 2 }}>
            {data?.total || 0} active markets across Polymarket & Kalshi
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220,
          padding: '0.55rem 0.85rem', borderRadius: 10, border: `1px solid ${theme.border}`,
          background: theme.card, transition: 'border-color 0.2s',
        }}>
          <Search size={15} color={theme.textMuted} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search markets..." style={{
              border: 'none', outline: 'none', background: 'transparent',
              color: theme.text, fontSize: '0.85rem', width: '100%',
              fontFamily: 'inherit',
            }} />
        </div>
        {[
          { key: '', label: 'All', emoji: '' },
          { key: 'polymarket', label: 'Polymarket', emoji: '🟣' },
          { key: 'kalshi', label: 'Kalshi', emoji: '🔵' },
        ].map(s => (
          <button key={s.key} onClick={() => setSource(s.key)} style={{
            padding: '0.55rem 1rem', borderRadius: 10,
            border: `1px solid ${source === s.key ? theme.accentBorder : theme.border}`,
            background: source === s.key ? theme.accentBg : theme.card,
            color: source === s.key ? theme.accent : theme.textSecondary,
            cursor: 'pointer', fontSize: '0.8rem', fontWeight: source === s.key ? 600 : 400,
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && !markets.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{
              height: 72, borderRadius: 12, border: `1px solid ${theme.border}`,
              background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`,
              backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
            }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {markets.map((m, i) => (
            <MarketCard key={`${m.source}-${m.market_id}`} market={m} index={i} onSelect={onSelectMarket} />
          ))}
          {markets.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: theme.textMuted }}>
              No markets found. Try a different search.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MarketCard: React.FC<{ market: Market; index: number; onSelect?: (id: string) => void }> = ({ market: m, index, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const pct = (m.yes_price * 100).toFixed(1);
  const isHigh = m.yes_price > 0.6;
  const isLow = m.yes_price < 0.4;
  const priceColor = isHigh ? theme.green : isLow ? theme.red : theme.yellow;

  const daysLeft = m.end_date ? Math.max(0, Math.ceil((new Date(m.end_date).getTime() - Date.now()) / 86400000)) : null;

  return (
    <div
      onClick={() => onSelect?.(m.market_id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '0.85rem 1.1rem',
        background: hovered ? theme.cardHover : theme.card,
        border: `1px solid ${hovered ? theme.borderHover : theme.border}`,
        borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease',
        animation: `fadeIn 0.3s ease ${index * 0.03}s both`,
      }}
    >
      {/* Source badge */}
      <div style={{
        width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.95rem', flexShrink: 0,
        background: m.source === 'polymarket' ? theme.purpleBg : theme.blueBg,
      }}>
        {m.source === 'polymarket' ? '🟣' : '🔵'}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.35,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: hovered ? theme.text : theme.text,
        }}>
          {m.question}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: '0.7rem', color: theme.textMuted }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <DollarSign size={11} /> {fmtVol(m.volume_24h)} 24h
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Droplets size={11} /> {fmtVol(m.liquidity || 0)}
          </span>
          {daysLeft !== null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={11} /> {daysLeft}d left
            </span>
          )}
          {m.category && (
            <span style={badgeStyle(theme.textMuted, `${theme.textMuted}15`)}>{m.category.slice(0, 20)}</span>
          )}
        </div>
      </div>

      {/* Price */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: priceColor, letterSpacing: '-0.02em' }}>
          {pct}<span style={{ fontSize: '0.7rem', fontWeight: 500 }}>¢</span>
        </div>
        <div style={{ fontSize: '0.6rem', color: theme.textMuted, fontWeight: 500 }}>YES</div>
      </div>

      {/* Price bar */}
      <div style={{ width: 50, flexShrink: 0 }}>
        <div style={{ height: 4, borderRadius: 2, background: `${theme.border}`, overflow: 'hidden' }}>
          <div style={{
            width: `${m.yes_price * 100}%`, height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${priceColor}80, ${priceColor})`,
            transition: 'width 0.5s ease',
          }} />
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
