import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import OwnerLayout from './OwnerLayout';
import OwnerHome from './OwnerHome';
import OwnerAuditPage from './OwnerAuditPage';
import SecurityLogsPage from './SecurityLogsPage';
import SecurityThreatsPage from '../SecurityThreatsPage';
import OwnershipPage from './OwnershipPage';
import OfficialCommunicator from '../OfficialCommunicator';
import AdminSettings from '../AdminSettings';
import BranchManagement from '../BranchManagement';
import AdminManagers from '../AdminManagers';
import AdminOfficers from '../AdminOfficers';
import AdminAccounts from '../AdminAccounts';
import AdminCustomers from '../AdminCustomers';
import AdminLoans from '../AdminLoans';
import SuperAdminPage from '../SuperAdminPage';
import { useAuth } from '../../context/AuthContext';

const OwnerDashboardWrapper = () => {
  const { user } = useAuth();
  if (!user?.is_owner) return <Navigate to="/login" replace />;

  return (
    <OwnerLayout>
      <Routes>
        {/* Core owner pages */}
        <Route index element={<OwnerHome />} />
        <Route path="dashboard" element={<OwnerHome />} />
        <Route path="audit" element={<OwnerAuditPage />} />
        <Route path="security-threats" element={<SecurityThreatsPage />} />
        <Route path="security-logs" element={<SecurityLogsPage />} />
        <Route path="ownership" element={<OwnershipPage />} />
        <Route path="communications" element={<OfficialCommunicator />} />

        {/* Settings — all tabs under /owner/settings */}
        <Route path="settings" element={<AdminSettings defaultTab="mpesa" />} />
        <Route path="settings/mpesa" element={<AdminSettings defaultTab="mpesa" />} />
        <Route path="settings/sms" element={<AdminSettings defaultTab="sms" />} />
        <Route path="settings/system" element={<AdminSettings defaultTab="system" />} />
        <Route path="settings/security" element={<AdminSettings defaultTab="security" />} />
        <Route path="settings/loans" element={<AdminSettings defaultTab="loans" />} />
        <Route path="settings/branches" element={<BranchManagement />} />

        {/* Officials — owner views staff directly under /owner/ */}
        <Route path="super-admins" element={<SuperAdminPage />} />
        <Route path="managers" element={<AdminManagers />} />
        <Route path="finance-officers" element={<AdminOfficers role="FINANCIAL_OFFICER" />} />
        <Route path="field-officers" element={<AdminOfficers role="FIELD_OFFICER" />} />
        <Route path="accounts" element={<AdminAccounts />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="loans" element={<AdminLoans />} />
      </Routes>
    </OwnerLayout>
  );
};

export default OwnerDashboardWrapper;
