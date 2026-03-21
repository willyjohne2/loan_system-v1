import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Calendar, FileText } from 'lucide-react';
import { Card, Table, Input } from '../../components/ui/Shared';
import { loanService } from '../../api/api';
import { useRepayments } from '../../hooks/useQueries';
import toast from 'react-hot-toast';

const FinanceLedger = () => {
  const { data: repaymentsData, isLoading: loading } = useRepayments({ page_size: 1000 });
  const repayments = useMemo(() => repaymentsData?.results || repaymentsData || [], [repaymentsData]);

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    branch: 'All Branches'
  });

  const branches = useMemo(() => {
    if (!Array.isArray(repayments)) return ['All Branches'];
    const unique = ['All Branches', ...new Set(repayments.map(r => r.branch_name).filter(Boolean))];
    return unique;
  }, [repayments]);

  const filteredData = useMemo(() => {
    if (!Array.isArray(repayments)) return [];
    return repayments.filter(r => {
      const matchBranch = filters.branch === 'All Branches' || r.branch_name === filters.branch;
      const rDate = new Date(r.payment_date || r.created_at);
      const matchStart = !filters.startDate || rDate >= new Date(filters.startDate);
      const matchEnd = !filters.endDate || rDate <= new Date(filters.endDate + 'T23:59:59');
      return matchBranch && matchStart && matchEnd;
    });
  }, [repayments, filters]);

  const formatKES = (val) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Collection Ledger</h2>
        <p className="text-sm text-slate-500 mt-1">Full repayment history and reconciliation</p>
      </div>

      <Card className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-bold text-slate-400 uppercase">From Date</label>
          <div className="relative">
            <Input 
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="pl-10"
            />
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-bold text-slate-400 uppercase">To Date</label>
          <div className="relative">
            <Input 
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="pl-10"
            />
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-bold text-slate-400 uppercase">Branch</label>
          <div className="relative">
            <select
              value={filters.branch}
              onChange={(e) => setFilters(prev => ({ ...prev, branch: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-primary-500/20"
            >
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table
          headers={['Reference', 'Customer Name', 'National ID', 'Amount Paid', 'Date & Time', 'Status']}
          data={filteredData}
          loading={loading}
          renderRow={(r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600">{r.reference_code || r.transaction_reference}</td>
              <td className="px-6 py-4 font-medium text-slate-900">{r.customer_name}</td>
              <td className="px-6 py-4 text-slate-600">{r.national_id || r.customer_id_number || 'N/A'}</td>
              <td className="px-6 py-4 font-bold text-emerald-600">{formatKES(r.amount_paid || r.amount)}</td>
              <td className="px-6 py-4 text-slate-500">{new Date(r.payment_date || r.created_at).toLocaleString()}</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-emerald-700">Matched</span>
                </div>
              </td>
            </tr>
          )}
        />
      </Card>
    </div>
  );
};

export default FinanceLedger;
