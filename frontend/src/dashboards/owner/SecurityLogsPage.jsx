import React, { useEffect, useState } from 'react';
import { loanService } from '../../api/api';
import { Card } from '../../components/ui/Shared';
import { Shield, AlertTriangle } from 'lucide-react';

const SecurityLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await loanService.api.get('/security-logs/');
        setLogs(res.data?.results || res.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <div className="space-y-6" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-red-500" />
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Security Logs</h2>
          <p className="text-sm text-slate-500 mt-1">System security events — read only, no export</p>
        </div>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <p className="text-xs text-amber-700 font-medium">Security logs cannot be exported or downloaded. All viewing activity is recorded.</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b">
                <th className="p-4">Event</th>
                <th className="p-4">Performed By</th>
                <th className="p-4">IP Address</th>
                <th className="p-4">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="4" className="p-12 text-center text-slate-400">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="4" className="p-12 text-center text-slate-400 italic">No security events recorded</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="p-4 text-sm text-slate-800 max-w-xs">{log.action}</td>
                    <td className="p-4">
                      <p className="text-sm font-bold text-slate-900">{log.admin_name || 'System'}</p>
                      <p className="text-xs text-slate-400">{log.admin_role || ''}</p>
                    </td>
                    <td className="p-4 text-xs font-mono text-slate-500">{log.ip_address || '—'}</td>
                    <td className="p-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default SecurityLogsPage;
