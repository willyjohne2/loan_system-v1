import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loanService } from '../api/api';
import { StatCard, Card, Button } from '../components/ui/Shared';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Users, 
  Wallet, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Shield,
  BarChart3,
  Activity,
  History,
  Lock,
  Eye,
  PieChart,
} from 'lucide-react';

const AdminOverview = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalLoans: 0,
    totalPaid: 0,
    outstanding: 0,
    totalCustomers: 0,
    activeLoans: 0,
    defaultRate: 0,
    repaymentRate: 0,
    newCustomersMonth: 0,
    overdue30: 0,
    overdue60: 0,
    overdue90: 0,
    actionsNeeded: 0
  });
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingExtra, setLoadingExtra] = useState(true);
  const [statusBreakdown, setStatusBreakdown] = useState({
    approved: 0,
    pending: 0,
    repaid: 0,
    defaulted: 0
  });
  const [productDistribution, setProductDistribution] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [isChartPlaceholder, setIsChartPlaceholder] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [securityAlerts, setSecurityAlerts] = useState([]);

  useEffect(() => {
    const fetchCoreStats = async () => {
      try {
        const parseAmount = (val) => {
          const num = Number(val);
          return Number.isFinite(num) ? num : 0;
        };

        // Fetch Customers first, then Loans and Repayments
        // This ensures the sequential load requested by the client
        const customersData = await loanService.getCustomers();
        const customers = customersData.results || customersData || [];

        const [loansData, repaymentsData] = await Promise.all([
          loanService.getLoans(),
          loanService.getRepayments(),
        ]);

        const loans = loansData.results || loansData || [];
        const repayments = repaymentsData.results || repaymentsData || [];

        setStats(prev => ({ ...prev, totalCustomers: customers.length }));

        const disbursedStatuses = ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'];
        const totalAmount = loans
          .filter(l => disbursedStatuses.includes((l.status || '').toUpperCase()))
          .reduce((acc, l) => acc + parseAmount(l.principal_amount), 0);
        const repaidAmount = repayments.reduce((acc, r) => acc + parseAmount(r.amount_paid), 0);

        const statusCounts = loans.reduce(
          (acc, l) => {
            const status = (l.status || '').toUpperCase();
            if (status === 'AWARDED' || status === 'APPROVED' || status === 'ACTIVE') acc.approved += 1;
            else if (status === 'VERIFIED' || status === 'PENDING' || status === 'UNVERIFIED') acc.pending += 1;
            else if (status === 'REPAID') acc.repaid += 1;
            else if (status === 'DEFAULTED' || status === 'DEFAULT') acc.defaulted += 1;
            return acc;
          },
          { approved: 0, pending: 0, repaid: 0, defaulted: 0 }
        );

        // Product Distribution for Pie Chart
        const productCounts = loans.reduce((acc, l) => {
          const name = l.product_name || 'Generic';
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        }, {});
        
        const formattedProducts = Object.keys(productCounts).map(name => ({
          name: name.toUpperCase(),
          value: productCounts[name]
        })).sort((a, b) => b.value - a.value);

        setProductDistribution(formattedProducts);

        // Process Chart Data: Show last 6 months
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          last6Months.push(monthNames[d.getMonth()]);
        }

        const monthlyData = loans.reduce((acc, loan) => {
          // Only count disbursed, active, repaid, or overdue loans in the volume graph
          const status = (loan.status || '').toUpperCase();
          const countedStatuses = ['DISBURSED', 'ACTIVE', 'REPAID', 'OVERDUE', 'DEFAULTED'];
          
          if (countedStatuses.includes(status)) {
            const dateStr = loan.disbursed_at || loan.created_at;
            const month = new Date(dateStr).toLocaleString('default', { month: 'short' });
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
          // Add dummy but labeled data for the client meeting
          setIsChartPlaceholder(true);
          const previewData = [
            { name: 'Jan', amount: 150000 },
            { name: 'Feb', amount: 280000 },
            { name: 'Mar', amount: 145000 },
            { name: 'Apr', amount: 320000 },
            { name: 'May', amount: 410000 },
            { name: 'Jun', amount: 380000 }
          ];
          setChartData(previewData);
        } else {
          setIsChartPlaceholder(false);
          setChartData(formattedData);
        }

        const actionsNeeded = loans.filter(l => ['UNVERIFIED', 'VERIFIED', 'PENDING'].includes((l.status || '').toUpperCase())).length;

        setStats(prev => ({
          ...prev,
          totalLoans: totalAmount,
          totalPaid: repaidAmount,
          outstanding: totalAmount - repaidAmount,
          activeLoans: statusCounts.approved,
          actionsNeeded,
          defaultRate: statusCounts.defaulted,
          repaymentRate: Math.round((repaidAmount / totalAmount) * 100) || 0,
        }));

        setStatusBreakdown(statusCounts);
        setLoading(false); // Core UI is ready!

        // Now fetch secondary data without blocking, pass customers along
        fetchSecondaryData(customers);
      } catch (err) {
        console.error("Fetch core stats error:", err);
        setLoading(false);
      }
    };

    const fetchSecondaryData = async (customers = []) => {
      try {
        const [auditData, adminsData] = await Promise.all([
          loanService.getAuditLogs({ limit: 10 }),
          loanService.getAllAdmins()
        ]);

        const logs = auditData.results || auditData || [];
        const admins = adminsData.results || adminsData || [];

        // Security Alerts logic
        const alerts = [];
        admins.forEach(admin => {
          if (admin.failed_login_attempts > 3) {
            alerts.push({
              type: 'SECURITY',
              message: `High failed login attempts for ${admin.email}`,
              severity: 'high'
            });
          }
        });

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const newMonth = customers.filter(c => new Date(c.created_at) >= thirtyDaysAgo).length;

        setStats(prev => ({
          ...prev,
          totalCustomers: customers.length,
          newCustomersMonth: newMonth,
        }));

        setAuditLogs(logs.slice(0, 10));
        setSecurityAlerts(alerts);
      } catch (err) {
        console.error("Fetch secondary data error:", err);
      } finally {
        setLoadingLogs(false);
        setLoadingExtra(false);
      }
    };

    fetchCoreStats();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard 
          label="Total Portfolio" 
          value={`KES ${stats.totalLoans.toLocaleString()}`} 
          icon={Wallet} 
          trend={{ value: 'All Time', isPositive: true }}
          onClick={() => navigate('/admin/loans')}
        />
        <StatCard 
          label="Total Collected" 
          value={`KES ${stats.totalPaid.toLocaleString()}`} 
          icon={CheckCircle} 
          trend={{ value: `${stats.repaymentRate}% rate`, isPositive: true }}
          onClick={() => navigate('/admin/loans')}
        />
        <StatCard 
          label="Principal at Risk" 
          value={`KES ${stats.outstanding.toLocaleString()}`} 
          icon={AlertCircle} 
          trend={{ value: 'Outstanding', isPositive: false }}
          onClick={() => navigate('/admin/loans')}
        />
        <StatCard 
          label="System Users" 
          value={loadingExtra ? "..." : stats.totalCustomers.toString()} 
          icon={Users} 
          trend={{ value: 'Customers', isPositive: true }}
          onClick={() => navigate('/admin/customers')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <Card className="xl:col-span-2 p-8">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                 <BarChart3 className="w-5 h-5 text-primary-600" />
                 Monthly Disbursement Volume
              </h3>
              {isChartPlaceholder && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-2 py-1 rounded uppercase tracking-tighter animate-pulse">
                  System Preview Mode
                </span>
              )}
           </div>
           <div className="h-[350px] w-full min-w-0 relative" style={{ minHeight: '350px' }}>
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
                <p className="text-slate-400 text-sm italic">{loading ? 'Loading chart data...' : 'No disbursement data available.'}</p>
                {!loading && <p className="text-slate-300 text-[10px] mt-1 uppercase font-bold tracking-widest">Charts will appear once loans are processed</p>}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-600" />
                Portfolio Breakdown
             </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Awarded', count: statusBreakdown.approved, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                { label: 'Pending', count: statusBreakdown.pending, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                { label: 'Repaid', count: statusBreakdown.repaid, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'Defaulted', count: statusBreakdown.defaulted, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
              ].map((item) => (
                <div key={item.label} className={`${item.bg} p-4 rounded-xl border border-transparent text-center`}>
                   <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">{item.label}</p>
                   <p className={`text-xl font-black ${item.color}`}>{loading ? '...' : item.count}</p>
                </div>
              ))}
           </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-600" />
                Loan Product Distribution
             </h3>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Popularity by volume</span>
          </div>
          <div className="h-[300px] w-full flex flex-col md:flex-row items-center justify-center relative">
             <div className="w-full h-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={productDistribution.length > 0 ? productDistribution : [{ name: 'N/A', value: 1 }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {(productDistribution.length > 0 ? productDistribution : [{ name: 'N/A', value: 1 }]).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
             </div>
             <div className="w-full md:w-auto space-y-2 mt-4 md:mt-0 md:pl-8">
                {productDistribution.map((entry, index) => (
                   <div key={entry.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5] }}></div>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{entry.name}</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white">{entry.value}</span>
                   </div>
                ))}
             </div>
          </div>
        </Card>

        <Card className="p-8 border-t-4 border-t-red-600">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-600" />
                Security Alerts
             </h3>
          </div>
          <div className="space-y-4">
            {loadingExtra ? (
               <div className="animate-pulse flex space-x-4">
                  <div className="flex-1 space-y-4 py-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-200 rounded"></div>
                    </div>
                  </div>
               </div>
            ) : securityAlerts.length > 0 ? (
              securityAlerts.map((alert, idx) => (
                <div key={idx} className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-l-4 border-red-500">
                   <p className="text-xs font-bold text-red-800 dark:text-red-400 uppercase">{alert.type}</p>
                   <p className="text-sm text-red-700 dark:text-red-300">{alert.message}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                 <Shield className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                 <p className="text-sm text-slate-500">No active threats</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-primary-600" />
            Recent Activity
          </h3>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/audit')}>View All</Button>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          {loadingLogs ? (
            <div className="p-8 text-center text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
              Calculating recent activities...
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Action</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Resource</th>
                  <th className="text-right p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{log.table_name}</td>
                    <td className="p-4 text-right text-xs text-slate-500 dark:text-slate-500">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AdminOverview;
