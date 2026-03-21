import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loanService } from '../api/api';
import { StatCard, Table, Card, Button } from '../components/ui/Shared';
import { useCustomers, useLoans, useInvalidate } from '../hooks/useQueries';
import { 
  Users, 
  Wallet, 
  UserPlus, 
  TrendingUp, 
  Calendar, 
  ArrowUpRight, 
  DollarSign, 
  CreditCard, 
  AlertCircle, 
  CheckCircle, 
  Lock, 
  Edit, 
  MessageSquare, 
  Send, 
  X,
  PhoneCall,
  XCircle,
  Search
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import CustomerRegistrationForm from '../components/forms/CustomerRegistrationForm';
import LoanApplicationForm from '../components/forms/LoanApplicationForm';
import RepaymentModal from '../components/ui/RepaymentModal';
import CustomerHistoryModal from '../components/ui/CustomerHistoryModal';
import ChecklistModal from '../components/ui/ChecklistModal';

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
  const { data: customersData, isLoading: customersLoading } = useCustomers();
  const { data: loansData, isLoading: loansLoading } = useLoans();
  const { invalidateCustomers, invalidateLoans, invalidateCapital } = useInvalidate();

  const loading = customersLoading || loansLoading;

  const [isRegistering, setIsRegistering] = useState(isRegisteringDefault);
  const [applyingForLoan, setApplyingForLoan] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [reviewingLoan, setReviewingLoan] = useState(null);
  const [reviewingCustomer, setReviewingCustomer] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [showDirectPreRegChecklist, setShowDirectPreRegChecklist] = useState(false);
  const [showSMS, setShowSMS] = useState(false);
  const [selectedForSMS, setSelectedForSMS] = useState(null);

  const [showPreSearchModal, setShowPreSearchModal] = useState(false);
  const [preSearchQuery, setPreSearchQuery] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(true);

  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const res = await loanService.api.get('/users/drafts/');
        setDrafts(res.data?.results || res.data || []);
      } catch (e) {
        setDrafts([]);
      } finally {
        setDraftsLoading(false);
      }
    };
    fetchDrafts();
  }, []);

  const customersList = useMemo(() => customersData?.results || customersData || [], [customersData]);
  const loansListRaw = useMemo(() => loansData?.results || loansData || [], [loansData]);

  const customerMap = useMemo(() => {
    return customersList.reduce((acc, c) => {
      acc[c.id] = { name: c.full_name, phone: c.phone };
      return acc;
    }, {});
  }, [customersList]);

  const loans = useMemo(() => {
    return loansListRaw.map((l) => ({
      ...l,
      amount: Number(l.principal_amount) || 0,
      customer_name: customerMap[l.user]?.name || 'Unknown',
      user_phone: customerMap[l.user]?.phone || ''
    }));
  }, [loansListRaw, customerMap]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const registeredToday = customersList.filter(c => new Date(c.created_at) >= today).length;
    const registeredThisWeek = customersList.filter(c => new Date(c.created_at) >= oneWeekAgo).length;
    const verifiedLoans = loansListRaw.filter(l => !['UNVERIFIED', 'PENDING', 'REJECTED'].includes(l.status)).length;

    return {
      today: registeredToday,
      thisWeek: registeredThisWeek,
      total: customersList.length,
      verifiedCount: verifiedLoans
    };
  }, [customersList, loansListRaw]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  const todayActivity = useMemo(() => ({
    registered: customersList.filter(c => new Date(c.created_at) >= today).length,
    submitted: loans.filter(l => new Date(l.created_at) >= today).length,
    verified: loans.filter(l => l.status !== 'UNVERIFIED' && new Date(l.updated_at) >= today).length,
    overdue: loans.filter(l => l.status === 'OVERDUE').length,
  }), [customersList, loans, today]);

  const navigate = useNavigate();
  const location = useLocation();

  const processedData = useMemo(() => {
    // Sort Active Portfolio and Registrations - Newest First (standard)
    const sortedLoans = [...loans].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    const sortedCustomers = [...customersList].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Sort Verification Queue - Rule [A] Oldest First (Task priority)
    const verificationQueue = loans
        .filter(l => l.status === 'UNVERIFIED')
        .sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

    return { sortedLoans, sortedCustomers, verificationQueue };
  }, [loans, customersList]);

  const rejectedLoans = useMemo(() =>
    loans.filter(l => l.status === 'REJECTED')
      .sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at))
  , [loans]);

  const preSearchResults = useMemo(() => {
    if (!preSearchQuery.trim()) return [];
    const q = preSearchQuery.toLowerCase();
    return customersList.filter(c => 
      (c.full_name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.profile?.national_id || '').includes(q)
    );
  }, [preSearchQuery, customersList]);

  const handleVerify = async (id) => {
    try {
      await loanService.updateLoan(id, { status: 'VERIFIED' });
      invalidateLoans();
    } catch (err) {
      console.error(err);
      alert('Verification error');
    }
  };

  useEffect(() => {
    if (isRegisteringDefault) {
      setShowDirectPreRegChecklist(true);
    }
    
    if (isApplyingDefault && location.state?.customer) {
        setApplyingForLoan(location.state.customer);
    } else if (!isApplyingDefault) {
        setApplyingForLoan(null);
    }
  }, [isRegisteringDefault, isApplyingDefault, location.state]);

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
            invalidateCustomers();
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
            invalidateLoans();
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
        <Button onClick={() => setShowPreSearchModal(true)} className="w-full md:w-auto flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 py-3 md:py-2">
          <UserPlus className="w-4 h-4" />
          Register New Customer
        </Button>
      </div>

      {showPreSearchModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold">Search Existing Customers</h3>
              <button onClick={() => setShowPreSearchModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search by name, phone or ID..."
                  value={preSearchQuery}
                  onChange={(e) => setPreSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                {preSearchQuery.trim() && preSearchResults.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 mb-4">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <p className="text-xs text-amber-700 font-medium">This customer may already exist. Review before registering.</p>
                  </div>
                )}
                {preSearchQuery.trim() && preSearchResults.length === 0 && (
                  <div className="p-8 text-center bg-emerald-50 border border-emerald-100 rounded-xl">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm text-emerald-700 font-bold">No existing customer found.</p>
                    <p className="text-xs text-emerald-600 mt-1 uppercase tracking-widest font-black">Safe to register new profile</p>
                  </div>
                )}
                {preSearchResults.map(c => (
                  <div key={c.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex justify-between items-center border border-slate-100 dark:border-slate-700">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{c.full_name}</p>
                      <p className="text-xs text-slate-500">{c.phone}</p>
                      <p className="text-[10px] text-slate-400">ID: {c.profile?.national_id || 'N/A'}</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs h-8"
                      onClick={() => navigate('/field/register-customer', { state: { customer: c } })}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setShowPreSearchModal(false)}>Cancel</Button>
              <Button onClick={() => {
                setShowPreSearchModal(false);
                setShowDirectPreRegChecklist(true);
              }}>
                Continue to Register New
              </Button>
            </div>
          </div>
        </div>
      )}

      <ChecklistModal
        isOpen={showDirectPreRegChecklist}
        onClose={() => setShowDirectPreRegChecklist(false)}
        onConfirm={() => {
          setShowDirectPreRegChecklist(false);
          setIsRegistering(true);
        }}
        title="Before You Begin — Prepare the Following"
        items={[
          "Original National ID card (physical copy present)",
          "Clear photo of the National ID card (front side)",
          "Passport photo or clear face photo of the customer",
          "Active M-Pesa registered phone number",
          "Details of at least one guarantor (full name, phone number, national ID)",
          "Customer's employment status and estimated monthly income",
          "Customer's physical address (village, town)"
        ]}
        confirmText="Proceed to Registration"
        note="Incomplete information will cause delays in loan processing. Ensure all items are ready before proceeding."
      />

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

      {Object.values(todayActivity).some(v => v > 0) && (
        <Card className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl px-6 py-4 flex flex-wrap gap-6 items-center">
          <div className="text-xs font-black text-primary-600 uppercase tracking-widest whitespace-nowrap">Today's Activity</div>
          <div className="flex flex-wrap items-center gap-6 text-sm divide-x divide-primary-200 dark:divide-primary-800">
            <div className="flex items-center gap-2 pl-0">
               <span className="text-slate-900 dark:text-white font-black">{todayActivity.registered}</span>
               <span className="text-slate-500 text-xs">Registered</span>
            </div>
            <div className="flex items-center gap-2 pl-6">
               <span className="text-slate-900 dark:text-white font-black">{todayActivity.submitted}</span>
               <span className="text-slate-500 text-xs">Submitted</span>
            </div>
            <div className="flex items-center gap-2 pl-6">
               <span className="text-slate-900 dark:text-white font-black">{todayActivity.verified}</span>
               <span className="text-slate-500 text-xs">Verified</span>
            </div>
            <div className="flex items-center gap-2 pl-6 border-l border-primary-200 dark:border-primary-800">
               <span className={`font-black ${todayActivity.overdue > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>{todayActivity.overdue}</span>
               <span className="text-slate-500 text-xs">Overdue</span>
            </div>
          </div>
        </Card>
      )}

      {drafts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                   <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                   <h3 className="text-sm font-bold text-amber-900 dark:text-amber-400">Incomplete Registrations</h3>
                   <p className="text-xs text-amber-600/70">These customers were not fully registered. Resume to complete their profiles.</p>
                </div>
             </div>
             <span className="bg-amber-200 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] font-black px-2 py-1 rounded-full uppercase">{drafts.length} Pending</span>
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-amber-200">
            {drafts.map((draft) => (
              <div key={draft.id} className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4 min-w-[220px] shadow-sm hover:shadow-md transition-shadow">
                 <p className="font-bold text-slate-900 dark:text-white text-sm truncate mb-1">{draft.full_name}</p>
                 <p className="text-xs text-slate-500 italic mb-3 line-clamp-1">{draft.incomplete_reason || 'Incomplete Profile'}</p>
                 <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400">{new Date(draft.created_at).toLocaleDateString()}</span>
                    <button 
                      onClick={() => navigate('/field/register-customer', { state: { customer: draft } })}
                      className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Resume
                    </button>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rejectedLoans.length > 0 && (
        <Card className="border-rose-100 dark:border-rose-900/30 bg-rose-50/30 dark:bg-rose-900/5">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                   <XCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                   <h3 className="text-base font-bold text-rose-900 dark:text-rose-400 uppercase tracking-tight">Rejected Loans</h3>
                   <p className="text-xs text-rose-600/70">Manager has rejected these applications. Review the reason and advise the customer.</p>
                </div>
             </div>
          </div>
          
          <Table
            headers={['Customer', 'Amount', 'Rejection Reason', 'Date Rejected', 'Action']}
            data={rejectedLoans}
            initialCount={5}
            renderRow={(loan) => (
              <tr key={loan.id} className="hover:bg-rose-100/30 dark:hover:bg-rose-900/10 transition-colors border-b border-rose-100 dark:border-rose-900/20 last:border-0">
                <td className="px-6 py-4">
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{loan.customer_name}</p>
                  <p className="text-[10px] text-slate-500">{loan.user_phone}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">KES {loan.amount.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4">
                   <div className="rose-50 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded text-xs border border-rose-100 dark:border-rose-900/30">
                      {loan.rejection_reason || loan.reject_reason ? (
                        <p className="text-rose-700 dark:text-rose-400 leading-relaxed font-medium">"{loan.rejection_reason || loan.reject_reason}"</p>
                      ) : (
                        <p className="text-slate-400 italic">No reason provided</p>
                      )}
                   </div>
                </td>
                <td className="px-6 py-4 text-slate-500 text-xs">
                  {new Date(loan.updated_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <Button 
                    size="sm" 
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg w-full sm:w-auto"
                    onClick={() => navigate('/field/apply-loan', { state: { customer: { id: loan.user, full_name: loan.customer_name } } })}
                  >
                    Resubmit
                  </Button>
                </td>
              </tr>
            )}
          />
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 overflow-hidden px-0 md:px-6">
          <div className="px-6 md:px-0 flex justify-between items-center mb-6">
            <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Active Portfolio</h3>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">LIVE</span>
          </div>
          {processedData.sortedLoans.filter(l => ['ACTIVE', 'OVERDUE'].includes(l.status)).length === 0 ? (
            <div className="mx-6 md:mx-0 text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
              No active loans found.
            </div>
          ) : (
            <Table
              headers={['Customer', <span key="prd">Product</span>, <span key="bal" className="hidden sm:inline">Principal</span>, <span key="tot" className="hidden md:inline">To Repay</span>, 'Status', 'Action']}
              data={processedData.sortedLoans.filter(l => ['ACTIVE', 'OVERDUE'].includes(l.status))}
              initialCount={10}
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
                      {loan.status === 'OVERDUE' && (
                        <button 
                          onClick={async (e) => {
                             e.preventDefault();
                             const followUpMessage = `Dear ${loan.customer_name}, this is a reminder that your loan repayment of KES ${loan.amount.toLocaleString()} is overdue. Please make payment as soon as possible to avoid penalties. Contact us for assistance.`;
                             try {
                               await loanService.sendDirectSMS({
                                 user_id: loan.user,
                                 message: followUpMessage
                               });
                               toast.success('Follow-up SMS sent to customer');
                             } catch (err) {
                               console.error(err);
                               toast.error('Failed to send follow-up SMS');
                             }
                          }}
                          className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-all shadow-sm hover:shadow-orange-500/20 h-8 md:h-9 whitespace-nowrap"
                        >
                          <PhoneCall className="w-3 h-3" />
                          Followed Up
                        </button>
                      )}
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
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">Display Limit: 10 Rows</span>
            </div>
            {processedData.sortedCustomers.length === 0 ? (
              <div className="mx-6 md:mx-0 text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
                No customers registered.
              </div>
            ) : (
              <Table
                headers={['Customer', <span key="date" className="hidden sm:inline">Joined</span>, 'Actions']}
                data={processedData.sortedCustomers}
                initialCount={10}
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
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-slate-900 dark:text-white uppercase tracking-tight">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Verification Queue
          </h3>
          <div className="space-y-4">
            {processedData.verificationQueue.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-500 italic">No loans awaiting verification.</p>
              </div>
            ) : (
              processedData.verificationQueue.slice(0, 10).map(loan => (
                <div key={loan.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-sm transition-shadow">
                   <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{loan.customer_name}</p>
                      <p className="text-xs font-black text-indigo-600">KES {loan.amount.toLocaleString()}</p>
                   </div>
                   <div className="flex justify-between items-center mt-3">
                      <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">
                        {new Date(loan.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })} — Pending
                      </span>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          const customerObj = customersList.find(c => c.id === loan.user);
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
            {processedData.verificationQueue.length > 10 && (
              <p className="text-[10px] text-center text-slate-400 font-medium uppercase tracking-widest">+ {processedData.verificationQueue.length - 10} More in queue</p>
            )}
          </div>
        </Card>
      </div>

      {selectedLoan && (
        <RepaymentModal 
          loan={selectedLoan}
          onClose={() => setSelectedLoan(null)}
          onSuccess={() => {
            setSelectedLoan(null);
            invalidateLoans();
            invalidateCapital();
          }}
        />
      )}

      {reviewingCustomer && (
        <CustomerHistoryModal 
          isOpen={isReviewOpen}
          customer={reviewingCustomer}
          loanToVerify={reviewingLoan}
          onVerified={() => {
            setIsReviewOpen(false);
            setReviewingCustomer(null);
            setReviewingLoan(null);
            invalidateLoans();
            invalidateCustomers();
          }}
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
