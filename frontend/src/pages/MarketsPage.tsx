import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { BarChart3, Search, Filter, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';

interface Market {
  market_id: string;
  source: string;
  question: string;
  yes_price: number;
  no_price: number;
  volume: number;
  volume_24h: number;
  category: string;
  end_date: string;
}

export const MarketsPage: React.FC<{ dark: boolean; onSelectMarket?: (id: string) => void }> = ({ dark, onSelectMarket }) => {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<string>('');
  const params = new URLSearchParams({ limit: '50', ...(source && { source }), ...(search && { search }) });
  const { data, loading } = useApi<{ markets: Market[]; total: number }>(`/markets?${params}`, 30000);

  const card = dark ? '#12141c' : '#fff';
  const border = dark ? '#1e2130' : '#e2e8f0';
  const textSec = dark ? '#8892a4' : '#64748b';

  const markets = data?.markets || [];

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200,
          padding: '0.5rem 0.75rem', borderRadius: 8, border: `1px solid ${border}`,
          background: card,
        }}>
          <Search size={14} color={textSec} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search markets..."
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              color: dark ? '#e2e8f0' : '#1a202c', fontSize: '0.82rem', width: '100%',
            }}
          />
        </div>
        {['', 'polymarket', 'kalshi'].map(s => (
          <button key={s} onClick={() => setSource(s)} style={{
            padding: '0.5rem 0.75rem', borderRadius: 8, border: `1px solid ${border}`,
            background: source === s ? '#6366f118' : card,
            color: source === s ? '#6366f1' : textSec,
            cursor: 'pointer', fontSize: '0.78rem', fontWeight: source === s ? 600 : 400,
          }}>
            {s || 'All'} {s === 'polymarket' ? '🟣' : s === 'kalshi' ? '🔵' : ''}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div style={{ fontSize: '0.72rem', color: textSec, marginBottom: '0.75rem' }}>
        {data?.total || 0} markets found
      </div>

      {/* Market list */}
      {loading && !markets.length ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: textSec }}>Loading markets...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {markets.map(m => (
            <MarketCard key={`${m.source}-${m.market_id}`} market={m} dark={dark} onSelect={onSelectMarket} />
          ))}
        </div>
      )}
    </div>
  );
};

const MarketCard: React.FC<{ market: Market; dark: boolean; onSelect?: (id: string) => void }> = ({ market: m, dark, onSelect }) => {
  const card = dark ? '#12141c' : '#fff';
  const border = dark ? '#1e2130' : '#e2e8f0';
  const textSec = dark ? '#8892a4' : '#64748b';
  const pct = (m.yes_price * 100).toFixed(1);
  const isHigh = m.yes_price > 0.6;
  const isLow = m.yes_price < 0.4;
  const priceColor = isHigh ? '#10b981' : isLow ? '#ef4444' : '#f59e0b';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem',
      background: card, border: `1px solid ${border}`, borderRadius: 10,
      transition: 'border-color 0.15s', cursor: 'pointer',
    }}
    onClick={() => onSelect?.(m.market_id)}
    onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f140')}
    onMouseLeave={e => (e.currentTarget.style.borderColor = border)}
    >
      {/* Source badge */}
      <span style={{
        fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4, fontWeight: 600,
        background: m.source === 'polymarket' ? '#8b5cf615' : '#3b82f615',
        color: m.source === 'polymarket' ? '#8b5cf6' : '#3b82f6',
        flexShrink: 0,
      }}>
        {m.source === 'polymarket' ? 'POLY' : 'KALSHI'}
      </span>

      {/* Question */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 500, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.question}
        </div>
        <div style={{ fontSize: '0.68rem', color: textSec, marginTop: 2 }}>
          {m.category || 'General'} · Vol: ${fmtVol(m.volume_24h)} 24h
        </div>
      </div>

      {/* Price */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: priceColor }}>
          {pct}%
        </div>
        <div style={{ fontSize: '0.62rem', color: textSec }}>YES</div>
      </div>

      {/* Price bar */}
      <div style={{ width: 60, height: 6, borderRadius: 3, background: `${border}`, flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ width: `${m.yes_price * 100}%`, height: '100%', borderRadius: 3, background: priceColor }} />
      </div>
    </div>
  );
};

function fmtVol(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}
