import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCcw, TrendingUp, Wallet, Users, AlertCircle, CheckCircle2, Clock, DollarSign, AlertTriangle } from 'lucide-react';
import { Card, StatCard, Button, Table } from '../../components/ui/Shared';
import { SkeletonStatCards, SkeletonCard } from '../../components/ui/Skeleton';
import { loanService } from '../../api/api';
import { useFinancialAnalytics, useCapital, useLoans, useRepayments, useInvalidate } from '../../hooks/useQueries';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

const FinanceOverview = () => {
  const navigate = useNavigate();
  const { invalidateAll } = useInvalidate();
  
  const { data: analyticsData, isLoading: analyticsLoading } = useFinancialAnalytics();
  const { data: capitalData, isLoading: capitalLoading } = useCapital();
  const { data: loansData, isLoading: loansLoading } = useLoans();
  const { data: repaymentsData, isLoading: repaymentsLoading } = useRepayments();

  const kpiLoading = analyticsLoading || capitalLoading;
  const queueLoading = loansLoading || repaymentsLoading;

  const loans = useMemo(() => loansData?.results || loansData || [], [loansData]);
  const repayments = useMemo(() => repaymentsData?.results || repaymentsData || [], [repaymentsData]);

  const stats = useMemo(() => {
    const portfolioLoans = loans.filter(l => ['DISBURSED', 'ACTIVE', 'OVERDUE'].includes(l.status));
    const portfolioSize = portfolioLoans.reduce((sum, l) => sum + parseFloat(l.principal_amount || 0), 0);
    const totalCollections = repayments.reduce((sum, r) => sum + parseFloat(r.amount_paid || r.amount || 0), 0);
    const overdueLoans = loans.filter(l => l.status === 'OVERDUE');
    const portfolioAtRisk = overdueLoans.reduce((sum, l) => sum + parseFloat(l.principal_amount || 0), 0);
    const availableCapital = capitalData?.balance || analyticsData?.capital?.available_balance || 0;

    return {
      portfolioSize,
      totalCollections,
      availableCapital,
      portfolioAtRisk,
      activeCount: loans.filter(l => l.status === 'ACTIVE').length,
      pendingDisbursementCount: loans.filter(l => l.status === 'APPROVED').length,
      overdueCount: overdueLoans.length,
    };
  }, [loans, repayments, capitalData, analyticsData]);

  const formatKES = (val) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val);

  return (
    <div className="space-y-6 px-4 sm:px-0">
      {!queueLoading && stats.pendingDisbursementCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <p className="text-sm font-semibold text-yellow-800">
              There are <span className="font-bold text-yellow-900">{stats.pendingDisbursementCount}</span> loans approved and waiting for disbursement.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/finance/disbursement')} className="border-yellow-300 text-yellow-700 hover:bg-yellow-100">
            View Queue
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white ">Financial Overview</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Portfolio health and system status</p>
        </div>
        <Button variant="secondary" onClick={() => invalidateAll()} className="hidden sm:flex">
          <RefreshCcw className={clsx("w-4 h-4 mr-2", (analyticsLoading || capitalLoading) && "animate-spin")} /> Refresh
        </Button>
      </div>

      {kpiLoading || queueLoading ? (
        <SkeletonStatCards count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Portfolio Size"
            value={formatKES(stats.portfolioSize)}
            icon={TrendingUp}
            variant="info"
          />
          <StatCard
            label="Total Recovered"
            value={formatKES(stats.totalCollections)}
            icon={CheckCircle2}
            variant="success"
          />
          <StatCard
            label="Available Capital"
            value={formatKES(stats.availableCapital)}
            icon={Wallet}
            variant="primary"
          />
          <StatCard
            label="Portfolio at Risk"
            value={formatKES(stats.portfolioAtRisk)}
            icon={AlertTriangle}
            variant="danger"
          />
        </div>
      )}

      {/* Portfolio Breakdown */}
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-8 mb-4">Operational Pipeline</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {queueLoading ? (
          [1,2,3].map(i => <SkeletonCard key={i} className="h-32" />)
        ) : (
          <>
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
                  <Clock className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white ">{stats.pendingDisbursementCount}</p>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Disbursement</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white ">{stats.activeCount}</p>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Portfolio</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center border border-rose-100 dark:border-rose-800">
                  <AlertCircle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white ">{stats.overdueCount}</p>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Overdue (PAR)</p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Recent Repayments Table */}
      <div className="mt-8">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white ">Recent Repayments</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/finance/ledger')}>View All</Button>
        </div>
        <Card className="p-0 overflow-hidden">
          {queueLoading ? (
            <div className="p-6"><SkeletonStatCards count={1} /></div>
          ) : repayments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">No recent repayments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table
                headers={['Customer', 'Amount', 'Date', 'Method', 'Reference']}
                data={repayments.slice(0, 5)}
                renderRow={(row) => (
                  <tr key={row.id} className="text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{row.customer_name}</td>
                    <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">{formatKES(row.amount_paid)}</td>
                    <td className="p-4 text-slate-500 dark:text-slate-400 font-medium">{new Date(row.payment_date).toLocaleDateString()}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-md">
                        {row.payment_method || 'MPESA_PAYBILL'}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-500 dark:text-slate-400 ">{row.reference_code || 'N/A'}</td>
                  </tr>
                )}
              />
            </div>
          )}
        </Card>
      </div>

    </div>
  );
};

export default FinanceOverview;
