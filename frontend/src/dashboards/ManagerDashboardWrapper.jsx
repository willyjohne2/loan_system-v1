import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import ManagerHome from './ManagerDashboard';
import AdminOfficers from './AdminOfficers';
import AdminCustomers from './AdminCustomers';
import CustomerCommunicator from './CustomerCommunicator';
import OfficialCommunicator from './OfficialCommunicator';
import ProfileSettings from '../pages/ProfileSettings';

const ManagerDashboardWrapper = () => {
  const location = useLocation();
  
  const getTitle = () => {
    if (location.pathname.includes('/officers')) return 'Regional Officers';
    if (location.pathname.includes('/customers')) return 'Regional Customers';
    if (location.pathname.includes('/customer-communicator')) return 'Customer Communication';
    if (location.pathname.includes('/official-communicator')) return 'Official Communication';
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
        <Route path="customer-communicator" element={<CustomerCommunicator />} />
        <Route path="official-communicator" element={<OfficialCommunicator />} />
        <Route path="profile" element={<ProfileSettings />} />
      </Routes>
    </Layout>
  );
};

export default ManagerDashboardWrapper;
