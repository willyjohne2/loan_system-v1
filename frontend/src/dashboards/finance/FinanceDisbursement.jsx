import React, { useState, useMemo } from 'react';
import { Send, MapPin, Search, CheckCircle2, AlertTriangle, X, Clock, Wallet, Phone } from 'lucide-react';
import { Card, Table, Button, Input, StatCard } from '../../components/ui/Shared';
import { loanService } from '../../api/api';
import toast from 'react-hot-toast';
import { useDisbursementQueue, useInvalidate } from '../../hooks/useQueries';
import { format } from 'date-fns';

const FinanceDisbursement = () => {
  const { data: loansData, isLoading: loading } = useDisbursementQueue();
  const { invalidateLoans, invalidateCapital } = useInvalidate();
  const loans = useMemo(() => loansData?.results || loansData || [], [loansData]);

  const [disbursing, setDisbursing] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [currentLoan, setCurrentLoan] = useState(null);
  const [disburseNote, setDisburseNote] = useState('');
  const [mpesaNumber, setMpesaNumber] = useState('');

  const branches = useMemo(() => {
    const unique = ['All Branches', ...new Set(loans.map(l => l.branch_name))];
    return unique;
  }, [loans]);

  const processedData = useMemo(() => {
    let result = [...loans];

    // 1. Sort - Handle Equal priority: Oldest creation remains top, but we want 
    // those RE-SUBMITTED (updated recently) to not jump the line unless it's their turn.
    // Standardizing to: Oldest "created_at" always first for fairness.
    result.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return timeA - timeB;
    });

    // 2. Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item => 
        (item.customer_name || '').toLowerCase().includes(q) ||
        (item.customer_id_number || '').toLowerCase().includes(q) ||
        (item.national_id || '').toLowerCase().includes(q) ||
        (item.id || '').toString().includes(q)
      );
    }

    // 3. Dropdown filters
    if (selectedBranch !== 'All Branches') {
      result = result.filter(item => item.branch_name === selectedBranch);
    }

    // 4. Date range
    if (dateFrom) result = result.filter(item => new Date(item.created_at) >= new Date(dateFrom));
    if (dateTo) result = result.filter(item => new Date(item.created_at) <= new Date(dateTo + 'T23:59:59'));

    return result;
  }, [loans, search, selectedBranch, dateFrom, dateTo]);

  const totalAmount = useMemo(() => {
    return processedData.reduce((sum, l) => sum + parseFloat(l.principal_amount), 0);
  }, [processedData]);

  const handleDisburse = async (loanId) => {
    setDisbursing(true);
    try {
      await loanService.api.post('/payments/disburse/', { 
        loan_id: loanId,
        mpesa_phone: mpesaNumber,
        confirmed: true,
        mode: 'single'
      });
      toast.success('Disbursement successful');
      setShowConfirmModal(false);
      invalidateLoans();
      invalidateCapital();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Disbursement failed');
    } finally {
      setDisbursing(false);
    }
  };

  const handleReject = async (loanId) => {
    const reason = window.prompt("Enter reason for rejection:");
    if (!reason) return;

    setDisbursing(true);
    try {
      await loanService.updateLoan(loanId, { 
        status: 'REJECTED',
        status_change_reason: reason 
      });
      toast.success('Loan rejected and returned to Manager');
      setShowConfirmModal(false);
      invalidateLoans();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rejection failed');
    } finally {
      setDisbursing(false);
    }
  };

  const handleBulkDisburse = async () => {
    if (!window.confirm(`You are about to disburse ${processedData.length} loans totalling KES ${totalAmount.toLocaleString()}. This cannot be reversed. Proceed?`)) return;
    
    setDisbursing(true);
    let successCount = 0;
    let failCount = 0;

    const results = await Promise.allSettled(
      processedData.map(loan => loanService.api.post('/payments/disburse/', { 
        loan_id: loan.id,
        confirmed: true,
        mode: 'single' 
      }))
    );

    results.forEach(res => {
      if (res.status === 'fulfilled') successCount++;
      else failCount++;
    });

    if (failCount === 0) {
      toast.success(`Bulk disbursement complete: All ${successCount} succeeded`);
    } else {
      toast.error(`Bulk disbursement finished: ${successCount} succeeded, ${failCount} failed`);
    }
    
    invalidateLoans();
    invalidateCapital();
    setDisbursing(false);
  };

  const openDisburseModal = (loan) => {
    setCurrentLoan(loan);
    setMpesaNumber(loan.customer_phone || '');
    setShowConfirmModal(true);
  };

  const formatKES = (val) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val);

  return (
    <div className="space-y-6">
      {/* Stat Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Clock}
          label="Loans Awaiting Disbursement"
          value={processedData.length}
          variant="indigo"
          className="bg-indigo-50 text-indigo-700"
          iconClassName="bg-indigo-100"
        />
        <StatCard
          icon={Wallet}
          label="Total to Disburse"
          value={formatKES(totalAmount)}
          variant="emerald"
          className="bg-emerald-50 text-emerald-700"
          iconClassName="bg-emerald-100"
        />
        <StatCard
          icon={MapPin}
          label="Branches in Queue"
          value={new Set(processedData.map(l => l.branch_name)).size}
          variant="blue"
          className="bg-blue-50 text-blue-700"
          iconClassName="bg-blue-100"
        />
      </div>

      {/* Filter Bar Redesign */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-slate-100">Disbursement Queue</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 ">Approved loans pending M-Pesa transfer</p>
          </div>
          {processedData.length > 0 && (
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm"
              onClick={handleBulkDisburse}
              disabled={disbursing}
            >
              <CheckCircle2 className="w-5 h-5" />
              Bulk Disburse {formatKES(totalAmount)}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search name, ID, loan number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-800 pl-9 py-2 text-sm focus:ring-2 focus:ring-primary-500/20 outline-none"
            />
          </div>

          <div className="relative w-full sm:w-44">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-primary-500/20 outline-none"
            >
              {branches.map(b => <option key={`branch-opt-${b}`} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">From</label>
            <input 
              type="date" 
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)} 
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary-500/20 outline-none" 
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">To</label>
            <input 
              type="date" 
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)} 
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary-500/20 outline-none" 
            />
          </div>

          <div className="bg-indigo-100 text-indigo-700 font-black text-xs px-3 py-1.5 rounded-full whitespace-nowrap mb-1">
            {processedData.length} Pending
          </div>
        </div>
      </div>

      <Card className="p-0 overflow-hidden min-w-0">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 /90 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">M-Pesa Number</th>
                <th className="px-6 py-3">Principal</th>
                <th className="px-6 py-3">Branch</th>
                <th className="px-6 py-3">Date Approved</th>
                <th className="px-4 py-3 bg-slate-50 dark:bg-slate-800 /90 sticky right-0 border-l border-slate-100 dark:border-slate-800">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-slate-500 dark:text-slate-400 ">Loading disbursement queue...</td>
                </tr>
              ) : processedData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-slate-500 dark:text-slate-400 ">No pending disbursements found</td>
                </tr>
              ) : (
                processedData.map((loan) => (
                  <tr key={loan.id} className="group hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-800/40 transition-colors relative">
                    <td className="px-6 py-4 border-l-4 border-l-transparent group-hover:border-l-emerald-500 transition-all">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 dark:text-white dark:text-slate-100 text-sm">
                          {loan.customer_name}
                        </span>
                        <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 inline-block mt-0.5 w-fit">
                          {loan.customer_id_number || loan.national_id || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-mono text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {loan.customer_phone}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">KES</span>
                        <span className="font-black text-emerald-700 text-sm">
                          {parseFloat(loan.principal_amount).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                        {loan.branch_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                          {format(new Date(loan.updated_at), 'dd MMM yyyy')}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {format(new Date(loan.updated_at), 'HH:mm')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 sticky right-0 bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 shadow-[-4px_0_8px_rgba(0,0,0,0.04)]">
                      <Button 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow-emerald-500/20 transition-all"
                        onClick={() => openDisburseModal(loan)}
                      >
                        <Send className="w-3.5 h-3.5" />
                        Disburse
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirmation Modal */}
      {showConfirmModal && currentLoan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full animate-in zoom-in-95 duration-200 p-6 rounded-2xl">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-7 h-7 text-emerald-600" />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white text-center mb-4">
              {currentLoan.customer_name}
            </h3>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Principal Amount</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white dark:text-slate-100">{formatKES(currentLoan.principal_amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Loan Product</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white dark:text-slate-100">{currentLoan.product_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Branch</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white dark:text-slate-100">{currentLoan.branch_name}</span>
              </div>
              {currentLoan.total_repayable_amount && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Total Repayable</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white dark:text-slate-100">{formatKES(currentLoan.total_repayable_amount)}</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">M-Pesa Phone Number</label>
                <Input
                  value={mpesaNumber}
                  onChange={(e) => setMpesaNumber(e.target.value)}
                  placeholder="Enter M-Pesa Number"
                  className="mt-1 rounded-xl"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  Ensure the phone number above belongs to the customer. Disbursements cannot be reversed once processed.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Button 
                  variant="primary" 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3"
                  onClick={() => handleDisburse(currentLoan.id)}
                  loading={disbursing}
                >
                  Confirm & Disburse {formatKES(currentLoan.principal_amount)}
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-xl py-3"
                  onClick={() => handleReject(currentLoan.id)}
                  disabled={disbursing}
                >
                  <X className="w-3.5 h-3.5 mr-2" />
                  Reject & Return to Manager
                </Button>
                
                <Button 
                  variant="secondary" 
                  className="w-full font-bold rounded-xl py-3"
                  onClick={() => setShowConfirmModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FinanceDisbursement;
