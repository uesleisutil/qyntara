import React, { useState, useEffect } from 'react';
import { MarketsPage } from './pages/MarketsPage';
import { MarketDetailPage } from './pages/MarketDetailPage';
import { SignalsPage } from './pages/SignalsPage';
import { ArbitragePage } from './pages/ArbitragePage';
import { PortfolioPage } from './pages/PortfolioPage';
import { BillingPage } from './pages/BillingPage';
import { LandingPage } from './pages/LandingPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminModelsPage } from './pages/admin/AdminModelsPage';
import { AdminInfraPage } from './pages/admin/AdminInfraPage';
import { AuthModal } from './components/AuthModal';
import { EmailVerifyBanner } from './components/EmailVerifyBanner';
import { useWebSocket } from './hooks/useWebSocket';
import { useApi } from './hooks/useApi';
import { useAuthStore } from './store/authStore';
import { API_BASE } from './config';
import {
  BarChart3, Zap, GitCompare, TrendingUp, Lock, User, LogOut,
  Shield, Users, Brain, Server, Briefcase, CreditCard, Bell,
} from 'lucide-react';

type Tab = 'landing' | 'markets' | 'market_detail' | 'signals' | 'arbitrage' | 'portfolio' | 'billing' | 'admin_users' | 'admin_models' | 'admin_infra';

