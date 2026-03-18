import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import OwnerLayout from './OwnerLayout';
import OwnerHome from './OwnerHome';
import OwnerAuditPage from './OwnerAuditPage';
import SecurityLogsPage from './SecurityLogsPage';
import OwnershipPage from './OwnershipPage';
import OfficialCommunicator from '../OfficialCommunicator';
import { useAuth } from '../../context/AuthContext';

// When Owner switches to God Mode view they go to admin dashboard
// These are Owner-only pages
const OwnerDashboardWrapper = () => {
  const { user } = useAuth();

  if (!user?.is_owner) return <Navigate to="/login" replace />;

  return (
    <OwnerLayout>
      <Routes>
        <Route index element={<OwnerHome />} />
        <Route path="dashboard" element={<OwnerHome />} />
        <Route path="audit" element={<OwnerAuditPage />} />
        <Route path="security-logs" element={<SecurityLogsPage />} />
        <Route path="ownership" element={<OwnershipPage />} />
        <Route path="communications" element={<OfficialCommunicator />} />
      </Routes>
    </OwnerLayout>
  );
};

export default OwnerDashboardWrapper;
