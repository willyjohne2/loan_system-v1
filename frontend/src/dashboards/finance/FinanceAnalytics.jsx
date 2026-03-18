import React, { useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Card } from '../../components/ui/Shared';
import { loanService } from '../../api/api';
import toast from 'react-hot-toast';

const FinanceAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    history: [],
    weekly_disbursed: [],
    weekly_repaid: [],
    product_distribution: []
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const analytics = await loanService.getFinancialAnalytics();
      setData({
        history: analytics.history || [],
        weekly_disbursed: analytics.weekly_disbursed || [],
        weekly_repaid: analytics.weekly_repaid || [],
        product_distribution: analytics.product_distribution || []
      });
    } catch (err) {
      toast.error('Failed to load portfolio analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const PRODUCT_COLORS = {
    'Inuka': '#4f46e5',
    'Jijenge': '#10b981',
    'Fadhili': '#f59e0b'
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Analytics</h2>
        <p className="text-sm text-slate-500 mt-1">Portfolio performance and trends</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Disbursement Rolling View */}
        <Card>
          <h3 className="text-lg font-bold text-slate-900 mb-6 font-primary uppercase tracking-wider text-xs font-black">Disbursement Rolling View (15 Days)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val) => [`KES ${val.toLocaleString()}`, 'Disbursed']}
                />
                <Area type="monotone" dataKey="disbursement" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Collection Rolling View */}
        <Card>
          <h3 className="text-lg font-bold text-slate-900 mb-6 font-primary uppercase tracking-wider text-xs font-black">Collection Rolling View (15 Days)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val) => [`KES ${val.toLocaleString()}`, 'Repayment']}
                />
                <Area type="monotone" dataKey="repayment" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.1} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Weekly Disbursement Volume */}
        <Card>
          <h3 className="text-lg font-bold text-slate-900 mb-6 font-primary uppercase tracking-wider text-xs font-black">Weekly Disbursement Volume (10 Weeks)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekly_disbursed}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val) => [`KES ${val.toLocaleString()}`, 'Volume']}
                />
                <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Weekly Collection Volume */}
        <Card>
          <h3 className="text-lg font-bold text-slate-900 mb-6 font-primary uppercase tracking-wider text-xs font-black">Weekly Collection Volume (10 Weeks)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekly_repaid}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val) => [`KES ${val.toLocaleString()}`, 'Volume']}
                />
                <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Product Priority */}
        <Card className="lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 mb-6 font-primary uppercase tracking-wider text-xs font-black">Product Priority (By Value)</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.product_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.product_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PRODUCT_COLORS[entry.name] || '#64748b'} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val) => [`KES ${val.toLocaleString()}`, 'Value']}
                />
                <Legend layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FinanceAnalytics;
