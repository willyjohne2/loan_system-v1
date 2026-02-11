import React, { useState } from 'react';
import { Button, Card } from './Shared';
import { loanService } from '../../api/api';
import { X, Smartphone, Receipt, CheckCircle, AlertCircle } from 'lucide-react';

const RepaymentModal = ({ loan, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(loan.user_phone || '');
  const [method, setMethod] = useState('MPESA'); // MPESA or CASH
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [msg, setMsg] = useState('');

  const handleRepayment = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) return alert('Enter a valid amount');
    
    setLoading(true);
    setStatus('processing');
    setMsg('Initiating repayment...');

    try {
      if (method === 'MPESA') {
        const res = await loanService.initiateMpesaRepayment({
          loan_id: loan.id,
          amount: parseFloat(amount),
          phone_number: phoneNumber
        });
        
        if (res.MerchantRequestID || res.status === 'MOCK_SUCCESS') {
          setStatus('success');
          setMsg(res.CustomerMessage || 'STK Push sent to customer phone. Please wait for them to enter PIN.');
          // For manual recording, we would wait for callback, but here we can just close after a delay
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 3000);
        } else {
          throw new Error(res.error || 'Failed to initiate Mpesa');
        }
      } else {
        // CASH / Manual
        await loanService.createRepayment({
          loan: loan.id,
          amount_paid: parseFloat(amount),
          payment_method: 'CASH',
          reference_code: `CASH-${Date.now()}`
        });
        setStatus('success');
        setMsg('Cash repayment recorded successfully.');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
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
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Repay Loan</h3>
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
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Transaction Sent</h4>
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
                <span className="text-slate-500">Remaining Balance:</span>
                <span className="font-bold text-primary-600">KES {loan.amount?.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod('MPESA')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    method === 'MPESA' 
                    ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/20' 
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span className="font-bold text-sm">M-Pesa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('CASH')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    method === 'CASH' 
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20' 
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span className="font-bold text-sm">Cash</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Amount to Pay (KES)</label>
              <input
                type="number"
                required
                max={loan.amount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
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
