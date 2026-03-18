import React, { useState, useEffect, useMemo } from 'react';
import { Send, MapPin, Search, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { Card, Table, Button, Input } from '../../components/ui/Shared';
import { loanService } from '../../api/api';
import toast from 'react-hot-toast';

const FinanceDisbursement = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disbursing, setDisbursing] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [currentLoan, setCurrentLoan] = useState(null);
  const [disburseNote, setDisburseNote] = useState('');
  const [mpesaNumber, setMpesaNumber] = useState('');

  const fetchApprovedLoans = async () => {
    setLoading(true);
    try {
      const data = await loanService.getLoans({ status: 'APPROVED' });
      setLoans(Array.isArray(data) ? data : (data?.results || []));
    } catch (err) {
      toast.error('Failed to fetch approval queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedLoans();
  }, []);

  const branches = useMemo(() => {
    const unique = ['All Branches', ...new Set(loans.map(l => l.branch_name))];
    return unique;
  }, [loans]);

  const filteredLoans = useMemo(() => {
    return selectedBranch === 'All Branches' 
      ? loans 
      : loans.filter(l => l.branch_name === selectedBranch);
  }, [loans, selectedBranch]);

  const totalAmount = useMemo(() => {
    return filteredLoans.reduce((sum, l) => sum + parseFloat(l.principal_amount), 0);
  }, [filteredLoans]);

  const handleDisburse = async (loanId) => {
    setDisbursing(true);
    try {
      // Logic for audit logging if mpesa number changed could be added here
      await loanService.api.post('/payments/disburse/', { 
        loan_id: loanId,
        mpesa_phone: mpesaNumber
      });
      toast.success('Disbursement successful');
      setShowConfirmModal(false);
      fetchApprovedLoans(); // Refresh queue
    } catch (err) {
      toast.error(err.response?.data?.error || 'Disbursement failed');
    } finally {
      setDisbursing(false);
    }
  };

  const handleBulkDisburse = async () => {
    if (!window.confirm(`You are about to disburse ${filteredLoans.length} loans totalling KES ${totalAmount.toLocaleString()}. This cannot be reversed. Proceed?`)) return;
    
    setDisbursing(true);
    try {
      // Need a bulk endpoint on backend or loop
      for (const loan of filteredLoans) {
        await loanService.api.post('/payments/disburse/', { loan_id: loan.id });
      }
      toast.success('Bulk disbursement complete');
      fetchApprovedLoans();
    } catch (err) {
      toast.error('Some disbursements failed. Please check the queue.');
    } finally {
      setDisbursing(false);
    }
  };

  const openDisburseModal = (loan) => {
    setCurrentLoan(loan);
    setMpesaNumber(loan.customer_phone || '');
    setShowConfirmModal(true);
  };

  const formatKES = (val) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">Disbursement Queue</h2>
          <p className="text-sm text-slate-500 mt-0.5">Approved loans awaiting disbursement</p>
        </div>
      </div>

      <Card className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-primary-500/20"
            >
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          <div className="inline-flex items-center self-start sm:self-auto bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
            {filteredLoans.length} Pending
          </div>
        </div>

        {filteredLoans.length > 0 && (
          <Button 
            variant="primary" 
            className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto text-sm py-2 px-4 flex items-center justify-center gap-2"
            onClick={handleBulkDisburse}
            disabled={disbursing}
          >
            <CheckCircle2 className="w-4 h-4" />
            Bulk Disburse {formatKES(totalAmount)}
          </Button>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
          <Table
            headers={['Customer Name', 'ID Number', 'M-Pesa Number', 'Principal', 'Branch', 'Date Approved', 'Action']}
            data={filteredLoans}
            loading={loading}
            renderRow={(loan) => (
              <tr key={loan.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 whitespace-nowrap">
                <td className="px-6 py-4 font-medium text-slate-900">{loan.customer_name}</td>
                <td className="px-6 py-4 text-slate-600">{loan.national_id || 'N/A'}</td>
                <td className="px-6 py-4 text-slate-600">{loan.customer_phone}</td>
                <td className="px-6 py-4 font-bold text-slate-900">{formatKES(loan.principal_amount)}</td>
                <td className="px-6 py-4">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    {loan.branch_name}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500">{new Date(loan.updated_at).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <Button 
                    variant="primary" 
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => openDisburseModal(loan)}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Disburse
                  </Button>
                </td>
              </tr>
            )}
          />
        </div>
      </Card>

      {/* Confirmation Modal */}
      {showConfirmModal && currentLoan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">Confirm Disbursement</h3>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Customer</label>
                <p className="text-lg font-bold text-slate-900">{currentLoan.customer_name}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Principal</label>
                <p className="text-lg font-bold text-emerald-600">{formatKES(currentLoan.principal_amount)}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">M-Pesa Phone Number</label>
                <Input
                  value={mpesaNumber}
                  onChange={(e) => setMpesaNumber(e.target.value)}
                  placeholder="Enter M-Pesa Number"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Branch</label>
                <p className="font-medium text-slate-700">{currentLoan.branch_name}</p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Ensure the phone number above belongs to the customer. Disbursements cannot be reversed once processed.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="secondary" 
                  className="flex-1"
                  onClick={() => setShowConfirmModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleDisburse(currentLoan.id)}
                  loading={disbursing}
                >
                  Disburse Now
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
