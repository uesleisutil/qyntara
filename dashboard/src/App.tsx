import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './mobile.css';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MyDashboardPage from './pages/dashboard/MyDashboardPage';
import RecommendationsPage from './pages/dashboard/RecommendationsPage';
import ExplainabilityPage from './pages/dashboard/ExplainabilityPage';
import BacktestingPage from './pages/dashboard/BacktestingPage';
import ChangePasswordPage from './pages/dashboard/ChangePasswordPage';
import ChangePhonePage from './pages/dashboard/ChangePhonePage';
import PerformancePage from './pages/dashboard/PerformancePage';
import UpgradePage from './pages/dashboard/UpgradePage';
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import AdminPerformancePage from './pages/admin/AdminPerformancePage';
import AdminCostsPage from './pages/admin/AdminCostsPage';
import AdminDataQualityPage from './pages/admin/AdminDataQualityPage';
import AdminDriftPage from './pages/admin/AdminDriftPage';
import AdminValidationPage from './pages/admin/AdminValidationPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';
import AdminAgentsPage from './pages/admin/AdminAgentsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminChatPage from './pages/admin/AdminChatPage';
import AdminModelsPage from './pages/admin/AdminModelsPage';
import AdminInvestorPage from './pages/admin/AdminInvestorPage';
import SupportChatPage from './pages/dashboard/SupportChatPage';
import CarteirasPage from './pages/dashboard/CarteirasPage';

// Layout
import DashboardLayout from './layouts/DashboardLayout';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import SettingsPage from './pages/dashboard/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 3, staleTime: 4 * 60 * 1000 },
  },
});

// Protected route wrapper — also redirects unverified emails
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0c0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9895b0' }}>
        Carregando...
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.emailVerified === false) return <Navigate to="/verify-email" replace />;
  return <>{children}</>;
};

// Admin route wrapper
const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0c0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9895b0' }}>
        Carregando...
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// Redirect authenticated users away from public pages
const PublicOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated && user?.emailVerified !== false) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// Requires login but NOT email verification (for verify-email page)
const RequireLoginOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<PublicOnly><LandingPage /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route path="/verify-email" element={<RequireLoginOnly><VerifyEmailPage /></RequireLoginOnly>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/privacidade" element={<PrivacyPolicyPage />} />

      {/* User dashboard */}
      <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route index element={<MyDashboardPage />} />
        <Route path="recommendations" element={<RecommendationsPage />} />
        <Route path="explainability" element={<ExplainabilityPage />} />
        <Route path="backtesting" element={<BacktestingPage />} />
        <Route path="tracking" element={<Navigate to="/dashboard/performance" replace />} />
        <Route path="portfolio" element={<Navigate to="/dashboard/carteiras" replace />} />
        <Route path="carteiras" element={<CarteirasPage />} />
        <Route path="performance" element={<PerformancePage />} />
        <Route path="upgrade" element={<UpgradePage />} />
        <Route path="change-password" element={<ChangePasswordPage />} />
        <Route path="change-phone" element={<ChangePhonePage />} />
        <Route path="support" element={<SupportChatPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="investor" element={<AdminInvestorPage />} />
      </Route>

      {/* Admin panel */}
      <Route path="/admin" element={<RequireAdmin><DashboardLayout /></RequireAdmin>}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="performance" element={<AdminPerformancePage />} />
        <Route path="costs" element={<AdminCostsPage />} />
        <Route path="data-quality" element={<AdminDataQualityPage />} />
        <Route path="drift" element={<AdminDriftPage />} />
        <Route path="models" element={<AdminModelsPage />} />
        <Route path="validation" element={<AdminValidationPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="agents" element={<AdminAgentsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="chat" element={<AdminChatPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
