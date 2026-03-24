import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { API_BASE_URL } from '../config';

interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'analyst' | 'viewer';
  plan?: 'free' | 'pro';
  planExpiresAt?: string;
  emailVerified?: boolean;
  canViewCosts?: boolean;
  freeTicker?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshPlan: () => Promise<void>;
  setFreeTicker: (ticker: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;
const AUTH_URL = `${API_BASE_URL}/auth`;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    const checkSession = async () => {
      try {
        const storedToken = localStorage.getItem('authToken');
        const storedExpiry = localStorage.getItem('sessionExpiry');
        if (storedToken && storedExpiry) {
          const expiry = parseInt(storedExpiry, 10);
          if (Date.now() < expiry) {
            const res = await fetch(`${AUTH_URL}/me`, {
              headers: { 'Authorization': `Bearer ${storedToken}` },
            });
            if (res.ok) {
              const data = await res.json();
              const freshUser = {
                id: data.userId, email: data.email, name: data.name,
                role: data.role || 'viewer', plan: data.plan || 'free',
                planExpiresAt: data.planExpiresAt || '',
                emailVerified: data.emailVerified ?? true,
                canViewCosts: data.canViewCosts ?? false,
                freeTicker: data.freeTicker || '',
              };
              setUser(freshUser);
              // Keep localStorage in sync so fallback is never stale
              localStorage.setItem('user', JSON.stringify(freshUser));
            } else { clearStorage(); }
          } else { clearStorage(); }
        }
      } catch {
        // Network error — use cached user but force plan to 'free' for safety
        // (plan will be corrected on next successful /auth/me call)
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            parsed.plan = 'free'; // Never trust cached plan on network failure
            setUser(parsed);
          } catch { clearStorage(); }
        }
      } finally { setIsLoading(false); }
    };
    checkSession();
  }, []);

  useEffect(() => {
    const handleActivity = () => setLastActivity(Date.now());
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, handleActivity));
    return () => events.forEach(e => window.removeEventListener(e, handleActivity));
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > SESSION_TIMEOUT) { clearStorage(); setUser(null); }
    }, 60000);
    return () => clearInterval(interval);
  }, [user, lastActivity]);

  // Periodic plan sync — polls /auth/me every 30s to catch admin plan changes
  // Also re-checks immediately when user returns to the tab
  useEffect(() => {
    if (!user) return;

    const syncPlan = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      try {
        const res = await fetch(`${AUTH_URL}/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const freshPlan = data.plan || 'free';
          const freshRole = data.role || 'viewer';
          const freshCanViewCosts = data.canViewCosts ?? false;
          const freshFreeTicker = data.freeTicker || '';
          setUser(prev => {
            if (!prev) return prev;
            if (prev.plan !== freshPlan || prev.role !== freshRole || prev.canViewCosts !== freshCanViewCosts || prev.freeTicker !== freshFreeTicker) {
              const updated = { ...prev, plan: freshPlan as 'free' | 'pro', role: freshRole as 'admin' | 'analyst' | 'viewer', planExpiresAt: data.planExpiresAt || '', canViewCosts: freshCanViewCosts, freeTicker: freshFreeTicker };
              localStorage.setItem('user', JSON.stringify(updated));
              return updated;
            }
            return prev;
          });
        }
      } catch { /* silent */ }
    };

    const planInterval = setInterval(syncPlan, 30000);

    // Re-check when user returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncPlan();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(planInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  const clearStorage = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('sessionExpiry');
  };

  const saveSession = (token: string, userData: User) => {
    const expiry = Date.now() + SESSION_TIMEOUT;
    localStorage.setItem('authToken', token);
    localStorage.setItem('sessionExpiry', expiry.toString());
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setLastActivity(Date.now());
  };

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${AUTH_URL}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Falha na autenticação');
    }
    const data = await res.json();
    saveSession(data.accessToken, {
      id: data.userId, email: data.email, name: data.name,
      role: data.role || 'viewer', plan: data.plan || 'free',
      emailVerified: data.emailVerified ?? true,
      canViewCosts: data.canViewCosts ?? false,
      freeTicker: data.freeTicker || '',
    });
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch(`${AUTH_URL}/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Falha no cadastro');
    }
    const data = await res.json();
    saveSession(data.accessToken, {
      id: data.userId, email: data.email, name: data.name,
      role: data.role || 'viewer', plan: data.plan || 'free',
      emailVerified: data.emailVerified ?? false,
      canViewCosts: data.canViewCosts ?? false,
      freeTicker: data.freeTicker || '',
    });
  }, []);

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const res = await fetch(`${AUTH_URL}/verify-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Código inválido');
    }
    const data = await res.json();
    if (data.accessToken) {
      const storedUser = localStorage.getItem('user');
      const currentUser = storedUser ? JSON.parse(storedUser) : {};
      saveSession(data.accessToken, { ...currentUser, emailVerified: true });
    }
    if (user) setUser({ ...user, emailVerified: true });
  }, [user]);

  const resendCode = useCallback(async (email: string) => {
    const res = await fetch(`${AUTH_URL}/resend-code`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Erro ao reenviar código');
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    const res = await fetch(`${AUTH_URL}/forgot-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Erro ao enviar código');
    }
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    const res = await fetch(`${AUTH_URL}/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Erro ao redefinir senha');
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('Não autenticado');
    const res = await fetch(`${AUTH_URL}/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Erro ao alterar senha');
    }
  }, []);

  const logout = useCallback(async () => { clearStorage(); setUser(null); }, []);

  const refreshSession = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('No token');
    const res = await fetch(`${AUTH_URL}/me`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { await logout(); throw new Error('Session expired'); }
    setLastActivity(Date.now());
  }, [logout]);

  const refreshPlan = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('No token');
    const res = await fetch(`${AUTH_URL}/me`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to check plan');
    const data = await res.json();
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, plan: (data.plan || 'free') as 'free' | 'pro', planExpiresAt: data.planExpiresAt || '', freeTicker: data.freeTicker || '' };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setFreeTicker = useCallback(async (ticker: string) => {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('Não autenticado');
    const res = await fetch(`${AUTH_URL}/free-ticker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ticker }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Erro ao salvar ticker');
    }
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, freeTicker: ticker };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, isLoading,
      login, register, verifyEmail, resendCode, forgotPassword, resetPassword, changePassword, logout, refreshSession, refreshPlan, setFreeTicker,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
