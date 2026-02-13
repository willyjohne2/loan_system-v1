import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loanService } from '../api/api';
import { StatCard, Table, Card, Button } from '../components/ui/Shared';
import { Users, Wallet, UserPlus, TrendingUp, Calendar, ArrowUpRight, DollarSign, CreditCard, AlertCircle, CheckCircle, Lock, Edit, MessageSquare, Send, X } from 'lucide-react';
import CustomerRegistrationForm from '../components/forms/CustomerRegistrationForm';
import LoanApplicationForm from '../components/forms/LoanApplicationForm';
import RepaymentModal from '../components/ui/RepaymentModal';
import CustomerHistoryModal from '../components/ui/CustomerHistoryModal';

const DirectSMSModal = ({ customer, isOpen, onClose }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen || !customer) return null;

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await loanService.sendDirectSMS({
        user_id: customer.user || customer.id, // Handles both user object or loan object with user id
        message: message.trim()
      });
      alert('SMS queued for delivery');
      onClose();
    } catch (err) {
      alert('Failed to send SMS: ' + (err.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Send SMS</h3>
            <p className="text-xs text-slate-500">To: {customer.customer_name || customer.full_name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            className="w-full h-32 p-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
          />
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !message.trim()} className="flex items-center gap-2">
            {sending ? 'Sending...' : (
              <>
                <Send className="w-4 h-4" />
                Send Message
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

const FieldOfficerDashboard = ({ isRegisteringDefault = false, isApplyingDefault = false }) => {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [isRegistering, setIsRegistering] = useState(isRegisteringDefault);
  const [applyingForLoan, setApplyingForLoan] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [reviewingLoan, setReviewingLoan] = useState(null);
  const [reviewingCustomer, setReviewingCustomer] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [showSMS, setShowSMS] = useState(false);
  const [selectedForSMS, setSelectedForSMS] = useState(null);
  const [stats, setStats] = useState({
    today: 0,
    thisWeek: 0,
    total: 0,
    verifiedCount: 0
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Handle URL change effects and deep linking from state
  useEffect(() => {
    setIsRegistering(isRegisteringDefault);
    
    // Check if we have a customer passed in state for registration (editing)
    // or for applying for a loan
    if (isRegisteringDefault && location.state?.customer) {
        // Here we could handle pre-filling if form supported it
    }

    if (isApplyingDefault && location.state?.customer) {
        setApplyingForLoan(location.state.customer);
    } else if (!isApplyingDefault) {
        setApplyingForLoan(null);
    }
  }, [isRegisteringDefault, isApplyingDefault, location.state]);

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
          <Button variant="secondary" onClick={() => navigate('/field/dashboard')}>Back to Dashboard</Button>
        </div>
        <CustomerRegistrationForm 
          initialCustomer={location.state?.customer}
          onSuccess={() => {
            navigate('/field/dashboard');
            fetchData();
          }}
          onApplyLoan={(customer) => {
            navigate('/field/apply-loan', { state: { customer } });
          }}
          onCancel={() => navigate('/field/dashboard')}
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
          <Button variant="secondary" onClick={() => navigate('/field/dashboard')}>Cancel Application</Button>
        </div>
        <LoanApplicationForm 
          customer={applyingForLoan}
          onSuccess={() => {
            navigate('/field/dashboard');
            setApplyingForLoan(null);
            fetchData();
          }}
          onCancel={() => navigate('/field/dashboard')}
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
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Field Officer Console</h2>
          <p className="text-slate-500 text-xs md:text-sm">Manage your registrations and portfolios efficiently.</p>
        </div>
        <Button onClick={() => navigate('/field/register-customer')} className="w-full md:w-auto flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 py-3 md:py-2">
          <UserPlus className="w-4 h-4" />
          Register New Customer
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard 
          label="My Customers" 
          value={stats.total.toString()} 
          icon={Users}
          trend={{ value: `${stats.thisWeek} New`, isPositive: true }}
        />
        <StatCard 
          label="Verified" 
          value={stats.verifiedCount.toString()} 
          icon={CheckCircle}
          variant="success"
        />
        <StatCard 
          label="Today" 
          value={stats.today.toString()} 
          icon={Calendar} 
        />
        <StatCard 
          label="Needed" 
          value={loans.filter(l => l.status === 'UNVERIFIED' || l.status === 'PENDING').length.toString()} 
          icon={AlertCircle} 
          variant="warning"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 overflow-hidden px-0 md:px-6">
          <div className="px-6 md:px-0 flex justify-between items-center mb-6">
            <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Active Portfolio</h3>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">LIVE</span>
          </div>
          {loans.filter(l => ['ACTIVE', 'OVERDUE'].includes(l.status)).length === 0 ? (
            <div className="mx-6 md:mx-0 text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
              No active loans found.
            </div>
          ) : (
            <Table
              headers={['Customer', <span key="prd">Product</span>, <span key="bal" className="hidden sm:inline">Principal</span>, <span key="tot" className="hidden md:inline">To Repay</span>, 'Status', 'Action']}
              data={loans.filter(l => ['ACTIVE', 'OVERDUE'].includes(l.status))}
              renderRow={(loan) => (
                <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 md:px-6 py-4">
                    <div className="font-bold text-slate-900 dark:text-white text-sm md:text-base">{loan.customer_name}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-medium">{loan.user_phone}</div>
                  </td>
                  <td className="px-4 md:px-6 py-4 font-bold text-slate-500 uppercase text-[10px]">
                    {loan.product_name}
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 font-bold text-slate-700 dark:text-slate-300">KES {loan.amount.toLocaleString()}</td>
                  <td className="hidden md:table-cell px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400 text-xs">KES {Number(loan.total_repayable_amount).toLocaleString()}</td>
                  <td className="px-4 md:px-6 py-4 text-center sm:text-left">
                    <span className={`px-2 py-0.5 rounded-[4px] text-[9px] md:text-[10px] font-black uppercase ${
                      loan.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {loan.status}
                    </span>
                    <div className="sm:hidden mt-0.5 font-bold text-[10px] text-slate-600">KES {loan.amount.toLocaleString()}</div>
                    <div className="md:hidden mt-0.5 font-bold text-[9px] text-emerald-600">Total: KES {Number(loan.total_repayable_amount).toLocaleString()}</div>
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-8 md:h-9 px-3"
                        onClick={() => {
                            setSelectedForSMS(loan);
                            setShowSMS(true);
                        }}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="primary" 
                        className="bg-emerald-600 hover:bg-emerald-700 h-8 md:h-9 w-full md:w-auto"
                        onClick={() => setSelectedLoan(loan)}
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Repay</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            />
          )}

          <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800">
            <div className="px-6 md:px-0 flex justify-between items-center mb-6">
              <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Recent Registrations</h3>
              <span className="text-[10px] font-medium text-slate-400 uppercase">Limit: 10</span>
            </div>
            {customers.length === 0 ? (
              <div className="mx-6 md:mx-0 text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
                No customers registered.
              </div>
            ) : (
              <Table
                headers={['Customer', <span key="date" className="hidden sm:inline">Joined</span>, 'Actions']}
                data={customers.slice(0, 10)}
                renderRow={(customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800 last:border-0">
                    <td className="px-4 md:px-6 py-4">
                       <p className="font-bold text-slate-900 dark:text-white text-sm">{customer.full_name}</p>
                       <span className="text-[10px] text-slate-500 font-medium">{customer.phone}</span>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4 text-slate-500 text-xs">
                      {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="secondary"
                          className="w-full sm:w-auto h-8 px-2 font-black text-[9px] uppercase border-slate-300"
                          onClick={() => navigate('/field/register-customer', { state: { customer } })}
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </Button>
                        {!customer.has_active_loan && (
                          <Button 
                            size="sm" 
                            className="w-full sm:w-auto bg-indigo-600 text-white hover:bg-indigo-700 h-8 px-2 font-black text-[9px] uppercase"
                            onClick={() => navigate('/field/apply-loan', { state: { customer } })}
                          >
                            <CreditCard className="w-3 h-3" />
                            Apply
                          </Button>
                        )}
                        {customer.has_active_loan && (
                          <div className="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded uppercase sm:hidden">
                            Active Loan
                          </div>
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

      {selectedForSMS && (
        <DirectSMSModal 
          customer={selectedForSMS}
          isOpen={showSMS}
          onClose={() => {
            setShowSMS(false);
            setSelectedForSMS(null);
          }}
        />
      )}
    </div>
  );
};

export default FieldOfficerDashboard;
