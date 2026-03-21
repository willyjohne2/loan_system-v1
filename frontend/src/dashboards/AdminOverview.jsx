import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loanService } from '../api/api';
import { useLoans, useCustomers, useRepayments, useSecurityLogs, useAuditLogs } from '../hooks/useQueries';
import { StatCard, Card, Button } from '../components/ui/Shared';
import { SkeletonStatCards, SkeletonCard } from '../components/ui/Skeleton';
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
  const { user } = useAuth();
  const isPrivileged = user?.is_owner || user?.is_super_admin;
  
  const { data: loansData, isLoading: loansLoading } = useLoans({ page_size: 5000 });
  const { data: repaymentsData, isLoading: repaymentsLoading } = useRepayments({ page_size: 5000 });
  const { data: customersData, isLoading: customersLoading } = useCustomers({ page_size: 5000 });
  const { data: securityData, isLoading: securityLoading } = useSecurityLogs({ 
    limit: 10,
    enabled: !!isPrivileged
  });
  const { data: auditData, isLoading: auditLoading } = useAuditLogs({ limit: 10 });

  const stats = useMemo(() => {
    const parseAmount = (val) => {
      const num = Number(val);
      return Number.isFinite(num) ? num : 0;
    };

    const loans = loansData?.results || loansData || [];
    const repayments = repaymentsData?.results || repaymentsData || [];
    const customers = customersData?.results || customersData || [];

    const disbursedStatuses = ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'];
    const totalAmount = loans
      .filter(l => disbursedStatuses.includes((l.status || '').toUpperCase()))
      .reduce((acc, l) => acc + parseAmount(l.principal_amount), 0);
    
    const repaidAmount = repayments.reduce((acc, r) => acc + parseAmount(r.amount_paid), 0);
    const outstanding = totalAmount - repaidAmount;

    return {
      totalLoans: loans.length,
      totalPaid: totalAmount,
      outstanding: Math.max(0, outstanding),
      totalCustomers: customers.length,
      activeLoans: loans.filter(l => ['DISBURSED', 'ACTIVE', 'OVERDUE'].includes(l.status)).length,
      defaultRate: 0, // Simplified or calculate as needed
      repaymentRate: totalAmount > 0 ? (repaidAmount / totalAmount) * 100 : 0,
      newCustomersMonth: 0,
      overdue30: loans.filter(l => l.status === 'OVERDUE').length,
      overdue60: 0,
      overdue90: 0,
      actionsNeeded: loans.filter(l => l.status === 'PENDING' || l.status === 'UNVERIFIED').length
    };
  }, [loansData, repaymentsData, customersData]);

  const statusBreakdown = useMemo(() => {
    const loans = loansData?.results || loansData || [];
    return {
      approved: loans.filter(l => l.status === 'APPROVED').length,
      pending: loans.filter(l => l.status === 'PENDING' || l.status === 'UNVERIFIED').length,
      repaid: loans.filter(l => l.status === 'REPAID' || l.status === 'CLOSED').length,
      defaulted: loans.filter(l => l.status === 'OVERDUE').length
    };
  }, [loansData]);

  const auditLogs = auditData?.results || auditData || [];
  const securityAlerts = securityData?.results || securityData || [];
  
  const statsLoading = loansLoading || repaymentsLoading || customersLoading;
  const logsLoading = securityLoading || auditLoading;

  // Chart data and distribution can be calculated similarly from loansData
  const productDistribution = useMemo(() => {
    const loans = loansData?.results || loansData || [];
    const dist = loans.reduce((acc, l) => {
      const p = l.loan_product_name || 'Personal';
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [loansData]);

  const chartData = useMemo(() => {
    const loans = loansData?.results || loansData || [];
    const disbursedStatuses = ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'];
    const parseAmount = (val) => {
      const num = Number(val);
      return Number.isFinite(num) ? num : 0;
    };

    const monthlyData = loans.reduce((acc, loan) => {
      const status = (loan.status || '').toUpperCase();
      if (disbursedStatuses.includes(status)) {
        const dateStr = loan.disbursed_at || loan.created_at;
        const month = new Date(dateStr).toLocaleString('default', { month: 'short' });
        acc[month] = (acc[month] || 0) + parseAmount(loan.principal_amount);
      }
      return acc;
    }, {});

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      last6Months.push({
        monthName: monthNames[d.getMonth()],
        fullDate: d
      });
    }

    return last6Months.map(m => ({
      name: m.monthName,
      amount: monthlyData[m.monthName] || 0
    }));
  }, [loansData]);

  return (

    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500">
      {statsLoading ? (
        <SkeletonStatCards count={4} />
      ) : (
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
            value={stats.totalCustomers.toString()} 
            icon={Users} 
            trend={{ value: 'Customers', isPositive: true }}
            onClick={() => navigate('/admin/customers')}
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <Card className="xl:col-span-2 p-8">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                 <BarChart3 className="w-5 h-5 text-primary-600" />
                 Monthly Disbursement Volume
              </h3>
           </div>
           <div className="h-[350px] w-full min-w-0 relative" style={{ minHeight: '350px' }}>
            {loansLoading ? (
               <SkeletonCard className="h-full w-full" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <ChartTooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="amount" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <BarChart3 className="w-12 h-12 opacity-20 mb-2" />
                <p className="text-sm font-medium">No disbursement data available for this period</p>
              </div>
            )}
           </div>
        </Card>

        <Card className="p-8">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-indigo-600" />
            Product Distribution
          </h3>
          <div className="h-[300px] w-full relative">
            {loansLoading ? (
              <SkeletonCard className="h-full w-full" />
            ) : productDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={productDistribution}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {productDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#4f46e5', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <PieChart className="w-12 h-12 opacity-20 mb-2" />
                <p className="text-sm font-medium">No product data</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
