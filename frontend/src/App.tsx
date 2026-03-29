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
import { theme, globalStyles, badgeStyle } from './styles';
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
        setVerifyMsg(data.ok ? 'Email verificado! Agora você pode usar todos os recursos.' : (data.detail || 'Falha na verificação'));
        // Refresh user data
        useAuthStore.getState().refreshAuth();
        window.history.replaceState({}, '', '/');
      }).catch(() => setVerifyMsg('Falha na verificação. Tente novamente.'));
    }
  }, []);

  // Se não logado e na landing, mostrar landing page
  if (tab === 'landing' && !user) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <style>{globalStyles}</style>
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.75rem 1.5rem', borderBottom: `1px solid ${theme.border}`, background: theme.bgAlt,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={22} color={theme.accent} />
            <span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Qyntara</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setTab('markets'); }} style={{
              padding: '0.45rem 0.9rem', borderRadius: 8, border: `1px solid ${theme.border}`,
              background: 'transparent', color: theme.textSecondary, cursor: 'pointer', fontSize: '0.78rem',
            }}>Explorar</button>
            <button onClick={() => setShowAuth(true)} style={{
              padding: '0.45rem 0.9rem', borderRadius: 8, border: 'none',
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
              color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
            }}>Entrar</button>
          </div>
        </header>
        <LandingPage onGetStarted={() => setShowAuth(true)} />
        {showAuth && <AuthModal onClose={() => { setShowAuth(false); if (useAuthStore.getState().user) setTab('markets'); }} dark={dark} />}
      </div>
    );
  }

  // Se acabou de logar e tá na landing, ir pra markets
  if (tab === 'landing' && user) setTab('markets');

  const tabs: { key: Tab; label: string; icon: React.ReactNode; pro?: boolean; admin?: boolean }[] = [
    { key: 'markets', label: 'Mercados', icon: <BarChart3 size={16} /> },
    { key: 'signals', label: 'Sinais IA', icon: <Zap size={16} />, pro: true },
    { key: 'arbitrage', label: 'Arbitragem', icon: <GitCompare size={16} />, pro: true },
    { key: 'portfolio', label: 'Portfólio', icon: <Briefcase size={16} /> },
    { key: 'billing', label: 'Planos', icon: <CreditCard size={16} /> },
    ...(user?.is_admin ? [
      { key: 'admin_users' as Tab, label: 'Usuários', icon: <Users size={16} />, admin: true },
      { key: 'admin_models' as Tab, label: 'Modelos', icon: <Brain size={16} />, admin: true },
      { key: 'admin_infra' as Tab, label: 'Infra', icon: <Server size={16} />, admin: true },
    ] : []),
  ];

  const tierBadge = user?.tier && user.tier !== 'free' ? (
    <span style={badgeStyle(
      user.tier === 'quant' ? theme.yellow : theme.accent,
      user.tier === 'quant' ? theme.yellowBg : theme.accentBg,
    )}>{user.tier}</span>
  ) : null;

  const openMarket = (id: string) => { setSelectedMarket(id); setTab('market_detail'); };

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{globalStyles}</style>

      {/* Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.75rem 1.5rem', borderBottom: `1px solid ${theme.border}`,
        background: theme.bgAlt, backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setTab('markets')}>
          <TrendingUp size={22} color={theme.accent} />
          <span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Qyntara</span>
          <span style={badgeStyle(theme.accent, theme.accentBg)}>BETA</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: theme.textSecondary }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? theme.green : theme.red,
              boxShadow: connected ? `0 0 8px ${theme.green}60` : undefined, animation: connected ? 'glow 2s infinite' : undefined }} />
            {connected ? 'Ao vivo' : '...'}
          </span>
          {stats && <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>{stats.total_markets || 0} mkts</span>}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {unreadCount > 0 && (
                <span style={{ position: 'relative', cursor: 'pointer' }}>
                  <Bell size={16} color={theme.textSecondary} />
                  <span style={{
                    position: 'absolute', top: -5, right: -5, width: 16, height: 16,
                    borderRadius: '50%', background: theme.red, color: '#fff',
                    fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                  }}>{unreadCount}</span>
                </span>
              )}
              {tierBadge}
              <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>{user.email.split('@')[0]}</span>
              <button onClick={() => { logout(); setTab('landing'); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted,
                transition: 'color 0.15s',
              }} aria-label="Logout"
              onMouseEnter={e => e.currentTarget.style.color = theme.red}
              onMouseLeave={e => e.currentTarget.style.color = theme.textMuted}>
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 0.9rem',
              borderRadius: 8, border: `1px solid ${theme.border}`, background: 'transparent',
              color: theme.text, cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.accentBorder; e.currentTarget.style.color = theme.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.text; }}>
              <User size={14} /> Entrar
            </button>
          )}
        </div>
      </header>

      {/* Email verification banner */}
      <EmailVerifyBanner dark={dark} />

      {/* Verification toast */}
      {verifyMsg && (
        <div style={{
          padding: '0.6rem 1.5rem', fontSize: '0.82rem', textAlign: 'center',
          background: verifyMsg.includes('verificado') ? '#10b98115' : '#ef444415',
          color: verifyMsg.includes('verificado') ? '#10b981' : '#ef4444',
          borderBottom: `1px solid ${verifyMsg.includes('verificado') ? '#10b98130' : '#ef444430'}`,
          cursor: 'pointer',
        }} onClick={() => setVerifyMsg(null)}>
          {verifyMsg} (clique para fechar)
        </div>
      )}

      {/* Tabs */}
      <nav style={{
        display: 'flex', gap: 2, padding: '0.5rem 1.5rem', overflowX: 'auto',
        borderBottom: `1px solid ${theme.border}`, background: theme.bgAlt,
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0.55rem 0.85rem',
            borderRadius: 8, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            background: tab === t.key ? theme.accentBg : 'transparent',
            color: tab === t.key ? theme.accent : theme.textSecondary,
            fontSize: '0.8rem', fontWeight: tab === t.key ? 600 : 400,
            transition: 'all 0.15s',
            borderBottom: tab === t.key ? `2px solid ${theme.accent}` : '2px solid transparent',
          }}
          onMouseEnter={e => { if (tab !== t.key) e.currentTarget.style.color = theme.text; }}
          onMouseLeave={e => { if (tab !== t.key) e.currentTarget.style.color = theme.textSecondary; }}>
            {t.icon} {t.label}
            {t.pro && !t.admin && <Lock size={10} style={{ opacity: 0.3 }} />}
            {t.admin && <Shield size={10} color={theme.red} style={{ opacity: 0.5 }} />}
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
