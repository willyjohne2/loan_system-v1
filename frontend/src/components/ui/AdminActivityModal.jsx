import React, { useEffect, useState } from 'react';
import { loanService } from '../../api/api';
import { Card, Button, Table } from '../ui/Shared';
import { X, Activity, User, Calendar, ExternalLink } from 'lucide-react';

const AdminActivityModal = ({ admin, isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (isOpen && admin) {
      fetchActivity();
    }
  }, [isOpen, admin]);

  const fetchActivity = async () => {
    setLoading(true);
    try {
      const data = await loanService.getAuditLogs();
      const allLogs = data.results || data || [];
      
      // Filter logs by this admin's ID
      // Assuming audit logs have an 'admin' or 'user' field that matches admin.id
      const adminLogs = allLogs.filter(log => log.admin === admin.id || log.user === admin.id);
      setLogs(adminLogs);
    } catch (err) {
      console.error('Error fetching admin activity:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <Card className="w-full max-w-3xl max-h-[85vh] overflow-hidden animate-in fade-in zoom-in duration-200 bg-white dark:bg-slate-900 border-none shadow-2xl flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 font-black text-xl">
              {admin.full_name?.[0]}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{admin.full_name}</h3>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> {admin.role?.replace('_', ' ')} Activity Feed
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 font-medium italic">Synthesizing activity trail...</p>
            </div>
          ) : logs.length > 0 ? (
            <div className="space-y-4">
              {logs.map((log, idx) => (
                <div key={log.id} className="flex gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className={`mt-1 p-2 rounded-lg shrink-0 ${
                    log.action?.includes('CREATE') ? 'bg-emerald-100 text-emerald-600' :
                    log.action?.includes('UPDATE') ? 'bg-blue-100 text-blue-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-slate-800 dark:text-slate-200 uppercase text-xs tracking-wider">
                        {log.action?.replace(/_/g, ' ')}
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Targeted record in <span className="font-bold text-slate-700 dark:text-slate-300">[{log.table_name}]</span>
                    </p>
                    {log.details && (
                        <div className="mt-2 text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2 rounded-lg font-mono text-slate-500 break-all">
                            {log.details}
                        </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400">No recent activity logs found for this account.</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex justify-between items-center">
            <p className="text-xs text-slate-400 italic">Logs are immutable and system-generated</p>
            <Button onClick={onClose}>Finish Review</Button>
        </div>
      </Card>
    </div>
  );
};

export default AdminActivityModal;
