import React, { useMemo } from 'react';
import { 
  BarChart3, TrendingUp, Users, MapPin, 
  LineChart as LineChartIcon, Activity, Activity as ActivityIcon
} from 'lucide-react';
import { Card, StatCard, Badge } from '../../components/ui/Shared';
import { useOwnerAnalytics, useFinancialAnalytics } from '../../hooks/useQueries';
import { SkeletonStatCards, SkeletonCard } from '../../components/ui/Skeleton';
import { 
  BarChart as ReBarChart, Bar as ReBar, XAxis as ReXAxis, YAxis as ReYAxis, CartesianGrid as ReCartesianGrid, Tooltip as ReTooltip, ResponsiveContainer as ReResponsiveContainer, 
  LineChart as ReLineChart, Line as ReLine, AreaChart as ReAreaChart, Area as ReArea, Legend as ReLegend, Cell as ReCell, PieChart as RePieChart, Pie as RePie 
} from 'recharts';

const OwnerAnalyticsPage = () => {
  const { data: ownerData, isLoading: ownerLoading } = useOwnerAnalytics();
  const { data: financialData, isLoading: financialLoading } = useFinancialAnalytics();

  const agingData = useMemo(() => {
    if (!financialData?.aging_report) return [];
    return [
      { label: '1-30 Days', amount: financialData.aging_report.days_30 },
      { label: '31-60 Days', amount: financialData.aging_report.days_60 },
      { label: '61+ Days', amount: financialData.aging_report.days_90 },
    ];
  }, [financialData]);

  const weeklyComparisonData = useMemo(() => {
    if (!financialData?.weekly_disbursed || !financialData?.weekly_repaid) return [];
    const map = {};
    financialData.weekly_disbursed.forEach(d => {
      map[d.week] = { week: d.week, disbursed: d.amount, repaid: 0 };
    });
    financialData.weekly_repaid.forEach(r => {
      if (map[r.week]) map[r.week].repaid = r.amount;
      else map[r.week] = { week: r.week, disbursed: 0, repaid: r.amount };
    });
    return Object.values(map);
  }, [financialData]);

  const leaderboardData = useMemo(() => {
    if (!ownerData?.field_officer_stats) return [];
    return [...ownerData.field_officer_stats]
      .sort((a, b) => b.loans_submitted - a.loans_submitted)
      .slice(0, 10)
      .map(o => ({
        name: o.name.split(' ')[0],
        submitted: o.loans_submitted,
        overdue: o.overdue_loans
      }));
  }, [ownerData]);

  const stats = useMemo(() => {
    const ce = ownerData?.collection_efficiency || 0;
    const turnaround = ownerData?.avg_turnaround_days || 0;
    const branches = ownerData?.branch_performance?.length || 0;
    return { ce, turnaround, branches };
  }, [ownerData]);

  if (ownerLoading || financialLoading) return <div className="space-y-6"><SkeletonStatCards count={3} /><SkeletonCard /></div>;

  return (
    <div className="space-y-6 pb-12 w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Executive Portfolio Analytics</h1>
          <p className="text-sm font-bold text-slate-500">Cross-branch trends and ROI projections</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard 
          label="Collection Efficiency" 
          value={`${stats.ce}%`} 
          icon={TrendingUp} 
          variant={stats.ce > 80 ? 'success' : stats.ce > 60 ? 'warning' : 'danger'} 
        />
        <StatCard 
          label="Avg Turnaround Time" 
          value={`${stats.turnaround} Days`} 
          icon={ActivityIcon} 
          variant={stats.turnaround < 3 ? 'success' : stats.turnaround < 7 ? 'warning' : 'danger'} 
        />
        <StatCard 
          label="Active Branches" 
          value={stats.branches.toString()} 
          icon={MapPin} 
          variant="primary" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1 — Customer Growth */}
        <Card className="p-6">
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-wider text-xs">Customer Growth (12 Months)</h3>
          <div className="h-[300px] w-full min-h-[300px]">
            <ReResponsiveContainer width="99%" height="100%">
              <ReAreaChart data={ownerData?.customer_growth}>
                <ReCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <ReXAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <ReYAxis axisLine={false} tickLine={false} tick={{fill: "#64748b", fontSize: 10}} tickFormatter={(val) => `KES ${val.toLocaleString()}`} width={80} />
                <ReTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <ReArea type="monotone" dataKey="customers" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.1} strokeWidth={3} />
              </ReAreaChart>
            </ReResponsiveContainer>
          </div>
        </Card>

        {/* CHART 2 — Branch Performance */}
        <Card className="p-6">
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-wider text-xs">Branch Performance (Value Disbursed)</h3>
          <div className="h-[300px] w-full min-h-[300px]">
            <ReResponsiveContainer width="99%" height="100%">
              <ReBarChart data={ownerData?.branch_performance} layout="vertical">
                <ReCartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <ReXAxis type="number" hide />
                <ReYAxis dataKey="branch" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} width={80} />
                <ReTooltip formatter={(val) => [`KES ${val.toLocaleString()}`, 'Principal']} />
                <ReBar dataKey="principal_disbursed" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
              </ReBarChart>
            </ReResponsiveContainer>
          </div>
        </Card>

        {/* CHART 3 — Cash Flow Projection */}
        <Card className="p-6">
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-wider text-xs">Expected Collections — Next 30 Days</h3>
          <div className="h-[300px] w-full min-h-[300px]">
            <ReResponsiveContainer width="99%" height="100%">
              <ReAreaChart data={ownerData?.cashflow_projection}>
                <ReCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <ReXAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: "#64748b", fontSize: 10}} />
                <ReYAxis axisLine={false} tickLine={false} tick={{fill: "#64748b", fontSize: 10}} tickFormatter={(val) => `KES ${val.toLocaleString()}`} width={80} />
                <ReTooltip labelFormatter={(val) => new Date(val).toLocaleDateString()} formatter={(val) => [`KES ${val.toLocaleString()}`, 'Expected']} />
                <ReArea type="monotone" dataKey="expected" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={3} strokeDasharray="5 5" />
              </ReAreaChart>
            </ReResponsiveContainer>
          </div>
        </Card>

        {/* CHART 4 — Overdue Aging */}
        <Card className="p-6">
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-wider text-xs">Overdue Aging Report</h3>
          <div className="h-[300px] w-full min-h-[300px]">
            <ReResponsiveContainer width="99%" height="100%">
              <ReBarChart data={agingData}>
                <ReCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <ReXAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <ReYAxis axisLine={false} tickLine={false} tick={{fill: "#64748b", fontSize: 10}} tickFormatter={(val) => `KES ${val.toLocaleString()}`} width={80} />
                <ReTooltip formatter={(val) => [`KES ${val.toLocaleString()}`, 'Amount']} />
                <ReBar dataKey="amount" radius={[4, 4, 0, 0]} barSize={40}>
                  {agingData.map((entry, index) => (
                    <ReCell key={`cell-${index}`} fill={index === 0 ? '#fbbf24' : index === 1 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </ReBar>
              </ReBarChart>
            </ReResponsiveContainer>
          </div>
        </Card>

        {/* CHART 5 — Weekly Disbursement vs Collection */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-wider text-xs">Weekly Disbursement vs Collection</h3>
          <div className="h-[350px] w-full min-h-[350px]">
            <ReResponsiveContainer width="99%" height="100%">
              <ReBarChart data={weeklyComparisonData}>
                <ReCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <ReXAxis dataKey="week" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <ReYAxis axisLine={false} tickLine={false} tick={{fill: "#64748b", fontSize: 10}} tickFormatter={(val) => `KES ${val.toLocaleString()}`} width={80} />
                <ReTooltip formatter={(val) => [`KES ${val.toLocaleString()}`]} />
                <ReLegend verticalAlign="top" align="right" height={36} />
                <ReBar dataKey="disbursed" name="Disbursements" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25} />
                <ReBar dataKey="repaid" name="Collections" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={25} />
              </ReBarChart>
            </ReResponsiveContainer>
          </div>
        </Card>

        {/* CHART 6 — Field Officer Leaderboard (Horizontal Bar) */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-wider text-xs">Field Officer Performance — Last 30 Days</h3>
          <div className="h-[400px] w-full min-h-[400px]">
            <ReResponsiveContainer width="99%" height="100%">
              <ReBarChart data={leaderboardData} layout="vertical" margin={{ left: 30 }}>
                <ReCartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <ReXAxis type="number" hide />
                <ReYAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} width={80} />
                <ReTooltip cursor={{fill: 'transparent'}} />
                <ReLegend verticalAlign="top" align="right" height={36} />
                <ReBar dataKey="submitted" name="Loans Submitted" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                <ReBar dataKey="overdue" name="Overdue" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
              </ReBarChart>
            </ReResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OwnerAnalyticsPage;