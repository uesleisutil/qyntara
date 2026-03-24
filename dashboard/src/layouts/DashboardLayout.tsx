import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  TrendingUp, LogOut, Menu, X, ChevronRight,
  BarChart3, Brain, TestTubes, Moon, Sun, User, Lock,
  Briefcase, LineChart, Crown, Bell, Phone, Bot, Users, MessageCircle,
  Settings, Mail, Shield, DollarSign, Database, CheckSquare, Activity, Layers,
  Landmark,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationCenter from '../components/shared/features/NotificationCenter';
import GuidedTour, { shouldShowTour } from '../components/shared/features/GuidedTour';
import OnboardingModal, { shouldShowOnboarding } from '../components/shared/features/OnboardingModal';
import { ProBadge } from '../components/shared/pro/ProGate';

const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    const isDark = saved ? JSON.parse(saved) : true;
    document.documentElement.classList.toggle('dark', isDark);
    return isDark;
  });

  const toggleDarkMode = () => {
    setDarkMode((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('darkMode', JSON.stringify(next));
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  };

  const isAdmin = user?.role === 'admin';
  const isPro = user?.plan === 'pro';

  const isAdminRoute = location.pathname.startsWith('/admin');

  React.useEffect(() => {
    if (isAdminRoute) return; // Never show onboarding/tour on admin pages
    if (shouldShowOnboarding()) {
      const timer = setTimeout(() => setShowOnboarding(true), 600);
      return () => clearTimeout(timer);
    } else if (!isPro && !user?.freeTicker) {
      // Free user who skipped onboarding without choosing a ticker — show it again
      const timer = setTimeout(() => setShowOnboarding(true), 600);
      return () => clearTimeout(timer);
    } else if (shouldShowTour()) {
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isPro, user?.freeTicker, isAdminRoute]);

  React.useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '1') navigate('/dashboard');
      else if (e.key === '2') navigate('/dashboard/recommendations');
      else if (e.key === '3') navigate('/dashboard/explainability');
      else if (e.key === '4') navigate('/dashboard/backtesting');
      else if (e.key === '5') navigate('/dashboard/performance');
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('[data-tour="search-bar"] input') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  /* ── Navigation items ── */
  const userMenuItems = [
    { path: '/dashboard', label: 'Meu Dashboard', icon: <TrendingUp size={18} />, tourId: 'nav-mydashboard', pro: false },
    { path: '/dashboard/recommendations', label: 'Recomendações', icon: <BarChart3 size={18} />, tourId: 'nav-recommendations', pro: false },
    { path: '/dashboard/explainability', label: 'Explicabilidade', icon: <Brain size={18} />, tourId: 'nav-explainability', pro: false },
    { path: '/dashboard/backtesting', label: 'Backtesting', icon: <TestTubes size={18} />, tourId: 'nav-backtesting', pro: false },
    { path: '/dashboard/performance', label: 'Performance', icon: <LineChart size={18} />, tourId: 'nav-performance', pro: false },
    { path: '/dashboard/carteiras', label: 'Carteiras', icon: <Briefcase size={18} />, tourId: 'nav-carteiras', pro: false },
  ];

  const adminModelItems = [
    { path: '/admin', label: 'Visão Geral', icon: <BarChart3 size={18} /> },
    { path: '/admin/performance', label: 'Performance', icon: <Activity size={18} /> },
    { path: '/admin/models', label: 'Modelos & Features', icon: <Layers size={18} /> },
    { path: '/admin/drift', label: 'Drift Detection', icon: <Brain size={18} /> },
    { path: '/admin/validation', label: 'Validação', icon: <CheckSquare size={18} /> },
  ];
  const adminInfraItems = [
    { path: '/admin/costs', label: 'Custos', icon: <DollarSign size={18} /> },
    { path: '/admin/data-quality', label: 'Qualidade de Dados', icon: <Database size={18} /> },
    { path: '/admin/notifications', label: 'Notificações', icon: <Bell size={18} /> },
  ];
  const adminMgmtItems = [
    { path: '/admin/users', label: 'Usuários', icon: <Users size={18} /> },
    { path: '/admin/agents', label: 'Agentes IA', icon: <Bot size={18} /> },
    { path: '/admin/chat', label: 'Chat', icon: <MessageCircle size={18} /> },
  ];

  const isActive = (path: string) => location.pathname === path;

  /* ── Theme with purple accents ── */
  const theme = {
    bg: darkMode ? '#0e0c1e' : '#f8f7fc',
    sidebar: darkMode ? '#161430' : '#ffffff',
    card: darkMode ? '#1e1b40' : '#ffffff',
    text: darkMode ? '#f5f4fb' : '#0f0e1a',
    textSecondary: darkMode ? '#b8b5d0' : '#64618b',
    border: darkMode ? '#363258' : '#e8e5f0',
    hover: darkMode ? '#272450' : '#f3f1fa',
    activeItem: darkMode ? 'rgba(139,92,246,0.20)' : 'rgba(139,92,246,0.08)',
    accentColor: '#8b5cf6',
    accentSoft: darkMode ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.06)',
  };

  const handleLogout = async () => { await logout(); navigate('/'); };
  const handleNav = (path: string) => { navigate(path); setSidebarOpen(false); };

  const renderNavButton = (item: { path: string; label: string; icon: React.ReactNode; tourId?: string; pro?: boolean }) => {
    const isProItem = item.pro && !isPro;
    return (
      <button key={item.path} onClick={() => handleNav(isProItem ? '/dashboard/upgrade' : item.path)}
        data-tour={item.tourId || undefined}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.6rem 0.75rem', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: isActive(item.path) ? theme.activeItem : 'transparent',
          color: isActive(item.path) ? theme.accentColor : theme.textSecondary,
          fontSize: '0.875rem', fontWeight: isActive(item.path) ? 600 : 400,
          transition: 'all 0.15s', marginBottom: '0.15rem', textAlign: 'left',
          opacity: isProItem ? 0.6 : 1,
        }}
        onMouseEnter={e => { if (!isActive(item.path)) e.currentTarget.style.background = theme.hover; }}
        onMouseLeave={e => { if (!isActive(item.path)) e.currentTarget.style.background = 'transparent'; }}
      >
        {item.icon} {item.label}
        {isProItem && <Lock size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
        {isActive(item.path) && !isProItem && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
      </button>
    );
  };

  const sectionLabel = (text: string, color?: string) => (
    <div style={{ padding: '0 0.5rem', marginBottom: '0.35rem' }}>
      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: color || theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {text}
      </span>
    </div>
  );

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{
        padding: '1.25rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
        borderBottom: `1px solid ${theme.border}`, cursor: 'pointer',
      }} onClick={() => handleNav('/dashboard')}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #7c3aed, #6366f1, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'white', fontWeight: 800, fontSize: '0.8rem' }}>Q</span>
        </div>
        <span style={{ fontSize: '1rem', fontWeight: 700, color: theme.text }}>Qyntara</span>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '1rem 0.5rem', flex: 1, overflowY: 'auto' }}>
        {sectionLabel('Principal')}
        {userMenuItems.map(renderNavButton)}

        {/* Investor Deck */}
        <div style={{ padding: '0.75rem 0.5rem 0.5rem', marginTop: '0.5rem', borderTop: `1px solid ${theme.border}` }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: theme.accentColor, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Landmark size={10} color={theme.accentColor} /> Investor
          </span>
        </div>
        {renderNavButton({ path: '/dashboard/investor', label: 'Investor Deck', icon: <Landmark size={18} /> })}

        {/* Admin sections */}
        {isAdmin && (
          <>
            <div style={{ padding: '0.75rem 0.5rem 0.5rem', marginTop: '0.5rem', borderTop: `1px solid ${theme.border}` }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Admin
              </span>
            </div>
            {sectionLabel('Modelo')}
            {adminModelItems.map(renderNavButton)}
            <div style={{ height: '0.5rem' }} />
            {sectionLabel('Infraestrutura')}
            {adminInfraItems.map(renderNavButton)}
            <div style={{ height: '0.5rem' }} />
            {sectionLabel('Gestão')}
            {adminMgmtItems.map(renderNavButton)}
          </>
        )}
      </nav>

      {/* User info + actions */}
      <div style={{ padding: '0.75rem', borderTop: `1px solid ${theme.border}` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem',
          borderRadius: 8, marginBottom: '0.5rem',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 600,
          }}>
            {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || user?.email}
            </div>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
              {isPro && <ProBadge small />}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => handleNav('/dashboard/settings')} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            padding: '0.5rem', borderRadius: 6, border: `1px solid ${theme.border}`, background: 'transparent',
            color: theme.textSecondary, cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = theme.hover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Settings size={14} /> Config
          </button>
          <button onClick={handleLogout} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            padding: '0.5rem', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent',
            color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>
    </>
  );

  const getBreadcrumb = () => {
    const p = location.pathname;
    if (p === '/admin') return '🔒 Admin — Visão Geral';
    if (p === '/admin/performance') return '🔒 Admin — Performance';
    if (p === '/admin/models') return '🔒 Admin — Modelos & Features';
    if (p === '/admin/costs') return '🔒 Admin — Custos';
    if (p === '/admin/data-quality') return '🔒 Admin — Qualidade de Dados';
    if (p === '/admin/drift') return '🔒 Admin — Drift';
    if (p === '/admin/validation') return '🔒 Admin — Validação';
    if (p === '/admin/notifications') return '🔒 Admin — Notificações';
    if (p === '/admin/agents') return '🤖 Admin — Agentes IA';
    if (p === '/admin/users') return '👥 Admin — Usuários';
    if (p === '/admin/chat') return '💬 Admin — Chat';
    if (p === '/admin/investor') return '💰 Admin — Investor Deck';
    if (p.startsWith('/admin')) return '🔒 Admin';
    if (p === '/dashboard') return 'Meu Dashboard';
    if (p === '/dashboard/recommendations') return 'Recomendações';
    if (p === '/dashboard/tracking') return 'Acompanhamento';
    if (p === '/dashboard/explainability') return 'Explicabilidade';
    if (p === '/dashboard/backtesting') return 'Backtesting';
    if (p === '/dashboard/performance') return 'Performance';
    if (p === '/dashboard/portfolio') return 'Carteira Modelo';
    if (p === '/dashboard/carteiras') return 'Minhas Carteiras';
    if (p === '/dashboard/upgrade') return 'Upgrade Pro';
    if (p === '/dashboard/change-password') return 'Alterar Senha';
    if (p === '/dashboard/change-phone') return 'Alertas WhatsApp';
    if (p === '/dashboard/support') return 'Fale Conosco';
    if (p === '/dashboard/settings') return 'Configurações';
    if (p === '/dashboard/investor') return 'Investor Deck';
    return 'Dashboard';
  };

  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return localStorage.getItem('b3tr_upgrade_banner_dismissed') === 'true'; } catch { return false; }
  });
  const showUpgradeBanner = !bannerDismissed && user && user.plan !== 'pro' && [
    '/dashboard', '/dashboard/recommendations', '/dashboard/explainability',
    '/dashboard/tracking', '/dashboard/portfolio', '/dashboard/carteiras',
  ].includes(location.pathname);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.bg }}>
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - Desktop */}
      <aside style={{
        width: 240, background: theme.sidebar, borderRight: `1px solid ${theme.border}`,
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 50,
      }} className="sidebar-desktop">
        {sidebarContent}
      </aside>

      {/* Sidebar - Mobile */}
      <aside style={{
        width: 260, background: theme.sidebar, borderRight: `1px solid ${theme.border}`,
        display: 'none', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0,
        zIndex: 50, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s',
      }} className="sidebar-mobile">
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 240, minHeight: '100vh', paddingBottom: 60 }} className="main-content">
        <header style={{
          padding: '0.75rem clamp(0.75rem, 3vw, 1.5rem)', borderBottom: `1px solid ${theme.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: theme.sidebar, position: 'sticky', top: 0, zIndex: 30, gap: '0.5rem',
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            display: 'none', background: 'none', border: 'none', color: theme.text,
            cursor: 'pointer', padding: 4, flexShrink: 0,
          }} className="mobile-menu-btn" aria-label="Menu">
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div style={{ fontSize: '0.9rem', fontWeight: 500, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>
            {getBreadcrumb()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <button onClick={toggleDarkMode} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0.35rem', borderRadius: 6, border: `1px solid ${theme.border}`, background: 'transparent',
              color: theme.textSecondary, cursor: 'pointer', transition: 'all 0.15s', minHeight: 'auto',
            }}
              onMouseEnter={e => e.currentTarget.style.background = theme.hover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              aria-label={darkMode ? 'Modo claro' : 'Modo escuro'}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <NotificationCenter darkMode={darkMode} />
            <div style={{ position: 'relative' }}>
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.6rem',
                borderRadius: 6, background: theme.hover, fontSize: '0.8rem', color: theme.textSecondary,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s', maxWidth: '40vw',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
                onMouseEnter={e => e.currentTarget.style.background = theme.activeItem || theme.hover}
                onMouseLeave={e => { if (!userMenuOpen) e.currentTarget.style.background = theme.hover; }}
              >
                <User size={14} style={{ flexShrink: 0 }} />
                <span className="header-email" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</span>
              </button>
              {userMenuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setUserMenuOpen(false)} />
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 6, minWidth: 220,
                    background: theme.sidebar, border: `1px solid ${theme.border}`, borderRadius: 10,
                    boxShadow: darkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden',
                  }} className="user-menu-dropdown">
                    {/* User info header */}
                    <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${theme.border}`, background: theme.accentSoft }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>{user?.name || user?.email}</div>
                      <div style={{ fontSize: '0.7rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
                        {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
                        {isPro && <ProBadge small />}
                      </div>
                    </div>
                    {/* Account section */}
                    <div style={{ padding: '0.35rem 0' }}>
                      <div style={{ padding: '0.25rem 1rem', fontSize: '0.65rem', fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conta</div>
                      {[
                        { path: '/dashboard/change-password', icon: <Lock size={14} />, label: 'Alterar Senha' },
                        { path: '/dashboard/change-phone', icon: <Phone size={14} />, label: 'Alertas WhatsApp' },
                        { path: '/dashboard/settings', icon: <Settings size={14} />, label: 'Configurações' },
                      ].map(item => (
                        <button key={item.path} onClick={() => { setUserMenuOpen(false); navigate(item.path); }} style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.5rem 1rem', background: 'transparent', border: 'none',
                          color: theme.textSecondary, cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left',
                          transition: 'background 0.1s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = theme.hover}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {item.icon} {item.label}
                        </button>
                      ))}
                    </div>
                    {/* Support section */}
                    <div style={{ padding: '0.35rem 0', borderTop: `1px solid ${theme.border}` }}>
                      <div style={{ padding: '0.25rem 1rem', fontSize: '0.65rem', fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suporte</div>
                      <button onClick={() => { setUserMenuOpen(false); navigate('/dashboard/support'); }} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.5rem 1rem', background: 'transparent', border: 'none',
                        color: theme.textSecondary, cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left',
                        transition: 'background 0.1s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = theme.hover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <MessageCircle size={14} /> Fale Conosco
                      </button>
                    </div>
                    {/* Upgrade */}
                    {!isPro && (
                      <div style={{ padding: '0.35rem 0', borderTop: `1px solid ${theme.border}` }}>
                        <button onClick={() => { setUserMenuOpen(false); navigate('/dashboard/upgrade'); }} style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.5rem 1rem', background: 'transparent', border: 'none',
                          color: '#f59e0b', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left',
                          transition: 'background 0.1s', fontWeight: 500,
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.06)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Crown size={14} /> Upgrade Pro
                        </button>
                      </div>
                    )}
                    {/* Logout */}
                    <button onClick={() => { setUserMenuOpen(false); handleLogout(); }} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.6rem 1rem', background: 'transparent', border: 'none',
                      color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left',
                      borderTop: `1px solid ${theme.border}`, transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <LogOut size={14} /> Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div style={{ padding: 'clamp(0.75rem, 3vw, 1.5rem)' }}>
          {isOffline && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: '0.78rem', color: '#f87171',
            }}>
              📡 Sem conexão com a internet. Dados podem estar desatualizados.
            </div>
          )}
          {user && user.emailVerified === false && (
            <EmailVerificationBanner darkMode={darkMode} theme={theme} />
          )}
          {showUpgradeBanner && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.75rem', marginBottom: '0.75rem', borderRadius: 8,
              background: darkMode ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)',
              border: '1px solid rgba(245,158,11,0.15)', fontSize: '0.75rem',
            }}>
              <Crown size={13} color="#f59e0b" />
              <span style={{ color: theme.textSecondary, flex: 1 }}>
                Alguns valores estão ocultos.{' '}
                <a href="#/dashboard/upgrade" style={{ color: '#f59e0b', fontWeight: 600, textDecoration: 'none' }}>
                  Assine o Pro
                </a>
              </span>
              <button onClick={() => { setBannerDismissed(true); try { localStorage.setItem('b3tr_upgrade_banner_dismissed', 'true'); } catch {} }} style={{
                background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', padding: 2, opacity: 0.5,
              }} aria-label="Fechar">
                <X size={14} />
              </button>
            </div>
          )}
          <Outlet context={{ darkMode, theme }} />
          <div style={{
            marginTop: '2rem', padding: '0.75rem 1rem', borderTop: `1px solid ${theme.border}`,
            textAlign: 'center', fontSize: '0.7rem', color: theme.textSecondary, lineHeight: 1.6,
          }}>
            ⚠️ Este sistema é uma ferramenta de apoio à decisão. Não constitui recomendação de investimento.
            Resultados passados não garantem resultados futuros. Consulte um profissional antes de investir.
            <br />
            <a href="#/privacidade" style={{ color: theme.textSecondary, textDecoration: 'underline', marginTop: 4, display: 'inline-block' }}>
              <Shield size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />Política de Privacidade
            </a>
          </div>
        </div>

        {/* Mobile bottom tab bar */}
        <nav className="mobile-bottom-tabs" style={{
          display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          background: theme.sidebar, borderTop: `1px solid ${theme.border}`,
          justifyContent: 'space-around', alignItems: 'center', padding: '0.35rem 0',
          paddingBottom: 'env(safe-area-inset-bottom, 0.35rem)',
        }}>
          {[
            { path: '/dashboard', icon: <TrendingUp size={20} />, label: 'Home' },
            { path: '/dashboard/recommendations', icon: <BarChart3 size={20} />, label: 'Recs' },
            { path: '/dashboard/backtesting', icon: <TestTubes size={20} />, label: 'Backtest' },
            { path: '/dashboard/carteiras', icon: <Briefcase size={20} />, label: 'Carteiras' },
          ].map(tab => (
            <button key={tab.path} onClick={() => navigate(tab.path)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem',
              background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem',
              color: isActive(tab.path) ? theme.accentColor : theme.textSecondary,
              fontWeight: isActive(tab.path) ? 600 : 400, fontSize: '0.6rem',
              minHeight: 'auto', transition: 'color 0.15s',
            }}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-mobile { display: flex !important; }
          .main-content { margin-left: 0 !important; padding-bottom: 70px !important; }
          .mobile-menu-btn { display: flex !important; }
          .mobile-bottom-tabs { display: flex !important; }
        }
      `}</style>

      {showOnboarding && (
        <OnboardingModal darkMode={darkMode} onClose={() => {
          setShowOnboarding(false);
          if (shouldShowTour()) setTimeout(() => setShowTour(true), 500);
        }} />
      )}
      <GuidedTour darkMode={darkMode} run={showTour} onFinish={() => setShowTour(false)} />
    </div>
  );
};

// Email verification banner
const EmailVerificationBanner: React.FC<{ darkMode: boolean; theme: Record<string, string> }> = ({ darkMode }) => {
  const { user, resendCode } = useAuth();
  const navigate = useNavigate();
  const [resending, setResending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  React.useEffect(() => {
    const key = 'b3tr_auto_resend_done';
    const regTime = localStorage.getItem('b3tr_register_time');
    if (!regTime) {
      localStorage.setItem('b3tr_register_time', Date.now().toString());
      return;
    }
    const elapsed = Date.now() - parseInt(regTime, 10);
    if (elapsed >= 3600000 && !localStorage.getItem(key) && user?.email) {
      localStorage.setItem(key, 'true');
      resendCode(user.email).catch(() => {});
    }
  }, [user, resendCode]);

  const handleResend = async () => {
    if (!user?.email || resending) return;
    setResending(true);
    try {
      await resendCode(user.email);
      setSent(true);
      setTimeout(() => setSent(false), 10000);
    } catch {}
    finally { setResending(false); }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
      padding: '0.6rem 1rem', marginBottom: '0.75rem', borderRadius: 8,
      background: darkMode ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)',
      border: '1px solid rgba(245,158,11,0.3)', fontSize: '0.82rem', color: '#f59e0b',
    }}>
      <Mail size={16} />
      <span style={{ flex: 1 }}>
        Verifique seu email para ativar todos os recursos.
      </span>
      {sent ? (
        <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Código reenviado ✓</span>
      ) : (
        <button onClick={handleResend} disabled={resending} style={{
          padding: '0.3rem 0.6rem', borderRadius: 6, border: '1px solid rgba(245,158,11,0.4)',
          background: 'rgba(245,158,11,0.15)', color: '#f59e0b', cursor: 'pointer',
          fontSize: '0.75rem', fontWeight: 600, minHeight: 'auto',
        }}>
          {resending ? 'Enviando...' : 'Reenviar código'}
        </button>
      )}
      <button onClick={() => navigate('/verify-email')} style={{
        padding: '0.3rem 0.6rem', borderRadius: 6, border: '1px solid rgba(245,158,11,0.4)',
        background: '#f59e0b', color: '#0f172a', cursor: 'pointer',
        fontSize: '0.75rem', fontWeight: 600, minHeight: 'auto',
      }}>
        Verificar agora
      </button>
    </div>
  );
};

export default DashboardLayout;
