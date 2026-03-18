import React, { useState, useEffect } from 'react';
import { RefreshCcw, TrendingUp, TrendingDown, Wallet, Users, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Card, StatCard, Button } from '../../components/ui/Shared';
import { loanService } from '../../api/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const FinanceOverview = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    stats: {
      portfolioSize: 0,
      totalCollections: 0,
      availableCapital: 0,
      portfolioAtRisk: 0,
    },
    pipeline: {
      activeCount: 0,
      pendingDisbursementCount: 0,
      overdueCount: 0,
    },
    health: {
      disbursed: 0,
      recovered: 0,
      atRisk: 0
    }
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [loansData, repaymentsData, analytics] = await Promise.all([
        loanService.getLoans(),
        loanService.getRepayments(),
        loanService.getFinancialAnalytics()
      ]);

      // Ensure lists are arrays even if API returns paginated objects or nulls
      const loans = Array.isArray(loansData) ? loansData : (loansData?.results || []);
      const repayments = Array.isArray(repaymentsData) ? repaymentsData : (repaymentsData?.results || []);

      // Calculate stats
      const portfolioLoans = loans.filter(l => ['DISBURSED', 'ACTIVE', 'OVERDUE'].includes(l.status));
      const portfolioSize = portfolioLoans.reduce((sum, l) => sum + parseFloat(l.principal_amount), 0);
      
      const totalCollections = repayments.reduce((sum, r) => sum + parseFloat(r.amount_paid || r.amount || 0), 0);
      
      const overdueLoans = loans.filter(l => l.status === 'OVERDUE');
      const portfolioAtRisk = overdueLoans.reduce((sum, l) => sum + parseFloat(l.principal_amount), 0);

      const availableCapital = analytics.capital?.available_balance || 0;

      setData({
        stats: {
          portfolioSize,
          totalCollections,
          availableCapital,
          portfolioAtRisk,
        },
        pipeline: {
          activeCount: loans.filter(l => l.status === 'ACTIVE').length,
          pendingDisbursementCount: loans.filter(l => l.status === 'APPROVED').length,
          overdueCount: overdueLoans.length,
        },
        health: {
          disbursed: portfolioSize,
          recovered: totalCollections,
          atRisk: portfolioAtRisk
        }
      });
    } catch (error) {
      console.error('Error fetching overview data:', error);
      toast.error('Failed to sync data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatKES = (val) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Financial Overview</h2>
          <p className="text-sm text-slate-500 mt-1">Portfolio health and system status</p>
        </div>
        <Button 
          variant="secondary" 
          onClick={fetchData} 
          loading={loading}
          className="flex items-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" />
          Sync Data
        </Button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Portfolio Size"
          value={formatKES(data.stats.portfolioSize)}
          icon={Wallet}
          variant="primary"
        />
        <StatCard
          label="Total Collections"
          value={formatKES(data.stats.totalCollections)}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          label="Available Capital"
          value={formatKES(data.stats.availableCapital)}
          icon={CheckCircle2}
          variant="warning"
        />
        <StatCard
          label="Portfolio at Risk"
          value={formatKES(data.stats.portfolioAtRisk)}
          icon={AlertCircle}
          variant="danger"
        />
      </div>

      {/* Pipeline Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button 
          onClick={() => navigate('/finance/ledger')}
          className="group"
        >
          <Card className="hover:border-primary-500 transition-colors text-left flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Active Loans</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{data.pipeline.activeCount}</h3>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </Card>
        </button>

        <button 
          onClick={() => navigate('/finance/disbursement')}
          className="group"
        >
          <Card className="hover:border-primary-500 transition-colors text-left flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Pending Disbursement</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{data.pipeline.pendingDisbursementCount}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Clock className="w-6 h-6" />
            </div>
          </Card>
        </button>

        <button 
          onClick={() => navigate('/finance/ledger')}
          className="group"
        >
          <Card className="hover:border-primary-500 transition-colors text-left flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Overdue Loans</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{data.pipeline.overdueCount}</h3>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-lg group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <AlertCircle className="w-6 h-6" />
            </div>
          </Card>
        </button>
      </div>

      {/* Portfolio Health */}
      <Card>
        <h3 className="text-lg font-bold text-slate-900 mb-6">Portfolio Health</h3>
        <div className="space-y-8">
          {/* Total Disbursed */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-sm font-medium text-slate-600">Total Disbursed</span>
              <span className="font-bold text-slate-900">{formatKES(data.health.disbursed)}</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Total Recovered */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-sm font-medium text-slate-600">Total Recovered</span>
              <div className="text-right">
                <span className="font-bold text-slate-900">{formatKES(data.health.recovered)}</span>
                <span className="text-xs text-slate-500 ml-2">
                  ({data.health.disbursed > 0 ? ((data.health.recovered / data.health.disbursed) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full" 
                style={{ width: `${data.health.disbursed > 0 ? (data.health.recovered / data.health.disbursed) * 100 : 0}%` }} 
              />
            </div>
          </div>

          {/* Principal at Risk */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-sm font-medium text-slate-600">Principal at Risk</span>
              <div className="text-right">
                <span className="font-bold text-slate-900">{formatKES(data.health.atRisk)}</span>
                <span className="text-xs text-slate-500 ml-2">
                  ({data.health.disbursed > 0 ? ((data.health.atRisk / data.health.disbursed) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 rounded-full" 
                style={{ width: `${data.health.disbursed > 0 ? (data.health.atRisk / data.health.disbursed) * 100 : 0}%` }} 
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default FinanceOverview;
