import React, { useEffect, useState } from 'react';
import { loanService } from '../api/api';
import { StatCard, Table, Card, Button } from '../components/ui/Shared';
import { Users, Wallet, UserPlus, TrendingUp, Calendar, ArrowUpRight, DollarSign, CreditCard, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import CustomerRegistrationForm from '../components/forms/CustomerRegistrationForm';
import LoanApplicationForm from '../components/forms/LoanApplicationForm';
import RepaymentModal from '../components/ui/RepaymentModal';
import CustomerHistoryModal from '../components/ui/CustomerHistoryModal';

const FieldOfficerDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [applyingForLoan, setApplyingForLoan] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [reviewingLoan, setReviewingLoan] = useState(null);
  const [reviewingCustomer, setReviewingCustomer] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [stats, setStats] = useState({
    today: 0,
    thisWeek: 0,
    total: 0,
    verifiedCount: 0
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
        acc[c.id] = { name: c.full_name, phone: c.phone };
        return acc;
      }, {});

      setCustomers(customersList);
      setLoans(loansList.map((l) => ({
        ...l,
        amount: Number(l.principal_amount) || 0,
        customer_name: customerMap[l.user]?.name || 'Unknown',
        user_phone: customerMap[l.user]?.phone || ''
      })));

      // Calculate simple trend stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const registeredToday = customersList.filter(c => new Date(c.created_at) >= today).length;
      const registeredThisWeek = customersList.filter(c => new Date(c.created_at) >= oneWeekAgo).length;
      const verifiedLoans = loansList.filter(l => !['UNVERIFIED', 'PENDING', 'REJECTED'].includes(l.status)).length;

      setStats({
        today: registeredToday,
        thisWeek: registeredThisWeek,
        total: customersList.length,
        verifiedCount: verifiedLoans
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
    // Add real-time update interval (every 30 seconds)
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isRegistering) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Customer Intake</h2>
            <p className="text-slate-500 text-sm">Register a new customer or update existing profile</p>
          </div>
          <Button variant="secondary" onClick={() => setIsRegistering(false)}>Back to Dashboard</Button>
        </div>
        <CustomerRegistrationForm 
          onSuccess={() => {
            setIsRegistering(false);
            fetchData();
          }}
          onApplyLoan={(customer) => {
            setIsRegistering(false);
            setApplyingForLoan(customer);
          }}
          onCancel={() => setIsRegistering(false)}
        />
      </div>
    );
  }

  if (applyingForLoan) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Loan Application</h2>
            <p className="text-slate-500 text-sm">Initiate a new loan request for {applyingForLoan.full_name}</p>
          </div>
          <Button variant="secondary" onClick={() => setApplyingForLoan(null)}>Cancel Application</Button>
        </div>
        <LoanApplicationForm 
          customer={applyingForLoan}
          onSuccess={() => {
            setApplyingForLoan(null);
            fetchData();
          }}
          onCancel={() => setApplyingForLoan(null)}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="My Customers" 
          value={stats.total.toString()} 
          icon={Users}
          trend={{ value: `${stats.thisWeek} this week`, isPositive: true }}
        />
        <StatCard 
          label="Verified Cases" 
          value={stats.verifiedCount.toString()} 
          icon={CheckCircle}
          variant="success"
          trend={{ value: "Documents reviewed", isPositive: true }}
        />
        <StatCard 
          label="Today's Work" 
          value={stats.today.toString()} 
          icon={Calendar} 
          trend={{ value: "New registrations", isPositive: true }}
        />
        <StatCard 
          label="Actions Needed" 
          value={loans.filter(l => l.status === 'UNVERIFIED' || l.status === 'PENDING').length.toString()} 
          icon={AlertCircle} 
          trend={{ value: "Needs review", isPositive: false }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Active Loan Portfolio</h3>
            <span className="text-xs font-black text-emerald-600 bg-emerald-100 px-2 py-1 rounded">REPAYMENTS ACTIVE</span>
          </div>
          {loans.filter(l => ['ACTIVE', 'OVERDUE'].includes(l.status)).length === 0 ? (
            <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
              No active loans found in your portfolio.
            </div>
          ) : (
            <Table
              headers={['Customer', 'Principal', 'Status', 'Action']}
              data={loans.filter(l => ['ACTIVE', 'OVERDUE'].includes(l.status))}
              renderRow={(loan) => (
                <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">{loan.customer_name}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-tighter">ID: {loan.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">KES {loan.amount.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-black ${
                      loan.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Button 
                      size="sm" 
                      variant="primary" 
                      className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1"
                      onClick={() => setSelectedLoan(loan)}
                    >
                      <DollarSign className="w-3 h-3" />
                      Repay
                    </Button>
                  </td>
                </tr>
              )}
            />
          )}

          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
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
                headers={['Customer Name', 'Phone', 'Joined', 'Actions']}
                data={customers.slice(0, 10)}
                renderRow={(customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800">
                    <td className="px-6 py-4">
                       <p className="font-bold text-slate-900 dark:text-white">{customer.full_name}</p>
                       <span className="text-[10px] text-slate-400 font-mono uppercase">CS-{customer.id.slice(0,5)}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">{customer.phone}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {customer.has_active_loan ? (
                          <span className="px-3 py-1.5 bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-100 dark:border-rose-800 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                            <Lock className="w-3 h-3" />
                            Blocked (Active Loan)
                          </span>
                        ) : (
                          <Button 
                            size="sm" 
                            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 flex items-center gap-2 h-8 px-4 font-black text-[10px] uppercase tracking-wider"
                            onClick={() => setApplyingForLoan(customer)}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            Apply Loan
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              />
            )}
          </div>
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
                      <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">Needs Documentation Review</span>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          const customerObj = customers.find(c => c.id === loan.user);
                          setReviewingCustomer(customerObj);
                          setReviewingLoan(loan);
                          setIsReviewOpen(true);
                        }} 
                        className="h-7 text-[10px] px-4 bg-indigo-600 hover:bg-indigo-700 font-bold"
                      >
                        REVIEW & VERIFY
                      </Button>
                   </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {selectedLoan && (
        <RepaymentModal 
          loan={selectedLoan}
          onClose={() => setSelectedLoan(null)}
          onSuccess={() => fetchData()}
        />
      )}

      {reviewingCustomer && (
        <CustomerHistoryModal 
          isOpen={isReviewOpen}
          customer={reviewingCustomer}
          loanToVerify={reviewingLoan}
          onVerified={fetchData}
          onClose={() => {
            setIsReviewOpen(false);
            setReviewingCustomer(null);
            setReviewingLoan(null);
          }}
        />
      )}
    </div>
  );
};

export default FieldOfficerDashboard;
