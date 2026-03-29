import React, { useState, useEffect, useRef } from 'react';
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
import { SupportPage } from './pages/SupportPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthModal } from './components/AuthModal';
import { EmailVerifyBanner } from './components/EmailVerifyBanner';
import { ToastContainer } from './components/ToastContainer';
import { useToastStore } from './store/toastStore';
import { useWebSocket } from './hooks/useWebSocket';
import { useApi, apiFetch } from './hooks/useApi';
import { useAuthStore } from './store/authStore';
import { API_BASE } from './config';
import { theme, globalStyles, badgeStyle } from './styles';
import {
  BarChart3, Zap, GitCompare, TrendingUp, Lock, User, LogOut,
  Users, Brain, Server, Briefcase, CreditCard, Bell,
  Settings, ChevronDown, Trash2, MessageCircle,
} from 'lucide-react';

type Tab = 'landing' | 'markets' | 'market_detail' | 'signals' | 'arbitrage' | 'portfolio' | 'billing' | 'support' | 'settings' | 'admin_users' | 'admin_models' | 'admin_infra';

const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('landing');
  const [showAuth, setShowAuth] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const dark = true;
  const { connected } = useWebSocket();
  const { data: stats } = useApi<any>('/stats', 60000);
  const { data: notifs } = useApi<any>(useAuthStore.getState().user ? '/notifications?unread=true&limit=5' : '', 30000);
  const { user, logout } = useAuthStore();
  const tabsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  const unreadCount = notifs?.unread_count || 0;
  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || '';

  const switchTab = (newTab: Tab) => {
    if (newTab === tab) return;
    setTransitioning(true);
    setTimeout(() => { setTab(newTab); setTransitioning(false); }, 150);
  };

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Handle email verification from URL
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token && window.location.pathname === '/verify') {
      fetch(`${API_BASE}/auth/verify-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).then(r => r.json()).then(data => {
        setVerifyMsg(data.ok ? 'Email verificado!' : (data.detail || 'Falha na verificação'));
        useAuthStore.getState().refreshAuth();
        window.history.replaceState({}, '', '/');
      }).catch(() => setVerifyMsg('Falha na verificação.'));
    }
    const billingStatus = params.get('billing_status');
    if (billingStatus === 'success') {
      useToastStore.getState().addToast('Assinatura ativada! Atualizando plano...', 'success', 6000);
      const refreshTier = (attempts: number) => {
        useAuthStore.getState().refreshAuth().then(() => {
          const u = useAuthStore.getState().user;
          if (u && u.tier === 'free' && attempts > 0) setTimeout(() => refreshTier(attempts - 1), 3000);
          else if (u && u.tier !== 'free') useToastStore.getState().addToast(`Plano ${u.tier.toUpperCase()} ativado!`, 'success');
        });
      };
      refreshTier(5);
      window.history.replaceState({}, '', '/');
    } else if (billingStatus === 'cancelled') {
      useToastStore.getState().addToast('Checkout cancelado.', 'info');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  useEffect(() => {
    if (!tabsRef.current) return;
    const activeBtn = tabsRef.current.querySelector(`[data-tab="${tab}"]`) as HTMLElement;
    if (activeBtn) setIndicatorStyle({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth });
  }, [tab]);

  useEffect(() => {
    if (tab === 'landing' && user) switchTab('markets');
  }, [tab, user]);

  // Landing page
  if (tab === 'landing' && !user) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <style>{globalStyles}</style>
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.75rem 1.5rem', borderBottom: `1px solid ${theme.border}`,
          background: `${theme.bgAlt}cc`, backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={22} color={theme.accent} />
            <span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Qyntara</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => switchTab('markets')} className="landing-btn-secondary" style={{
              padding: '0.45rem 0.9rem', borderRadius: 8, border: `1px solid ${theme.border}`,
              background: 'transparent', color: theme.textSecondary, cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.2s',
            }}>Explorar</button>
            <button onClick={() => setShowAuth(true)} style={{
              padding: '0.45rem 0.9rem', borderRadius: 8, border: 'none',
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
              color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
            }}>Entrar</button>
          </div>
        </header>
        <LandingPage onGetStarted={() => setShowAuth(true)} />
        {showAuth && <AuthModal onClose={() => { setShowAuth(false); if (useAuthStore.getState().user) switchTab('markets'); }} dark={dark} />}
        <ToastContainer />
      </div>
    );
  }

  // User tabs
  const userTabs: { key: Tab; label: string; icon: React.ReactNode; pro?: boolean }[] = [
    { key: 'markets', label: 'Mercados', icon: <BarChart3 size={15} /> },
    { key: 'signals', label: 'Sinais IA', icon: <Zap size={15} />, pro: true },
    { key: 'arbitrage', label: 'Arbitragem', icon: <GitCompare size={15} />, pro: true },
    { key: 'portfolio', label: 'Portfólio', icon: <Briefcase size={15} /> },
    { key: 'billing', label: 'Planos', icon: <CreditCard size={15} /> },
    { key: 'support', label: 'Suporte', icon: <MessageCircle size={15} /> },
  ];

  // Admin tabs
  const adminTabs: { key: Tab; label: string; icon: React.ReactNode }[] = user?.is_admin ? [
    { key: 'admin_users', label: 'Usuários', icon: <Users size={15} /> },
    { key: 'admin_models', label: 'Modelos', icon: <Brain size={15} /> },
    { key: 'admin_infra', label: 'Infra', icon: <Server size={15} /> },
  ] : [];

  const tierBadge = user?.tier && user.tier !== 'free' ? (
    <span style={badgeStyle(
      user.tier === 'quant' ? theme.yellow : theme.accent,
      user.tier === 'quant' ? theme.yellowBg : theme.accentBg,
    )}>{user.tier.toUpperCase()}</span>
  ) : null;

  const openMarket = (id: string) => { setSelectedMarket(id); switchTab('market_detail'); };

  const menuItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '0.55rem 0.85rem', border: 'none', background: 'transparent',
    color: theme.textSecondary, fontSize: '0.8rem', cursor: 'pointer',
    transition: 'all 0.15s', textAlign: 'left', borderRadius: 6,
  };

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{globalStyles}</style>

      {/* ═══ Header ═══ */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.65rem 1.25rem', borderBottom: `1px solid ${theme.border}`,
        background: `${theme.bgAlt}cc`, backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => switchTab('markets')}>
          <TrendingUp size={20} color={theme.accent} />
          <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Qyntara</span>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Live indicator — only show when connected */}
          {connected && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', color: theme.green }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.green, boxShadow: `0 0 8px ${theme.green}60` }} />
              Ao vivo
            </span>
          )}

          {stats?.total_markets && (
            <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>{stats.total_markets} mercados</span>
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Notifications */}
              {unreadCount > 0 && (
                <span style={{ position: 'relative', cursor: 'pointer' }}>
                  <Bell size={16} color={theme.textSecondary} />
                  <span style={{
                    position: 'absolute', top: -5, right: -5, width: 15, height: 15,
                    borderRadius: '50%', background: theme.red, color: '#fff',
                    fontSize: '0.48rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                  }}>{unreadCount}</span>
                </span>
              )}

              {/* User dropdown */}
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button onClick={() => setShowUserMenu(!showUserMenu)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0.65rem',
                  borderRadius: 10, border: `1px solid ${showUserMenu ? theme.accentBorder : theme.border}`,
                  background: showUserMenu ? theme.accentBg : 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!showUserMenu) e.currentTarget.style.borderColor = theme.borderHover; }}
                onMouseLeave={e => { if (!showUserMenu) e.currentTarget.style.borderColor = theme.border; }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: theme.accentBg, color: theme.accent, fontSize: '0.7rem', fontWeight: 700,
                  }}>{firstName.charAt(0).toUpperCase()}</div>
                  <span style={{ fontSize: '0.78rem', color: theme.text, fontWeight: 500 }}>{firstName}</span>
                  {tierBadge}
                  <ChevronDown size={13} color={theme.textMuted} style={{
                    transition: 'transform 0.2s',
                    transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0)',
                  }} />
                </button>

                {/* Dropdown menu */}
                {showUserMenu && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    width: 220, background: theme.card, border: `1px solid ${theme.border}`,
                    borderRadius: 12, padding: '0.4rem',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                    animation: 'fadeIn 0.15s ease', zIndex: 200,
                  }}>
                    {/* User info */}
                    <div style={{ padding: '0.6rem 0.85rem', borderBottom: `1px solid ${theme.border}`, marginBottom: 4 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{user.name || firstName}</div>
                      <div style={{ fontSize: '0.68rem', color: theme.textMuted }}>{user.email}</div>
                    </div>

                    <button onClick={() => { switchTab('billing'); setShowUserMenu(false); }}
                      style={menuItemStyle}
                      onMouseEnter={e => { e.currentTarget.style.background = theme.cardHover; e.currentTarget.style.color = theme.text; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.textSecondary; }}>
                      <CreditCard size={14} /> Meu plano
                    </button>

                    <button onClick={() => { switchTab('settings'); setShowUserMenu(false); }}
                      style={menuItemStyle}
                      onMouseEnter={e => { e.currentTarget.style.background = theme.cardHover; e.currentTarget.style.color = theme.text; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.textSecondary; }}>
                      <Settings size={14} /> Configurações
                    </button>

                    <div style={{ height: 1, background: theme.border, margin: '4px 0' }} />

                    <button onClick={() => { logout(); switchTab('landing'); setShowUserMenu(false); }}
                      style={menuItemStyle}
                      onMouseEnter={e => { e.currentTarget.style.background = theme.cardHover; e.currentTarget.style.color = theme.text; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.textSecondary; }}>
                      <LogOut size={14} /> Sair
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.85rem',
              borderRadius: 8, border: `1px solid ${theme.border}`, background: 'transparent',
              color: theme.text, cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.2s',
            }}>
              <User size={14} /> Entrar
            </button>
          )}
        </div>
      </header>

      <EmailVerifyBanner dark={dark} />

      {verifyMsg && (
        <div style={{
          padding: '0.5rem 1.5rem', fontSize: '0.8rem', textAlign: 'center',
          background: verifyMsg.includes('verificado') ? theme.greenBg : theme.redBg,
          color: verifyMsg.includes('verificado') ? theme.green : theme.red,
          borderBottom: `1px solid ${verifyMsg.includes('verificado') ? `${theme.green}30` : `${theme.red}30`}`,
          cursor: 'pointer',
        }} onClick={() => setVerifyMsg(null)}>
          {verifyMsg} (clique para fechar)
        </div>
      )}

      {/* ═══ Tabs ═══ */}
      <nav ref={tabsRef} style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: '0.4rem 1rem', overflowX: 'auto',
        borderBottom: `1px solid ${theme.border}`, background: `${theme.bgAlt}cc`,
        backdropFilter: 'blur(8px)', position: 'relative',
        scrollbarWidth: 'none' as any,
      }}>
        {/* User tabs */}
        {userTabs.map(t => (
          <button key={t.key} data-tab={t.key} onClick={() => switchTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '0.5rem 0.75rem',
            borderRadius: 8, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            background: tab === t.key ? theme.accentBg : 'transparent',
            color: tab === t.key ? theme.accent : theme.textSecondary,
            fontSize: '0.78rem', fontWeight: tab === t.key ? 600 : 400,
            transition: 'all 0.2s', position: 'relative', zIndex: 1,
          }}
          onMouseEnter={e => { if (tab !== t.key) e.currentTarget.style.color = theme.text; }}
          onMouseLeave={e => { if (tab !== t.key) e.currentTarget.style.color = theme.textSecondary; }}>
            {t.icon} {t.label}
            {t.pro && <Lock size={9} style={{ opacity: 0.25 }} />}
          </button>
        ))}

        {/* Admin separator + tabs */}
        {adminTabs.length > 0 && (
          <>
            <div style={{
              width: 1, height: 20, background: theme.border, margin: '0 6px', flexShrink: 0,
            }} />
            <span style={{
              fontSize: '0.58rem', color: theme.red, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', padding: '0 4px', flexShrink: 0, opacity: 0.6,
            }}>ADMIN</span>
            {adminTabs.map(t => (
              <button key={t.key} data-tab={t.key} onClick={() => switchTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '0.5rem 0.75rem',
                borderRadius: 8, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                background: tab === t.key ? `${theme.red}12` : 'transparent',
                color: tab === t.key ? theme.red : theme.textMuted,
                fontSize: '0.78rem', fontWeight: tab === t.key ? 600 : 400,
                transition: 'all 0.2s', position: 'relative', zIndex: 1,
              }}
              onMouseEnter={e => { if (tab !== t.key) e.currentTarget.style.color = theme.textSecondary; }}
              onMouseLeave={e => { if (tab !== t.key) e.currentTarget.style.color = theme.textMuted; }}>
                {t.icon} {t.label}
              </button>
            ))}
          </>
        )}

        {/* Sliding indicator */}
        <div style={{
          position: 'absolute', bottom: 0, height: 2,
          background: tab.startsWith('admin_')
            ? `linear-gradient(90deg, ${theme.red}, ${theme.yellow})`
            : `linear-gradient(90deg, ${theme.accent}, ${theme.purple})`,
          borderRadius: 2,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          ...indicatorStyle,
        }} />
      </nav>

      {/* ═══ Content ═══ */}
      <main style={{
        padding: 'clamp(0.75rem, 2vw, 1.25rem) clamp(0.75rem, 3vw, 1.5rem)',
        maxWidth: 1400, margin: '0 auto',
        opacity: transitioning ? 0 : 1,
        transform: transitioning ? 'translateY(6px)' : 'translateY(0)',
        transition: 'opacity 0.15s ease, transform 0.15s ease',
      }}>
        {tab === 'markets' && <MarketsPage dark={dark} onSelectMarket={openMarket} />}
        {tab === 'market_detail' && selectedMarket && <MarketDetailPage marketId={selectedMarket} dark={dark} onBack={() => switchTab('markets')} />}
        {tab === 'signals' && <SignalsPage dark={dark} onAuthRequired={() => setShowAuth(true)} />}
        {tab === 'arbitrage' && <ArbitragePage dark={dark} onAuthRequired={() => setShowAuth(true)} />}
        {tab === 'portfolio' && <PortfolioPage dark={dark} onAuthRequired={() => setShowAuth(true)} />}
        {tab === 'billing' && <BillingPage dark={dark} />}
        {tab === 'support' && <SupportPage dark={dark} onAuthRequired={() => setShowAuth(true)} />}
        {tab === 'settings' && <SettingsPage dark={dark} onSwitchTab={(t) => switchTab(t as Tab)} />}
        {tab === 'admin_users' && user?.is_admin && <AdminUsersPage dark={dark} />}
        {tab === 'admin_models' && user?.is_admin && <AdminModelsPage dark={dark} />}
        {tab === 'admin_infra' && user?.is_admin && <AdminInfraPage dark={dark} />}
      </main>

      {showAuth && <AuthModal onClose={() => { setShowAuth(false); if (useAuthStore.getState().user && tab === 'landing') switchTab('markets'); }} dark={dark} />}
      <ToastContainer />
    </div>
  );
};

export default App;
