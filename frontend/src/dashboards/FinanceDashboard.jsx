import React, { useEffect, useState } from 'react';
import { loanService } from '../api/api';
import { Table, Card, StatCard, Button } from '../components/ui/Shared';
import { 
  Briefcase, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  DollarSign,
  Activity,
  History,
  Send
} from 'lucide-react';
import BulkMessageModal from '../components/ui/BulkMessageModal';

const FinanceDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loans, setLoans] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [stats, setStats] = useState({
    borrowed: 0,
    repaid: 0,
    outstanding: 0,
    todayDisbursed: 0,
    todayCollected: 0,
    pendingApprovalsCount: 0,
    netFlow: 0
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const parseAmount = (val) => {
        const num = Number(val);
        return Number.isFinite(num) ? num : 0;
      };

      const [loanData, repaymentData, customerData] = await Promise.all([
        loanService.getLoans(),
        loanService.getRepayments(),
        loanService.getCustomers()
      ]);

      const loansList = loanData?.results || loanData || [];
      const repaymentsList = repaymentData?.results || repaymentData || [];
      const customersList = customerData?.results || customerData || [];

      const todayStr = new Date().toISOString().split('T')[0];

      const totalBorrowed = loansList.reduce((acc, l) => acc + parseAmount(l.principal_amount), 0);
      const totalRepaid = repaymentsList.reduce((acc, r) => acc + parseAmount(r.amount_paid), 0);
      
      const todayDisbursed = loansList
        .filter(l => (l.created_at || '').startsWith(todayStr) && l.status === 'AWARDED')
        .reduce((acc, l) => acc + parseAmount(l.principal_amount), 0);

      const todayCollected = repaymentsList
        .filter(r => (r.payment_date || '').startsWith(todayStr))
        .reduce((acc, r) => acc + parseAmount(r.amount_paid), 0);

      // Finance handles loans that are VERIFIED or PENDING
      const pendingList = loansList.filter(l => l.status === 'VERIFIED' || l.status === 'PENDING');

      const customerMap = customersList.reduce((acc, c) => {
        acc[c.id] = c.full_name;
        return acc;
      }, {});

      setLoans(loansList.map(l => ({ ...l, customer_name: customerMap[l.user] || 'Unknown' })));
      setRepayments(repaymentsList.map(r => ({ ...r, customer_name: customerMap[r.user] || 'Unknown' })));
      
      setStats({
        borrowed: totalBorrowed,
        repaid: totalRepaid,
        outstanding: totalBorrowed - totalRepaid,
        todayDisbursed,
        todayCollected,
        pendingApprovalsCount: pendingList.length,
        netFlow: todayCollected - todayDisbursed
      });
    } catch (err) {
      setError(err.message || 'Failed to sync financial data');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, status) => {
    try {
      await loanService.updateLoan(id, { status });
      fetchData(); // Refresh
    } catch (err) {
      alert('Error updating loan: ' + err.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Financial Operations</h3>
          <p className="text-sm text-slate-500 mt-1">Cash flow oversight and portfolio management</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Send className="w-4 h-4" /> Debt Reminders
          </Button>
          <Button onClick={fetchData} variant="outline" className="flex items-center gap-2">
             <Activity className="w-4 h-4" /> Sync Data
          </Button>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Money Out (Today)" 
          value={`KES ${stats.todayDisbursed.toLocaleString()}`} 
          icon={ArrowUpRight}
          trend={{ value: 'Disbursed', isPositive: false }}
        />
        <StatCard 
          label="Money In (Today)" 
          value={`KES ${stats.todayCollected.toLocaleString()}`} 
          icon={ArrowDownLeft}
          trend={{ value: 'Collected', isPositive: true }}
        />
        <StatCard 
          label="Net Cash Flow" 
          value={`KES ${stats.netFlow.toLocaleString()}`} 
          icon={DollarSign}
          accent={stats.netFlow >= 0 ? 'emerald' : 'orange'}
        />
        <StatCard 
          label="Pending Approvals" 
          value={stats.pendingApprovalsCount.toString()} 
          icon={Clock}
          accent="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Approvals Section */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-600" />
              Awaiting Approval
            </h3>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold">
              {stats.pendingApprovalsCount} NEW
            </span>
          </div>
          
          <div className="space-y-4 flex-1">
            {loans.filter(l => l.status === 'VERIFIED' || l.status === 'PENDING').length === 0 ? (
              <div className="text-center py-12 text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed">
                Queue is empty. No loans pending verification or approval.
              </div>
            ) : (
              loans.filter(l => l.status === 'VERIFIED' || l.status === 'PENDING').slice(0, 4).map((loan) => (
                <div key={loan.id} className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">KES {Number(loan.principal_amount).toLocaleString()}</p>
                      <p className="text-sm text-slate-500">{loan.customer_name}</p>
                      <span className="text-[10px] font-bold text-indigo-500 uppercase">{loan.status}</span>
                    </div>
                    <div className="flex gap-2">
                       <Button size="sm" onClick={() => handleAction(loan.id, 'AWARDED')} className="bg-emerald-600 hover:bg-emerald-700 text-white border-none px-4">
                         Approve
                       </Button>
                       <Button size="sm" variant="outline" onClick={() => handleAction(loan.id, 'REJECTED')} className="text-red-600 border-red-200 hover:bg-red-50">
                         Deny
                       </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent Collections Section */}
        <Card>
          <h3 className="text-lg font-semibold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            Recent Collections
          </h3>
          <div className="space-y-4">
            {repayments.length === 0 ? (
              <div className="text-sm text-slate-500 italic">No collection records found.</div>
            ) : (
              repayments.slice(0, 6).map((rep, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{rep.customer_name}</p>
                      <p className="text-xs text-slate-500">{new Date(rep.payment_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">+KES {Number(rep.amount_paid).toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400">VIA {rep.payment_method || 'MPESA'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Portfolio Health */}
      <Card className="bg-slate-900 text-white border-none shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <TrendingUp className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <h3 className="text-lg font-semibold mb-8 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-400" />
            Portfolio Health Index
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-2">
              <p className="text-slate-400 text-sm uppercase tracking-wider">Total Disbursed</p>
              <p className="text-3xl font-bold">KES {stats.borrowed.toLocaleString()}</p>
              <div className="w-full h-1 bg-slate-800 rounded-full mt-4">
                <div className="w-full h-full bg-indigo-500 rounded-full"></div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-slate-400 text-sm uppercase tracking-wider">Total Recovered</p>
              <p className="text-3xl font-bold text-emerald-400">KES {stats.repaid.toLocaleString()}</p>
              <div className="w-full h-1 bg-slate-800 rounded-full mt-4">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${(stats.repaid / stats.borrowed * 100) || 0}%` }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-slate-400 text-sm uppercase tracking-wider">Principal at Risk</p>
              <p className="text-3xl font-bold text-orange-400">KES {stats.outstanding.toLocaleString()}</p>
              <div className="w-full h-1 bg-slate-800 rounded-full mt-4">
                <div 
                  className="h-full bg-orange-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${(stats.outstanding / stats.borrowed * 100) || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Financial Utility Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="hover:border-indigo-200 transition-colors">
          <h3 className="text-lg font-semibold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Audit & Reconciliation
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="secondary" className="justify-start gap-2 h-12">
               <Activity className="w-4 h-4" /> Trial Balance
            </Button>
            <Button variant="secondary" className="justify-start gap-2 h-12">
               <FileText className="w-4 h-4" /> Cashbook
            </Button>
            <Button variant="secondary" className="justify-start gap-2 h-12">
               <History className="w-4 h-4" /> Collection Log
            </Button>
            <Button variant="secondary" className="justify-start gap-2 h-12">
               <AlertCircle className="w-4 h-4" /> Aging Report
            </Button>
          </div>
        </Card>

        <Card className="hover:border-emerald-200 transition-colors">
          <h3 className="text-lg font-semibold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Financial Control
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             <Button className="justify-start gap-2 h-12">
                <DollarSign className="w-4 h-4" /> Manual Repayment
             </Button>
             <Button className="justify-start gap-2 h-12 bg-slate-900 hover:bg-black">
                <ArrowRight className="w-4 h-4" /> Freeze Accounts
             </Button>
             <Button variant="outline" className="justify-start gap-2 h-12">
                <Briefcase className="w-4 h-4" /> Bulk Approval
             </Button>
             <Button variant="outline" className="justify-start gap-2 h-12">
                <TrendingUp className="w-4 h-4" /> Adjust Rates
             </Button>
          </div>
        </Card>
      </div>

      <BulkMessageModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default FinanceDashboard;
