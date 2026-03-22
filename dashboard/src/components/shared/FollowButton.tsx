import React, { useState, useEffect, useCallback } from 'react';
import { Star, StarOff } from 'lucide-react';
import { useIsPro } from './ProGate';

const STORAGE_KEY = 'b3tr_followed_positions';

export interface FollowedPosition {
  ticker: string;
  entryPrice: number;
  followedAt: string;
  predPrice: number;
  score: number;
}

export function getFollowedPositions(): FollowedPosition[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

export function setFollowedPositions(positions: FollowedPosition[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

export function isFollowing(ticker: string): boolean {
  return getFollowedPositions().some(p => p.ticker === ticker);
}

export function toggleFollow(ticker: string, entryPrice: number, predPrice: number, score: number): boolean {
  const positions = getFollowedPositions();
  const idx = positions.findIndex(p => p.ticker === ticker);
  if (idx >= 0) {
    positions.splice(idx, 1);
    setFollowedPositions(positions);
    return false;
  } else {
    positions.push({ ticker, entryPrice, followedAt: new Date().toISOString(), predPrice, score });
    setFollowedPositions(positions);
    return true;
  }
}

interface FollowButtonProps {
  ticker: string;
  entryPrice: number;
  predPrice: number;
  score: number;
  darkMode?: boolean;
  compact?: boolean;
}

const FollowButton: React.FC<FollowButtonProps> = ({ ticker, entryPrice, predPrice, score, darkMode, compact }) => {
  const isPro = useIsPro();
  const [following, setFollowing] = useState(false);

  useEffect(() => { setFollowing(isFollowing(ticker)); }, [ticker]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPro) return;
    const result = toggleFollow(ticker, entryPrice, predPrice, score);
    setFollowing(result);
    window.dispatchEvent(new Event('b3tr_follow_changed'));
  }, [ticker, entryPrice, predPrice, score, isPro]);

  if (!isPro) return null;

  if (compact) {
    return (
      <button onClick={handleClick} title={following ? 'Deixar de seguir' : 'Estou seguindo'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          color: following ? '#f59e0b' : (darkMode ? '#475569' : '#cbd5e1'),
          transition: 'color 0.2s', WebkitAppearance: 'none' as any,
        }}
      >
        {following ? <Star size={14} fill="#f59e0b" /> : <StarOff size={14} />}
      </button>
    );
  }

  return (
    <button onClick={handleClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.3rem 0.6rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600,
      background: following ? 'rgba(245,158,11,0.15)' : 'transparent',
      border: `1px solid ${following ? 'rgba(245,158,11,0.4)' : (darkMode ? '#334155' : '#e2e8f0')}`,
      color: following ? '#f59e0b' : (darkMode ? '#94a3b8' : '#64748b'),
      cursor: 'pointer', transition: 'all 0.2s', WebkitAppearance: 'none' as any,
    }}>
      {following ? <Star size={12} fill="#f59e0b" /> : <Star size={12} />}
      {following ? 'Seguindo' : 'Seguir'}
    </button>
  );
};

export default FollowButton;
