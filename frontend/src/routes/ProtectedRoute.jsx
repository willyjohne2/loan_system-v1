import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ allowedRoles }) => {
  const { user, activeRole } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  // Owner always passes — they can access everything
  if (user.is_owner) return <Outlet />;

  // God Mode passes for all routes
  if (user.god_mode_enabled) return <Outlet />;

  if (allowedRoles && !allowedRoles.includes(activeRole)) {
    if (user.role === 'MANAGER') return <Navigate to="/manager/dashboard" replace />;
    if (user.role === 'FINANCIAL_OFFICER') return <Navigate to="/finance/overview" replace />;
    if (user.role === 'FIELD_OFFICER') return <Navigate to="/field/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export const PublicRoute = () => {
  const { user } = useAuth();

  if (user) {
    if (user.is_owner) return <Navigate to="/owner/dashboard" replace />;
    if (user.is_super_admin || user.god_mode_enabled) return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'MANAGER') return <Navigate to="/manager/dashboard" replace />;
    if (user.role === 'FINANCIAL_OFFICER') return <Navigate to="/finance/overview" replace />;
    if (user.role === 'FIELD_OFFICER') return <Navigate to="/field/dashboard" replace />;
  }

  return <Outlet />;
};
