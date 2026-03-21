import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Zap, Ban, UserPlus, X, Mail, RefreshCw, ShieldAlert, UserMinus, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { loanService } from '../api/api';
import { useAdmins, useInvalidate } from '../hooks/useQueries';
import BulkInviteModal from '../components/forms/BulkInviteModal';

const SuperAdminPage = () => {
  const { user, activeRole } = useAuth();
  const { invalidateAdmins } = useInvalidate();

  // Consider as owner if role is OWNER or is_owner flag is true
  const isOwner = user?.role === 'OWNER' || user?.is_owner === true || activeRole === 'OWNER';

  // Invitation state
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { data: adminsData, isLoading: loading } = useAdmins();
  
  const admins = useMemo(() => {
    const data = adminsData?.results || adminsData || [];
    return Array.isArray(data) 
      ? data.filter(a => a.role === 'SUPER_ADMIN' && !a.is_owner)
      : [];
  }, [adminsData]);

  const handleSuspend = async (admin) => {
    const reason = window.prompt(`Reason for suspending ${admin.full_name}:`);
    if (!reason) return;
    try {
      await loanService.api.post(`/admins/${admin.id}/suspend/`, { reason });
      toast.success("Admin suspended");
      invalidateAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || "Action failed");
    }
  };

  const handleUnsuspend = async (admin) => {
    try {
      await loanService.api.post(`/admins/${admin.id}/unsuspend/`);
      toast.success("Admin unsuspended");
      invalidateAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || "Action failed");
    }
  };

  const toggleGodMode = async (admin) => {
    if (!isOwner) return;
    try {
      await loanService.api.patch(`/admins/${admin.id}/`, { 
        god_mode_enabled: !admin.god_mode_enabled 
      });
      toast.success(`God Mode ${!admin.god_mode_enabled ? 'enabled' : 'disabled'} for ${admin.full_name}`);
      invalidateAdmins();
    } catch (err) {
      toast.error("Failed to update God Mode");
    }
  };


  return (
    <div className="space-y-6">
      {/* Invite buttons — Owner only */}
      {isOwner && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button
            onClick={() => { setShowInviteModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Invite Super Admin
          </button>
        </div>
      )}

      {/* Invite Modal */}
      <BulkInviteModal 
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        defaultRole="SUPER_ADMIN"
      />

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShieldCheck className="w-8 h-8 text-purple-600" />
            <h2 className="text-xl font-bold dark:text-white">System Administrators</h2>
          </div>
          <button onClick={() => invalidateAdmins()} className="p-2 hover:bg-slate-100 rounded-lg">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto text-sm">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-medium italic">Loading system officials...</div>
          ) : admins.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-bold">No officials registered yet.</p>
              <p className="text-xs text-slate-400 mt-1 mb-6">Start by inviting a Super Admin to manage the system.</p>
              {isOwner && (
                <button
                  onClick={() => { setShowInviteModal(true); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-all shadow-md active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite Your First Super Admin
                </button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="text-left border-b dark:border-slate-800">
                  <th className="px-6 py-4">Administrator</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  {isOwner && <th className="px-6 py-4 text-center">God Mode</th>}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {admins.map(admin => (
                  <tr key={admin.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                    <td className="px-6 py-4 font-medium dark:text-white">{admin.full_name}<br/><span className="text-xs text-slate-500">{admin.email}</span></td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="px-2 py-1 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800 font-bold w-fit">{admin.role}</span>
                        {admin.god_mode_enabled && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 rounded text-[9px] font-black uppercase tracking-tighter w-fit">
                            <ShieldAlert className="w-2.5 h-2.5" /> God Mode
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {admin.suspended_at ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 dark:bg-rose-900/10 px-2 py-1 rounded font-bold text-[10px] uppercase">
                          <Ban className="w-3 h-3" /> Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-1 rounded font-bold text-[10px] uppercase">
                          <Zap className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    {isOwner && (
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => toggleGodMode(admin)}
                          className={`p-1.5 rounded-lg transition-all ${admin.god_mode_enabled ? 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                          {admin.god_mode_enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      {isOwner && admin.role !== 'OWNER' && (
                        <div className="flex justify-end gap-2">
                          {admin.suspended_at ? (
                            <button onClick={() => handleUnsuspend(admin)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-100">
                              <Zap className="w-4 h-4" />
                            </button>
                          ) : (
                            <button onClick={() => handleSuspend(admin)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100">
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPage;
