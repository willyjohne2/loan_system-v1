import React, { useEffect, useState } from 'react';
import { loanService } from '../api/api';
import { Card } from '../components/ui/Shared';
import { History, Search, Filter, TrendingUp } from 'lucide-react';

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [dailyAudit, setDailyAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');

  const fetchData = async (type = '') => {
    setLoading(true);
    try {
      const params = {};
      if (type) params.type = type;
      
      const [logsData, analyticsData] = await Promise.all([
        loanService.getAuditLogs(params),
        loanService.api.get('/loan-analytics/')
      ]);

      setLogs(logsData.results || logsData || []);
      setDailyAudit(analyticsData.daily_disbursements || []);
    } catch (err) {
      console.error("Fetch audit data error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(filterType);
  }, [filterType]);

  if (loading && logs.length === 0) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Financial Accountability Table */}
      <Card className="p-0 overflow-hidden border-none shadow-sm">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Financial Management Audit (Daily Disbursements)
          </h3>
          <p className="text-sm text-slate-500">Summary of total loans disbursed per day for transparency and accountability.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Disbursement Date</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Number of Loans</th>
                <th className="text-right p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total Amount (KES)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {dailyAudit.length > 0 ? (
                dailyAudit.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="p-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                      {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      {item.count} Loan(s)
                    </td>
                    <td className="p-4 text-right text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(item.amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="p-8 text-center text-slate-400 text-sm italic">
                    No disbursement records found for the past 30 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <History className="w-5 h-5 text-primary-600" />
              General Audit Trail
            </h3>
            <p className="text-sm text-slate-500">Search and filter every transaction and security event.</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
             <div className="relative flex-1 md:flex-none">
                <select 
                  className="pl-4 pr-10 py-2 border dark:border-slate-700 rounded-lg text-sm w-full md:w-48 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="STATUS">Status Changes</option>
                  <option value="COMMUNICATION">Communications</option>
                  <option value="MANAGEMENT">Management</option>
                  <option value="GENERAL">General</option>
                </select>
                <Filter className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
             </div>
             <div className="relative flex-1 md:flex-none">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input 
                  className="pl-10 pr-4 py-2 border dark:border-slate-700 rounded-lg text-sm w-full md:w-64 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500" 
                  placeholder="Search actions..." 
                />
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Timestamp</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Category</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Action</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Entity</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.log_type === 'STATUS' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        log.log_type === 'COMMUNICATION' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        log.log_type === 'MANAGEMENT' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
                      }`}>
                        {log.log_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{log.action}</p>
                    </td>
                    <td className="p-4 text-xs font-mono text-slate-500 dark:text-slate-400">{log.table_name || 'N/A'}</td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {log.new_data ? JSON.stringify(log.new_data) : 'No extra data'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-400 italic text-sm">
                    {loading ? 'Refreshing...' : 'No logs found for this criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminAuditLogs;
