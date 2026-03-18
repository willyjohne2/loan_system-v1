import React, { useEffect, useState } from 'react';
import { loanService } from '../../api/api';
import { Card, StatCard } from '../../components/ui/Shared';
import {
  Crown, TrendingUp, Wallet, AlertTriangle,
  Users, ShieldAlert, CheckCircle, Clock,
  Shield, Activity, Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const OwnerHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    portfolio: 0, collected: 0, capital: 0, overdue: 0
  });
  const [staffCounts, setStaffCounts] = useState({
    super_admins: 0, admins: 0, managers: 0,
    finance_officers: 0, field_officers: 0, suspended: 0
  });
  const [recentSecurity, setRecentSecurity] = useState([]);
  const [recentAudit, setRecentAudit] = useState([]);
  const [systemStatus, setSystemStatus] = useState({
    mpesa_env: 'sandbox', capital_balance: 0, low_capital: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [loansRes, analyticsRes, staffRes, securityRes, auditRes] = await Promise.all([
          loanService.getLoans(),
          loanService.getFinancialAnalytics(),
          loanService.api.get('/admins/'),
          loanService.api.get('/security-logs/?limit=5'),
          loanService.api.get('/owner-audit/?limit=5'),
        ]);

        const loans = loansRes?.results || loansRes || [];
        const activeLoans = loans.filter(l => ['ACTIVE', 'DISBURSED', 'OVERDUE'].includes(l.status));
        const overdueLoans = loans.filter(l => l.status === 'OVERDUE');

        setStats({
          portfolio: activeLoans.reduce((s, l) => s + Number(l.principal_amount || 0), 0),
          collected: analyticsRes?.money_in || 0,
          capital: analyticsRes?.balance || 0,
          overdue: overdueLoans.reduce((s, l) => s + Number(l.principal_amount || 0), 0),
        });

        const staff = staffRes?.data?.results || staffRes?.data || [];
        setStaffCounts({
          super_admins: staff.filter(s => s.is_super_admin && !s.is_owner).length,
          admins: staff.filter(s => s.role === 'ADMIN' && !s.is_super_admin && !s.is_owner).length,
          managers: staff.filter(s => s.role === 'MANAGER').length,
          finance_officers: staff.filter(s => s.role === 'FINANCIAL_OFFICER').length,
          field_officers: staff.filter(s => s.role === 'FIELD_OFFICER').length,
          suspended: staff.filter(s => s.is_blocked || s.suspended_at).length,
        });

        setRecentSecurity(securityRes?.data?.results || securityRes?.data || []);
        setRecentAudit(auditRes?.data?.results || auditRes?.data || []);

        setSystemStatus({
          mpesa_env: analyticsRes?.mpesa_env || 'sandbox',
          capital_balance: analyticsRes?.balance || 0,
          low_capital: (analyticsRes?.balance || 0) < 50000,
        });
      } catch (e) {
        console.error('Owner dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const staffCards = [
    { label: 'Super Admins', count: staffCounts.super_admins, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-100 dark:border-purple-800/30', path: '/admin/super-admins' },
    { label: 'Admins', count: staffCounts.admins, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/10', border: 'border-indigo-100 dark:border-indigo-800/30', path: '/admin/accounts' },
    { label: 'Managers', count: staffCounts.managers, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-100 dark:border-blue-800/30', path: '/admin/managers' },
    { label: 'Finance Officers', count: staffCounts.finance_officers, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-100 dark:border-emerald-800/30', path: '/admin/officers' },
    { label: 'Field Officers', count: staffCounts.field_officers, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/10', border: 'border-cyan-100 dark:border-cyan-800/30', path: '/admin/field-officers' },
    { label: 'Suspended', count: staffCounts.suspended, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-100 dark:border-red-800/30', path: '/admin/accounts' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center border border-amber-200 dark:border-amber-800/50">
          <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Welcome back, {user?.full_name?.split(' ')[0]}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Here's your system overview for today</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Portfolio"
          value={`KES ${stats.portfolio.toLocaleString()}`}
          icon={TrendingUp}
          variant="info"
        />
        <StatCard
          label="Total Collected"
          value={`KES ${stats.collected.toLocaleString()}`}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          label="Available Capital"
          value={`KES ${stats.capital.toLocaleString()}`}
          icon={Wallet}
          variant={systemStatus.low_capital ? 'warning' : 'success'}
        />
        <StatCard
          label="Overdue Portfolio"
          value={`KES ${stats.overdue.toLocaleString()}`}
          icon={AlertTriangle}
          variant="danger"
        />
      </div>

      {/* Low Capital Warning */}
      {systemStatus.low_capital && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Low Capital Warning</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">System capital is below KES 50,000. Consider injecting funds before new disbursements.</p>
          </div>
        </div>
      )}

      {/* Staff Overview */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          Staff Overview
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {staffCards.map((card) => (
            <button
              key={card.label}
              onClick={() => navigate(card.path)}
              className={`p-4 rounded-xl border text-left hover:shadow-md transition-all ${card.bg} ${card.border} hover:border-slate-200 dark:hover:border-slate-700`}
            >
              <p className={`text-2xl font-black ${card.color}`}>{card.count}</p>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">{card.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Two Column — Security + Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Security Events */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-500 dark:text-red-400" />
              Recent Security Events
            </h3>
            <button
              onClick={() => navigate('/owner/security-logs')}
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline"
            >
              View All
            </button>
          </div>
          <div className="space-y-2">
            {recentSecurity.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-6">No security events</p>
            ) : (
              recentSecurity.slice(0, 5).map((log, i) => (
                <div key={i} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/20 rounded-lg">
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{log.action}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{log.ip_address || '—'}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent Owner Audit */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              Recent Audit Activity
            </h3>
            <button
              onClick={() => navigate('/owner/audit')}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
            >
              View All
            </button>
          </div>
          <div className="space-y-2">
            {recentAudit.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-6">No audit entries yet</p>
            ) : (
              recentAudit.slice(0, 5).map((log, i) => (
                <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{log.action}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{log.admin_name || 'System'}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          System Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800/50">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">M-Pesa Environment</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${systemStatus.mpesa_env === 'production' ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className={`text-sm font-bold capitalize ${systemStatus.mpesa_env === 'production' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {systemStatus.mpesa_env}
              </span>
            </div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800/50">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Capital Balance</p>
            <p className={`text-sm font-bold ${systemStatus.low_capital ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              KES {Number(systemStatus.capital_balance).toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800/50">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">God Mode</p>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-amber-600">Active — All Views Accessible</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default OwnerHome;
