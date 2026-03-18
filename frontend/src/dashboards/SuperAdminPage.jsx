import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, Zap, AlertCircle, Ban, ArrowDown, UserMinus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { loanService } from '../api/api';

const SuperAdminPage = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAdmins = async () => {
    try {
      const res = await loanService.api.get('/admins/?role=ADMIN');
      // Handle paginated responses
      const data = res.data.results || res.data;
      setAdmins(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to load super admins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleSuspend = async (admin) => {
    const reason = window.prompt(`Reason for suspending ${admin.full_name}:`);
    if (!reason) return;
    try {
      await loanService.api.post(`/admins/${admin.id}/suspend/`, { reason });
      toast.success("Admin suspended");
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || "Action failed");
    }
  };

  const handleUnsuspend = async (admin) => {
    try {
      await loanService.api.post(`/admins/${admin.id}/unsuspend/`);
      toast.success("Admin unsuspended");
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || "Action failed");
    }
  };

  const handleToggleGodMode = async (admin) => {
    try {
      await loanService.api.post('/auth/god-mode/toggle/', {
        target_admin_id: admin.id,
        enabled: !admin.god_mode_enabled
      });
      toast.success(`God Mode ${!admin.god_mode_enabled ? 'enabled' : 'disabled'}`);
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || "Action failed");
    }
  };

  const handleRevoke = async (admin) => {
    const reason = window.prompt(`Reason for revoking rights from ${admin.full_name}:`);
    if (!reason) return;
    try {
      await loanService.api.post(`/admins/${admin.id}/revoke/`, { new_role: 'MANAGER', reason });
      toast.success("Role revoked/downgraded to Manager");
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || "Action failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary-500" />
                    Super Admin Console
                </h2>
                <p className="text-xs text-slate-500 font-medium">Manage top-level system administrators</p>
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name & Email</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Branch</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">God Mode</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date Added</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {admins.map(admin => (
                <tr key={admin.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {admin.full_name}
                            {admin.is_owner && <span className="text-[10px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full font-black">👑 OWNER</span>}
                        </span>
                        <span className="text-xs text-slate-500">{admin.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{admin.branch || 'HQ'}</td>
                  <td className="px-6 py-4">
                    {admin.god_mode_enabled || admin.is_owner ? (
                        <span className="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-black flex items-center gap-1 w-fit border border-amber-200 dark:border-amber-800">
                            <Zap className="w-3 h-3 fill-current" /> God Mode
                        </span>
                    ) : (
                        <span className="text-slate-400 text-[10px] font-bold">Standard</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {admin.is_blocked ? (
                         <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">Suspended</span>
                    ) : (
                        <span className="bg-green-100 text-green-600 text-[10px] px-2 py-0.5 rounded-full font-bold">Active</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">{new Date(admin.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    {user?.is_owner && !admin.is_owner && (
                        <div className="flex items-center justify-end gap-2">
                            <button 
                                onClick={() => handleToggleGodMode(admin)}
                                className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 rounded-lg transition-all"
                                title="Toggle God Mode"
                            >
                                <Zap className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => admin.is_blocked ? handleUnsuspend(admin) : handleSuspend(admin)}
                                className={`p-2 rounded-lg transition-all ${admin.is_blocked ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                                title={admin.is_blocked ? "Unsuspend" : "Suspend"}
                            >
                                <Ban className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => handleRevoke(admin)}
                                className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                                title="Revoke Rights"
                            >
                                <ArrowDown className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {admins.length === 0 && !loading && (
             <div className="p-10 text-center text-slate-400 font-medium">No super admins found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPage;
