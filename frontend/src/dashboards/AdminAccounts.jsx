import React, { useState, useEffect } from 'react';
import { loanService } from '../api/api';
import { Trash2, AlertCircle, CheckCircle, UserPlus, Mail, Shield, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BulkInviteModal from '../components/forms/BulkInviteModal';

const AdminAccounts = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const data = await loanService.getAllAdmins();
      console.log('Admin accounts loaded:', data);
      setAdmins(data.results || data);
      setError('');
    } catch (err) {
      console.error('Error fetching admins:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError(`Failed to load admin accounts: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (admin) => {
    setConfirmDelete(admin);
  };

  const confirmDeleteAdmin = async () => {
    if (!confirmDelete) return;

    setDeletingId(confirmDelete.id);
    try {
      await loanService.deleteAdmin(confirmDelete.id);
      setSuccess(`Admin account (${confirmDelete.email}) deleted successfully!`);
      setAdmins(admins.filter(a => a.id !== confirmDelete.id));
      setConfirmDelete(null);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.response?.data?.error || 'Failed to delete admin account');
    } finally {
      setDeletingId(null);
    }
  };

  const cancelDelete = () => {
    setConfirmDelete(null);
  };

  const getRoleColor = (role) => {
    const colors = {
      ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      MANAGER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      FINANCIAL_OFFICER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      FIELD_OFFICER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    };
    return colors[role] || 'bg-slate-100 text-slate-800';
  };

  const getVerificationStatus = (is_verified) => {
    return is_verified ? (
      <span className="text-green-600 font-medium flex items-center gap-1">
        <CheckCircle className="w-4 h-4" /> Verified
      </span>
    ) : (
      <span className="text-yellow-600 font-medium">Pending</span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold">Administrative Accounts</h3>
          <p className="text-sm text-slate-500">System access control and user management</p>
        </div>
        <button 
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-md active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          Invite Associate
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-3 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Error</h3>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-start gap-3 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
          <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Success</h3>
            <p className="text-sm">{success}</p>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-sm w-full shadow-lg border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Delete Admin Account?
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              Are you sure you want to delete{' '}
              <strong>{confirmDelete.full_name}</strong> ({confirmDelete.email})?
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-6 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg font-medium transition-colors dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAdmin}
                disabled={deletingId === confirmDelete.id}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                {deletingId === confirmDelete.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500 dark:text-slate-400">Loading admin accounts...</div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900 dark:text-white">Name</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900 dark:text-white">Email</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900 dark:text-white">Role</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900 dark:text-white">Status</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900 dark:text-white">Phone</th>
                  <th className="px-6 py-3 text-right font-semibold text-slate-900 dark:text-white">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      No admin accounts found
                    </td>
                  </tr>
                ) : (
                  admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-slate-900 dark:text-white">{admin.full_name}</div>
                          {admin.is_super_admin && (
                            <span className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">
                              <Shield className="w-2.5 h-2.5" /> Super
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{admin.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(admin.role)}`}>
                          {admin.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getVerificationStatus(admin.is_verified)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{admin.phone || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        {user?.admin?.is_super_admin && admin.id !== user?.admin?.id && (
                          <button
                            onClick={() => handleDeleteClick(admin)}
                            disabled={deletingId === admin.id}
                            className="inline-flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete admin"
                          >
                            <Trash2 className="w-4 h-4" />
                            Dismiss
                          </button>
                        )}
                        {!user?.admin?.is_super_admin && <span className="text-xs text-slate-400 italic">Restricted</span>}
                        {user?.admin?.is_super_admin && admin.id === user?.admin?.id && <span className="text-xs text-primary-500 font-medium">You</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {admins.length > 0 && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Total: <strong>{admins.length}</strong> admin account(s)
        </div>
      )}

      {/* Bulk Invitation Modal */}
      <BulkInviteModal 
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        defaultRole="ADMIN"
        branches={['Kagio', 'Embu', 'Thika', 'Naivasha']}
      />
    </div>
  );
};

export default AdminAccounts;
