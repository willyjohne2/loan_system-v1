import React, { useEffect, useState } from 'react';
import { loanService } from '../api/api';
import { Table, Card, StatCard, Button, cn } from '../components/ui/Shared';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
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
  Users,
  BarChart3
} from 'lucide-react';
import BulkCustomerSMSModal from '../components/ui/BulkCustomerSMSModal';

const PRODUCT_COLORS = {
  'Inuka': '#4f46e5', // Indigo
  'Jijenge': '#10b981', // Emerald
  'Fadhili': '#f59e0b', // Amber
  'Generic': '#64748b'  // Slate
};

const FinanceDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [loadingExtra, setLoadingExtra] = useState(true);
  const [error, setError] = useState('');
  const [loans, setLoans] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({
    borrowed: 0,
    repaid: 0,
    outstanding: 0,
    todayDisbursed: 0,
    todayCollected: 0,
    pendingApprovalsCount: 0,
    netFlow: 0,
    capitalBalance: 0,
    totalMoneyOut: 0,
    totalMoneyIn: 0
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportData, setReportData] = useState({
    trial_balance: [],
    cashbook: [],
    aging_report: {},
    collection_log: [],
    weekly_disbursed: [],
    weekly_repaid: []
  });
  const [activeReport, setActiveReport] = useState(null); // 'trial', 'cashbook', 'collection', 'aging'
  const [activeTab, setActiveTab] = useState('ACTIVE');
  const [productDistribution, setProductDistribution] = useState([]);

  // Logic for filtered totals
  const getTotals = (loansList) => {
    return (loansList || []).reduce((acc, l) => ({
      repayable: acc.repayable + Number(l.total_repayable_amount || 0),
      principal: acc.principal + Number(l.principal_amount || 0)
    }), { repayable: 0, principal: 0 });
  };

  const filteredLoansForTotals = (loans || []).filter(l => {
    const s = l.status;
    if (activeTab === 'ACTIVE') return ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'].includes(s);
    if (activeTab === 'PENDING') return ['UNVERIFIED', 'VERIFIED', 'APPROVED', 'PENDING'].includes(s);
    return s === 'REJECTED';
  });

  const totals = getTotals(filteredLoansForTotals);

  const fetchData = async () => {
    setLoading(true);
    setLoadingExtra(true);
    setError('');
    try {
      const parseAmount = (val) => {
        const num = Number(val);
        return Number.isFinite(num) ? num : 0;
      };

      // Fetch core financial data and analytics
      const [loanData, repaymentData, analyticsData] = await Promise.all([
        loanService.getLoans(),
        loanService.getRepayments(),
        loanService.getFinancialAnalytics()
      ]);

      const loansList = loanData?.results || loanData || [];
      const repaymentsList = repaymentData?.results || repaymentData || [];
      const analytics = analyticsData;

      // Calculate product distribution for pie chart (counts all loans regardless of status)
      const productCounts = loansList.reduce((acc, l) => {
        const name = l.product_name || 'Generic';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});
      setProductDistribution(Object.entries(productCounts).map(([name, count]) => ({ name, value: count })));

      const todayStr = new Date().toISOString().split('T')[0];

      // Only count loans that have actually been DISBURSED or are active/overdue/closed/repaid
      const disbursedStatuses = ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'];
      const disbursedLoans = loansList.filter(l => disbursedStatuses.includes((l.status || '').toUpperCase()));

      const totalBorrowed = disbursedLoans.reduce((acc, l) => acc + parseAmount(l.principal_amount), 0);
      const totalRepaid = repaymentsList.reduce((acc, r) => acc + parseAmount(r.amount_paid), 0);
      
      const todayDisbursed = loansList
        .filter(l => (l.created_at || '').startsWith(todayStr) && disbursedStatuses.includes((l.status || '').toUpperCase()))
        .reduce((acc, l) => acc + parseAmount(l.principal_amount), 0);

      const todayCollected = repaymentsList
        .filter(r => (r.payment_date || '').startsWith(todayStr))
        .reduce((acc, r) => acc + parseAmount(r.amount_paid), 0);

      // Finance handles loans that are VERIFIED or PENDING
      const pendingList = loansList.filter(l => l.status === 'VERIFIED' || l.status === 'PENDING');

      setLoans(loansList);
      setRepayments(repaymentsList);
      setHistory(analytics.history || []);
      setReportData({
        trial_balance: analytics.trial_balance || [],
        cashbook: analytics.cashbook || [],
        aging_report: analytics.aging_report || {},
        collection_log: analytics.collection_log || [],
        weekly_disbursed: analytics.weekly_disbursed || [],
        weekly_repaid: analytics.weekly_repaid || []
      });
      
      setStats(prev => ({
        ...prev,
        borrowed: totalBorrowed,
        repaid: totalRepaid,
        outstanding: totalBorrowed - totalRepaid,
        todayDisbursed,
        todayCollected,
        pendingApprovalsCount: pendingList.length,
        netFlow: analytics.balance,
        capitalBalance: analytics.balance,
        totalMoneyOut: analytics.money_out,
        totalMoneyIn: analytics.money_in
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
    if (!window.confirm("Disburse this specific loan now?")) return;
    
    setLoading(true);
    try {
      const response = await loanService.api.post('/payments/disburse/', { loan_id: loanId, mode: 'single' });
      // The backend now returns a message on success
      if (response.data.message || response.data.status === 'success' || response.data.ResponseCode === '0' || response.data.status === 'MOCK_SUCCESS') {
        alert(response.data.message || "Disbursement initiated successfully!");
        await fetchData();
      } else {
        alert("Disbursement Error: " + (response.data.ResponseDescription || response.data.error || "Unknown error"));
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard 
          label="Total Money Out" 
          value={`KES ${stats.totalMoneyOut.toLocaleString()}`} 
          icon={ArrowUpRight}
          trend={{ value: 'Disbursed', isPositive: false }}
          variant="danger"
        />
        <StatCard 
          label="Total Money In" 
          value={`KES ${stats.totalMoneyIn.toLocaleString()}`} 
          icon={ArrowDownLeft}
          trend={{ value: 'Repaid', isPositive: true }}
          variant="success"
        />
        <StatCard 
          label="System Capital Balance" 
          value={`KES ${stats.capitalBalance.toLocaleString()}`} 
          icon={Wallet}
          variant={stats.capitalBalance >= 100000 ? 'success' : 'warning'}
        />
        <StatCard 
          label="Actions Needed" 
          value={stats.pendingApprovalsCount.toString()} 
          icon={Clock}
          variant="info"
        />
      </div>

      {/* Analytics Graphs - Rolling Window */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Disbursement Rolling View (15d)
            </h3>
          </div>
          <div className="h-[250px] w-full min-h-[250px] relative">
            <ResponsiveContainer width="99%" height="100%">
              <AreaChart data={history} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDisburse" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="label" 
                  tick={{fontSize: 10}} 
                  minTickGap={5}
                />
                <YAxis tick={{fontSize: 10}} tickFormatter={(val) => `K${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(val) => [`KES ${val.toLocaleString()}`, 'Amount']}
                />
                <Area 
                  type="monotone" 
                  dataKey="disbursement" 
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorDisburse)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-2 uppercase tracking-tighter">History ← TODAY → Projections</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              Collection rolling View (15d)
            </h3>
          </div>
          <div className="h-[250px] w-full min-h-[250px] relative">
            <ResponsiveContainer width="99%" height="100%">
              <AreaChart data={history} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRepay" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="label" 
                  tick={{fontSize: 10}} 
                  minTickGap={5}
                />
                <YAxis tick={{fontSize: 10}} tickFormatter={(val) => `K${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(val) => [`KES ${val.toLocaleString()}`, 'Amount']}
                />
                <Area 
                   type="monotone" 
                   dataKey="repayment" 
                   stroke="#6366f1" 
                   fillOpacity={1} 
                   fill="url(#colorRepay)" 
                   strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-2 uppercase tracking-tighter">History ← TODAY → Schedule</p>
        </Card>
      </div>

      {/* Weekly Performance Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              Weekly Disbursement Volume (10w)
            </h3>
          </div>
          <div className="h-[200px] w-full min-h-[200px] relative">
            <ResponsiveContainer width="99%" height="100%">
              <BarChart data={reportData.weekly_disbursed}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                   dataKey="week" 
                   tick={{fontSize: 10}}
                />
                <YAxis tick={{fontSize: 10}} tickFormatter={(val) => `K${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none' }}
                />
                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Weekly Collection Volume (10w)
            </h3>
          </div>
          <div className="h-[200px] w-full min-h-[200px] relative">
            <ResponsiveContainer width="99%" height="100%">
              <BarChart data={reportData.weekly_repaid}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                   dataKey="week" 
                   tick={{fontSize: 10}}
                />
                <YAxis tick={{fontSize: 10}} tickFormatter={(val) => `K${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none' }}
                />
                <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8 mb-8">
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Product Priority
            </h3>
          </div>
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="99%" height="100%">
              <PieChart>
                <Pie
                  data={productDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {productDistribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={PRODUCT_COLORS[entry.name] || PRODUCT_COLORS['Generic']} 
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-center text-slate-500 mt-2 uppercase">Popularity by Application Volume</p>
        </Card>

        <Card className="lg:col-span-2">
           <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-600" />
              Pipeline Overview
            </h3>
          </div>
          <div className="space-y-4">
             <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Total Active Loans</span>
                <span className="text-xl font-bold text-indigo-900 dark:text-white">
                  {loans.filter(l => ['ACTIVE', 'DISBURSED'].includes(l.status)).length}
                </span>
             </div>
             <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Pending Disbursement</span>
                <span className="text-xl font-bold text-emerald-900 dark:text-white">
                  {loans.filter(l => l.status === 'PENDING').length}
                </span>
             </div>
             <div className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                <span className="text-sm font-medium text-rose-700 dark:text-rose-300">Overdue Portfolio</span>
                <span className="text-xl font-bold text-rose-900 dark:text-white">
                  {loans.filter(l => l.status === 'OVERDUE').length}
                </span>
             </div>
          </div>
        </Card>
      </div>

      <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-fit mb-4">
        {[
          { id: 'ACTIVE', label: 'Disbursed Portfolio' },
          { id: 'PENDING', label: 'Processing' },
          { id: 'REJECTED', label: 'Rejected' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${
              activeTab === tab.id 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Loan Portfolio Table (NEW) */}
        <Card className="lg:col-span-2">
           <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                {activeTab === 'ACTIVE' ? 'Live Loan Portfolio' : activeTab === 'PENDING' ? 'Processing Pipeline' : 'Archived Rejections'}
              </h3>
              <span className="text-[10px] font-black text-slate-400 border px-2 py-0.5 rounded tracking-tighter">
                {loans.filter(l => {
                  const s = l.status;
                  if (activeTab === 'ACTIVE') return ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'].includes(s);
                  if (activeTab === 'PENDING') return ['UNVERIFIED', 'VERIFIED', 'APPROVED', 'PENDING'].includes(s);
                  return s === 'REJECTED';
                }).length} ENTRIES
              </span>
           </div>
           <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 dark:bg-slate-800/90 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b dark:border-slate-800">
                    <th className="p-4">Loan ID</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Product</th>
                    <th className="p-4">Principal</th>
                    <th className="p-4 whitespace-nowrap">Total Repayable</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loans.filter(l => {
                    const s = l.status;
                    if (activeTab === 'ACTIVE') return ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'].includes(s);
                    if (activeTab === 'PENDING') return ['UNVERIFIED', 'VERIFIED', 'APPROVED', 'PENDING'].includes(s);
                    return s === 'REJECTED';
                  }).length > 0 ? (
                    loans.filter(l => {
                      const s = l.status;
                      if (activeTab === 'ACTIVE') return ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'].includes(s);
                      if (activeTab === 'PENDING') return ['UNVERIFIED', 'VERIFIED', 'APPROVED', 'PENDING'].includes(s);
                      return s === 'REJECTED';
                    }).map((l) => (
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
                        <td className="p-4">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{l.product_name}</span>
                        </td>
                        <td className="p-4 text-sm font-black text-slate-700 dark:text-slate-300">KES {Number(l.principal_amount).toLocaleString()}</td>
                        <td className="p-4 text-sm font-bold text-emerald-600 dark:text-emerald-400">KES {Number(l.total_repayable_amount).toLocaleString()}</td>
                        <td className="p-4">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                             l.status === 'DISBURSED' ? 'bg-emerald-100 text-emerald-700' :
                             l.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                             'bg-slate-100 text-slate-600'
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="p-4 text-[10px] text-slate-400 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="7" className="p-12 text-center text-slate-400 italic">No {activeTab.toLowerCase()} loans found</td></tr>
                  )}
                </tbody>
                {loans.filter(l => {
                    const s = l.status;
                    if (activeTab === 'ACTIVE') return ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'].includes(s);
                    if (activeTab === 'PENDING') return ['UNVERIFIED', 'VERIFIED', 'APPROVED', 'PENDING'].includes(s);
                    return s === 'REJECTED';
                  }).length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 bg-slate-50 dark:bg-slate-900 font-bold border-t-2 border-slate-200 dark:border-slate-800">
                    <tr>
                      <td colSpan="3" className="p-4 text-right text-[10px] font-black text-slate-500">PORTFOLIO TOTALS:</td>
                      <td className="p-4 text-sm font-black text-indigo-600 dark:text-indigo-400">
                        KES {totals.principal.toLocaleString()}
                      </td>
                      <td className="p-4 text-sm font-black text-emerald-600 dark:text-emerald-400">
                        KES {totals.repayable.toLocaleString()}
                      </td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                )}
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
            <Button 
               variant="secondary" 
               className={cn("justify-start gap-2 h-12", activeReport === 'trial' && "bg-indigo-50 border-indigo-200")}
               onClick={() => setActiveReport(activeReport === 'trial' ? null : 'trial')}
            >
               <Activity className="w-4 h-4" /> Trial Balance
            </Button>
            <Button 
               variant="secondary" 
               className={cn("justify-start gap-2 h-12", activeReport === 'cashbook' && "bg-indigo-50 border-indigo-200")}
               onClick={() => setActiveReport(activeReport === 'cashbook' ? null : 'cashbook')}
            >
               <FileText className="w-4 h-4" /> Cashbook
            </Button>
            <Button 
               variant="secondary" 
               className={cn("justify-start gap-2 h-12", activeReport === 'collection' && "bg-indigo-50 border-indigo-200")}
               onClick={() => setActiveReport(activeReport === 'collection' ? null : 'collection')}
            >
               <History className="w-4 h-4" /> Collection Log
            </Button>
            <Button 
               variant="secondary" 
               className={cn("justify-start gap-2 h-12", activeReport === 'aging' && "bg-indigo-50 border-indigo-200")}
               onClick={() => setActiveReport(activeReport === 'aging' ? null : 'aging')}
            >
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
             <Button className="justify-start gap-2 h-12" onClick={() => alert("Manual Repayment Feature Coming Soon")}>
                <DollarSign className="w-4 h-4" /> Manual Repayment
             </Button>
             <Button className="justify-start gap-2 h-12 bg-slate-900 hover:bg-black" onClick={() => alert("Freeze accounts is restricted to Super Admins")}>
                <ArrowRight className="w-4 h-4" /> Freeze Accounts
             </Button>
             <Button variant="outline" className="justify-start gap-2 h-12" onClick={() => alert("Bulk approval feature is currently undergoing security audit")}>
                <Briefcase className="w-4 h-4" /> Bulk Approval
             </Button>
             <Button variant="outline" className="justify-start gap-2 h-12" onClick={() => alert("Rate adjustments require risk committee authorization")}>
                <TrendingUp className="w-4 h-4" /> Adjust Rates
             </Button>
          </div>
        </Card>
      </div>

      {/* Dynamic Report View */}
      {activeReport && (
        <Card className="animate-in slide-in-from-bottom-4 duration-300 border-2 border-indigo-100">
           <div className="flex items-center justify-between mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                 {activeReport === 'trial' && <><Activity className="text-indigo-600" /> Trial Balance (Live)</>}
                 {activeReport === 'cashbook' && <><FileText className="text-indigo-600" /> Cashbook (Capital Ledger)</>}
                 {activeReport === 'collection' && <><History className="text-indigo-600" /> Collection Journal</>}
                 {activeReport === 'aging' && <><AlertCircle className="text-indigo-600" /> Arrears Aging Report</>}
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setActiveReport(null)}>Close Report</Button>
           </div>

           {activeReport === 'trial' && (
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <th className="p-4">Account Name</th>
                          <th className="p-4 text-right">Debit (Asset/Expense)</th>
                          <th className="p-4 text-right">Credit (Capital/Liability/Income)</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                       {reportData.trial_balance.map((item, i) => (
                          <tr key={i}>
                             <td className="p-4 font-bold text-slate-700">{item.account}</td>
                             <td className="p-4 text-right">{item.debit > 0 ? `KES ${item.debit.toLocaleString()}` : '-'}</td>
                             <td className="p-4 text-right">{item.credit > 0 ? `KES ${item.credit.toLocaleString()}` : '-'}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           )}

           {activeReport === 'cashbook' && (
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <th className="p-4">Date</th>
                          <th className="p-4">Type</th>
                          <th className="p-4">Customer/Entity</th>
                          <th className="p-4">Reference</th>
                          <th className="p-4 text-right">Amount</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                       {reportData.cashbook.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                             <td className="p-4 text-slate-500">{item.date}</td>
                             <td className="p-4">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                   item.type === 'DISBURSEMENT' ? 'bg-red-50 text-red-600' : 
                                   item.type === 'REPAYMENT' ? 'bg-emerald-50 text-emerald-600' : 
                                   'bg-blue-50 text-blue-600'
                                }`}>
                                   {item.type}
                                </span>
                             </td>
                             <td className="p-4 font-bold">{item.customer}</td>
                             <td className="p-4 font-mono text-xs">{item.reference}</td>
                             <td className={`p-4 text-right font-black ${item.type === 'DISBURSEMENT' ? 'text-red-600' : 'text-emerald-600'}`}>
                                {item.type === 'DISBURSEMENT' ? '-' : '+'} KES {item.amount.toLocaleString()}
                             </td>
                          </tr>
                       ))}
                       {reportData.cashbook.length === 0 && (
                          <tr><td colSpan="5" className="p-12 text-center text-slate-400 italic">No ledger entries found</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           )}

           {activeReport === 'collection' && (
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <th className="p-4">Date</th>
                          <th className="p-4">Customer</th>
                          <th className="p-4">Ref</th>
                          <th className="p-4 text-right">Amount</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                       {reportData.collection_log.map((item, i) => (
                          <tr key={i}>
                             <td className="p-4 text-slate-500">{item.date}</td>
                             <td className="p-4 font-bold">{item.customer}</td>
                             <td className="p-4 font-mono text-xs text-indigo-500">{item.reference}</td>
                             <td className="p-4 text-right font-black text-emerald-600">KES {item.amount.toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           )}

           {activeReport === 'aging' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {[
                    { label: '0-30 Days', val: reportData.aging_report.days_30, color: 'text-amber-600' },
                    { label: '31-60 Days', val: reportData.aging_report.days_60, color: 'text-orange-600' },
                    { label: '60+ Days (Bad Debt)', val: reportData.aging_report.days_90, color: 'text-rose-600' },
                 ].map((bucket, i) => (
                    <Card key={i} className="text-center p-8 bg-white border shadow-sm">
                       <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{bucket.label}</p>
                       <p className={cn("text-3xl font-black", bucket.color)}>KES {bucket.val.toLocaleString()}</p>
                    </Card>
                 ))}
              </div>
           )}
        </Card>
      )}

      <BulkCustomerSMSModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default FinanceDashboard;
