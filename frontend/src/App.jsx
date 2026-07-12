import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrgSetupPage from './pages/OrgSetupPage';
import AssetsPage from './pages/AssetsPage';
import AllocationPage from './pages/AllocationPage';
import MaintenancePage from './pages/MaintenancePage';
import ResourceBookingPage from './pages/ResourceBookingPage';
import AuditPage from './pages/AuditPage';
import ReportsPage from './pages/ReportsPage';
import NotificationsPage from './pages/NotificationsPage';
import AssetDetailPage from './pages/AssetDetailPage';
import AIChatPage from './pages/AIChatPage';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="animate-spin" style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTop: '3px solid var(--accent)', borderRadius: '50%' }} />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="org-setup" element={<OrgSetupPage />} />
            <Route path="assets" element={<AssetsPage />} />
            <Route path="assets/:id" element={<AssetDetailPage />} />
            <Route path="allocation" element={<AllocationPage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="booking" element={<ResourceBookingPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="ai-assistant" element={<AIChatPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
