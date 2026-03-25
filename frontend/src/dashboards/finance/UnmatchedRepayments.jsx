import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertCircle, 
  Search, 
  UserPlus, 
  MessageSquare, 
  Phone, 
  Calendar, 
  CheckCircle2, 
  Loader2,
  Clock,
  ExternalLink,
  Filter
} from 'lucide-react';
import { loanService } from '../../api/api';
import { useUnmatchedRepayments, useInvalidate } from '../../hooks/useQueries';
import { Card, Button, Badge } from '../../components/ui/Shared';
import toast from 'react-hot-toast';

const UnmatchedRepayments = () => {
  const { data: repaymentsData, isLoading: loading } = useUnmatchedRepayments();
  const { invalidateRepayments } = useInvalidate();
  const repayments = useMemo(() => repaymentsData || [], [repaymentsData]);

  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal for assigning
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [loanSearch, setLoanSearch] = useState('');
  const [loanResults, setLoanResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Clear the sidebar badge
    localStorage.setItem('last_repayment_check', new Date().toISOString());
  }, []);

  const handleLoanSearch = async (val) => {
    setLoanSearch(val);
    if (val.length < 3) {
      setLoanResults([]);
      return;
    }
    try {
      // Search loans by user name/phone/national_id/loan_id directly via API
      const res = await loanService.getLoans({ search: val, status: 'ACTIVE,OVERDUE' });
      const loans = Array.isArray(res) ? res : res.results || [];
      
      setLoanResults(loans.slice(0, 5));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssign = async (loanId) => {
    setSubmitting(true);
    try {
      await loanService.api.post('/repayments/assign-transaction/', {
        transaction_id: selectedTxn.id,
        loan_id: loanId
      });
      toast.success('Payment assigned successfully');
      setShowAssignModal(false);
      invalidateRepayments();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Assignment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSMSSender = async (txn) => {
    try {
      const msg = `Hello, we received KES ${parseFloat(txn.amount).toLocaleString()} on ${new Date(txn.transaction_date).toLocaleDateString()} referencing ${txn.account_ref}. Please contact us on 0712345678 with your loan details. - Azariah Credit Ltd`;
      await loanService.api.post('/notifications/direct-sms/', {
        phone: txn.sender_phone,
        message: msg
      });
      toast.success('SMS sent to customer');
      // Mark as contact attempted locally or refresh
      invalidateRepayments();
    } catch (e) {
      toast.error('Failed to send SMS');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const filteredRepayments = repayments.filter(r => 
    r.receipt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.sender_phone.includes(searchTerm) ||
    r.account_ref.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center border border-amber-200">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Unmatched Payments</h1>
            <p className="text-sm text-slate-500">Payments received via Paybill that couldn't be automatically matched to a loan.</p>
          </div>
        </div>
      </div>

      <Card className="p-4 flex flex-col md:flex-row gap-4 items-center bg-white/50 backdrop-blur-sm border-slate-200">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search by receipt, phone, or account ref..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="warning" className="px-3 py-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {repayments.length} Payments Pending
          </Badge>
        </div>
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-200">
              <th className="px-6 py-4">Receipt No</th>
              <th className="px-6 py-4">Sender Phone</th>
              <th className="px-6 py-4">Account Ref (Typed)</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-center">Wait Time</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRepayments.map(txn => (
              <tr 
                key={txn.id} 
                className={`transition-colors h-16 ${txn.needs_contact ? 'bg-amber-50/50 hover:bg-amber-100/50' : 'hover:bg-slate-50'}`}
              >
                <td className="px-6 py-3 font-mono text-xs font-bold">{txn.receipt_number}</td>
                <td className="px-6 py-3 text-sm">{txn.sender_phone}</td>
                <td className="px-6 py-3 text-sm">
                   <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{txn.account_ref}</span>
                        <span className="text-[10px] text-slate-500">{txn.sender_name || 'No name provided'}</span>
                   </div>
                </td>
                <td className="px-6 py-3 font-black text-emerald-600">KES {parseFloat(txn.amount).toLocaleString()}</td>
                <td className="px-6 py-3 text-xs text-slate-500">
                    <div className="flex flex-col">
                        <span>{new Date(txn.transaction_date).toLocaleDateString()}</span>
                        <span>{new Date(txn.transaction_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                </td>
                <td className="px-6 py-3 text-center">
                    <div className="flex flex-col items-center">
                        <span className={`text-xs font-bold ${txn.needs_contact ? 'text-amber-700' : 'text-slate-600'}`}>
                            {txn.days_waiting} Days
                        </span>
                        {txn.needs_contact && (
                            <Badge variant="warning" className="text-[8px] px-1 py-0 mt-1 uppercase">Contact Needed</Badge>
                        )}
                    </div>
                </td>
                <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-2">
                        {txn.needs_contact && (
                            <button 
                                onClick={() => handleSMSSender(txn)}
                                className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                                title="SMS Sender"
                            >
                                <MessageSquare className="w-4 h-4" />
                            </button>
                        )}
                        <Button 
                            size="sm" 
                            variant="primary" 
                            className="text-[11px] h-8 px-3"
                            onClick={() => {
                                setSelectedTxn(txn);
                                setShowAssignModal(true);
                            }}
                        >
                            Assign to Loan
                        </Button>
                    </div>
                </td>
              </tr>
            ))}
            {filteredRepayments.length === 0 && (
                <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500 italic">No unmatched payments found.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 relative animate-in zoom-in duration-200">
            <button 
              onClick={() => setShowAssignModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"
            >
              <Clock className="w-5 h-5 text-slate-400 rotate-45" />
            </button>
            
            <div className="mb-6">
              <h3 className="text-xl font-bold">Assign Payment</h3>
              <p className="text-sm text-slate-500">Receipt: <span className="font-mono font-bold text-slate-900">{selectedTxn.receipt_number}</span></p>
              <p className="text-sm text-slate-500">Amount: <span className="font-black text-emerald-600">KES {parseFloat(selectedTxn.amount).toLocaleString()}</span></p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input 
                  type="text"
                  placeholder="Search customer name or phone..."
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  value={loanSearch}
                  onChange={(e) => handleLoanSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {loanResults.map(loan => (
                  <div 
                    key={loan.id}
                    className="p-3 border border-slate-200 rounded-xl hover:bg-primary-50 hover:border-primary-200 cursor-pointer transition-all group"
                    onClick={() => handleAssign(loan.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold text-slate-900 group-hover:text-primary-700">{loan.user_full_name}</p>
                        <p className="text-xs text-slate-500">{loan.user_phone} • {loan.id.slice(0,8)}</p>
                      </div>
                      <Badge variant="primary">KES {parseFloat(loan.principal_amount).toLocaleString()}</Badge>
                    </div>
                  </div>
                ))}
                {loanSearch.length >= 3 && loanResults.length === 0 && (
                    <p className="text-center py-4 text-xs text-slate-400 italic">No matching active loans found.</p>
                )}
              </div>
            </div>

            <div className="mt-8">
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={() => setShowAssignModal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default UnmatchedRepayments;
