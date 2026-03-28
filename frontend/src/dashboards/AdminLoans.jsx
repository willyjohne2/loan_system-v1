import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { loanService } from '../api/api';
import { useInvalidate, useBranches, useCustomers, useLoanStats } from '../hooks/useQueries';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import PaginationFooter from '../components/ui/PaginationFooter';
import { Card, Table, Button } from '../components/ui/Shared';
import { Search, Filter, Calendar, Download, Eye, CheckCircle, XCircle, Clock, MessageSquareShare, FileCheck, Building2, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DateRangeFilter from '../components/ui/DateRangeFilter';
import ExportButton from '../components/ui/ExportButton';
import BulkCustomerSMSModal from '../components/ui/BulkCustomerSMSModal';
import CustomerHistoryModal from '../components/ui/CustomerHistoryModal';
import ChecklistModal from '../components/ui/ChecklistModal';
import useDebounce from '../hooks/useDebounce';

const FilterBar = ({ searchTerm, setSearchTerm, filterProduct, setFilterProduct, filterStatus, setFilterStatus, uniqueProducts, activeTab, dateRange, setDateRange, branchFilter, setBranchFilter, branches }) => (
  <Card className="p-0 overflow-hidden border-none shadow-sm dark:bg-slate-900">
    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col lg:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <input 
          className="pl-10 pr-4 py-2 w-full border rounded-lg text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all" 
          placeholder={`Search in ${activeTab.toLowerCase()} loans...`} 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative group min-w-[160px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
            <Building2 className="w-4 h-4 text-primary-500" />
          </div>
          <select 
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-sm bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 font-bold uppercase tracking-tight appearance-none shadow-sm transition-all hover:border-primary-300"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="all">ALL BRANCHES</option>
            {Array.isArray(branches) && branches.map(b => (
              <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-primary-500 transition-colors" />
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
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
              <option value="CLOSED">CLOSED</option>
            </>
          )}
          {activeTab === 'PENDING' && (
            <>
              <option value="UNVERIFIED">UNVERIFIED</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="APPROVED">APPROVED</option>              <option value="PENDING">PENDING</option>            </>
          )}
          {activeTab === 'REJECTED' && <option value="REJECTED">REJECTED</option>}
        </select>
      </div>
    </div>
  </Card>
);

const LOANS_QUERY_KEY = ['loans'];

const AdminLoans = () => {
  const { user } = useAuth();
  const { invalidateLoans } = useInvalidate();
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterProduct, setFilterProduct] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [activeTab, setActiveTab] = useState('ALL_DISBURSED'); // 'ACTIVE', 'PENDING', 'REJECTED'
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [showApprovalChecklist, setShowApprovalChecklist] = useState(false);
  const [loanPendingApproval, setLoanPendingApproval] = useState(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [branchFilter, setBranchFilter] = useState('all');
  const { data: branchesData } = useBranches();
  const { data: customersData } = useCustomers();
  const { data: stats } = useLoanStats();
  const customers = useMemo(() => {
    const list = customersData?.results || customersData || [];
    return list.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
  }, [customersData]);
  
  const branches = branchesData?.results || branchesData || [];
  
  const queryParams = useMemo(() => {
    let statusFilter = undefined;
    
    // Map Active Tab to specific statuses if user hasn't explicitly filtered
    if (filterStatus === 'ALL') {
      switch (activeTab) {
        case 'ALL_DISBURSED': 
          statusFilter = 'DISBURSED,ACTIVE,OVERDUE,CLOSED,REPAID'; 
          break;
        case 'ACTIVE': 
          statusFilter = 'ACTIVE'; 
          break;
        case 'OVERDUE': 
          statusFilter = 'OVERDUE'; 
          break;
        case 'APPROVED': 
          statusFilter = 'APPROVED'; 
          break;
        case 'PENDING': 
          statusFilter = 'UNVERIFIED,VERIFIED,PENDING'; 
          break;
        case 'REJECTED': 
          statusFilter = 'REJECTED'; 
          break;
        default:
          statusFilter = undefined;
      }
    } else {
      statusFilter = filterStatus;
    }

    return {
      search: debouncedSearch,
      status: statusFilter,
      date_from: dateRange.from || undefined,
      date_to: dateRange.to || undefined,
      branch: branchFilter === 'all' ? undefined : branchFilter,
      activeTab: activeTab, // To invalidate correctly
    };
  }, [debouncedSearch, filterStatus, dateRange, branchFilter, activeTab]);

  const {
    data: loans,
    isLoading: loading,
    isFetching,
    hasMore,
    canShowLess,
    showMore,
    showLess,
    totalCount,
    reset,
  } = usePaginatedQuery({
    queryKey: LOANS_QUERY_KEY,
    queryFn: (params) => loanService.getLoans(params),
    pageSize: 10,
    params: queryParams
  });

  // Removed manual reset callback to allow 'keepPreviousData' to work properly
  // useEffect(() => {
  //   reset();
  // }, [queryParams, reset]);

  const handleStatusUpdate = async (loanId, newStatus) => {
    setUpdatingId(loanId);
    try {
      await loanService.api.patch(`/loans/${loanId}/`, { status: newStatus });
      invalidateLoans(); // Refresh using React Query
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
        invalidateLoans();
      } else {
        alert("Disbursement Error: " + (response.data.ResponseDescription || response.data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Failed to disburse: " + (err.response?.data?.error || err.message));
    } finally {
      setUpdatingId(null);
    }
  };

  const processedLoans = useMemo(() => {
    let result = loans.filter(loan => {
      // Filter by Tab
      if (activeTab === 'ALL_DISBURSED' && !['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'].includes(loan.status)) return false;
      if (activeTab === 'ACTIVE' && loan.status !== 'ACTIVE') return false;
      if (activeTab === 'OVERDUE' && loan.status !== 'OVERDUE') return false;
      if (activeTab === 'APPROVED' && loan.status !== 'APPROVED') return false;
      if (activeTab === 'PENDING' && !['UNVERIFIED', 'VERIFIED', 'PENDING'].includes(loan.status)) return false;
      if (activeTab === 'REJECTED' && loan.status !== 'REJECTED') return false;

      const matchesStatus = filterStatus === 'ALL' || loan.status === filterStatus;
      const matchesProduct = filterProduct === 'ALL' || loan.product_name === filterProduct;
      const customer = customers[loan.user] || {};
      const customerName = customer.full_name || '';
      const matchesSearch = customerName.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                          loan.id.toString().includes(debouncedSearch) ||
                          (loan.product_name || '').toLowerCase().includes(debouncedSearch.toLowerCase());
      
      // Date filter
      if (dateRange.from && new Date(loan.created_at) < new Date(dateRange.from)) return false;
      if (dateRange.to) {
        const end = new Date(dateRange.to);
        end.setHours(23, 59, 59, 999);
        if (new Date(loan.created_at) > end) return false;
      }

      // Branch filter (Local filter for non-paginated results or extra safety)
      if (branchFilter !== 'all' && loan.branch_id !== branchFilter && loan.branch_name !== branchFilter) return false;

      return matchesStatus && matchesProduct && matchesSearch;
    });

    // Sorting: Rule [A] for Pending/Unverified -> Oldest First
    if (activeTab === 'PENDING') {
      result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else {
      // Newest First for others
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return result;
  }, [loans, activeTab, filterStatus, filterProduct, debouncedSearch, customers, dateRange]);

  const getTotals = (loansList) => {
    return loansList.reduce((acc, loan) => {
      acc.principal += Number(loan.principal_amount || 0);
      acc.repayable += Number(loan.total_repayable_amount || 0);
      return acc;
    }, { principal: 0, repayable: 0 });
  };

  const totals = getTotals(processedLoans);

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
      invalidateLoans();
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
           {user?.is_owner && (
             <ExportButton 
               resource="loans"
               dateRange={dateRange}
               filename={`all_loans_export_${new Date().toISOString().split('T')[0]}.csv`}
             />
           )}
           {(user?.role === 'FINANCE_OFFICER' || user?.role === 'FINANCIAL_OFFICER' || user?.god_mode_enabled) && (
             <Button 
               variant="primary" 
               className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-500/20 px-6 py-2"
               onClick={handleBulkDisbursement}
             >
                <FileCheck className="w-4 h-4" /> 
                Bulk Disburse (Queue)
             </Button>
           )}
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
          { id: 'ALL_DISBURSED', label: 'All Disbursed', icon: Building2 },
          { id: 'ACTIVE', label: 'Active Loans', icon: CheckCircle },
          { id: 'OVERDUE', label: 'Overdue Loans', icon: Clock },
          { id: 'APPROVED', label: 'Approved', icon: FileCheck },
          { id: 'PENDING', label: 'Pending Review', icon: Search },
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
              {(() => {
                if (!stats) return '-';
                if (tab.id === 'ALL_DISBURSED') return stats.all_disbursed;
                if (tab.id === 'ACTIVE') return stats.active;
                if (tab.id === 'OVERDUE') return stats.overdue;
                if (tab.id === 'APPROVED') return stats.approved;
                if (tab.id === 'PENDING') return stats.pending;
                if (tab.id === 'REJECTED') return stats.rejected;
                return 0;
              })()}
            </span>
          </button>
        ))}
      </div>

      <FilterBar 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterProduct={filterProduct}
        setFilterProduct={setFilterProduct}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        uniqueProducts={uniqueProducts}
        activeTab={activeTab}
        dateRange={dateRange}
        setDateRange={setDateRange}
        branchFilter={branchFilter}
        setBranchFilter={setBranchFilter}
        branches={branches}
      />

      <Card className="p-0 overflow-hidden">
        <Table
          headers={['Loan ID', 'Customer Profile', 'Product', 'Principal', 'Repayable', 'Submitted', 'Status', 'Actions']}
          data={loans}
          initialCount={10}
          maxHeight="max-h-[500px]"
          disableLocalPagination={true}
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
              <td className="px-6 py-4 text-xs font-black text-slate-500 uppercase">
                {new Date(loan.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
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
                      {loan.status === 'UNVERIFIED' && (!user?.is_owner || user?.god_mode_enabled) && (
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
                      {loan.status === 'VERIFIED' && (!user?.is_owner || user?.god_mode_enabled) && (
                        <button 
                          onClick={() => {
                            setLoanPendingApproval(loan.id);
                            setShowApprovalChecklist(true);
                          }}
                          className="p-1 px-2 text-[10px] font-bold bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-600 hover:text-white transition-colors border border-emerald-200"
                        >
                          APPROVE
                        </button>
                      )}
                        {(loan.status === 'APPROVED' || (loan.status === 'VERIFIED' && user?.role === 'FINANCE_OFFICER')) && (!user?.is_owner || user?.god_mode_enabled) && (user?.role === 'FINANCE_OFFICER' || user?.god_mode_enabled) && (
                        <button 
                          onClick={() => handleDisbursement(loan.id)}
                          className="p-1 px-2 text-[10px] font-bold bg-purple-50 text-purple-600 rounded hover:bg-purple-600 hover:text-white transition-colors border border-purple-200"
                        >
                          DISBURSE
                        </button>
                      )}
                      {['UNVERIFIED', 'VERIFIED'].includes(loan.status) && (!user?.is_owner || user?.god_mode_enabled) && (
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
        <PaginationFooter
          hasMore={hasMore}
          canShowLess={canShowLess}
          onShowMore={showMore}
          onShowLess={showLess}
          isFetching={isFetching}
          totalCount={totalCount}
          currentCount={loans.length}
        />
      </Card>

      <BulkCustomerSMSModal 
        isOpen={isBulkModalOpen} 
        onClose={() => setIsBulkModalOpen(false)} 
      />

      <ChecklistModal
        isOpen={showApprovalChecklist}
        onClose={() => {
          setShowApprovalChecklist(false);
          setLoanPendingApproval(null);
        }}
        onConfirm={() => {
          setShowApprovalChecklist(false);
          handleStatusUpdate(loanPendingApproval, 'APPROVED');
          setLoanPendingApproval(null);
        }}
        title="Approval Checklist — Review Before Approving"
        items={[
          "Customer profile is complete with all required documents",
          "National ID photo is clear and matches the customer's name on record",
          "Loan amount is within the customer's safe borrowing limit based on income",
          "Customer has no other active or overdue loans in the system",
          "Guarantor information is complete and valid",
          "Loan reason is acceptable and clearly stated",
          "Field Officer verification has been completed and submitted correctly"
        ]}
        confirmText="Confirm Approval"
        note="By approving this loan you take managerial responsibility for this decision. Ensure due diligence has been completed."
      />

      {selectedCustomer && (
        <CustomerHistoryModal 
          isOpen={isHistoryOpen}
          customer={selectedCustomer}
          loanToVerify={selectedLoan}
          onVerified={invalidateLoans}
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

