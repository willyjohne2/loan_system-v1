import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import FinanceOverview from './finance/FinanceOverview';
import FinanceDisbursement from './finance/FinanceDisbursement';
import FinanceAnalytics from './finance/FinanceAnalytics';
import FinanceLedger from './finance/FinanceLedger';
import FinanceReports from './finance/FinanceReports';
import FinanceControl from './finance/FinanceControl';
import CustomerCommunicator from './CustomerCommunicator';
import ProfileSettings from '../pages/ProfileSettings';

const FinanceDashboardWrapper = () => {
  return (
    <Layout>
      <Routes>
        <Route index element={<FinanceOverview />} />
        <Route path="overview" element={<FinanceOverview />} />
        <Route path="disbursement" element={<FinanceDisbursement />} />
        <Route path="analytics" element={<FinanceAnalytics />} />
        <Route path="ledger" element={<FinanceLedger />} />
        <Route path="reports" element={<FinanceReports />} />
        <Route path="control" element={<FinanceControl />} />
        <Route path="customer-communicator" element={<CustomerCommunicator />} />
        <Route path="profile" element={<ProfileSettings />} />
      </Routes>
    </Layout>
  );
};

export default FinanceDashboardWrapper;
