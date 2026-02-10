import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login/admin" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to correct dashboard based on user role
    if (user.role === 'ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (user.role === 'MANAGER') {
      return <Navigate to="/manager/dashboard" replace />;
    } else if (user.role === 'FINANCIAL_OFFICER') {
      return <Navigate to="/finance/dashboard" replace />;
    }
    return <Navigate to="/login/admin" replace />;
  }

  return <Outlet />;
};

export const PublicRoute = () => {
  const { user } = useAuth();

  if (user) {
    // Redirect logged-in users to their dashboard
    if (user.role === 'ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (user.role === 'MANAGER') {
      return <Navigate to="/manager/dashboard" replace />;
    } else if (user.role === 'FINANCIAL_OFFICER') {
      return <Navigate to="/finance/dashboard" replace />;
    }
  }

  return <Outlet />;
};
