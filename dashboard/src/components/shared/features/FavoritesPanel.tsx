import React, { useState } from 'react';
import { Star, X, Trash2 } from 'lucide-react';
import { useFavorites } from '../../../contexts/FavoritesContext';

export interface FavoritesPanelProps {
  onClose: () => void;
  darkMode?: boolean;
}

export const FavoritesPanel: React.FC<FavoritesPanelProps> = ({
  onClose,
  darkMode = false
}) => {
  const { favorites, removeFavorite, clearFavorites, favoriteCount, maxFavorites } = useFavorites();
  const [removing, setRemoving] = useState<string | null>(null);

  const theme = {
    bg: darkMode ? '#0c0a1a' : '#f8fafc',
    cardBg: darkMode ? '#1a1836' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#9895b0' : '#64748b',
    border: darkMode ? '#2a2745' : '#e2e8f0',
    hover: darkMode ? '#2a2745' : '#f1f5f9'
  };

  const handleRemove = async (ticker: string) => {
    setRemoving(ticker);
    try {
      await removeFavorite(ticker);
    } catch (err) {
      console.error('Failed to remove favorite:', err);
    } finally {
      setRemoving(null);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to remove all favorites?')) {
      try {
        await clearFavorites();
      } catch (err) {
        console.error('Failed to clear favorites:', err);
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        maxWidth: '400px',
        backgroundColor: theme.cardBg,
        boxShadow: '-4px 0 6px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1.5rem',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Star size={24} fill="#fbbf24" color="#fbbf24" />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: theme.text }}>
              Favorite Tickers
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: theme.textSecondary }}>
              {favoriteCount} of {maxFavorites} favorites
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem',
            cursor: 'pointer',
            borderRadius: '0.375rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.hover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label="Close favorites panel"
        >
          <X size={20} color={theme.textSecondary} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '1.5rem' }}>
        {favorites.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: theme.textSecondary
            }}
          >
            <Star size={48} color={theme.textSecondary} style={{ margin: '0 auto 1rem' }} />
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: '500' }}>
              No favorites yet
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
              Click the star icon next to any ticker to add it to your favorites
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleClearAll}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
              >
                <Trash2 size={16} />
                Clear All
              </button>
            </div>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {favorites.map((ticker) => (
                <li
                  key={ticker}
                  style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '0.5rem',
                    backgroundColor: theme.bg,
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: `1px solid ${theme.border}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Star size={16} fill="#fbbf24" color="#fbbf24" />
                    <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: theme.text }}>
                      {ticker}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemove(ticker)}
                    disabled={removing === ticker}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0.375rem',
                      cursor: removing === ticker ? 'wait' : 'pointer',
                      borderRadius: '0.375rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.2s',
                      opacity: removing === ticker ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (removing !== ticker) {
                        e.currentTarget.style.backgroundColor = '#fee2e2';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    aria-label={`Remove ${ticker} from favorites`}
                  >
                    <X size={16} color="#dc2626" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

export default FavoritesPanel;
