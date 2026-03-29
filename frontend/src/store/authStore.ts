import { create } from 'zustand';
import { API_BASE } from '../config';

interface User {
  id: string;
  email: string;
  name: string;
  tier: 'free' | 'pro' | 'quant' | 'enterprise';
  is_admin?: boolean;
  email_verified?: boolean;
  created_at: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;

  register: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  clearError: () => void;
}

const REFRESH_KEY = 'predikt_refresh_token';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  loading: false,
  error: null,

  register: async (email, password, name) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(_parseError(data));
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      set({ user: data.user, accessToken: data.access_token, loading: false });
      _scheduleRefresh(data.expires_in);
    } catch (e: any) {
      set({ loading: false, error: e.message });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(_parseError(data));
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      set({ user: data.user, accessToken: data.access_token, loading: false });
      _scheduleRefresh(data.expires_in);
    } catch (e: any) {
      set({ loading: false, error: e.message });
    }
  },

  logout: () => {
    localStorage.removeItem(REFRESH_KEY);
    set({ user: null, accessToken: null });
  },

  refreshAuth: async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        localStorage.removeItem(REFRESH_KEY);
        set({ user: null, accessToken: null });
        return;
      }
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      set({ user: data.user, accessToken: data.access_token });
      _scheduleRefresh(data.expires_in);
    } catch {
      // Silent fail — user stays logged out
    }
  },

  clearError: () => set({ error: null }),
}));

// Auto-refresh token before expiry
let _refreshTimer: ReturnType<typeof setTimeout> | null = null;
function _scheduleRefresh(expiresInSeconds: number) {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  // Refresh 60s before expiry
  const ms = Math.max((expiresInSeconds - 60) * 1000, 10000);
  _refreshTimer = setTimeout(() => useAuthStore.getState().refreshAuth(), ms);
}

// Try to restore session on load
useAuthStore.getState().refreshAuth();

function _parseError(data: any): string {
  if (!data) return 'Erro desconhecido';
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    // Pydantic validation errors
    return data.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join('. ');
  }
  if (typeof data.detail === 'object') return JSON.stringify(data.detail);
  if (data.message) return data.message;
  return 'Erro desconhecido';
}
