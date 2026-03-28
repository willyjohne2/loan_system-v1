import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import FinanceOverview from './finance/FinanceOverview';
import FinanceLoans from './finance/FinanceLoans';
import FinanceDisbursement from './finance/FinanceDisbursement';
import FinanceAnalytics from './finance/FinanceAnalytics';
import FinanceLedger from './finance/FinanceLedger';
import FinanceReports from './finance/FinanceReports';
import FinanceControl from './finance/FinanceControl';
import UnmatchedRepayments from './finance/UnmatchedRepayments';
import FinanceRepayments from "./finance/FinanceRepayments";
import StatementUpload from './finance/StatementUpload';
import CustomerCommunicator from './CustomerCommunicator';
import ProfileSettings from '../pages/ProfileSettings';

const FinanceDashboardWrapper = () => {
  return (
    <Layout>
      <Routes>
        <Route index element={<FinanceOverview />} />
        <Route path="overview" element={<FinanceOverview />} />
        <Route path="loans" element={<FinanceLoans />} />
        <Route path="disbursement" element={<FinanceDisbursement />} />
        <Route path="unmatched" element={<UnmatchedRepayments />} />
        <Route path="repayments" element={<FinanceRepayments />} />
        <Route path="upload" element={<StatementUpload />} />
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
