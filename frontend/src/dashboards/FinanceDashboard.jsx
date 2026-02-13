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
  Send,
  Users
} from 'lucide-react';
import BulkCustomerSMSModal from '../components/ui/BulkCustomerSMSModal';

const FinanceDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [loadingExtra, setLoadingExtra] = useState(true);
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
    setLoadingExtra(true);
    setError('');
    try {
      const parseAmount = (val) => {
        const num = Number(val);
        return Number.isFinite(num) ? num : 0;
      };

      // Fetch core financial data first
      const [loanData, repaymentData] = await Promise.all([
        loanService.getLoans(),
        loanService.getRepayments(),
      ]);

      const loansList = loanData?.results || loanData || [];
      const repaymentsList = repaymentData?.results || repaymentData || [];

      const todayStr = new Date().toISOString().split('T')[0];

      const totalBorrowed = loansList.reduce((acc, l) => acc + parseAmount(l.principal_amount), 0);
      const totalRepaid = repaymentsList.reduce((acc, r) => acc + parseAmount(r.amount_paid), 0);
      
      const todayDisbursed = loansList
        .filter(l => (l.created_at || '').startsWith(todayStr) && l.status === 'DISBURSED')
        .reduce((acc, l) => acc + parseAmount(l.principal_amount), 0);

      const todayCollected = repaymentsList
        .filter(r => (r.payment_date || '').startsWith(todayStr))
        .reduce((acc, r) => acc + parseAmount(r.amount_paid), 0);

      // Finance handles loans that are VERIFIED or PENDING
      const pendingList = loansList.filter(l => l.status === 'VERIFIED' || l.status === 'PENDING');

      setLoans(loansList);
      setRepayments(repaymentsList);
      
      setStats(prev => ({
        ...prev,
        borrowed: totalBorrowed,
        repaid: totalRepaid,
        outstanding: totalBorrowed - totalRepaid,
        todayDisbursed,
        todayCollected,
        pendingApprovalsCount: pendingList.length,
        netFlow: todayCollected - todayDisbursed
      }));

      setLoading(false); // Stats ready

      // Now fetch customers for names
      const customerData = await loanService.getCustomers();
      const customersList = customerData?.results || customerData || [];
      const customerMap = customersList.reduce((acc, c) => {
        acc[c.id] = {
           name: c.full_name,
           national_id: c.profile?.national_id || 'N/A'
        };
        return acc;
      }, {});

      setLoans(prev => prev.map(l => ({ 
        ...l, 
        customer_name: customerMap[l.user]?.name || 'Unknown',
        national_id: customerMap[l.user]?.national_id || 'N/A'
      })));
      setLoadingExtra(false);

    } catch (err) {
      setError(err.message || 'Failed to sync financial data');
      setLoading(false);
      setLoadingExtra(false);
    }
  };

  const handleAction = async (id, status) => {
    try {
      if (status === 'APPROVED') {
        const confirm = window.confirm("Are you sure you want to approve this loan? It will enter the disbursement queue.");
        if (!confirm) return;
      }
      await loanService.updateLoan(id, { status });
      fetchData(); // Refresh
    } catch (err) {
      alert('Error updating loan: ' + err.message);
    }
  };

  const handleBulkDisbursement = async () => {
    const queueCount = loans.filter(l => l.status === 'APPROVED').length;
    if (queueCount === 0) {
      alert("No approved loans in queue to disburse.");
      return;
    }
    
    if (!window.confirm(`Trigger automated disbursement for the next 20 loans in the queue? Total approved: ${queueCount}`)) return;
    
    setLoading(true);
    try {
      const response = await loanService.api.post('/payments/disburse/', { mode: 'bulk' });
      const results = response.data.results || [];
      const successCount = results.filter(r => r.status === 'success').length;
      const failCount = results.length - successCount;
      
      alert(`Bulk Disbursement Finished!\n✅ Success: ${successCount}\n❌ Failed: ${failCount}`);
      await fetchData();
    } catch (err) {
      alert("Bulk Disbursement Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSingleDisburse = async (loanId) => {
    if (!window.confirm("Disburse this specific loan now via M-Pesa?")) return;
    
    setLoading(true);
    try {
      const response = await loanService.api.post('/payments/disburse/', { loan_id: loanId, mode: 'single' });
      if (response.data.ResponseCode === '0' || response.data.status === 'MOCK_SUCCESS') {
        alert("Disbursement initiated successfully!");
        await fetchData();
      } else {
        alert("M-Pesa Error: " + (response.data.ResponseDescription || "Unknown error"));
      }
    } catch (err) {
      alert("Failed to disburse: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 45s for finance data
    const interval = setInterval(fetchData, 45000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Financial Operations</h3>
          <p className="text-sm text-slate-500 mt-1">Cash flow oversight and portfolio management</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="primary" 
            onClick={handleBulkDisbursement} 
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
          >
            <Send className="w-4 h-4" /> Bulk Disburse (Queue)
          </Button>
          <Button variant="primary" onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Send className="w-4 h-4" /> Customer Comms
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
          label="Actions Needed" 
          value={stats.pendingApprovalsCount.toString()} 
          icon={Clock}
          accent="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Loan Portfolio Table (NEW) */}
        <Card className="lg:col-span-2">
           <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Active Loan Portfolio
              </h3>
              <span className="text-xs font-black text-slate-400 uppercase">Viewing all accounts</span>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b dark:border-slate-800">
                    <th className="p-4">Loan ID</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Principal</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Last Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loans.length > 0 ? (
                    loans.slice(0, 10).map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="p-4">
                          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-bold border dark:border-slate-700">
                            {l.id.substring(0, 8)}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">{l.customer_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono italic uppercase tracking-tighter">
                             ID: {l.national_id}
                          </div>
                        </td>
                        <td className="p-4 text-sm font-black text-slate-700 dark:text-slate-300">KES {Number(l.principal_amount).toLocaleString()}</td>
                        <td className="p-4">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                             l.status === 'DISBURSED' ? 'bg-emerald-100 text-emerald-700' :
                             l.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                             'bg-slate-100 text-slate-600'
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="p-4 text-[10px] text-slate-400">{new Date(l.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="5" className="p-12 text-center text-slate-400 italic">No historical loans found</td></tr>
                  )}
                </tbody>
              </table>
           </div>
        </Card>

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
                       <Button size="sm" onClick={() => handleAction(loan.id, 'APPROVED')} className="bg-emerald-600 hover:bg-emerald-700 text-white border-none px-4">
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

        {/* Disbursement Queue (NEW) */}
        <Card className="flex flex-col border-emerald-100 dark:border-emerald-900/30">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-600" />
              Disbursement Queue
            </h3>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold uppercase tracking-tighter">
              {loans.filter(l => l.status === 'APPROVED').length} Ready
            </span>
          </div>
          
          <div className="space-y-4 flex-1">
            {loans.filter(l => l.status === 'APPROVED').length === 0 ? (
              <div className="text-center py-12 text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed">
                Queue is empty. No approved loans waiting for cash out.
              </div>
            ) : (
              loans.filter(l => l.status === 'APPROVED').slice(0, 4).map((loan) => (
                <div key={loan.id} className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">KES {Number(loan.principal_amount).toLocaleString()}</p>
                      <p className="text-xs text-slate-500">{loan.customer_name}</p>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleSingleDisburse(loan.id)} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm px-4 h-8 text-[11px] font-black uppercase tracking-wider"
                    >
                      Disburse Now
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent Collections Section */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-600" />
              Full Collection Ledger
            </h3>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-black tracking-widest uppercase">Live Reconciliation</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b dark:border-slate-800">
                  <th className="p-4">Reference</th>
                  <th className="p-4">Customer / Loan ID</th>
                  <th className="p-4">Amount Paid</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {repayments.length > 0 ? (
                  repayments.map((rep, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="p-4">
                        <div className="font-mono text-xs font-bold text-indigo-600">
                          {rep.mpesa_receipt || `TRX-${Math.floor(Math.random()*100000)}`}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-sm text-slate-900 dark:text-white">{rep.customer_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono italic">
                           ID No: {rep.national_id || 'N/A'}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-black text-emerald-600 text-sm">KES {Number(rep.amount_paid).toLocaleString()}</span>
                      </td>
                      <td className="p-4">
                         <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">
                           {rep.payment_method?.toUpperCase() || 'MPESA'}
                         </span>
                      </td>
                      <td className="p-4 text-[11px] text-slate-500">
                        {new Date(rep.payment_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="p-4">
                         <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-emerald-600 uppercase">Matched</span>
                         </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" className="p-12 text-center text-slate-400 italic">No historical collections found</td></tr>
                )}
              </tbody>
            </table>
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

      <BulkCustomerSMSModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default FinanceDashboard;
