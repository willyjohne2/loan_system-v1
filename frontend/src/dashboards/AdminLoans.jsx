import React, { useEffect, useState } from 'react';
import { loanService } from '../api/api';
import { Card, Table, Button } from '../components/ui/Shared';
import { Search, Filter, Download, Eye, CheckCircle, XCircle, Clock, MessageSquareShare, FileCheck } from 'lucide-react';
import BulkCustomerSMSModal from '../components/ui/BulkCustomerSMSModal';
import CustomerHistoryModal from '../components/ui/CustomerHistoryModal';

const AdminLoans = () => {
  const [loans, setLoans] = useState([]);
  const [customers, setCustomers] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchAllData = async () => {
    try {
      const [loansData, customersData] = await Promise.all([
        loanService.getLoans(),
        loanService.getCustomers()
      ]);

      const loansList = loansData.results || loansData || [];
      const customersList = customersData.results || customersData || [];

      const customerMap = customersList.reduce((acc, c) => {
        acc[c.id] = c;
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

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleStatusUpdate = async (loanId, newStatus) => {
    setUpdatingId(loanId);
    try {
      await loanService.api.patch(`/loans/${loanId}/`, { status: newStatus });
      await fetchAllData(); // Refresh
    } catch (err) {
      alert("Failed to update status: " + (err.response?.data?.error || err.message));
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredLoans = loans.filter(loan => {
    const matchesStatus = filterStatus === 'ALL' || loan.status === filterStatus;
    const customer = customers[loan.user] || {};
    const customerName = customer.full_name || '';
    const matchesSearch = customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         loan.id.toString().includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'AWARDED': 
      case 'APPROVED':
      case 'DISBURSED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'REJECTED': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'PENDING': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'VERIFIED': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'UNVERIFIED': return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
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
          <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Loan Management</h2>
          <p className="text-sm text-slate-500">Track lifecycle from verification to disbursement</p>
        </div>
        <div className="flex gap-2">
           <Button 
             variant="primary" 
             className="bg-orange-600 hover:bg-orange-700 flex items-center gap-2 shadow-lg shadow-orange-500/20 px-6 py-2"
             onClick={() => setIsBulkModalOpen(true)}
           >
              <MessageSquareShare className="w-4 h-4" /> 
              Broadcast SMS
           </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-none shadow-sm dark:bg-slate-900">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              className="pl-10 pr-4 py-2 w-full border rounded-lg text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all" 
              placeholder="Search by customer name or loan ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 font-bold"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">ALL STATUSES</option>
              <option value="UNVERIFIED">UNVERIFIED</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="DISBURSED">DISBURSED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="text-left p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Customer Profile</th>
                <th className="text-left p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Principal</th>
                <th className="text-left p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Duration</th>
                <th className="text-left p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                <th className="text-right p-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLoans.length > 0 ? (
                filteredLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white">{customers[loan.user]?.full_name || 'Loading...'}</div>
                      <div className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">{loan.id.split('-')[0]}... (Ref)</div>
                    </td>
                    <td className="p-4 text-sm font-black text-slate-700 dark:text-slate-200">
                      KES {Number(loan.principal_amount).toLocaleString()}
                    </td>
                    <td className="p-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                      {loan.duration_weeks ? `${loan.duration_weeks} Weeks` : `${loan.duration_months} Months`}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tight ${getStatusColor(loan.status)}`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {updatingId === loan.id ? (
                           <div className="animate-spin w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full mr-2" />
                        ) : (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {loan.status === 'UNVERIFIED' && (
                              <button 
                                onClick={() => {
                                  setSelectedCustomer(customers[loan.user]);
                                  setSelectedLoan(loan);
                                  setIsHistoryOpen(true);
                                }}
                                className="p-1 px-3 text-[10px] font-black bg-blue-600 text-white rounded hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
                              >
                                REVIEW & VERIFY
                              </button>
                            )}
                            {loan.status === 'VERIFIED' && (
                              <button 
                                onClick={() => handleStatusUpdate(loan.id, 'APPROVED')}
                                className="p-1 px-2 text-[10px] font-bold bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-600 hover:text-white transition-colors"
                              >
                                APPROVE
                              </button>
                            )}
                             {loan.status === 'APPROVED' && (
                              <button 
                                onClick={() => handleStatusUpdate(loan.id, 'DISBURSED')}
                                className="p-1 px-2 text-[10px] font-bold bg-purple-50 text-purple-600 rounded hover:bg-purple-600 hover:text-white transition-colors"
                              >
                                DISBURSE
                              </button>
                            )}
                            {['UNVERIFIED', 'VERIFIED'].includes(loan.status) && (
                              <button 
                                onClick={() => handleStatusUpdate(loan.id, 'REJECTED')}
                                className="p-1 px-2 text-[10px] font-bold bg-rose-50 text-rose-600 rounded hover:bg-rose-600 hover:text-white transition-colors"
                              >
                                REJECT
                              </button>
                            )}
                          </div>
                        )}
                        <button 
                          onClick={() => {
                            setSelectedCustomer(customers[loan.user]);
                            setIsHistoryOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-400 text-sm italic">
                    No loan applications found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <BulkCustomerSMSModal 
        isOpen={isBulkModalOpen} 
        onClose={() => setIsBulkModalOpen(false)} 
      />

      {selectedCustomer && (
        <CustomerHistoryModal 
          isOpen={isHistoryOpen}
          customer={selectedCustomer}
          loanToVerify={selectedLoan}
          onVerified={fetchAllData}
          onClose={() => {
            setIsHistoryOpen(false);
            setSelectedCustomer(null);
            setSelectedLoan(null);
          }}
        />
      )}
    </div>
  );
};

export default AdminLoans;

