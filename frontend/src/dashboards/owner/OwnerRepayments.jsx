import React, { useState, useMemo } from 'react';
import { Wallet, Search, Filter, Download } from 'lucide-react';
import { Card, Table, Button, StatCard } from '../../components/ui/Shared';
import { useRepayments, useBranches } from '../../hooks/useQueries';
import DateRangeFilter from '../../components/ui/DateRangeFilter';
import ExportButton from '../../components/ui/ExportButton';
import { SkeletonStatCards, SkeletonCard } from '../../components/ui/Skeleton';

const OwnerRepayments = () => {
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [displayCount, setDisplayCount] = useState(10);

  const { data: repaymentsData, isLoading } = useRepayments();
  const { data: branchesData } = useBranches();

  const repayments = useMemo(() => {
    let raw = repaymentsData?.results || repaymentsData || [];
    
    // Search
    if (search) {
      const q = search.toLowerCase();
      raw = raw.filter(r => 
        r.customer_name?.toLowerCase().includes(q) || 
        r.reference_code?.toLowerCase().includes(q) ||
        r.loan_id?.toString().includes(q)
      );
    }

    // Branch filter
    if (selectedBranch !== 'all') {
      const selectedBranchName = branches.find(b => b.id === selectedBranch)?.name || selectedBranch;
      raw = raw.filter(r => r.branch_id === selectedBranch || r.branch_name === selectedBranchName || r.branch_name === selectedBranch);
    }

    // Date range
    if (dateRange.from) {
      raw = raw.filter(r => new Date(r.payment_date) >= new Date(dateRange.from));
    }
    if (dateRange.to) {
      raw = raw.filter(r => new Date(r.payment_date) <= new Date(dateRange.to + 'T23:59:59'));
    }

    // Sort newest first
    return [...raw].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
  }, [repaymentsData, search, selectedBranch, dateRange]);

  const branches = useMemo(() => branchesData?.results || branchesData || [], [branchesData]);

  const stats = useMemo(() => {
    const totalCollected = repayments.reduce((sum, r) => sum + Number(r.amount_paid || 0), 0);
    const count = repayments.length;
    const avg = count > 0 ? totalCollected / count : 0;
    return { totalCollected, count, avg };
  }, [repayments]);

  const formatKES = (val) => new Intl.NumberFormat('en-KE', { 
    style: 'currency', 
    currency: 'KES',
    maximumFractionDigits: 0 
  }).format(val);

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
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">System-Wide Repayments</h1>
          <p className="text-sm font-bold text-slate-500">Consolidated collection log from all branches</p>
        </div>
        <ExportButton exportType="repayments" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Collected" value={formatKES(stats.totalCollected)} icon={Wallet} variant="success" />
        <StatCard label="Number of Payments" value={stats.count.toLocaleString()} icon={Filter} variant="primary" />
        <StatCard label="Average Payment" value={formatKES(stats.avg)} icon={Search} variant="info" />
      </div>

      <Card className="p-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer, reference, loan ID..."
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
            <DateRangeFilter
              onFilter={(from, to) => setDateRange({ from, to })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table
            headers={['Customer', 'Amount Paid', 'M-Pesa Ref', 'Payment Date', 'Method', 'Notes']}
            data={repayments.slice(0, displayCount)}
            renderRow={(row) => (
              <tr key={row.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors">
                <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">{row.customer_name}</td>
                <td className="px-4 py-4 font-mono text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">{formatKES(row.amount_paid)}</td>
                <td className="px-4 py-4 font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 rounded inline-block mt-2 font-bold px-2 py-1">{row.reference_code || 'N/A'}</td>
                <td className="px-4 py-4 text-slate-500 font-medium">{new Date(row.payment_date).toLocaleDateString()}</td>
                <td className="px-4 py-4">
                  <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                    MPESA_PAYBILL
                  </span>
                </td>
                <td className="px-4 py-4 text-xs italic text-slate-400">N/A</td>
              </tr>
            )}
          />
        </div>

        {repayments.length === 0 && (
          <div className="py-12 text-center text-slate-400 italic font-medium">
            No repayments found matching your criteria.
          </div>
        )}

        <div className="mt-6 flex justify-center gap-4">
          {displayCount < repayments.length && (
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

export default OwnerRepayments;