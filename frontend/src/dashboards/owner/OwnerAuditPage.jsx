import React, { useState, useEffect } from 'react';
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
import { Card } from '../../components/ui/Shared';
import toast from 'react-hot-toast';

const OwnerAuditPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ count: 0, next: null, previous: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    log_type: '',
    search: ''
  });

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const response = await loanService.getOwnerAuditLogs({ 
        page, 
        log_type: filters.log_type,
        search: filters.search 
      });
      setLogs(response.results || []);
      setPagination({
        count: response.count,
        next: response.next,
        previous: response.previous
      });
      setCurrentPage(page);
    } catch (error) {
      toast.error('Failed to load system-wide logs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters.log_type]);

  const getLogTypeColor = (type) => {
    switch (type) {
      case 'SECURITY': return 'bg-red-100 text-red-700 border-red-200';
      case 'OWNERSHIP': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'SYSTEM': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'PAYMENT': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="text-red-600" />
            System Owner Audit Trail
          </h1>
          <p className="text-gray-500">Global transparency across all branches and super-admin actions</p>
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search logs..."
              className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none w-64"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && fetchLogs(1)}
            />
          </div>
          
          <select 
            className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none"
            value={filters.log_type}
            onChange={(e) => setFilters(prev => ({ ...prev, log_type: e.target.value }))}
          >
            <option value="">All Log Types</option>
            <option value="OWNERSHIP">Ownership Changes</option>
            <option value="SECURITY">Security Events</option>
            <option value="SYSTEM">System Updates</option>
            <option value="ADMIN">Admin Actions</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-bottom border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actor</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="5" className="px-6 py-8 h-16 bg-gray-50/50"></td>
                  </tr>
                ))
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs">
                          {log.admin_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{log.admin_name}</div>
                          <div className="text-xs text-gray-500">{log.branch_name || 'System Root'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getLogTypeColor(log.log_type)}`}>
                        {getLogIcon(log.log_type)}
                        {log.log_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-md">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-mono text-gray-400">
                      {log.ip_address || '---'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    No matching audit records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={() => fetchLogs(currentPage - 1)}
            disabled={!pagination.previous || loading}
            className="px-4 py-2 border rounded-md text-sm font-medium bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {Math.ceil(pagination.count / 10) || 1}
          </span>
          <button
            onClick={() => fetchLogs(currentPage + 1)}
            disabled={!pagination.next || loading}
            className="px-4 py-2 border rounded-md text-sm font-medium bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default OwnerAuditPage;
