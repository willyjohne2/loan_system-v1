import React, { useEffect, useState } from 'react';
import { loanService } from '../../api/api';
import { Card, Button, Table } from '../ui/Shared';
import { X, TrendingUp, TrendingDown, Clock, CheckCircle, FileText, Wallet } from 'lucide-react';

const CustomerHistoryModal = ({ customer, isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [stats, setStats] = useState({
    totalBorrowed: 0,
    totalPaid: 0,
    activeCount: 0,
    lastPaymentDate: null
  });

  useEffect(() => {
    if (isOpen && customer) {
      fetchHistory();
    }
  }, [isOpen, customer]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const [loanData, repaymentData] = await Promise.all([
        loanService.getLoans(),
        loanService.getRepayments()
      ]);

      const allLoans = loanData.results || loanData || [];
      const allRepayments = repaymentData.results || repaymentData || [];

      // Filter for this specific user
      const userLoans = allLoans.filter(l => l.user === customer.id);
      const userRepayments = allRepayments.filter(r => r.user === customer.id);

      const totalBorrowed = userLoans.reduce((acc, l) => acc + Number(l.principal_amount || 0), 0);
      const totalPaid = userRepayments.reduce((acc, r) => acc + Number(r.amount_paid || 0), 0);
      const activeCount = userLoans.filter(l => l.status === 'AWARDED' || l.status === 'APPROVED').length;
      
      const lastPayment = userRepayments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0];

      setLoans(userLoans);
      setRepayments(userRepayments);
      setStats({
        totalBorrowed,
        totalPaid,
        activeCount,
        lastPaymentDate: lastPayment ? lastPayment.payment_date : null
      });
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200 bg-white dark:bg-slate-900 border-none shadow-2xl">
        <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{customer.full_name}</h3>
            <p className="text-sm text-slate-500">Loan & Repayment Trail</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-2">
                <Wallet className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Borrowed</span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">KES {stats.totalBorrowed.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Repaid</span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">KES {stats.totalPaid.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-100 dark:border-rose-900/50">
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Balance</span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">KES {(stats.totalBorrowed - stats.totalPaid).toLocaleString()}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/50">
              <div className="flex items-center gap-3 text-slate-500 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Last Paid</span>
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {stats.lastPaymentDate ? new Date(stats.lastPaymentDate).toLocaleDateString() : 'No payments'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* Loan Table */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded">
                  <FileText className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-white">Loan History</h4>
              </div>
              <Table
                headers={['Date', 'Amount', 'Type', 'Status']}
                data={loans}
                renderRow={(loan) => (
                  <tr key={loan.id} className="text-sm">
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{new Date(loan.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-bold">KES {Number(loan.principal_amount).toLocaleString()}</td>
                    <td className="px-6 py-4 text-xs font-medium uppercase">{loan.loan_type || 'Standard'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        loan.status === 'AWARDED' ? 'bg-emerald-100 text-emerald-700' :
                        loan.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {loan.status}
                      </span>
                    </td>
                  </tr>
                )}
              />
            </div>

            {/* Repayment Table */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-white">Repayment Trail</h4>
              </div>
              <Table
                headers={['Date', 'Amount', 'Mode', 'Reference']}
                data={repayments}
                renderRow={(rep) => (
                  <tr key={rep.id} className="text-sm">
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{new Date(rep.payment_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-bold text-emerald-600">KES {Number(rep.amount_paid).toLocaleString()}</td>
                    <td className="px-6 py-4 text-xs font-medium uppercase">{rep.payment_mode}</td>
                    <td className="px-6 py-4 font-mono text-xs">{rep.reference_number || 'AUTO'}</td>
                  </tr>
                )}
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button onClick={onClose} variant="secondary">Close History</Button>
        </div>
      </Card>
    </div>
  );
};

export default CustomerHistoryModal;
