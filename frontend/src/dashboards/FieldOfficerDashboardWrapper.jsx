import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import FieldOfficerDashboard from './FieldOfficerDashboard';
import AdminCustomers from './AdminCustomers';
import ProfileSettings from '../pages/ProfileSettings';

const FieldOfficerDashboardWrapper = () => {
  const location = useLocation();

  const getTitle = () => {
    if (location.pathname.includes('/customers')) return 'Customers';
    if (location.pathname.includes('/profile')) return 'Account Profile';
    return 'Field Officer Dashboard';
  };

  return (
    <Layout title={getTitle()}>
      <Routes>
        <Route index element={<FieldOfficerDashboard />} />
        <Route path="dashboard" element={<FieldOfficerDashboard />} />
        <Route path="profile" element={<ProfileSettings />} />
      </Routes>
    </Layout>
  );
};

export default FieldOfficerDashboardWrapper;
