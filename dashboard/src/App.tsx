import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './mobile.css';

/* ─── Lazy-loaded pages (each becomes its own chunk) ─── */
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));

// Dashboard pages
const MyDashboardPage = lazy(() => import('./pages/dashboard/MyDashboardPage'));
const RecommendationsPage = lazy(() => import('./pages/dashboard/RecommendationsPage'));
const ExplainabilityPage = lazy(() => import('./pages/dashboard/ExplainabilityPage'));
const BacktestingPage = lazy(() => import('./pages/dashboard/BacktestingPage'));
const PerformancePage = lazy(() => import('./pages/dashboard/PerformancePage'));
const UpgradePage = lazy(() => import('./pages/dashboard/UpgradePage'));
const ChangePasswordPage = lazy(() => import('./pages/dashboard/ChangePasswordPage'));
const ChangePhonePage = lazy(() => import('./pages/dashboard/ChangePhonePage'));
const SupportChatPage = lazy(() => import('./pages/dashboard/SupportChatPage'));
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
const CarteirasPage = lazy(() => import('./pages/dashboard/CarteirasPage'));
const ReferralPage = lazy(() => import('./pages/dashboard/ReferralPage'));
const ChallengesPage = lazy(() => import('./pages/dashboard/ChallengesPage'));

// Admin pages
const AdminPerformancePage = lazy(() => import('./pages/admin/AdminPerformancePage'));
const AdminCostsPage = lazy(() => import('./pages/admin/AdminCostsPage'));
const AdminDataQualityPage = lazy(() => import('./pages/admin/AdminDataQualityPage'));
const AdminModelsPage = lazy(() => import('./pages/admin/AdminModelsPage'));
const AdminValidationPage = lazy(() => import('./pages/admin/AdminValidationPage'));
const AdminNotificationsPage = lazy(() => import('./pages/admin/AdminNotificationsPage'));
const AdminAgentsPage = lazy(() => import('./pages/admin/AdminAgentsPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminChatPage = lazy(() => import('./pages/admin/AdminChatPage'));
const AdminInfraPage = lazy(() => import('./pages/admin/AdminInfraPage'));
const AdminInvestorPage = lazy(() => import('./pages/admin/AdminInvestorPage'));

/* ─── Suspense fallback ─── */
const PageLoader: React.FC = () => (
  <div style={{
    minHeight: '100vh', background: '#0f1117',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', gap: '1rem',
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 9,
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'pulse-loader 1.5s ease-in-out infinite',
    }}>
      <span style={{ color: 'white', fontWeight: 800, fontSize: '1rem' }}>Q</span>
    </div>
    <style>{`
      @keyframes pulse-loader {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.7; }
      }
    `}</style>
  </div>
);

/* ─── Route-level Suspense fallback (lighter, for nested routes) ─── */
const RouteLoader: React.FC = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '4rem 0', color: '#6b7280',
  }}>
    <div style={{
      width: 20, height: 20, border: '2px solid #3b82f6',
      borderTopColor: 'transparent', borderRadius: '50%',
      animation: 'spin-loader 0.6s linear infinite',
    }} />
    <style>{`@keyframes spin-loader { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 3, staleTime: 4 * 60 * 1000 },
  },
});


/* ─── Route guards ─── */
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.emailVerified === false) return <Navigate to="/verify-email" replace />;
  return <>{children}</>;
};

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const PublicOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated && user?.emailVerified !== false) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const RequireLoginOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

/* ─── Routes ─── */
const AppRoutes: React.FC = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public */}
      <Route path="/" element={<PublicOnly><LandingPage /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route path="/verify-email" element={<RequireLoginOnly><VerifyEmailPage /></RequireLoginOnly>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/privacidade" element={<PrivacyPolicyPage />} />

      {/* User dashboard — nested Suspense for route transitions */}
      <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route index element={<Suspense fallback={<RouteLoader />}><MyDashboardPage /></Suspense>} />
        <Route path="recommendations" element={<Suspense fallback={<RouteLoader />}><RecommendationsPage /></Suspense>} />
        <Route path="explainability" element={<Suspense fallback={<RouteLoader />}><ExplainabilityPage /></Suspense>} />
        <Route path="backtesting" element={<Suspense fallback={<RouteLoader />}><BacktestingPage /></Suspense>} />
        <Route path="tracking" element={<Navigate to="/dashboard/performance" replace />} />
        <Route path="portfolio" element={<Navigate to="/dashboard/carteiras" replace />} />
        <Route path="carteiras" element={<Suspense fallback={<RouteLoader />}><CarteirasPage /></Suspense>} />
        <Route path="performance" element={<Suspense fallback={<RouteLoader />}><PerformancePage /></Suspense>} />
        <Route path="upgrade" element={<Suspense fallback={<RouteLoader />}><UpgradePage /></Suspense>} />
        <Route path="change-password" element={<Suspense fallback={<RouteLoader />}><ChangePasswordPage /></Suspense>} />
        <Route path="change-phone" element={<Suspense fallback={<RouteLoader />}><ChangePhonePage /></Suspense>} />
        <Route path="support" element={<Suspense fallback={<RouteLoader />}><SupportChatPage /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<RouteLoader />}><SettingsPage /></Suspense>} />
        <Route path="referral" element={<Suspense fallback={<RouteLoader />}><ReferralPage /></Suspense>} />
        <Route path="challenges" element={<Suspense fallback={<RouteLoader />}><ChallengesPage /></Suspense>} />
        <Route path="investor" element={<Suspense fallback={<RouteLoader />}><AdminInvestorPage /></Suspense>} />
      </Route>

      {/* Admin panel */}
      <Route path="/admin" element={<RequireAdmin><DashboardLayout /></RequireAdmin>}>
        <Route index element={<Navigate to="/admin/models" replace />} />
        <Route path="performance" element={<Suspense fallback={<RouteLoader />}><AdminPerformancePage /></Suspense>} />
        <Route path="costs" element={<Suspense fallback={<RouteLoader />}><AdminCostsPage /></Suspense>} />
        <Route path="data-quality" element={<Suspense fallback={<RouteLoader />}><AdminDataQualityPage /></Suspense>} />
        <Route path="models" element={<Suspense fallback={<RouteLoader />}><AdminModelsPage /></Suspense>} />
        <Route path="validation" element={<Suspense fallback={<RouteLoader />}><AdminValidationPage /></Suspense>} />
        <Route path="notifications" element={<Suspense fallback={<RouteLoader />}><AdminNotificationsPage /></Suspense>} />
        <Route path="agents" element={<Suspense fallback={<RouteLoader />}><AdminAgentsPage /></Suspense>} />
        <Route path="users" element={<Suspense fallback={<RouteLoader />}><AdminUsersPage /></Suspense>} />
        <Route path="chat" element={<Suspense fallback={<RouteLoader />}><AdminChatPage /></Suspense>} />
        <Route path="infra" element={<Suspense fallback={<RouteLoader />}><AdminInfraPage /></Suspense>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
