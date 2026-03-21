import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RecommendationsPage from './pages/dashboard/RecommendationsPage';
import ExplainabilityPage from './pages/dashboard/ExplainabilityPage';
import BacktestingPage from './pages/dashboard/BacktestingPage';
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import AdminPerformancePage from './pages/admin/AdminPerformancePage';
import AdminCostsPage from './pages/admin/AdminCostsPage';
import AdminDataQualityPage from './pages/admin/AdminDataQualityPage';
import AdminDriftPage from './pages/admin/AdminDriftPage';
import AdminValidationPage from './pages/admin/AdminValidationPage';

// Layout
import DashboardLayout from './layouts/DashboardLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 3, staleTime: 4 * 60 * 1000 },
  },
});

// Protected route wrapper
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#94a3b8',
      }}>
        Carregando...
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Admin route wrapper
const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#94a3b8',
      }}>
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
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<PublicOnly><LandingPage /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />

      {/* User dashboard */}
      <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route index element={<RecommendationsPage />} />
        <Route path="explainability" element={<ExplainabilityPage />} />
        <Route path="backtesting" element={<BacktestingPage />} />
      </Route>

      {/* Admin panel */}
      <Route path="/admin" element={<RequireAdmin><DashboardLayout /></RequireAdmin>}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="performance" element={<AdminPerformancePage />} />
        <Route path="costs" element={<AdminCostsPage />} />
        <Route path="data-quality" element={<AdminDataQualityPage />} />
        <Route path="drift" element={<AdminDriftPage />} />
        <Route path="validation" element={<AdminValidationPage />} />
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
