import React, { useState, useCallback } from 'react';
import { Star } from 'lucide-react';

const WATCHLIST_KEY = 'b3tr_watchlist';

export const getWatchlist = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');
  } catch { return []; }
};

export const toggleWatchlist = (ticker: string): boolean => {
  const list = getWatchlist();
  const idx = list.indexOf(ticker);
  if (idx >= 0) { list.splice(idx, 1); } else { list.push(ticker); }
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  return idx < 0; // returns true if added
};

export const isInWatchlist = (ticker: string): boolean => getWatchlist().includes(ticker);

interface WatchlistButtonProps {
  ticker: string;
  darkMode?: boolean;
  size?: number;
}

export const WatchlistButton: React.FC<WatchlistButtonProps> = ({ ticker, darkMode = true, size = 15 }) => {
  const [active, setActive] = useState(isInWatchlist(ticker));

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const added = toggleWatchlist(ticker);
    setActive(added);
    // Dispatch custom event so other components can react
    window.dispatchEvent(new CustomEvent('watchlist-change', { detail: { ticker, added } }));
  }, [ticker]);

  return (
    <button
      onClick={handleClick}
      aria-label={active ? `Remover ${ticker} dos favoritos` : `Adicionar ${ticker} aos favoritos`}
      title={active ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 2,
        color: active ? '#d4a84b' : (darkMode ? '#3a5248' : '#b0c8bc'),
        transition: 'color 0.15s, transform 0.15s',
        display: 'inline-flex', alignItems: 'center', minHeight: 'auto',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#d4a84b80'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = darkMode ? '#3a5248' : '#b0c8bc'; }}
    >
      <Star size={size} fill={active ? '#d4a84b' : 'none'} />
    </button>
  );
};

export default WatchlistButton;
