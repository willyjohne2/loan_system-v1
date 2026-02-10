import React, { useEffect, useState } from 'react';
import { loanService } from '../api/api';
import { Card, Table, Button } from '../components/ui/Shared';
import { Search, Filter, Download, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';

const AdminLoans = () => {
  const [loans, setLoans] = useState([]);
  const [customers, setCustomers] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [loansData, customersData] = await Promise.all([
          loanService.getLoans(),
          loanService.getCustomers()
        ]);

        const loansList = loansData.results || loansData || [];
        const customersList = customersData.results || customersData || [];

        const customerMap = customersList.reduce((acc, c) => {
          acc[c.id] = c.full_name;
          return acc;
        }, {});

        setLoans(loansList);
        setCustomers(customerMap);
      } catch (err) {
        console.error("Error fetching loans:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredLoans = loans.filter(loan => {
    const matchesStatus = filterStatus === 'ALL' || loan.status === filterStatus;
    const customerName = customers[loan.user] || '';
    const matchesSearch = customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         loan.id.toString().includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'AWARDED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'REJECTED': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'PENDING': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'VERIFIED': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Loan Portfolio</h2>
          <p className="text-sm text-slate-500">Monitor and manage all loan applications across the system</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" /> Export CSV
           </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              className="pl-10 pr-4 py-2 w-full border rounded-lg text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none" 
              placeholder="Search by customer name or loan ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="UNVERIFIED">Unverified</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending Approval</option>
              <option value="AWARDED">Awarded</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Customer</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Amount</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Duration</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Applied On</th>
                <th className="text-right p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLoans.length > 0 ? (
                filteredLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-slate-900 dark:text-white">{customers[loan.user] || 'Unknown User'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{loan.id}</div>
                    </td>
                    <td className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      KES {Number(loan.principal_amount).toLocaleString()}
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      {loan.duration_months} Months
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(loan.status)}`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(loan.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-primary-600 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-400 text-sm italic">
                    No loans found matching your criteria.
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

export default AdminLoans;
