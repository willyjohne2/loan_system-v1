import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import ManagerHome from './ManagerDashboard'; // We'll repurpose the previous file as the home view
import AdminOfficers from './AdminOfficers'; // We can reuse the list view
import AdminCustomers from './AdminCustomers'; // We can reuse the list view
import ProfileSettings from '../pages/ProfileSettings';

const ManagerDashboardWrapper = () => {
  const location = useLocation();
  
  const getTitle = () => {
    if (location.pathname.includes('/officers')) return 'Regional Officers';
    if (location.pathname.includes('/customers')) return 'Regional Customers';
    if (location.pathname.includes('/profile')) return 'Account Profile';
    return 'Regional Manager Dashboard';
  };

  return (
    <Layout title={getTitle()}>
      <Routes>
        <Route index element={<ManagerHome />} />
        <Route path="dashboard" element={<ManagerHome />} />
        <Route path="officers" element={<AdminOfficers role="FIELD_OFFICER" />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="profile" element={<ProfileSettings />} />
      </Routes>
    </Layout>
  );
};

export default ManagerDashboardWrapper;
