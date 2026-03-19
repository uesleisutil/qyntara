import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { FavoritesContextType } from '../types/favorites';

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const useFavorites = (): FavoritesContextType => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

interface FavoritesProviderProps {
  children: ReactNode;
  userId?: string;
}

const MAX_FAVORITES = 50;
const STORAGE_KEY = 'dashboard_favorites';

export const FavoritesProvider: React.FC<FavoritesProviderProps> = ({ 
  children,
  userId 
}) => {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const loadFavorites = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setFavorites(parsed.tickers || []);
        }
      } catch (err) {
        console.error('Failed to load favorites:', err);
        setError('Failed to load favorites');
      }
    };

    loadFavorites();
  }, []);

  // Save favorites to localStorage whenever they change
  const saveFavorites = useCallback((newFavorites: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tickers: newFavorites,
        updatedAt: new Date().toISOString()
      }));
    } catch (err) {
      console.error('Failed to save favorites:', err);
      throw new Error('Failed to save favorites');
    }
  }, []);

  // TODO: Implement DynamoDB persistence when backend is ready
  const syncWithBackend = useCallback(async (newFavorites: string[]) => {
    if (!userId || !newFavorites) return;
    
    try {
      // Placeholder for DynamoDB sync
      // await fetch(`${API_BASE_URL}/api/user/favorites`, {
      //   method: 'PUT',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'x-api-key': API_KEY
      //   },
      //   body: JSON.stringify({ userId, favorites: newFavorites })
      // });
    } catch (err) {
      console.error('Failed to sync favorites with backend:', err);
    }
  }, [userId]);

  const isFavorite = useCallback((ticker: string): boolean => {
    return favorites.includes(ticker);
  }, [favorites]);

  const addFavorite = useCallback(async (ticker: string) => {
    if (favorites.length >= MAX_FAVORITES) {
      setError(`Maximum of ${MAX_FAVORITES} favorites reached`);
      throw new Error(`Maximum of ${MAX_FAVORITES} favorites reached`);
    }

    if (isFavorite(ticker)) {
      return; // Already a favorite
    }

    setLoading(true);
    setError(null);

    try {
      const newFavorites = [...favorites, ticker];
      setFavorites(newFavorites);
      saveFavorites(newFavorites);
      await syncWithBackend(newFavorites);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add favorite');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [favorites, isFavorite, saveFavorites, syncWithBackend]);

  const removeFavorite = useCallback(async (ticker: string) => {
    if (!isFavorite(ticker)) {
      return; // Not a favorite
    }

    setLoading(true);
    setError(null);

    try {
      const newFavorites = favorites.filter(t => t !== ticker);
      setFavorites(newFavorites);
      saveFavorites(newFavorites);
      await syncWithBackend(newFavorites);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove favorite');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [favorites, isFavorite, saveFavorites, syncWithBackend]);

  const toggleFavorite = useCallback(async (ticker: string) => {
    if (isFavorite(ticker)) {
      await removeFavorite(ticker);
    } else {
      await addFavorite(ticker);
    }
  }, [isFavorite, addFavorite, removeFavorite]);

  const clearFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setFavorites([]);
      saveFavorites([]);
      await syncWithBackend([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear favorites');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [saveFavorites, syncWithBackend]);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        isFavorite,
        toggleFavorite,
        addFavorite,
        removeFavorite,
        clearFavorites,
        favoriteCount: favorites.length,
        maxFavorites: MAX_FAVORITES,
        canAddMore: favorites.length < MAX_FAVORITES,
        loading,
        error
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export default FavoritesContext;
