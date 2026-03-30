import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { theme, badgeStyle } from '../styles';
import { Search, BarChart3, Clock, DollarSign, Droplets, Flame, Lock } from 'lucide-react';

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
  const params = new URLSearchParams({
    limit: '50',
    ...(source && { source }),
    ...(category && { category }),
    ...(search && { search }),
  });
  const { data, loading } = useApi<{ markets: Market[]; total: number }>(`/markets?${params}`, 30000);
  const { data: statsData } = useApi<any>('/stats', 60000);
  const markets = data?.markets || [];
  const categories = statsData?.categories as Record<string, number> | undefined;

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Guest banner */}
      {isGuest && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '0.75rem 1rem', borderRadius: 12, marginBottom: '1rem',
          background: `linear-gradient(135deg, ${theme.accentBg}, ${theme.purpleBg})`,
          border: `1px solid ${theme.accentBorder}`,
          animation: 'fadeIn 0.5s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={15} color={theme.accent} />
            <span style={{ fontSize: '0.78rem', color: theme.textSecondary }}>
              Crie uma conta grátis para ver preços, volumes e dados completos dos mercados.
            </span>
          </div>
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.02em' }}>
            <BarChart3 size={20} color={theme.accent} /> Mercados
          </h2>
          <p style={{ fontSize: '0.75rem', color: theme.textSecondary, marginTop: 4 }}>
            {data?.total || 0} mercados ativos · Polymarket & Kalshi em tempo real
          </p>
        </div>
        {data?.total && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 8, background: theme.greenBg, border: `1px solid ${theme.green}20`,
            animation: 'fadeIn 0.5s ease 0.3s both',
          }}>
            <Flame size={13} color={theme.green} />
            <span style={{ fontSize: '0.7rem', color: theme.green, fontWeight: 600 }}>
              {data.total} ao vivo
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220,
          padding: '0.6rem 0.9rem', borderRadius: 12,
          border: `1px solid ${searchFocused ? theme.accentBorder : theme.border}`,
          background: theme.card,
          transition: 'all 0.3s ease',
          boxShadow: searchFocused ? `0 0 0 3px ${theme.accent}12` : 'none',
        }}>
          <Search size={15} color={searchFocused ? theme.accent : theme.textMuted} style={{ transition: 'color 0.2s' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar mercados..." style={{
              border: 'none', outline: 'none', background: 'transparent',
              color: theme.text, fontSize: '0.85rem', width: '100%',
              fontFamily: 'inherit',
            }} />
        </div>
        {[
          { key: '', label: 'Todos', emoji: '' },
          { key: 'polymarket', label: 'Polymarket', emoji: '🟣' },
          { key: 'kalshi', label: 'Kalshi', emoji: '🔵' },
        ].map(s => (
          <button key={s.key} onClick={() => setSource(s.key)} style={{
            padding: '0.6rem 1.1rem', borderRadius: 12,
            border: `1px solid ${source === s.key ? theme.accentBorder : theme.border}`,
            background: source === s.key ? theme.accentBg : theme.card,
            color: source === s.key ? theme.accent : theme.textSecondary,
            cursor: 'pointer', fontSize: '0.8rem', fontWeight: source === s.key ? 600 : 400,
            transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 5,
          }}
          onMouseEnter={e => { if (source !== s.key) e.currentTarget.style.borderColor = theme.borderHover; }}
          onMouseLeave={e => { if (source !== s.key) e.currentTarget.style.borderColor = theme.border; }}>
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      {/* Category filters */}
      {categories && Object.keys(categories).length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button onClick={() => setCategory('')} style={{
            padding: '0.4rem 0.85rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: category === '' ? 600 : 400,
            border: `1px solid ${category === '' ? theme.accentBorder : theme.border}`,
            background: category === '' ? theme.accentBg : 'transparent',
            color: category === '' ? theme.accent : theme.textSecondary,
            cursor: 'pointer', transition: 'all 0.2s',
          }}>Todas</button>
          {Object.entries(categories)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => (
              <button key={cat} onClick={() => setCategory(cat)} style={{
                padding: '0.4rem 0.85rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: category === cat ? 600 : 400,
                border: `1px solid ${category === cat ? theme.accentBorder : theme.border}`,
                background: category === cat ? theme.accentBg : 'transparent',
                color: category === cat ? theme.accent : theme.textSecondary,
                cursor: 'pointer', transition: 'all 0.2s',
              }}>
                {cat} <span style={{ opacity: 0.5 }}>{count}</span>
              </button>
            ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !markets.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} style={{
              height: 76, borderRadius: 14, border: `1px solid ${theme.border}`,
              background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`,
              backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.1}s`,
            }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {markets.map((m, i) => (
            <MarketCard key={`${m.source}-${m.market_id}`} market={m} index={i} onSelect={onSelectMarket} isGuest={isGuest} />
          ))}
          {markets.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '4rem 2rem', color: theme.textMuted,
              background: theme.card, borderRadius: 16, border: `1px solid ${theme.border}`,
            }}>
              <Search size={32} color={theme.textMuted} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontSize: '0.9rem', marginBottom: 4 }}>Nenhum mercado encontrado</p>
              <p style={{ fontSize: '0.75rem' }}>Tente outra busca ou mude o filtro.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MarketCard: React.FC<{ market: Market; index: number; onSelect?: (id: string) => void; isGuest: boolean }> = ({ market: m, index, onSelect, isGuest }) => {
  const [hovered, setHovered] = useState(false);
  const pct = (m.yes_price * 100).toFixed(1);
  const isHigh = m.yes_price > 0.6;
  const isLow = m.yes_price < 0.4;
  const priceColor = isHigh ? theme.green : isLow ? theme.red : theme.yellow;
  const daysLeft = m.end_date ? Math.max(0, Math.ceil((new Date(m.end_date).getTime() - Date.now()) / 86400000)) : null;
  const isHot = (m.volume_24h || 0) > 100000;

  return (
    <div
      onClick={() => onSelect?.(m.market_id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '0.9rem 1.15rem',
        background: hovered ? theme.cardHover : theme.card,
        border: `1px solid ${hovered ? theme.borderHover : theme.border}`,
        borderRadius: 14, cursor: 'pointer',
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: hovered ? `0 8px 24px rgba(0,0,0,0.2)` : 'none',
        animation: `fadeIn 0.35s ease ${Math.min(index * 0.04, 0.8)}s both`,
      }}
    >
      {/* Source badge */}
      <div style={{
        width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.95rem', flexShrink: 0,
        background: m.source === 'polymarket' ? theme.purpleBg : theme.blueBg,
        transition: 'transform 0.2s',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
      }}>
        {m.source === 'polymarket' ? '🟣' : '🔵'}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.35,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: theme.text,
          transition: 'color 0.2s',
        }}>
          {m.question}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, fontSize: '0.7rem', color: theme.textMuted, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <DollarSign size={11} /> {isGuest ? <span aria-hidden style={{ filter: 'blur(5px)', userSelect: 'none' }} onCopy={e => e.preventDefault()}>███</span> : <>{fmtVol(m.volume_24h)} 24h</>}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Droplets size={11} /> {isGuest ? <span aria-hidden style={{ filter: 'blur(5px)', userSelect: 'none' }} onCopy={e => e.preventDefault()}>███</span> : fmtVol(m.liquidity || 0)}
          </span>
          {daysLeft !== null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: daysLeft < 3 ? theme.red : theme.textMuted }}>
              <Clock size={11} /> {daysLeft}d restantes
            </span>
          )}
          {m.category && (
            <span style={badgeStyle(theme.textMuted, `${theme.textMuted}15`)}>{m.category.slice(0, 20)}</span>
          )}
          {isHot && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 3,
              ...badgeStyle(theme.yellow, theme.yellowBg),
              animation: 'pulse 2s infinite',
            }}>
              <Flame size={9} /> HOT
            </span>
          )}
        </div>
      </div>

      {/* Price */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontSize: '1.2rem', fontWeight: 800, color: priceColor, letterSpacing: '-0.02em',
          transition: 'transform 0.2s',
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
        }}>
          {isGuest ? (
            <span aria-hidden="true" style={{ filter: 'blur(7px)', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' }} onCopy={e => e.preventDefault()}>██</span>
          ) : (
            <>{pct}<span style={{ fontSize: '0.7rem', fontWeight: 500 }}>¢</span></>
          )}
        </div>
        <div style={{ fontSize: '0.6rem', color: theme.textMuted, fontWeight: 500 }}>YES</div>
      </div>

      {/* Price bar */}
      <div style={{ width: 56, flexShrink: 0, filter: isGuest ? 'blur(5px)' : 'none' }}>
        <div style={{ height: 5, borderRadius: 3, background: `${theme.border}`, overflow: 'hidden' }}>
          <div style={{
            width: `${m.yes_price * 100}%`, height: '100%', borderRadius: 3,
            background: `linear-gradient(90deg, ${priceColor}80, ${priceColor})`,
            transition: 'width 0.6s ease',
            boxShadow: hovered ? `0 0 6px ${priceColor}40` : 'none',
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
