import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  TrendingUp, LogOut, Menu, X, ChevronRight,
  BarChart3, Brain, TestTubes, Moon, Sun, User, Lock, Target,
  Briefcase, LineChart, Crown, Bell, Phone, Bot, Users, MessageCircle,
  Settings, Mail, Shield, DollarSign, Database, CheckSquare, Activity,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationCenter from '../components/shared/NotificationCenter';
import GuidedTour, { shouldShowTour } from '../components/shared/GuidedTour';
import OnboardingModal, { shouldShowOnboarding } from '../components/shared/OnboardingModal';
import { ProBadge } from '../components/shared/ProGate';

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
    return saved ? JSON.parse(saved) : true;
  });

  const toggleDarkMode = () => {
    setDarkMode((prev: boolean) => {
      localStorage.setItem('darkMode', JSON.stringify(!prev));
      return !prev;
    });
  };

  const isAdmin = user?.role === 'admin';
  const isPro = user?.plan === 'pro';

  React.useEffect(() => {
    if (shouldShowOnboarding()) {
      const timer = setTimeout(() => setShowOnboarding(true), 600);
      return () => clearTimeout(timer);
    } else if (shouldShowTour()) {
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

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

  const userMenuItems = [
    { path: '/dashboard', label: 'Meu Dashboard', icon: <TrendingUp size={18} />, tourId: 'nav-mydashboard' },
    { path: '/dashboard/recommendations', label: 'Recomendações', icon: <BarChart3 size={18} />, tourId: 'nav-recommendations' },
    { path: '/dashboard/explainability', label: 'Explicabilidade', icon: <Brain size={18} />, tourId: 'nav-explainability' },
    { path: '/dashboard/backtesting', label: 'Backtesting', icon: <TestTubes size={18} />, tourId: 'nav-backtesting' },
    { path: '/dashboard/performance', label: 'Performance', icon: <LineChart size={18} />, tourId: 'nav-performance' },
  ];

  const proMenuItems = [
    { path: '/dashboard/tracking', label: 'Acompanhamento', icon: <Target size={18} /> },
    { path: '/dashboard/portfolio', label: 'Carteira Modelo', icon: <Briefcase size={18} /> },
  ];

  /* #2 + #3: Admin items grouped with unique icons */
  const adminModelItems = [
    { path: '/admin', label: 'Visão Geral', icon: <BarChart3 size={18} /> },
    { path: '/admin/performance', label: 'Performance', icon: <Activity size={18} /> },
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

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    sidebar: darkMode ? '#1e293b' : '#ffffff',
    card: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    hover: darkMode ? '#334155' : '#f1f5f9',
    activeItem: darkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
  };

  const handleLogout = async () => { await logout(); navigate('/'); };
  const handleNav = (path: string) => { navigate(path); setSidebarOpen(false); };

  const renderNavButton = (item: { path: string; label: string; icon: React.ReactNode; tourId?: string }) => (
    <button key={item.path} onClick={() => handleNav(item.path)}
      data-tour={item.tourId || undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
        padding: '0.6rem 0.75rem', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: isActive(item.path) ? theme.activeItem : 'transparent',
        color: isActive(item.path) ? '#3b82f6' : theme.textSecondary,
        fontSize: '0.875rem', fontWeight: isActive(item.path) ? 600 : 400,
        transition: 'all 0.15s', marginBottom: '0.15rem', textAlign: 'left',
      }}
      onMouseEnter={e => { if (!isActive(item.path)) e.currentTarget.style.background = theme.hover; }}
      onMouseLeave={e => { if (!isActive(item.path)) e.currentTarget.style.background = 'transparent'; }}
    >
      {item.icon} {item.label}
      {isActive(item.path) && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
    </button>
  );

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
        <TrendingUp size={24} color="#3b82f6" />
        <span style={{ fontSize: '1rem', fontWeight: 700, color: theme.text }}>B3 Tactical</span>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '1rem 0.5rem', flex: 1, overflowY: 'auto' }}>
        {sectionLabel('Dashboard')}
        {userMenuItems.map(renderNavButton)}

        {/* Pro section */}
        <div data-tour="nav-pro" style={{ padding: '1rem 0.5rem 0.5rem', marginTop: '0.5rem', borderTop: `1px solid ${theme.border}` }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Crown size={11} color="#f59e0b" /> Pro
          </span>
        </div>
        {proMenuItems.map(item => (
          <button key={item.path} onClick={() => handleNav(isPro ? item.path : '/dashboard/upgrade')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.6rem 0.75rem', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: isActive(item.path) ? theme.activeItem : 'transparent',
              color: isActive(item.path) ? '#f59e0b' : theme.textSecondary,
              fontSize: '0.875rem', fontWeight: isActive(item.path) ? 600 : 400,
              transition: 'all 0.15s', marginBottom: '0.15rem', textAlign: 'left',
              opacity: isPro ? 1 : 0.6,
            }}
            onMouseEnter={e => { if (!isActive(item.path)) e.currentTarget.style.background = theme.hover; }}
            onMouseLeave={e => { if (!isActive(item.path)) e.currentTarget.style.background = 'transparent'; }}
          >
            {item.icon} {item.label}
            {!isPro && <Lock size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            {isActive(item.path) && isPro && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
          </button>
        ))}

        {/* #2: Admin grouped sections */}
        {isAdmin && (
          <>
            <div style={{ padding: '1rem 0.5rem 0.5rem', marginTop: '0.5rem', borderTop: `1px solid ${theme.border}` }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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

      {/* User info + logout */}
      <div style={{ padding: '0.75rem', borderTop: `1px solid ${theme.border}` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem',
          borderRadius: 8, marginBottom: '0.5rem',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
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
          <button onClick={handleLogout} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            padding: '0.5rem', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent',
            color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>
    </>
  );

  /* #1: Fix breadcrumb priority — admin paths checked FIRST */
  const getBreadcrumb = () => {
    const p = location.pathname;
    // Admin routes first (more specific)
    if (p === '/admin') return '🔒 Admin — Visão Geral';
    if (p === '/admin/performance') return '🔒 Admin — Performance';
    if (p === '/admin/costs') return '🔒 Admin — Custos';
    if (p === '/admin/data-quality') return '🔒 Admin — Qualidade de Dados';
    if (p === '/admin/drift') return '🔒 Admin — Drift';
    if (p === '/admin/validation') return '🔒 Admin — Validação';
    if (p === '/admin/notifications') return '🔒 Admin — Notificações';
    if (p === '/admin/agents') return '🤖 Admin — Agentes IA';
    if (p === '/admin/users') return '👥 Admin — Usuários';
    if (p === '/admin/chat') return '💬 Admin — Chat';
    if (p.startsWith('/admin')) return '🔒 Admin';
    // Client routes
    if (p === '/dashboard') return '📊 Recomendações';
    if (p === '/dashboard/tracking') return '🎯 Acompanhamento';
    if (p === '/dashboard/explainability') return '🧠 Explicabilidade';
    if (p === '/dashboard/backtesting') return '🧪 Backtesting';
    if (p === '/dashboard/performance') return '📈 Performance';
    if (p === '/dashboard/portfolio') return '👑 Carteira Modelo';
    if (p === '/dashboard/upgrade') return '👑 Upgrade Pro';
    if (p === '/dashboard/change-password') return '🔒 Alterar Senha';
    if (p === '/dashboard/change-phone') return '📱 Alertas WhatsApp';
    if (p === '/dashboard/support') return '💬 Fale Conosco';
    if (p === '/dashboard/settings') return '⚙️ Configurações';
    return 'Dashboard';
  };

  /* #4: Only show upgrade banner on pages where Pro matters */
  const showUpgradeBanner = user && user.plan !== 'pro' && [
    '/dashboard', '/dashboard/tracking', '/dashboard/portfolio',
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
          <div style={{ fontSize: '0.9rem', color: theme.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>
            {getBreadcrumb()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            {/* #11: Dark mode toggle in header */}
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
                    position: 'absolute', right: 0, top: '100%', marginTop: 6, minWidth: 200,
                    background: theme.sidebar, border: `1px solid ${theme.border}`, borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 50, overflow: 'hidden',
                  }} className="user-menu-dropdown">
                    <div style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${theme.border}` }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: theme.text }}>{user?.name || user?.email}</div>
                      <div style={{ fontSize: '0.7rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
                        {isPro && <ProBadge small />}
                      </div>
                    </div>
                    {[
                      { path: '/dashboard/change-password', icon: <Lock size={14} />, label: 'Alterar Senha', color: theme.textSecondary },
                      { path: '/dashboard/change-phone', icon: <Phone size={14} />, label: 'Alertas WhatsApp', color: theme.textSecondary },
                      { path: '/dashboard/support', icon: <MessageCircle size={14} />, label: 'Fale Conosco', color: theme.textSecondary },
                      { path: '/dashboard/settings', icon: <Settings size={14} />, label: 'Configurações', color: theme.textSecondary },
                    ].map(item => (
                      <button key={item.path} onClick={() => { setUserMenuOpen(false); navigate(item.path); }} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.6rem 0.75rem', background: 'transparent', border: 'none',
                        color: item.color, cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left',
                        transition: 'background 0.1s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = theme.hover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {item.icon} {item.label}
                      </button>
                    ))}
                    {!isPro && (
                      <button onClick={() => { setUserMenuOpen(false); navigate('/dashboard/upgrade'); }} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.6rem 0.75rem', background: 'transparent', border: 'none',
                        color: '#f59e0b', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left',
                        transition: 'background 0.1s', fontWeight: 500,
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Crown size={14} /> Upgrade Pro
                      </button>
                    )}
                    <button onClick={() => { setUserMenuOpen(false); handleLogout(); }} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.6rem 0.75rem', background: 'transparent', border: 'none',
                      color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left',
                      borderTop: `1px solid ${theme.border}`, transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
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
          {/* #4: Upgrade banner only on relevant pages */}
          {showUpgradeBanner && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
              padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: 8,
              background: darkMode ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)',
              border: '1px solid rgba(245,158,11,0.15)', fontSize: '0.78rem',
            }}>
              <Crown size={14} color="#f59e0b" />
              <span style={{ color: theme.textSecondary, flex: 1 }}>
                Plano Free — colunas Pro bloqueadas.
              </span>
              <button onClick={() => navigate('/dashboard/upgrade')} style={{
                padding: '0.25rem 0.6rem', borderRadius: 6, border: 'none',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white',
                cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                WebkitAppearance: 'none' as any,
              }}>
                Upgrade Pro →
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

        {/* #9: Mobile bottom tab bar */}
        <nav className="mobile-bottom-tabs" style={{
          display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          background: theme.sidebar, borderTop: `1px solid ${theme.border}`,
          justifyContent: 'space-around', alignItems: 'center', padding: '0.35rem 0',
          paddingBottom: 'env(safe-area-inset-bottom, 0.35rem)',
        }}>
          {[
            { path: '/dashboard', icon: <TrendingUp size={20} />, label: 'Recs' },
            { path: '/dashboard/explainability', icon: <Brain size={20} />, label: 'Explica' },
            { path: '/dashboard/backtesting', icon: <TestTubes size={20} />, label: 'Backtest' },
            { path: '/dashboard/performance', icon: <LineChart size={20} />, label: 'Perf' },
          ].map(tab => (
            <button key={tab.path} onClick={() => navigate(tab.path)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem',
              background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem',
              color: isActive(tab.path) ? '#3b82f6' : theme.textSecondary,
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

// Email verification banner with auto-resend after 1h
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
