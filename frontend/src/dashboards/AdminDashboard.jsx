import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import AdminOverview from './AdminOverview';
import AdminManagers from './AdminManagers';
import AdminOfficers from './AdminOfficers';
import AdminCustomers from './AdminCustomers';
import AdminAccounts from './AdminAccounts';
import AdminAuditLogs from './AdminAuditLogs';
import AdminLoans from './AdminLoans';
import AdminSettings from './AdminSettings';
import AdminSMSLogs from './AdminSMSLogs';
import ProfileSettings from '../pages/ProfileSettings';
import { clsx } from 'clsx';

const AdminDashboard = () => {
  const location = useLocation();
  
  const getTitle = () => {
    if (location.pathname.includes('/managers')) return 'Manager Management';
    if (location.pathname.includes('/officers')) return 'Finance Officer Management';
    if (location.pathname.includes('/customers')) return 'Customer Database';
    if (location.pathname.includes('/loans')) return 'Loan Portfolio';
    if (location.pathname.includes('/accounts')) return 'Admin Accounts Management';
    if (location.pathname.includes('/audit')) return 'System Audit Trail';
    if (location.pathname.includes('/sms-logs')) return 'Communication Logs';
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
            { to: '/admin/managers', label: 'Managers' },
            { to: '/admin/officers', label: 'Finance Officers' },
            { to: '/admin/customers', label: 'Customers' },
            { to: '/admin/loans', label: 'Loans' },
            { to: '/admin/accounts', label: 'Admin Accounts' },
            { to: '/admin/audit', label: 'Audit Logs' },
            { to: '/admin/sms-logs', label: 'Communicator' },
            { to: '/admin/settings', label: 'Interest Settings' }
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
          <Route path="officers" element={<AdminOfficers />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="loans" element={<AdminLoans />} />
          <Route path="accounts" element={<AdminAccounts />} />
          <Route path="audit" element={<AdminAuditLogs />} />
          <Route path="sms-logs" element={<AdminSMSLogs />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="profile" element={<ProfileSettings />} />
        </Routes>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
