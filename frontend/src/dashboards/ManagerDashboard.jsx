import React, { useEffect, useState, useMemo } from 'react';
import { loanService } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Table, Button, Card, StatCard, Badge } from '../components/ui/Shared';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import PaginationFooter from '../components/ui/PaginationFooter';
import { useRepayments, useFieldOfficers, useCustomers, useInvalidate } from '../hooks/useQueries';
import { useGodModeGuard } from '../hooks/useGodModeGuard';
import CustomerRegistrationForm from '../components/forms/CustomerRegistrationForm';
import RepaymentModal from '../components/ui/RepaymentModal';
import BulkCustomerSMSModal from '../components/ui/BulkCustomerSMSModal';
import CustomerHistoryModal from '../components/ui/CustomerHistoryModal';
import AdminOfficers from './AdminOfficers';
import BulkInviteModal from '../components/forms/BulkInviteModal';
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
  ShieldOff,
  UserCircle,
  Search,
  ShieldAlert,
  AlertTriangle,
  Lock,
  CalendarDays
} from 'lucide-react';
import { format, formatDistanceToNow, isAfter, subHours, subDays } from 'date-fns';
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
import { useTeamSecurityAlerts } from '../hooks/useQueries';

const formatLastActive = (lastLogin) => {
  if (!lastLogin) return { label: 'Never Active', color: 'bg-slate-100 text-slate-500 border-slate-200' };
  
  const date = new Date(lastLogin);
  const now = new Date();
  const diffInMinutes = (now - date) / 1000 / 60;
  
  if (diffInMinutes < 5) return { label: 'Online Now', color: 'bg-emerald-100 text-emerald-700 border-emerald-200 animate-pulse' };
  if (isAfter(date, subHours(now, 2))) return { label: 'Active recently', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
  if (isAfter(date, subHours(now, 24))) return { label: 'Active today', color: 'bg-blue-50 text-blue-600 border-blue-100' };
  if (isAfter(date, subDays(now, 7))) return { label: formatDistanceToNow(date) + ' ago', color: 'bg-slate-50 text-slate-600 border-slate-200' };
  
  return { label: format(date, 'MMM d, yyyy'), color: 'bg-slate-100 text-slate-400 border-slate-200 opacity-60' };
};

const ManagerDashboard = () => {
  const { user, updateUser } = useAuth();
  const { guardAction, isRestricted } = useGodModeGuard();
  
  const [activeTab, setActiveTab] = useState('ACTIVE');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const managerQueueParams = useMemo(() => ({
    tab: activeTab, 
    search: search || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined
  }), [activeTab, search, dateFrom, dateTo]);

  const { 
    data: loans, 
    isLoading: loansLoading, 
    isFetching, 
    error: loansError, 
    hasMore, 
    showMore: fetchNext, 
    showLess,
    reset 
  } = usePaginatedQuery({
    queryKey: ['manager-queue'],
    queryFn: (params) => loanService.getManagerQueue(params),
    pageSize: 10,
    params: managerQueueParams
  });

  // Removed manual reset callback to allow 'keepPreviousData' to work properly
  // useEffect(() => {
  //   reset();
  // }, [managerQueueParams, reset]);

  const { data: repaymentsData, isLoading: repaymentsLoading } = useRepayments();
  const { data: officersData, isLoading: officersLoading } = useFieldOfficers();
  const { data: customersData, isLoading: customersLoading } = useCustomers();

  const { invalidateLoans, invalidateRepayments, invalidateCustomers } = useInvalidate();

  const { data: alertsData, isLoading: alertsLoading } = useTeamSecurityAlerts();
  const alerts = alertsData || [];

  const loadingStats = loansLoading || repaymentsLoading;
  const loadingTables = officersLoading || customersLoading;

  const [selectedBranch, setSelectedBranch] = useState('Kagio');
  
  const availableBranches = [
    'All Branches', 'Kagio', 'Embu', 'Thika', 'Naivasha'
  ];

  // Derive initial values
  const rawBranch = user?.admin?.branch || user?.branch || 'All Branches';
  const currentBranch = availableBranches.includes(rawBranch) ? rawBranch : 'Kagio';

  useEffect(() => {
    const refreshProfile = async () => {
      const adminId = user?.admin?.id || user?.id; // Standardize ID access
      if (adminId) {
        try {
          const latestProfile = await loanService.getAdminProfile(adminId);
          if (latestProfile && latestProfile.branch) {
            // Check if we actually need to update to avoid infinite loop
            const currentUserBranch = user?.admin?.branch || user?.branch;
            if (latestProfile.branch !== currentUserBranch) {
                // Update auth context so other components see it
                updateUser({ ...user, admin: { ...user?.admin, ...latestProfile }, branch: latestProfile.branch });
            }
            
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

  // Sync selectedBranch when user object changes (but don't trigger updates back)
  useEffect(() => {
    const updatedRaw = user?.admin?.branch || user?.branch;
    if (updatedRaw && availableBranches.includes(updatedRaw) && updatedRaw !== selectedBranch) {
      setSelectedBranch(updatedRaw);
    }
  }, [user?.admin?.branch, user?.branch]);

  const repayments = useMemo(() => repaymentsData?.results || repaymentsData || [], [repaymentsData]);
  const officersRaw = useMemo(() => officersData?.results || officersData || [], [officersData]);
  const customers = useMemo(() => customersData?.results || customersData || [], [customersData]);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [officerToDeactivate, setOfficerToDeactivate] = useState(null);
  const [submittingDeactivation, setSubmittingDeactivation] = useState(false);
  const [reviewingCustomer, setReviewingCustomer] = useState(null);
  const [reviewingLoan, setReviewingLoan] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updatingLoanId, setUpdatingLoanId] = useState(null);
  const [displayCount, setDisplayCount] = useState(10);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const parseAmount = (val) => {
    const num = Number(val);
    return Number.isFinite(num) ? num : 0;
  };

  const loansList = useMemo(() => loans || [], [loans]);

  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const isBranchFilterActive = selectedBranch && selectedBranch !== 'All' && selectedBranch !== 'Azariah Credit' && selectedBranch !== 'All Branches';

  const branchFilteredCustomers = useMemo(() => {
    if (!isBranchFilterActive) return customers;
    return customers.filter(c => c.profile?.branch === selectedBranch);
  }, [customers, selectedBranch, isBranchFilterActive]);

  const branchFilteredLoans = useMemo(() => {
    // The backend already filters loans strictly to the manager's assigned branch.
    // Filtering by checking if customer exists in the local 'customers' array drops 
    // loans if the customer is not in the first paginated page.
    return loansList;
  }, [loansList]);

  const branchFilteredRepayments = useMemo(() => {
    if (!isBranchFilterActive) return repayments;
    const validLoanIds = new Set(branchFilteredLoans.map(l => l.id));
    return repayments.filter(r => validLoanIds.has(r.loan));
  }, [repayments, branchFilteredLoans, isBranchFilterActive]);

  const stats = useMemo(() => {
    const disbursedStatuses = ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'];
    const issued = branchFilteredLoans
      .filter(l => disbursedStatuses.includes((l.status || '').toUpperCase()))
      .reduce((acc, l) => acc + parseAmount(l.principal_amount), 0);
    const repaid = branchFilteredRepayments.reduce((acc, r) => acc + parseAmount(r.amount_paid), 0);
    const repaymentRate = issued > 0 ? Math.round((repaid / issued) * 100) : 0;
    const unverifiedLoans = branchFilteredLoans.filter(l => (l.status || '').toUpperCase() === 'UNVERIFIED').length;
    
    return {
      served: branchFilteredCustomers.length,
      issued,
      repaid,
      pending: issued - repaid,
      activeOfficers: officersRaw.length,
      repaymentRate,
      unverifiedLoans
    };
  }, [branchFilteredLoans, branchFilteredRepayments, branchFilteredCustomers, officersRaw]);

  const officers = useMemo(() => {
    return officersRaw.map(officer => {
      const officerCustomers = customers.filter(c => c.created_by === officer.id).length;
      const officerLoans = loansList.filter(l => l.created_by === officer.id);
      const officerVolume = officerLoans.reduce((sum, l) => sum + parseAmount(l.principal_amount), 0);
      
      return {
        ...officer,
        customersCount: officerCustomers,
        loansCount: officerLoans.length,
        volume: officerVolume
      };
    });
  }, [officersRaw, customers, loansList]);

  const unverifiedCustomers = useMemo(() => {
    return branchFilteredCustomers.filter(c => !c.is_verified);
  }, [branchFilteredCustomers]);

  const statusDistribution = useMemo(() => {
    const statuses = loansList.reduce((acc, l) => {
      const s = (l.status || 'PENDING').toUpperCase();
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statuses)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [loansList]);

  const chartData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      last6Months.push(monthNames[d.getMonth()]);
    }

    const monthlyData = branchFilteredLoans.reduce((acc, loan) => {
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
      return [
        { name: 'Jan', amount: 80000 },
        { name: 'Feb', amount: 165000 },
        { name: 'Mar', amount: 148000 },
        { name: 'Apr', amount: 210000 },
        { name: 'May', amount: 290000 },
        { name: 'Jun', amount: 250000 }
      ];
    }
    return formattedData;
  }, [branchFilteredLoans]);

  const isChartPlaceholder = useMemo(() => {
    return chartData.every(d => d.amount === 0) || (chartData[0]?.amount === 80000); 
  }, [chartData]);

  // Logic for filtered totals
  const processedLoans = useMemo(() => {
    // backend already filters for tab and search
    let result = [...branchFilteredLoans];

    // Sort - Newest update first (ensures recycled rejects are at bottom/back)
    // and older APPLICATIONS stay at the top.
    result.sort((a, b) => {
      // Primary sort: Oldest created_at first (for equality)
      return new Date(a.created_at) - new Date(b.created_at);
    });

    return result;
  }, [branchFilteredLoans]);

  const totals = (processedLoans || []).reduce((acc, l) => ({
    repayable: acc.repayable + Number(l.total_repayable_amount || 0),
    principal: acc.principal + Number(l.principal_amount || 0)
  }), { repayable: 0, principal: 0 });

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
    fetchAnalytics();
  }, [selectedBranch]);

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'AWARDED':
      case 'DISBURSED':
      case 'ACTIVE': return 'success';
      case 'VERIFIED':
      case 'APPROVED': return 'info';
      case 'FIELD_VERIFIED': return 'primary';
      case 'PENDING':
      case 'UNVERIFIED': return 'warning';
      case 'REJECTED':
      case 'OVERDUE': return 'danger';
      default: return 'secondary';
    }
  };

  const handleUpdateLoanStatus = async (loanId, newStatus) => {
    setUpdating(true);
    setUpdatingLoanId(loanId);
    try {
      await loanService.updateLoan(loanId, { 
        status: newStatus,
        status_change_reason: `Manager override to ${newStatus}`
      });
      // Refresh data without full page reload
      invalidateLoans();
      fetchAnalytics();
    } catch (err) {
      console.error("Failed to update loan status:", err);
      alert("Error updating status");
    } finally {
      setUpdating(false);
      setUpdatingLoanId(null);
    }
  };

  const handleVerifyUser = async (userId) => {
    setUpdating(true);
    try {
      await loanService.updateCustomer(userId, { is_verified: true });
      invalidateCustomers();
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
          <div className="relative">
             <select 
               value={selectedBranch}
               onChange={(e) => setSelectedBranch(e.target.value)}
               className="h-10 pl-4 pr-10 text-sm font-bold bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 rounded-lg appearance-none focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer text-slate-700 dark:text-slate-200"
             >
               {availableBranches.map(branch => (
                 <option key={branch} value={branch}>{branch}</option>
               ))}
             </select>
             <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none text-slate-400" />
          </div>
          <Button 
            variant="secondary"
            disabled={isRestricted}
            onClick={() => guardAction(() => setShowInviteModal(true))} 
            className="flex items-center gap-2"
          >
            <UserCircle className="w-4 h-4" />
            Invite Field Officer
          </Button>
          <Button 
            disabled={isRestricted}
            onClick={() => guardAction(() => setIsRegistering(true))} 
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Register Customer
          </Button>
        </div>
      </div>

      <BulkInviteModal 
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        defaultRole="FIELD_OFFICER"
      />

      {/* Branchal KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard 
          label="Branch Customers" 
          value={loadingTables ? "..." : stats.served.toString()} 
          icon={Users}
          trend="up"
          trendValue="8"
          variant="primary"
        />
        <StatCard 
          label="Branch Disbursements" 
          value={loadingStats ? "..." : `KES ${stats.issued.toLocaleString()}`} 
          icon={TrendingUp}
          trend="up"
          trendValue="12"
          variant="info"
        />
        <StatCard 
          label="Branch Repayments" 
          value={loadingStats ? "..." : `KES ${stats.repaid.toLocaleString()}`} 
          icon={CheckCircle2}
          trend="up"
          trendValue="6"
          variant="success"
        />
        <StatCard 
          label="Action Required" 
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
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Status</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Customers</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Loans</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Volume (KES)</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {officers.slice(0, 5).map((off) => {
                  const status = formatLastActive(off.last_login);
                  return (
                    <tr key={off.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold text-xs ring-2 ring-white dark:ring-slate-900">
                             {off.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{off.full_name}</p>
                            <p className="text-xs text-slate-400">{off.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${status.color}`}>
                          {status.label}
                        </span>
                        {off.failed_login_attempts > 0 && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[9px] font-black uppercase ring-1 ring-red-200">
                              <ShieldAlert className="w-2.5 h-2.5 mr-0.5" />
                              {off.failed_login_attempts} Failed
                            </span>
                          </div>
                        )}
                        {off.is_locked_out && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-black uppercase">
                              <Lock className="w-2.5 h-2.5 mr-0.5" />
                              LOCKED
                            </span>
                          </div>
                        )}
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
                  );
                })}
                {officers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">No field officers assigned to this branch yet</td>
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

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                 <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Total Portfolio Value</span>
                    <span className="font-bold text-slate-900 dark:text-white">KES {stats.issued.toLocaleString()}</span>
                 </div>
                 <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Active Customers</span>
                    <span className="font-bold text-slate-900 dark:text-white">{stats.served}</span>
                 </div>
              </div>

              {/* Branch Security Alerts */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                    Security Alerts
                  </h4>
                  {alerts.length > 0 && (
                    <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
                  )}
                </div>
                
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {alerts.length > 0 ? (
                    alerts.slice(0, 5).map((alert, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-100/50 dark:border-red-900/20 group hover:bg-red-50 transition-colors">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight mb-0.5">
                              {alert.action}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-500">
                                {alert.admin_name || 'System'}
                              </span>
                              <span className="text-[9px] font-medium text-slate-400">
                                {formatDistanceToNow(new Date(alert.created_at))} ago
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center">
                      <ShieldCheck className="w-8 h-8 text-emerald-200 mx-auto mb-2" />
                      <p className="text-[10px] text-slate-400 italic font-medium">No security threats detected in your branch.</p>
                    </div>
                  )}
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
               { id: 'QUEUE', label: 'Review Queue' },
               { id: 'VERIFIED', label: 'Manager Verified' },
               { id: 'APPROVED', label: 'Pushed to Finance' },
               { id: 'ACTIVE', label: 'Disbursed' },
               { id: 'REJECTED', label: 'Rejected' }
             ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => {
                   setActiveTab(tab.id);
                   setDisplayCount(10);
                 }}
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

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search customer, ID, loan ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500 shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase">From:</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-white dark:bg-slate-900 border-none rounded-lg text-xs py-2 px-1 shadow-sm" />
            <span className="text-[10px] font-black text-slate-400 uppercase">To:</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-white dark:bg-slate-900 border-none rounded-lg text-xs py-2 px-1 shadow-sm" />
          </div>
        </div>
        
        <div className="overflow-x-auto -mx-6 md:mx-0 px-6 md:px-0 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <Table
            headers={['Loan ID', 'Customer', 'Product', 'Total Repayable', 'Principal', 'Status', 'Actions']}
            data={processedLoans}
            loading={loadingStats}
            initialCount={10}
            disableLocalPagination={true}
            renderRow={(loan) => (
              <tr key={loan.id} className="text-[10px] md:text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-50 dark:border-slate-800/50 last:border-0 whitespace-nowrap">
                <td className="px-4 py-3 font-mono font-bold text-slate-500">#{loan.id}</td>
                <td className="px-4 py-3">
                   <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-white leading-tight">{loan.customer_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {loan.customer_id_number || loan.national_id || 'N/A'}</span>
                   </div>
                </td>
                <td className="px-4 py-3">
                   <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {loan.product_name}
                   </span>
                </td>
                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">KES {parseAmount(loan.total_repayable_amount).toLocaleString()}</td>
                <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">KES {parseAmount(loan.principal_amount).toLocaleString()}</td>
                <td className="px-4 py-3">
                   <Badge variant={getStatusColor(loan.status)} className="text-[9px] px-2 py-0.5">
                      {loan.status}
                   </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                   {activeTab === 'QUEUE' && (loan.status === 'UNVERIFIED' || loan.status === 'FIELD_VERIFIED' || loan.status === 'PENDING') && (
                     <div className="flex gap-2">
                       <button 
                         onClick={() => {
                            const customerObj = customers.find(c => c.id === loan.user) || { id: loan.user, full_name: loan.customer_name, national_id: loan.customer_id_number, phone_number: loan.phone_number };
                            setReviewingLoan(loan);
                            setReviewingCustomer(customerObj);
                            setIsReviewOpen(true);
                         }}
                         className="p-1 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-sm hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                         disabled={updatingLoanId === loan.id}
                       >
                         {updatingLoanId === loan.id ? "..." : "VERIFY LOAN"}
                       </button>
                       <button 
                         onClick={() => {
                            if (window.confirm("Approve this loan and send to Finance for disbursement?")) {
                              handleUpdateLoanStatus(loan.id, 'APPROVED');
                            }
                         }}
                         className="p-1 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                         disabled={updatingLoanId === loan.id}
                       >
                         {updatingLoanId === loan.id ? "PUSHING..." : "✓ APPROVE"}
                       </button>
                     </div>
                   )}
                   {activeTab === 'VERIFIED' && (
                     <button 
                       onClick={() => {
                          if (window.confirm("Approve this loan and send to Finance for disbursement?")) {
                            handleUpdateLoanStatus(loan.id, 'APPROVED');
                          }
                       }}
                       className="p-1 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                       disabled={updatingLoanId === loan.id}
                     >
                       {updatingLoanId === loan.id ? "FORWARDING..." : "✓ APPROVE & SEND TO FINANCE"}
                     </button>
                   )}
                   {activeTab === 'APPROVED' && (
                     <button 
                       onClick={() => {
                         const customerObj = customers.find(c => c.id === loan.user) || { id: loan.user, full_name: loan.customer_name, national_id: loan.customer_id_number, phone_number: loan.phone_number };
                         setReviewingLoan(loan);
                         setReviewingCustomer(customerObj);
                         setIsReviewOpen(true);
                       }}
                       className="flex items-center gap-1 justify-end w-full group cursor-pointer"
                     >
                        <span className="text-[10px] font-black text-emerald-600 uppercase group-hover:text-emerald-500">
                           Pushed to Finance
                        </span>
                        <ArrowRight className="w-3 h-3 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                     </button>
                   )}
                   {['DISBURSED', 'ACTIVE', 'OVERDUE'].includes(loan.status) && (
                     <Button 
                       size="sm"
                       variant="secondary"
                       className="text-[10px] h-7 px-3 font-bold"
                       onClick={() => {
                         setSelectedLoan(loan);
                         setShowRepaymentModal(true);
                       }}
                     >
                       REPAYMENT
                     </Button>
                   )}
                   {loan.status === 'REJECTED' && (
                     <button 
                       onClick={() => {
                         const customerObj = customers.find(c => c.id === loan.user) || { id: loan.user, full_name: loan.customer_name, national_id: loan.customer_id_number, phone_number: loan.phone_number };
                         setReviewingLoan(loan);
                         setReviewingCustomer(customerObj);
                         setIsReviewOpen(true);
                       }}
                       className="p-1 px-4 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm"
                     >
                       VIEW REASON
                     </button>
                   )}
                </td>
              </tr>
            )}
          />
          <PaginationFooter
            resultsCount={processedLoans.length}
            hasMore={hasMore}
            isLoading={isFetching}
            onShowMore={fetchNext}
            onShowLess={showLess}
          />
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
              {['UNVERIFIED', 'FIELD_VERIFIED'].includes(selectedLoan.status) && (
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
                  onClick={() => {
                    if (window.confirm("This loan is already verified. Do you want to re-verify?")) {
                      handleUpdateLoanStatus(selectedLoan.id, 'VERIFIED');
                    }
                  }}
                  disabled={updating}
                >
                  Re-Verify
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
            invalidateRepayments();
            invalidateLoans();
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
            invalidateLoans();
            invalidateCustomers();
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
