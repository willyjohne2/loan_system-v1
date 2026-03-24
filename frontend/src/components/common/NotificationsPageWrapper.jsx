import React from 'react';
import { useAuth } from '../../context/AuthContext';
import OwnerLayout from '../../dashboards/owner/OwnerLayout';
import Layout from '../layout/Layout'; // Admin/Manager/etc layout
import { Navigate } from 'react-router-dom';

const NotificationsPageWrapper = ({ children }) => {
  const { user, activeRole } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Determine layout based on user role or active role
  // Owners have their own layout
  if (user.is_owner || activeRole === 'OWNER') {
    return <OwnerLayout>{children}</OwnerLayout>;
  }

  // Other roles use the standard Layout (Admin, Manager, etc)
  // Note: Some roles might have specific layouts, but Layout.jsx is generally used for Admin/Manager/Officer
  // If specific dashboards use specific layouts, they should be imported here.
  // Based on file exploration, 'Layout' seems to be the unified layout for non-owner roles.
  
  return <Layout title="Notifications">{children}</Layout>;
};

export default NotificationsPageWrapper;
