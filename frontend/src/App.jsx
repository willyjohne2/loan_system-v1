import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, PublicRoute } from './routes/ProtectedRoute';

// Auth Pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// Dashboards
import AdminDashboard from './dashboards/AdminDashboard';
import ManagerDashboardWrapper from './dashboards/ManagerDashboardWrapper';
import FinanceDashboardWrapper from './dashboards/FinanceDashboardWrapper';
import FieldOfficerDashboardWrapper from './dashboards/FieldOfficerDashboardWrapper';

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin/*" element={<AdminDashboard />} />
          </Route>

          {/* Protected Manager Routes */}
          <Route element={<ProtectedRoute allowedRoles={['MANAGER']} />}>
            <Route path="/manager/*" element={<ManagerDashboardWrapper />} />
          </Route>

          {/* Protected Finance Routes */}
          <Route element={<ProtectedRoute allowedRoles={['FINANCIAL_OFFICER']} />}>
            <Route path="/finance/*" element={<FinanceDashboardWrapper />} />
          </Route>

          {/* Protected Field Officer Routes */}
          <Route element={<ProtectedRoute allowedRoles={['FIELD_OFFICER']} />}>
            <Route path="/field/*" element={<FieldOfficerDashboardWrapper />} />
          </Route>

          {/* Fallback */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
