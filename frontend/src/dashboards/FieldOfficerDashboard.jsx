import React, { useEffect, useState } from 'react';
import { loanService } from '../api/api';
import { StatCard, Table, Card, Button } from '../components/ui/Shared';
import { Users, Wallet, UserPlus, TrendingUp, Calendar, ArrowUpRight } from 'lucide-react';
import CustomerRegistrationForm from '../components/forms/CustomerRegistrationForm';

const FieldOfficerDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [stats, setStats] = useState({
    today: 0,
    thisWeek: 0,
    total: 0
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customersData, loansData] = await Promise.all([
        loanService.getCustomers(),
        loanService.getLoans()
      ]);

      const customersList = customersData.results || customersData || [];
      const loansList = loansData.results || loansData || [];

      // Link customers to loans locally for display
      const customerMap = customersList.reduce((acc, c) => {
        acc[c.id] = c.full_name;
        return acc;
      }, {});

      setCustomers(customersList);
      setLoans(loansList.map((l) => ({
        ...l,
        amount: Number(l.principal_amount) || 0,
        customer_name: customerMap[l.user] || 'Unknown'
      })));

      // Calculate simple trend stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const registeredToday = customersList.filter(c => new Date(c.created_at) >= today).length;
      const registeredThisWeek = customersList.filter(c => new Date(c.created_at) >= oneWeekAgo).length;

      setStats({
        today: registeredToday,
        thisWeek: registeredThisWeek,
        total: customersList.length
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id) => {
    try {
      await loanService.updateLoan(id, { status: 'VERIFIED' });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Verification error');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isRegistering) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Customer Intake</h2>
            <p className="text-slate-500 text-sm">Register a new customer and initiate loan application</p>
          </div>
          <Button variant="secondary" onClick={() => setIsRegistering(false)}>Back to Dashboard</Button>
        </div>
        <CustomerRegistrationForm 
          onSuccess={() => {
            setIsRegistering(false);
            fetchData();
          }}
          onCancel={() => setIsRegistering(false)}
        />
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Field Officer Console</h2>
          <p className="text-slate-500 text-sm">Welcome back. Here is your registration performance.</p>
        </div>
        <Button onClick={() => setIsRegistering(true)} className="flex items-center gap-2 shadow-lg shadow-primary-500/20">
          <UserPlus className="w-4 h-4" />
          Register New Customer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="My Customers" 
          value={stats.total.toString()} 
          icon={Users}
          trend={{ value: `${stats.thisWeek} this week`, isPositive: true }}
        />
        <StatCard 
          label="Today's Work" 
          value={stats.today.toString()} 
          icon={Calendar} 
          trend={{ value: "New registrations", isPositive: true }}
        />
        <StatCard 
          label="Conversion Value" 
          value={`KES ${loans.reduce((acc, l) => acc + l.amount, 0).toLocaleString()}`} 
          icon={TrendingUp} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">My Registered Customers</h3>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Read Only</span>
          </div>
          {customers.length === 0 ? (
            <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
              No customers registered yet. Start by clicking the button above.
            </div>
          ) : (
            <Table
              headers={['Customer Name', 'Phone', 'Registration Date', 'Status']}
              data={customers.slice(0, 10)}
              renderRow={(customer) => (
                <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{customer.full_name}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{customer.phone}</td>
                  <td className="px-6 py-4 text-slate-500">{customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '-'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded text-[10px] font-bold">
                      ACTIVE
                    </span>
                  </td>
                </tr>
              )}
            />
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Verification Queue
          </h3>
          <div className="space-y-4">
            {loans.filter(l => l.status === 'UNVERIFIED').length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-500 italic">No loans awaiting verification.</p>
              </div>
            ) : (
              loans.filter(l => l.status === 'UNVERIFIED').slice(0, 5).map(loan => (
                <div key={loan.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-sm transition-shadow">
                   <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{loan.customer_name}</p>
                      <p className="text-xs font-black text-indigo-600">KES {loan.amount.toLocaleString()}</p>
                   </div>
                   <div className="flex justify-between items-center mt-3">
                      <span className="text-[9px] text-slate-400 font-medium">AWAITING DOCS</span>
                      <Button size="sm" onClick={() => handleVerify(loan.id)} className="h-7 text-[10px] px-4 bg-indigo-600 hover:bg-indigo-700">
                        Verify Now
                      </Button>
                   </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FieldOfficerDashboard;
