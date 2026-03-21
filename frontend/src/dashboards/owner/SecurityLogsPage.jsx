import React, { useEffect, useState, useMemo } from 'react';
import { loanService } from '../../api/api';
import { useSecurityLogs } from '../../hooks/useQueries';
import { Card, Button, Table } from '../../components/ui/Shared';
import { Shield, AlertTriangle, Search, Filter, Mail, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

const SecurityLogsPage = () => {
  const [search, setSearch] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [displayCount, setDisplayCount] = useState(10);

  const { data: logsData, isLoading: loading } = useSecurityLogs();
  const logs = useMemo(() => logsData?.results || logsData || [], [logsData]);

  const processedLogs = useMemo(() => {
    let result = [...logs];


    // 1. Sort - Newest first
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 2. Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(log => 
        (log.action || '').toLowerCase().includes(q) ||
        (log.admin_name || '').toLowerCase().includes(q)
      );
    }
    if (emailSearch.trim()) {
      const q = emailSearch.toLowerCase();
      result = result.filter(log => (log.admin_email || '').toLowerCase().includes(q));
    }

    // 3. Dropdown filters
    if (filterType !== 'ALL') result = result.filter(log => log.log_type === filterType);

    // 4. Date range
    if (dateFrom) {
      const startOfDay = new Date(dateFrom);
      startOfDay.setHours(0, 0, 0, 0);
      result = result.filter(log => new Date(log.created_at) >= startOfDay);
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      result = result.filter(log => new Date(log.created_at) <= endOfDay);
    }

    return result;
  }, [logs, search, emailSearch, filterType, dateFrom, dateTo]);

  const visibleLogs = processedLogs.slice(0, displayCount);
  const hasMore = processedLogs.length > displayCount;

  return (
    <div className="space-y-6" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-red-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Security Logs</h2>
            <p className="text-sm text-slate-500 mt-1">System security events — read only, no export</p>
          </div>
        </div>
      </div>

      <div className="p-3 bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-xl flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
        <p className="text-xs text-rose-700 dark:text-rose-400 font-bold uppercase tracking-tight">Security logs cannot be exported. All viewing activity is audited in real-time.</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 px-5 py-4 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4 transition-all hover:shadow-lg">
        <div className="relative flex-1 min-w-[240px] group">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by action or admin name..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2.5 w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all placeholder:text-slate-400 font-medium"
          />
        </div>

        <div className="relative min-w-[200px] group">
          <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Filter by email..." 
            value={emailSearch}
            onChange={(e) => setEmailSearch(e.target.value)}
            className="pl-10 pr-4 py-2.5 w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all placeholder:text-slate-400 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-1 rounded-xl border border-slate-100 dark:border-slate-800 group focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
          <Filter className="w-4 h-4 text-slate-400 group-focus-within:text-primary-500" />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-transparent border-none text-xs font-black uppercase tracking-widest py-2 focus:ring-0 outline-none cursor-pointer text-slate-600 dark:text-slate-300"
          >
            <option value="ALL">ALL LOG TYPES</option>
            <option value="SECURITY">SECURITY</option>
            <option value="PRIVILEGE">PRIVILEGE</option>
            <option value="AUTH">AUTH</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800 group focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
          <Calendar className="w-4 h-4 text-slate-400 group-focus-within:text-primary-500" />
          <input 
            type="date" 
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-transparent border-none text-[10px] font-bold py-0.5 focus:ring-0 outline-none text-slate-600 dark:text-slate-300 uppercase"
          />
          <span className="text-slate-300 font-light px-1">|</span>
          <input 
            type="date" 
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-transparent border-none text-[10px] font-bold py-0.5 focus:ring-0 outline-none text-slate-600 dark:text-slate-300 uppercase"
          />
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-none shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <Table
          headers={['Type', 'Event', 'Produced By', 'IP Address', 'Timeline']}
          data={processedLogs}
          initialCount={10}
          renderRow={(log) => {
            const typeDot = 
              log.log_type === 'SECURITY' ? 'bg-rose-600 shadow-rose-500/50 shadow-lg' : 
              log.log_type === 'PRIVILEGE' ? 'bg-amber-500 shadow-amber-500/50 shadow-lg' : 
              log.log_type === 'AUTH' ? 'bg-indigo-600 shadow-indigo-500/50 shadow-lg' :
              'bg-slate-400';

            return (
              <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all border-b border-slate-100 dark:border-slate-800 last:border-0 group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                     <div className={`w-2 h-2 rounded-full ${typeDot}`}></div>
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                       {log.log_type}
                     </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {log.action || log.message}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <p className="text-sm font-black text-slate-700 dark:text-slate-300">{log.admin_name || 'SYSTEM'}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter opacity-70">{log.admin_email || 'Core Engine'}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm">
                    {log.ip_address || '127.0.0.1'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col items-end">
                    <p className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase">{format(new Date(log.created_at), 'dd MMM yyyy')}</p>
                    <p className="text-[10px] text-slate-400 font-mono tracking-widest">{format(new Date(log.created_at), 'HH:mm:ss')}</p>
                  </div>
                </td>
              </tr>
            );
          }}
        />
      </Card>
    </div>
  );
};

export default SecurityLogsPage;
