import React, { useEffect, useState } from 'react';
import { loanService } from '../api/api';
import { Card, Table, Button } from '../components/ui/Shared';
import { Search, Filter, Download, Eye, CheckCircle, XCircle, Clock, MessageSquareShare, FileCheck } from 'lucide-react';
import BulkCustomerSMSModal from '../components/ui/BulkCustomerSMSModal';
import CustomerHistoryModal from '../components/ui/CustomerHistoryModal';
import { useDebounce } from '../hooks/useDebounce';

const AdminLoans = () => {
  const [loans, setLoans] = useState([]);
  const [customers, setCustomers] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterProduct, setFilterProduct] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [activeTab, setActiveTab] = useState('ACTIVE'); // 'ACTIVE', 'PENDING', 'REJECTED'
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchAllData = async (pageNum = 1, isReset = false) => {
    try {
      setLoading(true);
      const [loansData, customersData] = await Promise.all([
        loanService.getLoans({ 
          page: pageNum, 
          page_size: 10,
          search: debouncedSearch,
          status: filterStatus !== 'ALL' ? filterStatus : undefined
        }),
        loanService.getCustomers({ page_size: 1000 })
      ]);

      const loansList = loansData.results || loansData || [];
      const customersList = customersData.results || customersData || [];
      
      setHasMore(!!loansData.next);

      const customerMap = customersList.reduce((acc, c) => {
        acc[c.id] = c;
        return acc;
      }, {});

      setCustomers(customerMap);
      
      if (isReset) {
        setLoans(loansList);
      } else {
        setLoans(prev => [...prev, ...loansList]);
      }
    } catch (err) {
      console.error("Error fetching loans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchAllData(1, true);
  }, [debouncedSearch, filterStatus, activeTab]);

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

  const handleDisbursement = async (loanId) => {
    if (!window.confirm("Are you sure you want to trigger M-Pesa disbursement for this loan?")) return;
    
    setUpdatingId(loanId);
    try {
      // 1. Call the M-Pesa Disbursement API
      const response = await loanService.api.post('/payments/disburse/', { 
        loan_id: loanId,
        mode: 'single'
      });
      
      // The backend now returns a message on success and handles the status update
      if (response.data.message || response.data.status === 'success' || response.data.ResponseCode === '0' || response.data.status === 'MOCK_SUCCESS') {
        alert(response.data.message || "Disbursement initiated successfully!");
        await fetchAllData();
      } else {
        alert("Disbursement Error: " + (response.data.ResponseDescription || response.data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Failed to disburse: " + (err.response?.data?.error || err.message));
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredLoans = loans.filter(loan => {
    // Filter by Tab
    const isDisbursed = ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'].includes(loan.status);
    const isPending = ['UNVERIFIED', 'VERIFIED', 'APPROVED', 'PENDING'].includes(loan.status);
    const isRejected = loan.status === 'REJECTED';

    if (activeTab === 'ACTIVE' && !isDisbursed) return false;
    if (activeTab === 'PENDING' && !isPending) return false;
    if (activeTab === 'REJECTED' && !isRejected) return false;

    const matchesStatus = filterStatus === 'ALL' || loan.status === filterStatus;
    const matchesProduct = filterProduct === 'ALL' || loan.product_name === filterProduct;
    const customer = customers[loan.user] || {};
    const customerName = customer.full_name || '';
    const matchesSearch = customerName.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                         loan.id.toString().includes(debouncedSearch) ||
                         (loan.product_name || '').toLowerCase().includes(debouncedSearch.toLowerCase());
    return matchesStatus && matchesProduct && matchesSearch;
  });

  const getTotals = (loansList) => {
    return loansList.reduce((acc, loan) => {
      acc.principal += Number(loan.principal_amount || 0);
      acc.repayable += Number(loan.total_repayable_amount || 0);
      return acc;
    }, { principal: 0, repayable: 0 });
  };

  const totals = getTotals(filteredLoans);

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

  const handleBulkDisbursement = async () => {
    const queueCount = loans.filter(l => l.status === 'APPROVED').length;
    if (queueCount === 0) {
      alert("No approved loans in queue to disburse.");
      return;
    }
    
    if (!window.confirm(`Trigger automated disbursement for the next 20 loans in the queue (First Come First Served)? Current total approved: ${queueCount}`)) return;
    
    setLoading(true);
    try {
      const response = await loanService.api.post('/payments/disburse/', { mode: 'bulk' });
      const successCount = response.data.results?.filter(r => r.status === 'success').length || 0;
      const failCount = (response.data.results?.length || 0) - successCount;
      
      alert(`Bulk Disbursement Complete!\nSuccessful: ${successCount}\nFailed: ${failCount}`);
      await fetchAllData();
    } catch (err) {
      alert("Bulk Disbursement Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const uniqueProducts = [...new Set(loans.map(l => l.product_name).filter(Boolean))];

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
             className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-500/20 px-6 py-2"
             onClick={handleBulkDisbursement}
           >
              <FileCheck className="w-4 h-4" /> 
              Bulk Disburse (Queue)
           </Button>
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

      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {[
          { id: 'ACTIVE', label: 'Disbursed Portfolio', icon: CheckCircle },
          { id: 'PENDING', label: 'Pending Apps', icon: Clock },
          { id: 'REJECTED', label: 'Rejected', icon: XCircle }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setFilterStatus('ALL');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
              activeTab === tab.id 
                ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label.toUpperCase()}
            <span className="ml-1 bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded-full text-[10px]">
              {loans.filter(l => {
                const s = l.status;
                if (tab.id === 'ACTIVE') return ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'].includes(s);
                if (tab.id === 'PENDING') return ['UNVERIFIED', 'VERIFIED', 'APPROVED', 'PENDING'].includes(s);
                return s === 'REJECTED';
              }).length}
            </span>
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden border-none shadow-sm dark:bg-slate-900">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              className="pl-10 pr-4 py-2 w-full border rounded-lg text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all" 
              placeholder={`Search in ${activeTab.toLowerCase()} loans...`} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 font-bold"
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
            >
              <option value="ALL">ALL PRODUCTS</option>
              {uniqueProducts.map(p => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
            </select>
            <select 
              className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 font-bold"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">ALL STATUSES</option>
              {activeTab === 'ACTIVE' && (
                <>
                  <option value="DISBURSED">DISBURSED</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="OVERDUE">OVERDUE</option>
                </>
              )}
              {activeTab === 'PENDING' && (
                <>
                  <option value="UNVERIFIED">UNVERIFIED</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="APPROVED">APPROVED</option>
                </>
              )}
              {activeTab === 'REJECTED' && <option value="REJECTED">REJECTED</option>}
            </select>
          </div>
        </div>

      <Card className="p-0 overflow-hidden">
        <Table
          headers={['Loan ID', 'Customer Profile', 'Product', 'Principal', 'Repayable', 'Overdue By', 'Status', 'Actions']}
          data={filteredLoans}
          maxHeight="max-h-[500px]"
          renderRow={(loan) => (
            <tr key={loan.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
              <td className="px-6 py-4">
                 <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-primary-600 font-bold uppercase tracking-tighter border border-slate-200 dark:border-slate-700 shadow-sm">
                    {loan.id.substring(0, 8)}
                 </span>
              </td>
              <td className="px-6 py-4">
                <div className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">{customers[loan.user]?.full_name || 'Loading...'}</div>
                <div className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">
                  PH: {customers[loan.user]?.phone} | NAT: {customers[loan.user]?.profile?.national_id || 'N/A'}
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase">
                  {loan.product_name}
                </span>
              </td>
              <td className="px-6 py-4 text-sm font-black text-slate-700 dark:text-slate-200">
                KES {Number(loan.principal_amount).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                KES {Number(loan.total_repayable_amount).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-xs font-black text-rose-600">
                {loan.overdue_duration || '-'}
              </td>
              <td className="px-6 py-4">
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tight ${getStatusColor(loan.status)}`}>
                  {loan.status}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
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
                          REVIEW
                        </button>
                      )}
                      {loan.status === 'VERIFIED' && (
                        <button 
                          onClick={() => handleStatusUpdate(loan.id, 'APPROVED')}
                          className="p-1 px-2 text-[10px] font-bold bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-600 hover:text-white transition-colors border border-emerald-200"
                        >
                          APPROVE
                        </button>
                      )}
                        {loan.status === 'APPROVED' && (
                        <button 
                          onClick={() => handleDisbursement(loan.id)}
                          className="p-1 px-2 text-[10px] font-bold bg-purple-50 text-purple-600 rounded hover:bg-purple-600 hover:text-white transition-colors border border-purple-200"
                        >
                          DISBURSE
                        </button>
                      )}
                      {['UNVERIFIED', 'VERIFIED'].includes(loan.status) && (
                        <button 
                          onClick={() => handleStatusUpdate(loan.id, 'REJECTED')}
                          className="p-1 px-2 text-[10px] font-bold bg-rose-50 text-rose-600 rounded hover:bg-rose-600 hover:text-white transition-colors border border-rose-200"
                        >
                          REJECT
                        </button>
                      )}
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      setSelectedCustomer(customers[loan.user]);
                      setSelectedLoan(loan);
                      setIsHistoryOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-primary-600 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
        {hasMore && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-center">
            <Button 
              variant="secondary" 
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                fetchAllData(nextPage);
              }}
              disabled={loading}
              className="px-8 font-black uppercase tracking-widest text-xs"
            >
              {loading ? 'Processing...' : 'Load More Applications'}
            </Button>
          </div>
        )}
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

