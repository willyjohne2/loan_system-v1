import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import AdminOverview from './AdminOverview';
import AdminManagers from './AdminManagers';
import AdminOfficers from './AdminOfficers';
import AdminCustomers from './AdminCustomers';
import AdminAccounts from './AdminAccounts';
import AdminAuditLogs from './AdminAuditLogs';
import AdminDeactivations from './AdminDeactivations';
import AdminLoans from './AdminLoans';
import AdminSettings from './AdminSettings';
import BranchManagement from './BranchManagement';
import CustomerCommunicator from './CustomerCommunicator';
import OfficialCommunicator from './OfficialCommunicator';
import ProfileSettings from '../pages/ProfileSettings';
import SuperAdminPage from './SuperAdminPage';
import SecurityLogsPage from './SecurityLogsPage';
import OwnerAuditPage from './owner/OwnerAuditPage';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';

const AdminDashboard = () => {
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const getTitle = () => {
    if (location.pathname.includes('/managers')) return 'Manager Management';
    if (location.pathname.includes('/finance-officers')) return 'Finance Officer Management';
    if (location.pathname.includes('/field-officers')) return 'Field Officer Management';
    if (location.pathname.includes('/customers')) return 'Customer Database';
    if (location.pathname.includes('/loans')) return 'Loan Portfolio';
    if (location.pathname.includes('/accounts')) return 'Admin Accounts Management';
    if (location.pathname.includes('/deactivations')) return 'Security & Deactivation Requests';
    if (location.pathname.includes('/branches')) return 'Branch Network Management';
    if (location.pathname.includes('/audit')) return 'System Audit Trail';
    if (location.pathname.includes('/customer-communicator')) return 'Customer Communication';
    if (location.pathname.includes('/official-communicator')) return 'Official Communication';
    if (location.pathname.includes('/super-admins')) return 'Super Admin Console';
    if (location.pathname.includes('/security-logs')) return 'Security & Compliance';
    if (location.pathname.includes('/owner-audit')) return 'Owner Audit Trail';
    if (location.pathname.includes('/settings')) return 'System Financial Settings';
    if (location.pathname.includes('/profile')) return 'Account Profile';
    return 'Admin Dashboard';
  };

  return (
    <Layout title={getTitle()}>
      <div className="space-y-6">
        <nav className="flex space-x-4 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar">
          {[
            { to: '/admin/dashboard', label: 'Overview' },
            { to: '/admin/customers', label: 'Customers' },
            { to: '/admin/loans', label: 'Loans' },
            { to: '/admin/customer-communicator', label: 'Customer Comms' },
            { to: '/admin/official-communicator', label: 'Official Comms' },
          ].map(tab => (
            <Link
              key={tab.to}
              to={tab.to}
              className={clsx(
                "text-sm font-medium pb-2 border-b-2 transition-colors whitespace-nowrap",
                location.pathname === tab.to 
                  ? "border-primary-600 text-primary-600" 
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <Routes>
          <Route index element={<AdminOverview />} />
          <Route path="dashboard" element={<AdminOverview />} />
          <Route path="managers" element={<AdminManagers />} />
          <Route path="finance-officers" element={<AdminOfficers role="FINANCIAL_OFFICER" />} />
          <Route path="field-officers" element={<AdminOfficers role="FIELD_OFFICER" />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="loans" element={<AdminLoans />} />
          <Route path="accounts" element={<AdminAccounts />} />
          <Route path="deactivations" element={<AdminDeactivations />} />
          <Route path="branches" element={<BranchManagement />} />
          <Route path="audit" element={<AdminAuditLogs />} />
          <Route path="super-admins" element={
            (user?.is_owner || user?.is_super_admin)
              ? <SuperAdminPage />
              : <Navigate to="/admin/dashboard" replace />
          } />
          <Route path="security-logs" element={<SecurityLogsPage />} />
          <Route path="owner-audit" element={
            user?.is_owner
              ? <OwnerAuditPage />
              : <Navigate to="/admin/dashboard" replace />
          } />
          <Route path="customer-communicator" element={<CustomerCommunicator />} />
          <Route path="official-communicator" element={<OfficialCommunicator />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="profile" element={<ProfileSettings />} />
        </Routes>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
