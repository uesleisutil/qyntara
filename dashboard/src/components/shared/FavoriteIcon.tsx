import React from 'react';
import { Star } from 'lucide-react';
import { useFavorites } from '../../contexts/FavoritesContext';

export interface FavoriteIconProps {
  ticker: string;
  size?: number;
  className?: string;
  showTooltip?: boolean;
}

export const FavoriteIcon: React.FC<FavoriteIconProps> = ({
  ticker,
  size = 18,
  className = '',
  showTooltip = true
}) => {
  const { isFavorite, toggleFavorite, canAddMore, loading } = useFavorites();
  const favorite = isFavorite(ticker);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!favorite && !canAddMore) {
      alert('Maximum of 50 favorites reached. Please remove some favorites first.');
      return;
    }

    try {
      await toggleFavorite(ticker);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e as any);
    }
  };

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={loading}
      className={className}
      title={showTooltip ? (favorite ? 'Remove from favorites' : 'Add to favorites') : undefined}
      aria-label={favorite ? `Remove ${ticker} from favorites` : `Add ${ticker} to favorites`}
      style={{
        background: 'none',
        border: 'none',
        padding: '0.25rem',
        cursor: loading ? 'wait' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '0.375rem',
        transition: 'all 0.2s',
        opacity: loading ? 0.5 : 1
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.transform = 'scale(1.1)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <Star
        size={size}
        fill={favorite ? '#e0b85c' : 'none'}
        color={favorite ? '#e0b85c' : '#8fa89c'}
        strokeWidth={2}
      />
    </button>
  );
};

export default FavoriteIcon;
