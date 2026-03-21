import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ShieldAlert, Server, Globe, User, Clock, Search, Filter, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { loanService } from '../api/api';
import { useSecurityLogs } from '../hooks/useQueries';
import { Button } from '../components/ui/Shared';

const SecurityLogsPage = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [emailSearch, setEmailSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [displayCount, setDisplayCount] = useState(10);

  const { data: logsData, isLoading: loading } = useSecurityLogs();
  const logs = useMemo(() => logsData?.results || logsData || [], [logsData]);

  const processedLogs = useMemo(() => {
    let result = [...logs];


    // 1. Sort - Newest first
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 2. Search (action, name, email)
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(log => 
        (log.action || '').toLowerCase().includes(q) ||
        (log.message || '').toLowerCase().includes(q) ||
        (log.admin_name || '').toLowerCase().includes(q)
      );
    }

    if (emailSearch.trim()) {
      const q = emailSearch.toLowerCase();
      result = result.filter(log => (log.admin_email || '').toLowerCase().includes(q));
    }

    // 3. Dropdown filters
    if (filter !== 'ALL') result = result.filter(log => log.log_type === filter);
    if (roleFilter !== 'ALL') result = result.filter(log => log.admin_role === roleFilter);

    // 4. Date range
    if (dateFrom) result = result.filter(log => new Date(log.created_at) >= new Date(dateFrom));
    if (dateTo) result = result.filter(log => new Date(log.created_at) <= new Date(dateTo + 'T23:59:59'));

    return result;
  }, [logs, search, emailSearch, filter, roleFilter, dateFrom, dateTo]);

  const visibleLogs = processedLogs.slice(0, displayCount);
  const hasMore = processedLogs.length > displayCount;
  const showLess = displayCount > 10;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            Security & Compliance Logs
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-bold tracking-tight">System-wide critical events tracking</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="Search logs/name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary-500 w-full md:w-48 transition-all"
                />
            </div>

            <div className="relative group">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="Email..."
                    value={emailSearch}
                    onChange={(e) => setEmailSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary-500 w-full md:w-32 transition-all"
                />
            </div>

            <div className="flex items-center gap-2">
                <input 
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-black py-2 focus:ring-2 focus:ring-primary-500 transition-all text-slate-700 dark:text-slate-200"
                />
                <input 
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-black py-2 focus:ring-2 focus:ring-primary-500 transition-all text-slate-700 dark:text-slate-200"
                />
            </div>

            <div className="flex items-center gap-2">
                <select 
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-black py-2 focus:ring-2 focus:ring-primary-500 transition-all text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                    <option value="ALL">All Roles</option>
                    <option value="OWNER">Owner</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="ADMIN">Admin</option>
                </select>

                <select 
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-black py-2 focus:ring-2 focus:ring-primary-500 transition-all text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                    <option value="ALL">All Types</option>
                    <option value="SECURITY">Security</option>
                    <option value="PRIVILEGE">Privilege</option>
                    <option value="AUTH">Auth</option>
                </select>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
             <div className="p-10 text-center animate-pulse text-slate-500 dark:text-slate-400 font-bold text-lg">Loading system audits...</div>
        ) : processedLogs.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-lg italic">No logs matched your criteria.</div>
        ) : (
          <>
            {visibleLogs.map((log, idx) => {
              const rowStyle = 
                log.log_type === 'SECURITY' ? 'bg-red-50 dark:bg-red-950/30 border-l-red-500' : 
                log.log_type === 'PRIVILEGE' ? 'bg-amber-50 dark:bg-amber-950/30 border-l-amber-500' : 
                log.log_type === 'AUTH' ? 'bg-blue-50 dark:bg-blue-950/30 border-l-blue-500' :
                'bg-white dark:bg-slate-900 border-l-slate-300';

              const iconContainerStyle = 
                log.log_type === 'SECURITY' ? 'bg-red-100 dark:bg-red-900/40 text-red-600' : 
                log.log_type === 'PRIVILEGE' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600' : 
                log.log_type === 'AUTH' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' :
                'bg-slate-100 dark:bg-slate-800 text-slate-600';

              const badgeStyle = 
                log.log_type === 'SECURITY' ? 'bg-red-600 text-white' : 
                log.log_type === 'PRIVILEGE' ? 'bg-amber-500 text-white' : 
                log.log_type === 'AUTH' ? 'bg-blue-600 text-white' :
                'bg-slate-600 text-white';

              return (
                <div 
                  key={idx} 
                  className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border-l-4 shadow-sm border-y border-r border-y-slate-100 dark:border-y-slate-800 border-r-slate-100 dark:border-r-slate-800 ${rowStyle} transition-all hover:translate-x-1`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-2.5 rounded-lg shrink-0 ${iconContainerStyle}`}>
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                            {log.action || log.message || "No description"}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm')}
                            </span>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {log.admin_name || 'System'} {log.admin_email && <span className="text-slate-500 dark:text-slate-400 font-medium ml-1">({log.admin_email})</span>}
                            </span>
                            <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                {log.ip_address || '0.0.0.0'}
                            </span>
                        </div>
                    </div>
                  </div>

                  <div className="mt-3 md:mt-0 md:ml-6 flex items-center gap-2">
                    <span className={`text-[11px] font-bold uppercase px-3 py-1 rounded-full ${badgeStyle}`}>
                        {log.log_type}
                    </span>
                  </div>
                </div>
              );
            })}
            
            {(hasMore || showLess) && (
              <div className="flex justify-center items-center gap-4 pt-6">
                {hasMore && (
                  <Button 
                    variant="primary" 
                    onClick={() => setDisplayCount(prev => prev + 10)}
                    className="px-8 py-2.5 font-bold uppercase tracking-tight text-sm flex items-center gap-2 rounded-xl"
                  >
                    <ChevronDown className="w-4 h-4" />
                    Show More (+10)
                  </Button>
                )}
                {showLess && (
                  <Button 
                    variant="secondary" 
                    onClick={() => setDisplayCount(10)}
                    className="px-8 py-2.5 font-bold uppercase tracking-tight text-sm flex items-center gap-2 rounded-xl"
                  >
                    <ChevronUp className="w-4 h-4" />
                    Show Less
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SecurityLogsPage;
