import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, Server, Globe, User, Clock, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { loanService } from '../api/api';

const SecurityLogsPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await loanService.api.get('/security-logs/');
      setLogs(res.data);
    } catch (err) {
      toast.error("Failed to load security logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
      const description = log.action || log.message || "";
      const matchesSearch = description.toLowerCase().includes(search.toLowerCase()) || 
                          (log.admin_name && log.admin_name.toLowerCase().includes(search.toLowerCase()));
      const matchesFilter = filter === 'ALL' || log.log_type === filter;
      return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            Security & Compliance Logs
          </h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">System-wide critical events tracking</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
            <div className="relative group">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="Search logs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 w-full md:w-64 transition-all"
                />
            </div>
            <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-bold py-2 focus:ring-2 focus:ring-primary-500 transition-all"
            >
                <option value="ALL">All Types</option>
                <option value="SECURITY">Security Issues</option>
                <option value="PRIVILEGE">Privilege Escalation</option>
                <option value="AUTH">Authentication</option>
            </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
             <div className="p-10 text-center animate-pulse text-slate-400">Loading system audits...</div>
        ) : filteredLogs.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 font-medium">No logs matched your criteria.</div>
        ) : (
          filteredLogs.map((log, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col md:flex-row md:items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border-l-4 shadow-sm border-y border-r border-y-slate-100 dark:border-y-slate-800 border-r-slate-100 dark:border-r-slate-800 ${
                  log.log_type === 'SECURITY' ? 'border-l-red-500 bg-red-50/10' : 
                  log.log_type === 'PRIVILEGE' ? 'border-l-amber-500 bg-amber-50/10' : 
                  'border-l-primary-500'
              } transition-all hover:translate-x-1`}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={`p-2 rounded-lg shrink-0 ${
                    log.log_type === 'SECURITY' ? 'bg-red-100/50 text-red-600' : 
                    log.log_type === 'PRIVILEGE' ? 'bg-amber-100/50 text-amber-600' : 
                    'bg-primary-100/50 text-primary-600'
                }`}>
                    <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {log.action || log.message || "No description"}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 overflow-hidden">
                        <span className="text-[10px] flex items-center gap-1 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shadow-sm">
                            <Clock className="w-3 h-3" />
                            {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                        </span>
                        <span className="text-[10px] flex items-center gap-1 text-slate-500 font-medium">
                            <User className="w-3 h-3" />
                            {log.admin_name || 'System'}
                        </span>
                        <span className="text-[10px] flex items-center gap-1 text-slate-500 font-medium">
                            <Globe className="w-3 h-3" />
                            {log.ip_address || '0.0.0.0'}
                        </span>
                    </div>
                </div>
              </div>

              <div className="mt-4 md:mt-0 md:ml-6 flex items-center gap-2">
                 <span className={`text-[10px] font-black italic uppercase italic px-2 py-0.5 rounded cursor-default border ${
                    log.log_type === 'SECURITY' ? 'border-red-200 text-red-500' : 
                    log.log_type === 'PRIVILEGE' ? 'border-amber-200 text-amber-500' : 
                    'border-primary-200 text-primary-500'
                 }`}>
                    {log.log_type}
                 </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SecurityLogsPage;
