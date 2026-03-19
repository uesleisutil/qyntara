export interface FavoriteTickerData {
  ticker: string;
  addedAt: string;
}

export interface FavoritesState {
  tickers: string[];
  count: number;
  maxFavorites: number;
}

export interface FavoritesContextType {
  favorites: string[];
  isFavorite: (ticker: string) => boolean;
  toggleFavorite: (ticker: string) => Promise<void>;
  addFavorite: (ticker: string) => Promise<void>;
  removeFavorite: (ticker: string) => Promise<void>;
  clearFavorites: () => Promise<void>;
  favoriteCount: number;
  maxFavorites: number;
  canAddMore: boolean;
  loading: boolean;
  error: string | null;
}
