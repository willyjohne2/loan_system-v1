import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  ArrowRight, 
  ShieldAlert,
  Server,
  UserCheck,
  Package2,
  AlertTriangle
} from 'lucide-react';
import { loanService } from '../../api/api';
import { useAuditLogs } from '../../hooks/useQueries';
import { Card } from '../../components/ui/Shared';
import toast from 'react-hot-toast';

const OwnerAuditPage = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    log_type: '',
    search: ''
  });

  const { data: auditData, isLoading: loading } = useAuditLogs({ 
    page: currentPage, 
    log_type: filters.log_type,
    search: filters.search 
  });

  const logs = useMemo(() => auditData?.results || [], [auditData]);
  const pagination = useMemo(() => ({
    count: auditData?.count || 0,
    next: auditData?.next,
    previous: auditData?.previous
  }), [auditData]);

  const fetchLogs = (page = 1) => {
    setCurrentPage(page);
  };


  const getLogTypeColor = (type) => {
    switch (type) {
      case 'SECURITY': return 'bg-red-400/10 text-red-500 border-red-500/20';
      case 'OWNERSHIP': return 'bg-purple-400/10 text-purple-400 border-purple-400/20';
      case 'SYSTEM': return 'bg-blue-400/10 text-blue-400 border-blue-400/20';
      case 'PAYMENT': return 'bg-green-400/10 text-green-400 border-green-400/20';
      default: return 'bg-slate-800/50 text-slate-400 border-slate-700/50';
    }
  };

  const getLogIcon = (type) => {
    switch (type) {
      case 'SECURITY': return <ShieldAlert className="w-4 h-4" />;
      case 'OWNERSHIP': return <UserCheck className="w-4 h-4" />;
      case 'SYSTEM': return <Server className="w-4 h-4" />;
      default: return <History className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3 tracking-tight">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <ShieldAlert className="text-indigo-400 w-7 h-7" />
            </div>
            System Owner Audit Trail
          </h1>
          <p className="text-slate-400 mt-2 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            Global transparency across all branches and super-admin actions
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search forensic logs..."
              className="w-full md:w-72 bg-slate-900/50 border border-slate-800 text-slate-200 pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 shadow-lg"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && fetchLogs(1)}
            />
          </div>
          
          <div className="relative flex-1 md:flex-none">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
            <select 
              className="w-full bg-slate-900/50 border border-slate-800 text-slate-200 pl-10 pr-10 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer shadow-lg"
              value={filters.log_type}
              onChange={(e) => setFilters(prev => ({ ...prev, log_type: e.target.value }))}
            >
              <option value="" className="bg-slate-900">All Classifications</option>
              <option value="OWNERSHIP" className="bg-slate-900">Ownership Changes</option>
              <option value="SECURITY" className="bg-slate-900">Security Threats</option>
              <option value="SYSTEM" className="bg-slate-900">System Logs</option>
              <option value="ADMIN" className="bg-slate-900">Administrative</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Security Alerts', count: logs.filter(l => l.log_type === 'SECURITY').length, color: 'text-red-400', bg: 'bg-red-400/10', icon: ShieldAlert },
          { label: 'System Ops', count: logs.filter(l => l.log_type === 'SYSTEM').length, color: 'text-blue-400', bg: 'bg-blue-400/10', icon: Server },
          { label: 'Asset Control', count: logs.filter(l => l.log_type === 'OWNERSHIP').length, color: 'text-purple-400', bg: 'bg-purple-400/10', icon: UserCheck },
          { label: 'Recorded Events', count: pagination.count, color: 'text-slate-400', bg: 'bg-slate-400/10', icon: History },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900/40 border border-slate-800/50 p-5 rounded-2xl backdrop-blur-sm group hover:border-indigo-500/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.1em]">{stat.label}</p>
                <p className="text-2xl font-black text-white mt-1.5 group-hover:scale-105 transition-transform origin-left">{stat.count}</p>
              </div>
              <div className={`p-3 ${stat.bg} ${stat.color} rounded-xl shadow-inner border border-white/5`}>
                <stat.icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Forensic Table */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl shadow-2xl backdrop-blur-md overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-indigo-500/5 border-b border-indigo-500/10">
                <th className="px-6 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Event Horizon</th>
                <th className="px-6 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Authorized Actor</th>
                <th className="px-6 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Security Rank</th>
                <th className="px-6 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Operation Digest</th>
                <th className="px-6 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Source Identity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="5" className="px-6 py-8">
                      <div className="h-5 bg-slate-800/40 rounded-xl w-full"></div>
                    </td>
                  </tr>
                ))
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-indigo-500/[0.03] transition-all group">
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-200 group-hover:text-indigo-300 transition-colors">
                        {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1 opacity-70">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600/20 to-violet-600/20 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-sm shadow-xl group-hover:rotate-12 transition-transform">
                          {log.admin_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-200 group-hover:text-white">{log.admin_name}</div>
                          <div className="text-[10px] text-indigo-400/60 font-black uppercase tracking-tighter">{log.branch_name || 'Global Root'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black border tracking-widest uppercase shadow-sm ${getLogTypeColor(log.log_type)}`}>
                        <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                        {log.log_type}
                      </span>
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-sm text-slate-300 leading-relaxed font-semibold group-hover:text-slate-100 max-w-sm">
                        {log.action}
                      </div>
                      {log.target_name && (
                        <div className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium border-l border-slate-700 pl-2">
                          <History size={10} className="text-indigo-500/50" /> Affecting: <span className="text-slate-400">{log.target_name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap text-right md:text-left">
                      <div className="inline-flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg group-hover:border-slate-700 group-hover:text-slate-300 transition-all">
                          {log.ip_address || 'Internal Network'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-32 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="relative mb-6">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
                        <div className="relative p-8 bg-slate-900/80 rounded-full border border-slate-800 shadow-2xl">
                          <AlertTriangle className="w-20 h-20 text-slate-700" />
                        </div>
                      </div>
                      <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Zero Events Detected</h3>
                      <p className="text-slate-500 text-sm max-w-xs mx-auto font-medium">
                        The forensic engine has no recorded events matching your current parameters.
                      </p>
                      <button 
                        onClick={() => setFilters({ log_type: '', search: '' })}
                        className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-xl shadow-indigo-600/20"
                      >
                        Reset Forensic Engine <History size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Improved Neon Pagination */}
        {pagination.count > 0 && (
          <div className="px-8 py-8 bg-slate-950/20 border-t border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1">Retrieval Metrics</p>
              <p className="text-xs font-bold text-slate-400">
                Displaying <span className="text-indigo-400">{(currentPage - 1) * 10 + 1}</span> 
                — <span className="text-indigo-400">{Math.min(currentPage * 10, pagination.count)}</span> 
                of <span className="text-indigo-400 font-extrabold">{pagination.count}</span> total records
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                disabled={!pagination.previous || loading}
                onClick={() => fetchLogs(currentPage - 1)}
                className="group flex items-center gap-2 pl-4 pr-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-800 rounded-2xl hover:bg-slate-800 hover:text-white disabled:opacity-20 transition-all"
              >
                <ArrowRight size={14} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                Previous
              </button>
              
              <div className="flex gap-1">
                {[...Array(Math.min(3, Math.ceil(pagination.count / 10)))].map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${currentPage === i + 1 ? 'bg-indigo-500' : 'bg-slate-800'}`} />
                ))}
              </div>

              <button
                disabled={!pagination.next || loading}
                onClick={() => fetchLogs(currentPage + 1)}
                className="group flex items-center gap-2 pl-5 pr-4 py-3 text-[10px] font-black text-white uppercase tracking-widest bg-indigo-600 rounded-2xl hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 disabled:opacity-20 transition-all"
              >
                Next
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerAuditPage;
