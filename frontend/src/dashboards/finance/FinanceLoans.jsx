import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, Briefcase } from 'lucide-react';
import { Card, Table, Button, StatCard } from '../../components/ui/Shared';
import { useLoans, useBranches } from '../../hooks/useQueries';
import DateRangeFilter from '../../components/ui/DateRangeFilter';
import ExportButton from '../../components/ui/ExportButton';
import { SkeletonStatCards, SkeletonCard } from '../../components/ui/Skeleton';

const FinanceLoans = () => {
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [displayCount, setDisplayCount] = useState(10);

  const { data: loansData, isLoading } = useLoans();
  const { data: branchesData } = useBranches();

  const loans = useMemo(() => {
    let raw = loansData?.results || loansData || [];
    
    // Search
    if (search) {
      const q = search.toLowerCase();
      raw = raw.filter(l => 
        l.customer_name?.toLowerCase().includes(q) || 
        l.id?.toString().toLowerCase().includes(q)
      );
    }

    // Branch filter
    if (selectedBranch !== 'all') {
      raw = raw.filter(l => l.branch === selectedBranch || l.branch_name === selectedBranch);
    }

    // Status filter
    if (selectedStatus !== 'all') {
      raw = raw.filter(l => l.status === selectedStatus);
    }

    // Date range
    if (dateRange.from) {
      raw = raw.filter(l => new Date(l.created_at || l.disbursed_at) >= new Date(dateRange.from));
    }
    if (dateRange.to) {
      raw = raw.filter(l => new Date(l.created_at || l.disbursed_at) <= new Date(dateRange.to + 'T23:59:59'));
    }

    // Sort newest first
    return [...raw].sort((a, b) => new Date(b.created_at || b.disbursed_at) - new Date(a.created_at || a.disbursed_at));
  }, [loansData, search, selectedBranch, selectedStatus, dateRange]);

  const branches = useMemo(() => branchesData?.results || branchesData || [], [branchesData]);

  const stats = useMemo(() => {
    const totalPrincipal = loans.reduce((sum, l) => sum + Number(l.principal_amount || 0), 0);
    const totalOutstanding = loans.reduce((sum, l) => sum + Number(l.remaining_balance || 0), 0);
    const count = loans.length;
    return { totalPrincipal, totalOutstanding, count };
  }, [loans]);

  const formatKES = (val) => new Intl.NumberFormat('en-KE', { 
    style: 'currency', 
    currency: 'KES',
    maximumFractionDigits: 0 
  }).format(val || 0);

  const STATUS_COLORS = {
    PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
    APPROVED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    OVERDUE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
    CLOSED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
  };

  if (isLoading) return (
    <div className="space-y-6">
      <SkeletonStatCards count={3} />
      <SkeletonCard />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Global Portfolio</h1>
          <p className="text-sm font-bold text-slate-500">Read-only view of all active and historical loans</p>
        </div>
        <ExportButton exportType="loans" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Principal" value={formatKES(stats.totalPrincipal)} icon={Briefcase} variant="primary" />
        <StatCard label="Total Outstanding" value={formatKES(stats.totalOutstanding)} icon={Filter} variant="warning" />
        <StatCard label="Total Loans" value={stats.count.toLocaleString()} icon={Search} variant="info" />
      </div>

      <Card className="p-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name or loan ID..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm py-2 px-4 focus:ring-2 focus:ring-primary-500"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="all">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm py-2 px-4 focus:ring-2 focus:ring-primary-500"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="ACTIVE">Active</option>
              <option value="OVERDUE">Overdue</option>
              <option value="CLOSED">Closed</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <DateRangeFilter
              onFilter={(from, to) => setDateRange({ from, to })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table
            headers={['Customer', 'Branch', 'Principal', 'Balance', 'Status', 'Date']}
            data={loans.slice(0, displayCount)}
            renderRow={(row) => (
              <tr key={row.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors">
                <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">{row.customer_name || 'N/A'}</td>
                <td className="px-4 py-4 text-slate-500">{row.branch_name || 'N/A'}</td>
                <td className="px-4 py-4 font-mono text-emerald-600 font-bold">{formatKES(row.principal_amount)}</td>
                <td className="px-4 py-4 font-mono text-rose-500 font-bold">{formatKES(row.remaining_balance)}</td>
                <td className="px-4 py-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${STATUS_COLORS[row.status] || STATUS_COLORS.PENDING}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-4 text-slate-500 font-medium">
                  {new Date(row.created_at || row.disbursed_at).toLocaleDateString()}
                </td>
              </tr>
            )}
          />
        </div>

        {loans.length === 0 && (
          <div className="py-12 text-center text-slate-400 italic font-medium">
            No loans found matching your criteria.
          </div>
        )}

        <div className="mt-6 flex justify-center gap-4">
          {displayCount < loans.length && (
            <Button variant="outline" onClick={() => setDisplayCount(prev => prev + 10)}>
              Show More
            </Button>
          )}
          {displayCount > 10 && (
            <Button variant="outline" onClick={() => setDisplayCount(10)}>
              Show Less
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default FinanceLoans;
