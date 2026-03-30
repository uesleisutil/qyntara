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
import { SettingsPage } from './pages/SettingsPage';
import { AuthModal } from './components/AuthModal';
import { EmailVerifyBanner } from './components/EmailVerifyBanner';
import { ToastContainer } from './components/ToastContainer';
import { useToastStore } from './store/toastStore';
import { useWebSocket } from './hooks/useWebSocket';
import { useApi } from './hooks/useApi';
import { useAuthStore } from './store/authStore';
import { API_BASE } from './config';
import { theme, globalStyles } from './styles';
import {
  BarChart3, Zap, GitCompare, Lock, User, LogOut,
  Users, Brain, Server, Briefcase, CreditCard, Bell,
  Settings, ChevronDown,
} from 'lucide-react';

type Tab = 'landing' | 'markets' | 'market_detail' | 'signals' | 'arbitrage' | 'portfolio' | 'billing' | 'settings' | 'admin_users' | 'admin_models' | 'admin_infra';

const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('landing');
  const [showAuth, setShowAuth] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const dark = true;
  const { connected } = useWebSocket();
  const { data: stats } = useApi<any>('/stats', 60000);
  const { data: notifs } = useApi<any>(useAuthStore.getState().user ? '/notifications?unread=true&limit=5' : '', 30000);
  const { user, logout } = useAuthStore();
  const menuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifs?.unread_count || 0;
  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || '';

  const go = (t: Tab) => {
    if (t === tab) return;
    setTransitioning(true);
    setTimeout(() => { setTab(t); setTransitioning(false); }, 120);
  };

  // Close menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // URL handlers
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const token = p.get('token');
    if (token && window.location.pathname === '/verify') {
      fetch(`${API_BASE}/auth/verify-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
        .then(r => r.json()).then(d => {
          setVerifyMsg(d.ok ? 'Email verificado!' : (d.detail || 'Falha'));
          useAuthStore.getState().refreshAuth();
          window.history.replaceState({}, '', '/');
        }).catch(() => setVerifyMsg('Falha na verificação.'));
    }
    const bs = p.get('billing_status');
    if (bs === 'success') {
      useToastStore.getState().addToast('Assinatura ativada!', 'success', 5000);
      const retry = (n: number) => {
        useAuthStore.getState().refreshAuth().then(() => {
          const u = useAuthStore.getState().user;
          if (u && u.tier === 'free' && n > 0) setTimeout(() => retry(n - 1), 3000);
        });
      };
      retry(5);
      window.history.replaceState({}, '', '/');
    } else if (bs === 'cancelled') {
      useToastStore.getState().addToast('Checkout cancelado.', 'info');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  useEffect(() => { if (tab === 'landing' && user) go('markets'); }, [tab, user]);

  // ── Landing ──
  if (tab === 'landing' && !user) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <style>{globalStyles}</style>
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.7rem clamp(1rem, 4vw, 2rem)', borderBottom: `1px solid ${theme.border}`,
          position: 'sticky', top: 0, zIndex: 100, background: theme.bg,
        }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '-0.03em' }}>Qyntara</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => go('markets')} style={{
              padding: '0.4rem 0.85rem', borderRadius: 8, border: `1px solid ${theme.border}`,
              background: 'transparent', color: theme.textMuted, cursor: 'pointer', fontSize: '0.75rem',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = theme.textMuted}
            onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>Explorar</button>
            <button onClick={() => setShowAuth(true)} style={{
              padding: '0.4rem 0.85rem', borderRadius: 8, border: 'none',
              background: theme.text, color: theme.bg, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = theme.accent; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = theme.text; e.currentTarget.style.color = theme.bg; }}>Entrar</button>
          </div>
        </header>
        <LandingPage onGetStarted={() => setShowAuth(true)} />
        {showAuth && <AuthModal onClose={() => { setShowAuth(false); if (useAuthStore.getState().user) go('markets'); }} dark={dark} />}
        <ToastContainer />
      </div>
    );
  }

  const openMarket = (id: string) => { setSelectedMarket(id); go('market_detail'); };

  // Tab definitions
  const userTabs: { key: Tab; label: string; icon: React.ReactNode; pro?: boolean }[] = [
    { key: 'markets', label: 'Mercados', icon: <BarChart3 size={14} /> },
    { key: 'signals', label: 'Sinais', icon: <Zap size={14} />, pro: true },
    { key: 'arbitrage', label: 'Arbitragem', icon: <GitCompare size={14} />, pro: true },
    { key: 'portfolio', label: 'Portfólio', icon: <Briefcase size={14} /> },
    { key: 'billing', label: 'Planos', icon: <CreditCard size={14} /> },
  ];
  const adminTabs: { key: Tab; label: string; icon: React.ReactNode }[] = user?.is_admin ? [
    { key: 'admin_users', label: 'Usuários', icon: <Users size={14} /> },
    { key: 'admin_models', label: 'Modelos', icon: <Brain size={14} /> },
    { key: 'admin_infra', label: 'Infra', icon: <Server size={14} /> },
  ] : [];

  const tierColor = user?.tier === 'quant' ? theme.yellow : user?.tier === 'pro' ? theme.accent : '';

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{globalStyles}</style>

      {/* ── Header ── */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 clamp(1rem, 3vw, 1.5rem)', height: 48,
        borderBottom: `1px solid ${theme.border}`, position: 'sticky', top: 0, zIndex: 100,
        background: theme.bg,
      }}>
        <span onClick={() => go('markets')} style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '-0.03em', cursor: 'pointer' }}>Qyntara</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {connected && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', color: theme.green }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: theme.green }} />
              Ao vivo
            </span>
          )}
          {stats?.total_markets && <span style={{ fontSize: '0.62rem', color: theme.textMuted }}>{stats.total_markets} mkts</span>}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {unreadCount > 0 && (
                <span style={{ position: 'relative', cursor: 'pointer' }}>
                  <Bell size={15} color={theme.textMuted} />
                  <span style={{
                    position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%',
                    background: theme.red, color: '#fff', fontSize: '0.45rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{unreadCount}</span>
                </span>
              )}

              {/* User menu */}
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button onClick={() => setShowMenu(!showMenu)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '0.3rem 0.55rem',
                  borderRadius: 8, border: `1px solid ${showMenu ? theme.borderHover : theme.border}`,
                  background: 'transparent', cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = theme.borderHover}
                onMouseLeave={e => { if (!showMenu) e.currentTarget.style.borderColor = theme.border; }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: tierColor ? `${tierColor}15` : theme.accentBg,
                    color: tierColor || theme.accent, fontSize: '0.62rem', fontWeight: 700,
                  }}>{firstName.charAt(0).toUpperCase()}</div>
                  <span style={{ fontSize: '0.72rem', color: theme.text, fontWeight: 500 }}>{firstName}</span>
                  {user.tier !== 'free' && (
                    <span style={{
                      fontSize: '0.5rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                      background: `${tierColor}15`, color: tierColor,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>{user.tier}</span>
                  )}
                  <ChevronDown size={11} color={theme.textMuted} style={{ transform: showMenu ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
                </button>

                {showMenu && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', right: 0, width: 200,
                    background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10,
                    padding: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)', animation: 'fadeIn 0.12s ease', zIndex: 200,
                  }}>
                    <div style={{ padding: '0.5rem 0.75rem', borderBottom: `1px solid ${theme.border}`, marginBottom: 2 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{user.name || firstName}</div>
                      <div style={{ fontSize: '0.62rem', color: theme.textMuted }}>{user.email}</div>
                    </div>
                    {[
                      { label: 'Meu plano', icon: <CreditCard size={13} />, action: () => go('billing') },
                      { label: 'Configurações', icon: <Settings size={13} />, action: () => go('settings') },
                    ].map(item => (
                      <button key={item.label} onClick={() => { item.action(); setShowMenu(false); }} style={{
                        display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '0.45rem 0.75rem',
                        border: 'none', background: 'transparent', color: theme.textSecondary, fontSize: '0.75rem',
                        cursor: 'pointer', borderRadius: 6, transition: 'all 0.1s', textAlign: 'left',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = theme.cardHover; e.currentTarget.style.color = theme.text; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.textSecondary; }}>
                        {item.icon} {item.label}
                      </button>
                    ))}
                    <div style={{ height: 1, background: theme.border, margin: '2px 0' }} />
                    <button onClick={() => { logout(); go('landing'); setShowMenu(false); }} style={{
                      display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '0.45rem 0.75rem',
                      border: 'none', background: 'transparent', color: theme.textMuted, fontSize: '0.75rem',
                      cursor: 'pointer', borderRadius: 6, transition: 'all 0.1s', textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = theme.cardHover; e.currentTarget.style.color = theme.text; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.textMuted; }}>
                      <LogOut size={13} /> Sair
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '0.35rem 0.75rem',
              borderRadius: 8, border: `1px solid ${theme.border}`, background: 'transparent',
              color: theme.text, cursor: 'pointer', fontSize: '0.72rem',
            }}>
              <User size={13} /> Entrar
            </button>
          )}
        </div>
      </header>

      <EmailVerifyBanner dark={dark} />
      {verifyMsg && (
        <div onClick={() => setVerifyMsg(null)} style={{
          padding: '0.4rem 1rem', fontSize: '0.75rem', textAlign: 'center', cursor: 'pointer',
          background: verifyMsg.includes('verificado') ? `${theme.green}08` : `${theme.red}08`,
          color: verifyMsg.includes('verificado') ? theme.green : theme.red,
          borderBottom: `1px solid ${verifyMsg.includes('verificado') ? `${theme.green}20` : `${theme.red}20`}`,
        }}>{verifyMsg}</div>
      )}

      {/* ── Tabs ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', gap: 1, padding: '0 clamp(0.75rem, 3vw, 1.25rem)',
        height: 40, overflowX: 'auto', borderBottom: `1px solid ${theme.border}`,
        scrollbarWidth: 'none' as any,
      }}>
        {userTabs.map(t => (
          <button key={t.key} onClick={() => go(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '0 0.65rem', height: '100%',
            border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative',
            background: 'transparent',
            color: tab === t.key ? theme.text : theme.textMuted,
            fontSize: '0.75rem', fontWeight: tab === t.key ? 600 : 400,
            transition: 'color 0.15s',
            borderBottom: tab === t.key ? `2px solid ${theme.accent}` : '2px solid transparent',
          }}
          onMouseEnter={e => { if (tab !== t.key) e.currentTarget.style.color = theme.textSecondary; }}
          onMouseLeave={e => { if (tab !== t.key) e.currentTarget.style.color = theme.textMuted; }}>
            {t.icon} {t.label}
            {t.pro && <Lock size={8} style={{ opacity: 0.2 }} />}
          </button>
        ))}

        {adminTabs.length > 0 && (
          <>
            <div style={{ width: 1, height: 16, background: theme.border, margin: '0 8px', flexShrink: 0 }} />
            <span style={{ fontSize: '0.52rem', color: theme.red, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.5, flexShrink: 0 }}>ADMIN</span>
            {adminTabs.map(t => (
              <button key={t.key} onClick={() => go(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '0 0.65rem', height: '100%',
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', background: 'transparent',
                color: tab === t.key ? theme.red : theme.textMuted,
                fontSize: '0.75rem', fontWeight: tab === t.key ? 600 : 400,
                transition: 'color 0.15s',
                borderBottom: tab === t.key ? `2px solid ${theme.red}` : '2px solid transparent',
              }}
              onMouseEnter={e => { if (tab !== t.key) e.currentTarget.style.color = theme.textSecondary; }}
              onMouseLeave={e => { if (tab !== t.key) e.currentTarget.style.color = theme.textMuted; }}>
                {t.icon} {t.label}
              </button>
            ))}
          </>
        )}
      </nav>

      {/* ── Content ── */}
      <main style={{
        padding: 'clamp(1rem, 3vw, 1.5rem) clamp(1rem, 4vw, 2rem)',
        maxWidth: 1300, margin: '0 auto',
        opacity: transitioning ? 0 : 1,
        transform: transitioning ? 'translateY(4px)' : 'translateY(0)',
        transition: 'opacity 0.12s ease, transform 0.12s ease',
      }}>
        {tab === 'markets' && <MarketsPage dark={dark} onSelectMarket={openMarket} />}
        {tab === 'market_detail' && selectedMarket && <MarketDetailPage marketId={selectedMarket} dark={dark} onBack={() => go('markets')} />}
        {tab === 'signals' && <SignalsPage dark={dark} onAuthRequired={() => setShowAuth(true)} />}
        {tab === 'arbitrage' && <ArbitragePage dark={dark} onAuthRequired={() => setShowAuth(true)} />}
        {tab === 'portfolio' && <PortfolioPage dark={dark} onAuthRequired={() => setShowAuth(true)} />}
        {tab === 'billing' && <BillingPage dark={dark} />}
        {tab === 'settings' && <SettingsPage dark={dark} onSwitchTab={(t) => go(t as Tab)} />}
        {tab === 'admin_users' && user?.is_admin && <AdminUsersPage dark={dark} />}
        {tab === 'admin_models' && user?.is_admin && <AdminModelsPage dark={dark} />}
        {tab === 'admin_infra' && user?.is_admin && <AdminInfraPage dark={dark} />}
      </main>

      {showAuth && <AuthModal onClose={() => { setShowAuth(false); if (useAuthStore.getState().user && tab === 'landing') go('markets'); }} dark={dark} />}
      <ToastContainer />
    </div>
  );
};

export default App;
