import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import FinanceHome from './FinanceDashboard';
import AdminOfficers from './AdminOfficers'; // We can reuse
import ProfileSettings from '../pages/ProfileSettings';

const FinanceDashboardWrapper = () => {
  const location = useLocation();
  
  const getTitle = () => {
    if (location.pathname.includes('/field-officers')) return 'Field Officers';
    if (location.pathname.includes('/reports')) return 'Financial Reports';
    if (location.pathname.includes('/profile')) return 'Account Profile';
    return 'Finance Officer Dashboard';
  };

  return (
    <Layout title={getTitle()}>
      <Routes>
        <Route index element={<FinanceHome />} />
        <Route path="dashboard" element={<FinanceHome />} />
        <Route path="reports" element={<FinanceHome />} />
        <Route path="profile" element={<ProfileSettings />} />
      </Routes>
    </Layout>
  );
};

export default FinanceDashboardWrapper;
