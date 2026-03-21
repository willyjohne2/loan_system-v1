import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCcw, TrendingUp, Wallet, Users, AlertCircle, CheckCircle2, Clock, DollarSign, AlertTriangle } from 'lucide-react';
import { Card, StatCard, Button } from '../../components/ui/Shared';
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Financial Overview</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Portfolio health and system status</p>
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
      <h3 className="text-lg font-bold text-slate-900 mt-8 mb-4">Operational Pipeline</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {queueLoading ? (
          [1,2,3].map(i => <SkeletonCard key={i} className="h-32" />)
        ) : (
          <>
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                  <Clock className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">{stats.pendingDisbursementCount}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Disbursement</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">{stats.activeCount}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Portfolio</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-100">
                  <AlertCircle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">{stats.overdueCount}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overdue (PAR)</p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default FinanceOverview;
