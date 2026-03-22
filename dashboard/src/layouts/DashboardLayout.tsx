import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  TrendingUp, LogOut, Menu, X, ChevronRight,
  BarChart3, Brain, TestTubes, Moon, Sun, User, Lock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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

  const userMenuItems = [
    { path: '/dashboard', label: 'Recomendações', icon: <TrendingUp size={18} /> },
    { path: '/dashboard/explainability', label: 'Explicabilidade', icon: <Brain size={18} /> },
    { path: '/dashboard/backtesting', label: 'Backtesting', icon: <TestTubes size={18} /> },
  ];

  const adminMenuItems = [
    { path: '/admin', label: 'Visão Geral', icon: <BarChart3 size={18} /> },
    { path: '/admin/performance', label: 'Performance', icon: <TrendingUp size={18} /> },
    { path: '/admin/costs', label: 'Custos', icon: <BarChart3 size={18} /> },
    { path: '/admin/data-quality', label: 'Qualidade de Dados', icon: <TestTubes size={18} /> },
    { path: '/admin/drift', label: 'Drift Detection', icon: <Brain size={18} /> },
    { path: '/admin/validation', label: 'Validação', icon: <TestTubes size={18} /> },
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

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleNav = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const renderNavButton = (item: { path: string; label: string; icon: React.ReactNode }) => (
    <button key={item.path} onClick={() => handleNav(item.path)}
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
        <div style={{ padding: '0 0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Dashboard
          </span>
        </div>
        {userMenuItems.map(renderNavButton)}

        {isAdmin && (
          <>
            <div style={{ padding: '1rem 0.5rem 0.5rem', marginTop: '0.5rem', borderTop: `1px solid ${theme.border}` }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Admin
              </span>
            </div>
            {adminMenuItems.map(renderNavButton)}
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
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
              {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={toggleDarkMode} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            padding: '0.5rem', borderRadius: 6, border: `1px solid ${theme.border}`, background: 'transparent',
            color: theme.textSecondary, cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = theme.hover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.bg }}>
      {/* Mobile overlay */}
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
      <main style={{ flex: 1, marginLeft: 240, minHeight: '100vh' }} className="main-content">
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
          <div style={{ fontSize: '0.9rem', color: theme.textSecondary, whiteSpace: 'nowrap' }}>
            {location.pathname.startsWith('/admin') ? '🔒 Admin' : 'Dashboard'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
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
                  }}>
                    <div style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${theme.border}` }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: theme.text }}>{user?.name || user?.email}</div>
                      <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>{user?.role === 'admin' ? 'Administrador' : 'Usuário'}</div>
                    </div>
                    <button onClick={() => { setUserMenuOpen(false); navigate('/dashboard/change-password'); }} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.6rem 0.75rem', background: 'transparent', border: 'none',
                      color: theme.textSecondary, cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = theme.hover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Lock size={14} /> Alterar Senha
                    </button>
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
          <Outlet context={{ darkMode, theme }} />
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-mobile { display: flex !important; }
          .main-content { margin-left: 0 !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
};

export default DashboardLayout;
