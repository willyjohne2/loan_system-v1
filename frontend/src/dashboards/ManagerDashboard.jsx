import React, { useEffect, useState } from 'react';
import { loanService } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Table, Button, Card, StatCard, Badge } from '../components/ui/Shared';
import CustomerRegistrationForm from '../components/forms/CustomerRegistrationForm';
import RepaymentModal from '../components/ui/RepaymentModal';
import BulkCustomerSMSModal from '../components/ui/BulkCustomerSMSModal';
import CustomerHistoryModal from '../components/ui/CustomerHistoryModal';
import { 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  UserPlus,
  ChevronDown,
  AlertCircle,
  Briefcase,
  Target,
  MapPin,
  ArrowRight,
  PieChart,
  Activity,
  Eye,
  CheckCircle,
  XCircle,
  ShieldCheck,
  UserCheck,
  History,
  FileText,
  Upload,
  BarChart3,
  ExternalLink,
  MessageSquareShare,
  ShieldOff
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';
import DeactivationRequestModal from '../components/ui/DeactivationRequestModal';

const ManagerDashboard = () => {
  const { user, updateUser } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState('Kagio');
  
  const availableBranches = [
    'Kagio', 'Embu', 'Thika', 'Naivasha'
  ];

  // Derive initial values
  const rawBranch = user?.admin?.branch || user?.branch || 'Kagio';
  const currentBranch = availableBranches.includes(rawBranch) ? rawBranch : 'Kagio';

  useEffect(() => {
    const refreshProfile = async () => {
      const adminId = user?.admin?.id || user?.id; // Standardize ID access
      if (adminId) {
        try {
          const latestProfile = await loanService.getAdminProfile(adminId);
          if (latestProfile && latestProfile.branch) {
            // Update auth context so other components see it
            updateUser({ admin: latestProfile });
            
            // Update local state if it matches our list
            if (availableBranches.includes(latestProfile.branch)) {
              setSelectedBranch(latestProfile.branch);
            }
          }
        } catch (err) {
          console.error("Failed to refresh manager profile:", err);
        }
      }
    };
    
    refreshProfile();
    // One-time refresh on mount
  }, []);

  // Update selectedBranch when user object changes (from AuthContext)
  useEffect(() => {
    const updatedRaw = user?.admin?.branch || user?.branch;
    if (updatedRaw && availableBranches.includes(updatedRaw)) {
      setSelectedBranch(updatedRaw);
    }
  }, [user]);

  const [officers, setOfficers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [unverifiedCustomers, setUnverifiedCustomers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [officerToDeactivate, setOfficerToDeactivate] = useState(null);
  const [submittingDeactivation, setSubmittingDeactivation] = useState(false);
  const [reviewingCustomer, setReviewingCustomer] = useState(null);
  const [reviewingLoan, setReviewingLoan] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('ACTIVE');

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

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingTables, setLoadingTables] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [isChartPlaceholder, setIsChartPlaceholder] = useState(false);
  const [statusDistribution, setStatusDistribution] = useState([]);
  const [stats, setStats] = useState({
    served: 0,
    issued: 0,
    repaid: 0,
    pending: 0,
    activeOfficers: 0,
    repaymentRate: 0,
    defaultRate: 0,
    unverifiedLoans: 0
  });

  const [analytics, setAnalytics] = useState({ monthly_disbursements: [], status_breakdown: [] });

  const fetchAnalytics = async () => {
    try {
      const data = await loanService.getAnalytics(selectedBranch);
      if (data && data.monthly_disbursements) {
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const parseAmount = (val) => {
    const num = Number(val);
    return Number.isFinite(num) ? num : 0;
  };

  const fetchSecondaryData = async (loansList, repaymentsList) => {
     try {
      setLoadingTables(true);
      const [offData, custData] = await Promise.all([
        loanService.getFieldOfficers(),
        loanService.getCustomers()
      ]);

      const officersList = offData.results || offData;
      let customersList = custData.results || custData;

      // Apply Branch Filter if selected
      if (selectedBranch !== 'All' && selectedBranch !== 'Azariah Credit') {
          customersList = customersList.filter(c => c.profile?.branch === selectedBranch);
          const validCustomerIds = new Set(customersList.map(c => c.id));
          loansList = loansList.filter(l => validCustomerIds.has(l.user));
          const validLoanIds = new Set(loansList.map(l => l.id));
          
          // Recalculate stats based on filtered data (only disbursed/active)
          const disbursedStatuses = ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'];
          const issued = loansList
            .filter(l => disbursedStatuses.includes((l.status || '').toUpperCase()))
            .reduce((acc, l) => acc + parseAmount(l.principal_amount), 0);
          const filteredRepayments = repaymentsList.filter(r => validLoanIds.has(r.loan));
          const repaid = filteredRepayments.reduce((acc, r) => acc + parseAmount(r.amount_paid), 0);
          
          setStats(prev => ({
            ...prev,
            issued: issued,
            repaid: repaid,
            pending: issued - repaid,
          }));
      }

      const officersWithPerformance = officersList.map(officer => {
        const officerCustomers = customersList.filter(c => c.created_by === officer.id).length;
        const officerLoans = loansList.filter(l => l.created_by === officer.id);
        const officerVolume = officerLoans.reduce((sum, l) => sum + parseAmount(l.principal_amount), 0);
        
        return {
          ...officer,
          customersCount: officerCustomers,
          loansCount: officerLoans.length,
          volume: officerVolume
        };
      });

      const unverifiedCust = customersList.filter(c => !c.is_verified);

      setOfficers(officersWithPerformance);
      setCustomers(customersList);
      setUnverifiedCustomers(unverifiedCust);

      setStats(prev => ({
        ...prev,
        served: customersList.length,
        activeOfficers: officersList.length,
      }));
     } catch (err) {
       console.error("Error fetching secondary manager data:", err);
     } finally {
       setLoadingTables(false);
     }
  };

  const fetchCoreData = async () => {
    try {
      setLoadingStats(true);
      const [loanData, repaymentData] = await Promise.all([
        loanService.getLoans(),
        loanService.getRepayments()
      ]);

      let loansList = loanData.results || loanData;
      const repaymentsList = repaymentData.results || repaymentData;

      const disbursedStatuses = ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'];
      const issued = loansList
        .filter(l => disbursedStatuses.includes((l.status || '').toUpperCase()))
        .reduce((acc, l) => acc + parseAmount(l.principal_amount), 0);
      const repaid = repaymentsList.reduce((acc, r) => acc + parseAmount(r.amount_paid), 0);
      const repaymentRate = issued > 0 ? Math.round((repaid / issued) * 100) : 0;
      const unverifiedCount = loansList.filter(l => (l.status || '').toUpperCase() === 'UNVERIFIED').length;

      // Process Chart Data (Monthly Disbursement)
      // Process Chart Data: Show last 6 months
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const last6Months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        last6Months.push(monthNames[d.getMonth()]);
      }

      const monthlyData = loansList.reduce((acc, loan) => {
        const status = (loan.status || '').toUpperCase();
        const disbursedStatuses = ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'];
        
        if (disbursedStatuses.includes(status)) {
          const month = new Date(loan.created_at).toLocaleString('default', { month: 'short' });
          acc[month] = (acc[month] || 0) + parseAmount(loan.principal_amount);
        }
        return acc;
      }, {});

      const formattedData = last6Months.map(month => ({
        name: month,
        amount: monthlyData[month] || 0
      }));

      const totalVolume = formattedData.reduce((sum, item) => sum + item.amount, 0);

      if (totalVolume === 0) {
        setIsChartPlaceholder(true);
        const previewData = [
          { name: 'Jan', amount: 80000 },
          { name: 'Feb', amount: 165000 },
          { name: 'Mar', amount: 148000 },
          { name: 'Apr', amount: 210000 },
          { name: 'May', amount: 290000 },
          { name: 'Jun', amount: 250000 }
        ];
        setChartData(previewData);
      } else {
        setIsChartPlaceholder(false);
        setChartData(formattedData);
      }

      setStats(prev => ({
        ...prev,
        issued: issued,
        repaid: repaid,
        pending: issued - repaid,
        repaymentRate: repaymentRate,
        unverifiedLoans: unverifiedCount
      }));

      setLoans(loansList);
      setLoadingStats(false);
      
      // Fetch secondary
      fetchSecondaryData(loansList, repaymentsList);
    } catch (error) {
      console.error("Error fetching core manager data:", error);
      setLoadingStats(false);
    }
  };

  const handleDeactivationSubmit = async (officerId, reason) => {
    setSubmittingDeactivation(true);
    try {
      await loanService.createDeactivationRequest({
        officer: officerId,
        reason: reason
      });
      setIsDeactivateModalOpen(false);
      setOfficerToDeactivate(null);
      alert("Deactivation request submitted successfully. Admin will review it.");
    } catch (err) {
      console.error("Error submitting deactivation request:", err);
      alert(err.response?.data?.error || "Failed to submit request.");
    } finally {
      setSubmittingDeactivation(false);
    }
  };

  useEffect(() => {
    fetchCoreData();
    fetchAnalytics();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchCoreData();
      fetchAnalytics();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [selectedBranch]);

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'AWARDED': return 'success';
      case 'VERIFIED': return 'info';
      case 'PENDING': return 'warning';
      case 'UNVERIFIED': return 'warning';
      case 'REJECTED': return 'danger';
      case 'OVERDUE': return 'danger';
      default: return 'secondary';
    }
  };

  const handleUpdateLoanStatus = async (loanId, newStatus) => {
    setUpdating(true);
    try {
      await loanService.updateLoan(loanId, { status: newStatus });
      // Refresh data without full page reload
      fetchCoreData();
      fetchAnalytics();
    } catch (err) {
      console.error("Failed to update loan status:", err);
      alert("Error updating status");
    } finally {
      setUpdating(false);
    }
  };

  const handleVerifyUser = async (userId) => {
    setUpdating(true);
    try {
      await loanService.updateCustomer(userId, { is_verified: true });
      fetchCoreData();
      fetchAnalytics();
    } catch (err) {
      console.error("Failed to verify user:", err);
      alert("Error verifying user");
    } finally {
      setUpdating(false);
    }
  };

  if (isRegistering) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">New Customer Registration</h2>
          <Button variant="secondary" onClick={() => setIsRegistering(false)}>Back to Dashboard</Button>
        </div>
        <CustomerRegistrationForm 
          onSuccess={() => setIsRegistering(false)}
          onCancel={() => setIsRegistering(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Branch Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/20 p-6 rounded-xl border border-emerald-200 dark:border-emerald-800">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            {selectedBranch} Overview
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 italic font-medium">
             Managing {selectedBranch} branch • {stats.activeOfficers} field officers
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={() => setIsRegistering(true)} className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Register Customer
          </Button>
        </div>
      </div>

      {/* Branchal KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard 
          label="Customers Served" 
          value={loadingTables ? "..." : stats.served.toString()} 
          icon={Users}
          trend="up"
          trendValue="8"
          variant="primary"
        />
        <StatCard 
          label="Amount Disbursed" 
          value={loadingStats ? "..." : `KES ${stats.issued.toLocaleString()}`} 
          icon={TrendingUp}
          trend="up"
          trendValue="12"
          variant="info"
        />
        <StatCard 
          label="Amount Repaid" 
          value={loadingStats ? "..." : `KES ${stats.repaid.toLocaleString()}`} 
          icon={CheckCircle2}
          trend="up"
          trendValue="6"
          variant="success"
        />
        <StatCard 
          label="Actions Needed" 
          value={loadingStats ? "..." : stats.unverifiedLoans.toString()} 
          icon={Clock}
          trend={stats.unverifiedLoans > 10 ? "up" : "down"}
          trendValue={stats.unverifiedLoans.toString()}
          variant="warning"
        />
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary-600" />
              Monthly Disbursement Volume
            </h3>
            {isChartPlaceholder && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-2 py-1 rounded uppercase tracking-tighter">
                Preview Data
              </span>
            )}
          </div>
          <div className="h-72 w-full min-w-0" style={{ minHeight: '300px' }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 12}} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 12}} 
                    tickFormatter={(val) => `K${val/1000}k`} 
                    width={50}
                  />
                  <ChartTooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#ffffff' }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(value) => [`KES ${value.toLocaleString()}`, isChartPlaceholder ? 'Projected' : 'Amount']}
                    cursor={{fill: '#ffffff10'}}
                  />
                  <Bar 
                    dataKey="amount" 
                    fill="#ffffff" 
                    radius={[6, 6, 0, 0]} 
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 text-sm italic">No disbursement data available.</p>
                <p className="text-slate-300 text-[10px] mt-1 uppercase font-bold tracking-widest">Branchal charts will appear here</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <PieChart className="w-5 h-5 text-emerald-600" />
              Portfolio Status Distribution
            </h3>
          </div>
          <div className="h-72 w-full flex items-center justify-center">
            {statusDistribution.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={[
                          '#10b981', // AWARDED
                          '#3b82f6', // VERIFIED
                          '#f59e0b', // PENDING/UNVERIFIED
                          '#ef4444', // REJECTED
                          '#6366f1'  // OTHERS
                        ][index % 5]} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                  {statusDistribution.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full" style={{backgroundColor: [
                         '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6366f1'
                       ][index % 5]}}></div>
                       <span className="text-xs font-medium text-slate-600">{entry.name} ({entry.value})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center">
                <PieChart className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 text-sm italic">No status data available.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Officer Performance Table */}
        <Card className="lg:col-span-2 p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
               <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                 <Briefcase className="w-5 h-5 text-primary-600" />
                 Field Officer Performance
               </h3>
               <p className="text-xs text-slate-500 mt-1">Branchal recruitment and disbursement metrics</p>
            </div>
          </div>
          
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Officer</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Customers</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Loans</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Volume (KES)</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {officers.slice(0, 5).map((off) => (
                  <tr key={off.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                       <p className="text-sm font-semibold text-slate-900 dark:text-white">{off.full_name}</p>
                       <p className="text-xs text-slate-500">{off.email}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{off.customersCount}</span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-700 dark:text-slate-300">
                       {off.loansCount}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-primary-600 dark:text-primary-400">
                       {(off.volume || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                       <button 
                         type="button"
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           setOfficerToDeactivate(off);
                           setIsDeactivateModalOpen(true);
                         }}
                         className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded-lg transition-colors relative z-10"
                         title="Request Deactivation"
                       >
                         <ShieldOff className="w-5 h-5" />
                       </button>
                    </td>
                  </tr>
                ))}
                {officers.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400 italic">No field officers assigned to this branch yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Portfolio Quality Card */}
        <Card className="p-6">
           <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <Target className="w-5 h-5 text-emerald-600" />
              Portfolio Overview
           </h3>
           
           <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-sm font-medium dark:text-slate-300">Repayment Rate</span>
                 </div>
                 <span className="text-lg font-bold text-emerald-600">{stats.repaymentRate}%</span>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                  <span>Verification Progress</span>
                  <span className="text-primary-600">{Math.round(((loans.length - stats.unverifiedLoans) / (loans.length || 1)) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-primary-500 transition-all duration-1000" 
                     style={{ width: `${((loans.length - stats.unverifiedLoans) / (loans.length || 1)) * 100}%` }}
                   ></div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                 <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Total Portfolio Value</span>
                    <span className="font-bold text-slate-900 dark:text-white">KES {stats.issued.toLocaleString()}</span>
                 </div>
                 <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Active Customers</span>
                    <span className="font-bold text-slate-900 dark:text-white">{stats.served}</span>
                 </div>
              </div>

              <Button variant="outline" className="w-full gap-2 text-xs py-2">
                 Generate Branchal Report
                 <ArrowRight className="w-3 h-3" />
              </Button>
           </div>
        </Card>
      </div>

      {/* Recent Loans */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
           <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Activity className="w-5 h-5 text-orange-500" />
              Branchal Loan Pipeline
           </h3>

           <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
             {[
               { id: 'ACTIVE', label: 'Disbursed' },
               { id: 'PENDING', label: 'Processing' },
               { id: 'REJECTED', label: 'Rejected' }
             ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                   activeTab === tab.id 
                     ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm' 
                     : 'text-slate-500 hover:text-slate-700'
                 }`}
               >
                 {tab.label.toUpperCase()}
               </button>
             ))}
           </div>

           <div className="flex gap-2">
             <Button 
               variant="primary" 
               size="sm" 
               className="bg-orange-600 hover:bg-orange-700 flex items-center gap-2 shadow-lg shadow-orange-500/20"
               onClick={() => setIsBulkModalOpen(true)}
             >
               <MessageSquareShare className="w-4 h-4" />
               Customer Comms
             </Button>
           </div>
        </div>
        
        <div className="overflow-x-auto -mx-6 md:mx-0 px-6 md:px-0 max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <table className="w-full text-left min-w-[700px]">
            <thead className="sticky top-0 z-10">
              <tr className="text-[10px] md:text-xs font-black text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <th className="px-4 py-3">Loan ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 whitespace-nowrap">Total Repayable</th>
                <th className="px-4 py-3">Principal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
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
                }).map((loan) => (
                  <tr key={loan.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/20">
                    <td className="px-4 py-4 font-mono text-xs text-slate-500">{loan.id.substring(0, 8)}...</td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {loan.customer_name || customers.find(c => c.id === loan.user)?.full_name || 'Loading...'}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[10px] font-bold text-slate-500 uppercase border px-1.5 py-0.5 rounded">{loan.product_name}</span>
                    </td>
                    <td className="px-4 py-4 font-black text-emerald-600 dark:text-emerald-400">
                      KES {Number(loan.total_repayable_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 font-semibold italic text-slate-700 dark:text-slate-300">
                      KES {Number(loan.principal_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={getStatusColor(loan.status)}>
                        {loan.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {loan.status === 'UNVERIFIED' && (
                          <Button 
                            size="xs" 
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                            onClick={() => {
                              setSelectedCustomer(customers.find(c => c.id === loan.user));
                              setSelectedLoan(loan);
                            }}
                            disabled={updating}
                          >
                            Verify
                          </Button>
                        )}
                        <Button 
                          size="xs" 
                          variant="ghost"
                          onClick={() => setSelectedLoan(loan)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                   <td colSpan="7" className="px-4 py-12 text-center text-slate-400 italic">No {activeTab.toLowerCase()} loans found in this branch</td>
                </tr>
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
                   <td colSpan="3" className="px-4 py-3 text-right text-[10px] font-black text-slate-500">BRANCH TOTALS:</td>
                   <td className="px-4 py-3 text-sm font-black text-emerald-600 dark:text-emerald-400">
                     KES {totals.repayable.toLocaleString()}
                   </td>
                   <td className="px-4 py-3 text-sm font-black text-slate-700 dark:text-slate-300">
                     KES {totals.principal.toLocaleString()}
                   </td>
                   <td colSpan="2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Unverified Customers Section */}
      <Card className="p-6 border-l-4 border-l-amber-500">
        <div className="flex items-center justify-between mb-6">
           <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              Unverified Customers
           </h3>
           <Badge variant="warning">{unverifiedCustomers.length} Awaiting Verification</Badge>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Registered By</th>
                <th className="px-4 py-3 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {unverifiedCustomers.map((cust) => (
                <tr key={cust.id} className="text-sm">
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                    {cust.full_name}
                  </td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-400">
                    {cust.phone}
                  </td>
                  <td className="px-4 py-4 text-slate-500">
                     {cust.branch || 'N/A'}
                  </td>
                  <td className="px-4 py-4 text-xs">
                     {officers.find(o => o.id === cust.created_by)?.full_name || 'Direct / Unknown'}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => setSelectedCustomer(cust)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-amber-200 text-amber-700 hover:bg-amber-50 gap-2"
                        onClick={() => {
                          const loan = loans.find(l => l.user === cust.id && l.status === 'UNVERIFIED');
                          setReviewingCustomer(cust);
                          setReviewingLoan(loan);
                          setIsReviewOpen(true);
                        }}
                        disabled={updating}
                      >
                        <UserCheck className="w-4 h-4" />
                        Verify
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {unverifiedCustomers.length === 0 && (
                <tr>
                   <td colSpan="5" className="px-4 py-12 text-center text-slate-400 italic">
                      All customers in your branch are currently verified.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Loan Details Modal Overlay */}
      {selectedLoan && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full p-8 relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setSelectedLoan(null)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              <XCircle className="w-6 h-6 text-slate-400" />
            </button>
            
            <div className="flex items-start gap-6 mb-8">
              <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl">
                <Briefcase className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Loan Details</h3>
                <p className="text-slate-500 font-mono text-sm">{selectedLoan.id}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer Info</label>
                  <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    {customers.find(c => c.id === selectedLoan.user)?.full_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    ID: {customers.find(c => c.id === selectedLoan.user)?.profile?.national_id || 'N/A'}
                  </p>
                  <p className="text-sm text-slate-500">
                    Location: {customers.find(c => c.id === selectedLoan.user)?.profile?.town}, {customers.find(c => c.id === selectedLoan.user)?.profile?.branch}
                  </p>
                  <p className="text-sm text-slate-500 capitalize">
                    {customers.find(c => c.id === selectedLoan.user)?.profile?.employment_status || 'N/A'} • KES {Number(customers.find(c => c.id === selectedLoan.user)?.profile?.monthly_income || 0).toLocaleString()}/mo
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Principal Amount</label>
                  <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
                    KES {Number(selectedLoan.principal_amount).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reason</label>
                  <p className="text-slate-600 dark:text-slate-400 italic">"{selectedLoan.loan_reason || 'No reason provided'}"</p>
                </div>
              </div>
              
              <div className="space-y-4 text-right flex flex-col items-end">
               <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</label>
                  <div className="mt-1">
                    <Badge variant={getStatusColor(selectedLoan.status)} className="text-base px-3 py-1">
                      {selectedLoan.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</label>
                  <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    {selectedLoan.duration_weeks ? `${selectedLoan.duration_weeks} Weeks` : `${selectedLoan.duration_months} Months`}
                  </p>
                </div>
                
                {/* Visual Identity for Manager Review */}
                <div className="flex gap-2 h-24 mt-2">
                   {customers.find(c => c.id === selectedLoan.user)?.profile?.profile_image && (
                     <div className="h-full aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                        <img 
                          src={customers.find(c => c.id === selectedLoan.user).profile.profile_image.startsWith('http') 
                            ? customers.find(c => c.id === selectedLoan.user).profile.profile_image 
                            : `${loanService.api.defaults.baseURL.replace('/api', '')}${customers.find(c => c.id === selectedLoan.user).profile.profile_image}`} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                     </div>
                   )}
                   {customers.find(c => c.id === selectedLoan.user)?.profile?.national_id_image && (
                     <div className="h-full aspect-[3/2] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                        <img 
                          src={customers.find(c => c.id === selectedLoan.user).profile.national_id_image.startsWith('http') 
                            ? customers.find(c => c.id === selectedLoan.user).profile.national_id_image 
                            : `${loanService.api.defaults.baseURL.replace('/api', '')}${customers.find(c => c.id === selectedLoan.user).profile.national_id_image}`} 
                          alt="ID" 
                          className="w-full h-full object-cover"
                        />
                     </div>
                   )}
                </div>
              </div>
            </div>

            {/* Activities & Documents Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pt-6 border-t border-slate-100 dark:border-slate-800">
               {/* Timeline */}
               <section>
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <Clock className="w-4 h-4" />
                   Activity Timeline
                 </h4>
                 <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                   {selectedLoan.activities?.length > 0 ? (
                     selectedLoan.activities.slice().reverse().map((activity, idx) => (
                       <div key={idx} className="relative pl-6 border-l-2 border-slate-100 dark:border-slate-800 pb-2">
                         <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-2 border-primary-500"></div>
                         <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{activity.action}</p>
                         <p className="text-xs text-slate-500">{activity.note}</p>
                         <p className="text-[10px] text-slate-400 mt-1">{new Date(activity.created_at).toLocaleString()}</p>
                       </div>
                     ))
                   ) : (
                     <p className="text-sm text-slate-400 italic">No activity recorded yet.</p>
                   )}
                 </div>
               </section>

               {/* Documents */}
               <section>
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <FileText className="w-4 h-4" />
                   Loan Documents
                 </h4>
                 <div className="space-y-2">
                   {selectedLoan.documents?.length > 0 ? (
                     selectedLoan.documents.map((doc, idx) => (
                       <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                         <div className="flex items-center gap-3">
                           <FileText className="w-5 h-5 text-primary-500" />
                           <div>
                             <p className="text-sm font-medium">{doc.name}</p>
                             <p className="text-[10px] text-slate-500 uppercase">{doc.document_type}</p>
                           </div>
                         </div>
                         <a 
                           href={doc.file.startsWith('http') ? doc.file : `${loanService.api.defaults.baseURL.replace('/api', '')}${doc.file}`} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="text-xs text-primary-600 hover:underline font-bold"
                         >
                           VIEW
                         </a>
                       </div>
                     ))
                   ) : (
                     <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                       <p className="text-sm text-slate-400">No documents uploaded.</p>
                       <p className="text-[10px] text-slate-500 mt-1">Upload via Officer Terminal</p>
                     </div>
                   )}
                 </div>
               </section>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedLoan(null)}>Close</Button>
              {selectedLoan.status !== 'REJECTED' && (
                <Button 
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => handleUpdateLoanStatus(selectedLoan.id, 'REJECTED')}
                  disabled={updating}
                >
                  Reject Loan
                </Button>
              )}
              {selectedLoan.status === 'UNVERIFIED' && (
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => handleUpdateLoanStatus(selectedLoan.id, 'VERIFIED')}
                  disabled={updating}
                >
                  Verify Loan
                </Button>
              )}
              {selectedLoan.status === 'VERIFIED' && (
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleUpdateLoanStatus(selectedLoan.id, 'PENDING')}
                  disabled={updating}
                >
                  Move to Pending
                </Button>
              )}
              {['ACTIVE', 'OVERDUE'].includes(selectedLoan.status) && (
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setShowRepaymentModal(true)}
                  disabled={updating}
                >
                  Record Repayment
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {showRepaymentModal && selectedLoan && (
        <RepaymentModal
          loan={{
            ...selectedLoan,
            customer_name: customers.find(c => c.id === selectedLoan.user)?.full_name || 'Customer',
            user_phone: customers.find(c => c.id === selectedLoan.user)?.phone || '',
            amount: Number(selectedLoan.remaining_balance || selectedLoan.principal_amount) || 0
          }}
          onClose={() => setShowRepaymentModal(false)}
          onSuccess={() => {
            setShowRepaymentModal(false);
            setSelectedLoan(null);
            fetchData();
          }}
        />
      )}

      {isBulkModalOpen && (
        <BulkCustomerSMSModal 
          isOpen={isBulkModalOpen} 
          onClose={() => setIsBulkModalOpen(false)} 
        />
      )}

      {/* Customer Details Modal Overlay */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-3xl w-full p-8 relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setSelectedCustomer(null)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              <XCircle className="w-6 h-6 text-slate-400" />
            </button>
            
            <div className="flex items-start gap-6 mb-8">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl">
                <Users className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Customer Profile Review</h3>
                <p className="text-slate-500 font-mono text-sm">{selectedCustomer.id}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <section className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Full Name</p>
                      <p className="font-semibold">{selectedCustomer.full_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Phone Number</p>
                      <p className="font-semibold">{selectedCustomer.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Email Address</p>
                      <p className="font-semibold text-sm">{selectedCustomer.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">National ID</p>
                      <p className="font-semibold">{selectedCustomer.profile?.national_id || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Location Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Branch</p>
                      <p className="font-medium">{selectedCustomer.profile?.branch || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Town / Village</p>
                      <p className="font-medium">{selectedCustomer.profile?.town || 'N/A'}, {selectedCustomer.profile?.village || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Financial Profile</h4>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Employment</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedCustomer.profile?.employment_status || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Monthly Income</span>
                      <span className="text-sm font-bold text-primary-600">KES {Number(selectedCustomer.profile?.monthly_income || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Registration Context</h4>
                   <p className="text-sm text-slate-600 dark:text-slate-400">
                     Account created on {new Date(selectedCustomer.created_at).toLocaleDateString()} by 
                     <span className="font-bold text-slate-800 dark:text-slate-200 ml-1">
                        {officers.find(o => o.id === selectedCustomer.created_by)?.full_name || 'System'}
                     </span>.
                   </p>
                </div>
              </section>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedCustomer(null)}>Close</Button>
              {!selectedCustomer.is_verified && (
                <Button 
                  className="bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-2"
                  onClick={() => {
                    const loan = loans.find(l => l.user === selectedCustomer.id && l.status === 'UNVERIFIED');
                    setReviewingCustomer(selectedCustomer);
                    setReviewingLoan(loan);
                    setIsReviewOpen(true);
                    setSelectedCustomer(null);
                  }}
                  disabled={updating}
                >
                  <UserCheck className="w-4 h-4" />
                  Review & Verify
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {isReviewOpen && (
        <CustomerHistoryModal 
          isOpen={isReviewOpen}
          customer={reviewingCustomer}
          loanToVerify={reviewingLoan}
          onVerified={() => {
            setIsReviewOpen(false);
            window.location.reload();
          }}
          onClose={() => setIsReviewOpen(false)}
        />
      )}
      <DeactivationRequestModal
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        officer={officerToDeactivate}
        onSubmit={handleDeactivationSubmit}
        loading={submittingDeactivation}
      />
    </div>
  );
};

export default ManagerDashboard;