const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('landing');
  const [showAuth, setShowAuth] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const dark = true;
  const { connected } = useWebSocket();
  const { data: stats } = useApi<any>('/stats', 60000);
  const { data: notifs } = useApi<any>(useAuthStore.getState().user ? '/notifications?unread=true&limit=5' : '', 30000);
  const { user, logout } = useAuthStore();

  const bg = '#0a0b0f';
  const border = '#1e2130';
  const text = '#e2e8f0';
  const textSec = '#8892a4';
  const accent = '#6366f1';

  const unreadCount = notifs?.unread_count || 0;

  // Handle email verification from URL
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token && window.location.pathname === '/verify') {
      fetch(`${API_BASE}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).then(r => r.json()).then(data => {
        setVerifyMsg(data.ok ? 'Email verified! You can now use all features.' : (data.detail || 'Verification failed'));
        // Refresh user data
        useAuthStore.getState().refreshAuth();
        window.history.replaceState({}, '', '/');
      }).catch(() => setVerifyMsg('Verification failed. Try again.'));
    }
  }, []);

  // Se não logado e na landing, mostrar landing page
  if (tab === 'landing' && !user) {
    return (
      <div style={{ minHeight: '100vh', background: bg, color: text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <style>{`* { margin: 0; padding: 0; box-sizing: border-box; } body { background: ${bg}; }`}</style>
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.75rem 1.5rem', borderBottom: `1px solid ${border}`, background: '#0d0e14',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={22} color={accent} />
            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Predikt</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setTab('markets'); }} style={{
              padding: '0.4rem 0.8rem', borderRadius: 6, border: `1px solid ${border}`,
              background: 'transparent', color: textSec, cursor: 'pointer', fontSize: '0.78rem',
            }}>Explore</button>
            <button onClick={() => setShowAuth(true)} style={{
              padding: '0.4rem 0.8rem', borderRadius: 6, border: 'none',
              background: accent, color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
            }}>Sign in</button>
          </div>
        </header>
        <LandingPage dark={dark} onGetStarted={() => setShowAuth(true)} />
        {showAuth && <AuthModal onClose={() => { setShowAuth(false); if (useAuthStore.getState().user) setTab('markets'); }} dark={dark} />}
      </div>
    );
  }

  // Se acabou de logar e tá na landing, ir pra markets
  if (tab === 'landing' && user) setTab('markets');

  const tabs: { key: Tab; label: string; icon: React.ReactNode; pro?: boolean; admin?: boolean }[] = [
    { key: 'markets', label: 'Markets', icon: <BarChart3 size={16} /> },
    { key: 'signals', label: 'AI Signals', icon: <Zap size={16} />, pro: true },
    { key: 'arbitrage', label: 'Arbitrage', icon: <GitCompare size={16} />, pro: true },
    { key: 'portfolio', label: 'Portfolio', icon: <Briefcase size={16} /> },
    { key: 'billing', label: 'Plans', icon: <CreditCard size={16} /> },
    ...(user?.is_admin ? [
      { key: 'admin_users' as Tab, label: 'Users', icon: <Users size={16} />, admin: true },
      { key: 'admin_models' as Tab, label: 'Models', icon: <Brain size={16} />, admin: true },
      { key: 'admin_infra' as Tab, label: 'Infra', icon: <Server size={16} />, admin: true },
    ] : []),
  ];

  const tierBadge = user?.tier && user.tier !== 'free' ? (
    <span style={{
      fontSize: '0.58rem', padding: '2px 6px', borderRadius: 4, fontWeight: 700,
      background: user.tier === 'quant' ? '#f59e0b20' : '#6366f120',
      color: user.tier === 'quant' ? '#f59e0b' : accent, textTransform: 'uppercase',
    }}>{user.tier}</span>
  ) : null;

  const openMarket = (id: string) => { setSelectedMarket(id); setTab('market_detail'); };

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: ${bg}; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: ${border}; border-radius: 3px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.75rem 1.5rem', borderBottom: `1px solid ${border}`, background: '#0d0e14',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setTab('markets')}>
          <TrendingUp size={22} color={accent} />
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Predikt</span>
          <span style={{ fontSize: '0.58rem', padding: '2px 6px', borderRadius: 4, background: `${accent}18`, color: accent, fontWeight: 600 }}>BETA</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: textSec }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#10b981' : '#ef4444',
              boxShadow: connected ? '0 0 6px rgba(16,185,129,0.4)' : undefined }} />
            {connected ? 'Live' : '...'}
          </span>
          {stats && <span style={{ fontSize: '0.7rem', color: textSec }}>{stats.total_markets || 0} mkts</span>}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Notification bell */}
              {unreadCount > 0 && (
                <span style={{ position: 'relative', cursor: 'pointer' }}>
                  <Bell size={16} color={textSec} />
                  <span style={{
                    position: 'absolute', top: -4, right: -4, width: 14, height: 14,
                    borderRadius: '50%', background: '#ef4444', color: '#fff',
                    fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                  }}>{unreadCount}</span>
                </span>
              )}
              {tierBadge}
              <span style={{ fontSize: '0.75rem', color: textSec }}>{user.email.split('@')[0]}</span>
              <button onClick={() => { logout(); setTab('landing'); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: textSec,
              }} aria-label="Logout"><LogOut size={16} /></button>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.8rem',
              borderRadius: 6, border: `1px solid ${border}`, background: 'transparent',
              color: text, cursor: 'pointer', fontSize: '0.78rem',
            }}><User size={14} /> Sign in</button>
          )}
        </div>
      </header>

      {/* Email verification banner */}
      <EmailVerifyBanner dark={dark} />

      {/* Verification toast */}
      {verifyMsg && (
        <div style={{
          padding: '0.6rem 1.5rem', fontSize: '0.82rem', textAlign: 'center',
          background: verifyMsg.includes('verified') ? '#10b98115' : '#ef444415',
          color: verifyMsg.includes('verified') ? '#10b981' : '#ef4444',
          borderBottom: `1px solid ${verifyMsg.includes('verified') ? '#10b98130' : '#ef444430'}`,
          cursor: 'pointer',
        }} onClick={() => setVerifyMsg(null)}>
          {verifyMsg} (click to dismiss)
        </div>
      )}

      {/* Tabs */}
      <nav style={{
        display: 'flex', gap: 2, padding: '0.5rem 1.5rem', overflowX: 'auto',
        borderBottom: `1px solid ${border}`, background: '#0d0e14',
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 0.75rem',
            borderRadius: 6, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            background: tab === t.key ? `${accent}18` : 'transparent',
            color: tab === t.key ? accent : textSec,
            fontSize: '0.78rem', fontWeight: tab === t.key ? 600 : 400,
          }}>
            {t.icon} {t.label}
            {t.pro && !t.admin && <Lock size={10} style={{ opacity: 0.4 }} />}
            {t.admin && <Shield size={10} color="#ef4444" style={{ opacity: 0.6 }} />}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ padding: '1rem 1.5rem', maxWidth: 1400, margin: '0 auto' }}>
        {tab === 'markets' && <MarketsPage dark={dark} onSelectMarket={openMarket} />}
        {tab === 'market_detail' && selectedMarket && (
          <MarketDetailPage marketId={selectedMarket} dark={dark} onBack={() => setTab('markets')} />
        )}
        {tab === 'signals' && <SignalsPage dark={dark} onAuthRequired={() => setShowAuth(true)} />}
        {tab === 'arbitrage' && <ArbitragePage dark={dark} onAuthRequired={() => setShowAuth(true)} />}
        {tab === 'portfolio' && <PortfolioPage dark={dark} onAuthRequired={() => setShowAuth(true)} />}
        {tab === 'billing' && <BillingPage dark={dark} />}
        {tab === 'admin_users' && user?.is_admin && <AdminUsersPage dark={dark} />}
        {tab === 'admin_models' && user?.is_admin && <AdminModelsPage dark={dark} />}
        {tab === 'admin_infra' && user?.is_admin && <AdminInfraPage dark={dark} />}
      </main>

      {showAuth && <AuthModal onClose={() => { setShowAuth(false); if (useAuthStore.getState().user && tab === 'landing') setTab('markets'); }} dark={dark} />}
    </div>
  );
};

export default App;
