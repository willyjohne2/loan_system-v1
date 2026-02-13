import React, { useState } from 'react';
import { Button, Card } from './Shared';
import { loanService } from '../../api/api';
import { X, Smartphone, Receipt, CheckCircle, AlertCircle } from 'lucide-react';

const RepaymentModal = ({ loan, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH'); // Default to CASH
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); 
  const [msg, setMsg] = useState('');

  const handleRepayment = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) return alert('Enter a valid amount');
    
    setLoading(true);
    setStatus('processing');
    setMsg('Recording payment...');

    try {
      // Manual recording
      await loanService.createRepayment({
        loan: loan.id,
        amount_paid: parseFloat(amount),
        payment_method: method,
        reference_code: `${method}-${Date.now()}`
      });
      setStatus('success');
      setMsg(`${method} repayment recorded successfully.`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMsg(err.response?.data?.error || err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md animate-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Record Payment</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {status === 'processing' ? (
          <div className="py-12 text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">{msg}</p>
          </div>
        ) : status === 'success' ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Success</h4>
            <p className="text-slate-600 dark:text-slate-400">{msg}</p>
          </div>
        ) : (
          <form onSubmit={handleRepayment} className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-900 dark:text-white">{loan.customer_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Loan ID:</span>
                <span className="font-mono text-[10px] bg-slate-200 px-1 rounded">{loan.id.substring(0, 8)}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Manual Paybill Instructions</p>
                <p className="text-sm font-bold text-slate-700">Business No: 174379</p>
                <p className="text-sm font-bold text-slate-700">Account: {loan.id.substring(0, 8)}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod('CASH')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    method === 'CASH' 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20' 
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span className="font-bold text-sm">CASH</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('BANK')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    method === 'BANK' 
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20' 
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  <span className="font-bold text-sm">BANK</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Amount to Record (KES)</label>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500/20 outline-none transition-all font-bold"
                placeholder="0.00"
              />
            </div>

            {method === 'MPESA' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">M-Pesa Number</label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                    placeholder="2547XXXXXXXX"
                  />
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {msg}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full py-3 mt-4">
              {method === 'MPESA' ? 'Send STK Push' : 'Record Cash Payment'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};

export default RepaymentModal;
