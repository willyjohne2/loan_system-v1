import React, { useEffect, useState } from 'react';
import { loanService } from '../api/api';
import { Table, Button } from '../components/ui/Shared';
import { UserPlus, Shield, Activity, ShieldOff } from 'lucide-react';
import AdminActivityModal from '../components/ui/AdminActivityModal';
import DeactivationRequestModal from '../components/ui/DeactivationRequestModal';
import BulkInviteModal from '../components/forms/BulkInviteModal';
import { useAuth } from '../context/AuthContext';

const AdminOfficers = ({ role = 'FINANCIAL_OFFICER' }) => {
  const { user } = useAuth();
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [showActivity, setShowActivity] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState('');

  // Deactivation Request State
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [officerToDeactivate, setOfficerToDeactivate] = useState(null);
  const [submittingDeactivation, setSubmittingDeactivation] = useState(false);

  const userRole = user?.role || user?.admin?.role;

  useEffect(() => {
    const fetchOfficers = async () => {
      try {
        console.log(`[AdminOfficers] Fetching ${role} officers...`);
        const fetch = role === 'FIELD_OFFICER' ? loanService.getFieldOfficers : loanService.getFinanceOfficers;
        const data = await fetch();
        console.log(`[AdminOfficers] Data for ${role}:`, data);
        const officersList = data.results || data || [];
        console.log(`[AdminOfficers] Processed list for ${role}:`, officersList);
        setOfficers(officersList);
        setError('');
      } catch (err) {
        console.error(`[AdminOfficers] Error fetching ${role} officers:`, err);
        console.error('[AdminOfficers] Error details:', err.response?.data || err.message);
        setError(`Failed to load ${role === 'FIELD_OFFICER' ? 'field' : 'finance'} officers: ${err.response?.data?.error || err.message}`);
        setOfficers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOfficers();
  }, [role]);

  const handleDeactivationSubmit = async (officerId, reason) => {
    setSubmittingDeactivation(true);
    try {
      await loanService.createDeactivationRequest({
        officer: officerId,
        reason: reason
      });
      setIsDeactivateModalOpen(false);
      setOfficerToDeactivate(null);
      alert("Deactivation request submitted successfully. Admin will review it.");
    } catch (err) {
      console.error("Error submitting deactivation request:", err);
      alert(err.response?.data?.error || "Failed to submit request.");
    } finally {
      setSubmittingDeactivation(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Loading officers...</div>

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">{role === 'FIELD_OFFICER' ? 'Field Officers' : 'Finance Officers'}</h3>
          <p className="text-sm text-slate-500">View and manage all active {role === 'FIELD_OFFICER' ? 'field' : 'finance'} officers.</p>
        </div>
        <Button 
          className="flex items-center"
          onClick={() => setIsInviting(true)}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Invite {role === 'FIELD_OFFICER' ? 'Field' : 'Finance'} Officers
        </Button>
      </div>

      {officers.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <p>No {role === 'FIELD_OFFICER' ? 'field' : 'finance'} officers registered yet</p>
        </div>
      ) : (
        <Table
          headers={['Name', 'Email', 'Phone', 'Status', 'Actions']}
          data={officers}
          renderRow={(officer) => (
            <tr key={officer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{officer.full_name}</td>
              <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{officer.email}</td>
              <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{officer.phone || '-'}</td>
              <td className="px-6 py-4">
                <div className="flex items-center text-xs text-indigo-600 font-medium">
                  <Shield className="w-3 h-3 mr-1" />
                  {officer.is_verified ? 'Verified' : 'Pending'}
                </div>
              </td>
              <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                <button 
                    onClick={() => {
                        setSelectedAdmin({...officer, role});
                        setShowActivity(true);
                    }}
                    className="flex items-center gap-1 text-slate-500 hover:text-primary-600 transition-colors"
                >
                    <Activity className="w-4 h-4" />
                    <span className="text-sm font-medium">Activity</span>
                </button>
                <button 
                  onClick={() => {
                    if (userRole === 'MANAGER') {
                      setOfficerToDeactivate(officer);
                      setIsDeactivateModalOpen(true);
                    } else if (window.confirm(`Are you sure you want to deactivate ${officer.full_name}? They will be immediately logged out.`)) {
                      loanService.updateAdmin(officer.id, { is_blocked: true })
                        .then(() => {
                          alert("Officer deactivated successfully.");
                          window.location.reload();
                        })
                        .catch(err => alert("Error: " + (err.response?.data?.error || err.message)));
                    }
                  }}
                  className="text-rose-600 hover:text-rose-700 text-sm font-medium"
                >
                  {userRole === 'MANAGER' ? 'Request Suspension' : 'Deactivate'}
                </button>
              </td>
            </tr>
          )}
        />
      )}

      {selectedAdmin && (
          <AdminActivityModal 
            admin={selectedAdmin}
            isOpen={showActivity}
            onClose={() => {
                setShowActivity(false);
                setSelectedAdmin(null);
            }}
          />
      )}

      <DeactivationRequestModal
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        officer={officerToDeactivate}
        onSubmit={handleDeactivationSubmit}
        loading={submittingDeactivation}
      />

      <BulkInviteModal 
        isOpen={isInviting}
        onClose={() => setIsInviting(false)}
        defaultRole={role}
        branches={['Kagio', 'Embu', 'Thika', 'Naivasha']}
      />
    </div>
  );
};

export default AdminOfficers;
