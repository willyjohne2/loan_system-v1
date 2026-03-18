import React, { useState } from 'react';
import { 
  Receipt, 
  Lock, 
  CheckCircle2, 
  TrendingUp, 
  X, 
  AlertTriangle 
} from 'lucide-react';
import { Card, Button, StatCard } from '../../components/ui/Shared';
import toast from 'react-hot-toast';

const FinanceControl = () => {
  const [loading, setLoading] = useState(false);

  const handleManualRepayment = () => {
    toast.error("Manual repayment window: This feature is only permitted for Super Admins to ensure M-Pesa reconciliation matches audit logs.");
  };

  const handleRestrictedAction = (action) => {
    toast.info(`${action} is restricted. This action requires Level 2 Branch Manager approval or Super Admin privilege.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Financial Control</h2>
        <p className="text-sm text-slate-500 mt-1">Restricted financial operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        <button 
          onClick={handleManualRepayment}
          className="group"
        >
          <Card className="hover:border-primary-500 transition-all text-left flex flex-col gap-6 p-8">
            <div className="p-4 bg-primary-100 text-primary-600 rounded-2xl w-fit group-hover:bg-primary-600 group-hover:text-white transition-all transform group-hover:scale-110">
              <Receipt className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 font-primary">Manual Repayment</h3>
              <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">Force a manual repayment record for an existing active loan. Use only for cash settlements verified by branch manager.</p>
            </div>
          </Card>
        </button>

        <button 
          onClick={() => handleRestrictedAction('Freeze Accounts')}
          className="group"
        >
          <Card className="hover:border-rose-500 transition-all text-left flex flex-col gap-6 p-8">
            <div className="p-4 bg-rose-100 text-rose-600 rounded-2xl w-fit group-hover:bg-rose-600 group-hover:text-white transition-all transform group-hover:scale-110">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 font-primary">Freeze Accounts</h3>
              <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">Temporarily halt all disbursements and repayment processing for a specific region or branch due to security audit.</p>
            </div>
          </Card>
        </button>

        <button 
          onClick={() => handleRestrictedAction('Bulk Approval')}
          className="group"
        >
          <Card className="hover:border-emerald-500 transition-all text-left flex flex-col gap-6 p-8">
            <div className="p-4 bg-emerald-100 text-emerald-600 rounded-2xl w-fit group-hover:bg-emerald-600 group-hover:text-white transition-all transform group-hover:scale-110">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 font-primary">Bulk Approval</h3>
              <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">Bypass individual loan assessment for corporate disbursement programs or civil servant mass-hiring initiatives.</p>
            </div>
          </Card>
        </button>

        <button 
          onClick={() => handleRestrictedAction('Adjust Rates')}
          className="group"
        >
          <Card className="hover:border-amber-500 transition-all text-left flex flex-col gap-6 p-8">
            <div className="p-4 bg-amber-100 text-amber-600 rounded-2xl w-fit group-hover:bg-amber-600 group-hover:text-white transition-all transform group-hover:scale-110">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 font-primary">Adjust Rates</h3>
              <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">Modify global interest rates or product processing fees. Changes take effect on New Loan applications only.</p>
            </div>
          </Card>
        </button>
      </div>

      <div className="p-6 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-center gap-4">
        <div className="p-3 bg-white rounded-full text-slate-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Security Audit Active</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">All operations in this control panel are logged with your Finance Officer ID and IP address for compliance reporting.</p>
        </div>
      </div>
    </div>
  );
};

export default FinanceControl;
