import React, { useEffect, useState, useMemo } from 'react';
import { loanService } from '../api/api';
import { useInvalidate, useBranches } from '../hooks/useQueries';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import PaginationFooter from '../components/ui/PaginationFooter';
import { Table, StatCard, Button, Card } from '../components/ui/Shared';
import { Search, Filter, UserPlus, Trash2, Lock, Unlock, MessageSquare, Send, X, AlertTriangle, Building2, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DateRangeFilter from '../components/ui/DateRangeFilter';
import ExportButton from '../components/ui/ExportButton';
import CustomerRegistrationForm from '../components/forms/CustomerRegistrationForm';
import CustomerHistoryModal from '../components/ui/CustomerHistoryModal';
import ChecklistModal from '../components/ui/ChecklistModal';
import useDebounce from '../hooks/useDebounce';

const DirectSMSModal = ({ customer, isOpen, onClose }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await loanService.sendDirectSMS({
        user_id: customer.id,
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
            <p className="text-xs text-slate-500">To: {customer.full_name} ({customer.phone_number})</p>
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
          <p className="text-[10px] text-slate-400">
            Note: Standard SMS rates apply. Messages are logged for auditing.
          </p>
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

const AdminCustomers = () => {
  const { user } = useAuth();
  const { invalidateCustomers } = useInvalidate();
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSMS, setShowSMS] = useState(false);
  const [showPreRegChecklist, setShowPreRegChecklist] = useState(false);
  const [showRoleWarning, setShowRoleWarning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [branchFilter, setBranchFilter] = useState('all');

  const { data: branchesData } = useBranches();
  const branches = branchesData?.results || branchesData || [];

  const queryParams = useMemo(() => ({
    search: searchTerm,
    branch: branchFilter === 'all' ? undefined : branchFilter,
    date_from: dateRange.from || undefined,
    date_to: dateRange.to || undefined,
  }), [searchTerm, branchFilter, dateRange]);

  const customersQueryKey = useMemo(() => ['customers'], []);

  const {
    data: customers,
    isLoading: loading,
    isFetching,
    hasMore,
    canShowLess,
    showMore,
    showLess,
    totalCount,
    reset,
  } = usePaginatedQuery({
    queryKey: customersQueryKey,
    queryFn: (params) => loanService.getCustomers(params),
    pageSize: 10,
    params: queryParams
  });

  useEffect(() => {
    reset();
  }, [queryParams, reset]);

  const handleStartRegistration = () => {
    if (user?.role !== 'FIELD_OFFICER') {
      setShowRoleWarning(true);
    } else {
      setShowPreRegChecklist(true);
    }
  };

  const handleDelete = async (customer) => {
    if (window.confirm(`Are you sure you want to "delete" ${customer.full_name}? This will lock their account and keep their records for legal reference.`)) {
      try {
        await loanService.deleteCustomer(customer.id);
        invalidateCustomers();
      } catch (err) {
        alert("Failed to lock customer: " + (err.response?.data?.error || err.message));
      }
    }
  };

  const onSuccess = () => {
    setIsRegistering(false);
    invalidateCustomers();
  };

  if (isRegistering) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">New Customer Registration</h2>
          <Button variant="secondary" onClick={() => setIsRegistering(false)}>Back to List</Button>
        </div>
        <CustomerRegistrationForm 
          onSuccess={onSuccess}
          onCancel={() => setIsRegistering(false)}
        />
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Loading customers...</div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold">Customers & Loanees</h3>
            <p className="text-sm text-slate-500">Full list of customers with their loan statuses.</p>
          </div>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold">Customers & Loanees</h3>
          <p className="text-sm text-slate-500">Full list of customers with their loan statuses.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
          {(user?.role === 'MANAGER' || user?.role === 'FIELD_OFFICER' || user?.god_mode_enabled) && !user?.is_owner && (
            <Button onClick={handleStartRegistration} className="flex items-center gap-2 whitespace-nowrap">
              <UserPlus className="w-4 h-4" />
              Register Customer
            </Button>
          )}
          {user?.is_owner && (
            <ExportButton 
              resource="customers"
              dateRange={dateRange}
              filename={`all_customers_export_${new Date().toISOString().split('T')[0]}.csv`}
            />
          )}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative group min-w-[160px]">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                <Building2 className="w-4 h-4 text-primary-500" />
              </div>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm bg-white dark:bg-slate-900 dark:border-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 appearance-none font-bold uppercase tracking-tight text-slate-700 dark:text-slate-200 shadow-sm transition-all hover:border-primary-300"
              >
                <option value="all">ALL BRANCHES</option>
                {Array.isArray(branches) && branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-primary-500 transition-colors" />
            </div>

            <DateRangeFilter 
              onChange={setDateRange}
            />

            <div className="relative flex-1 sm:flex-initial min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white dark:bg-slate-900 dark:border-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-all" 
              />
            </div>
          </div>
        </div>
      </div>

      <ChecklistModal
        isOpen={showPreRegChecklist}
        onClose={() => setShowPreRegChecklist(false)}
        onConfirm={() => {
          setShowPreRegChecklist(false);
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

      {showRoleWarning && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">System Policy Warning</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
                Customer registration is primarily a <span className="font-bold text-amber-600">Field Officer</span> responsibility. 
                By continuing, you are performing a role outside your primary designation.
              </p>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-8 text-left border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Requirement:</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  If you proceed, you <span className="text-primary-600">must</span> assign a Field Officer to this customer after registration to manage their loan applications and verification.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                      setShowRoleWarning(false);
                      setShowPreRegChecklist(true);
                  }}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-12 rounded-xl transition-colors"
                >
                  I Understand, Continue
                </button>
                <button 
                  onClick={() => setShowRoleWarning(false)}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold h-12 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel & Return
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {customers.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <p>{searchTerm ? 'No results matching your search' : 'No customers registered yet'}</p>
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table
            headers={['Customer', 'Borrowed', 'Paid', 'Balance', 'Status', 'Actions']}
            data={customers}
            maxHeight="max-h-[500px]"
            disableLocalPagination={true}
            renderRow={(customer) => {
              const balance = (customer.totalBorrowed || 0) - (customer.totalRepaid || 0);
              return (
                <tr key={customer.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${customer.is_locked ? 'opacity-60 bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {customer.is_locked && <Lock className="w-3 h-3 text-red-500" />}
                      <p className="font-medium text-slate-900 dark:text-white truncate max-w-[150px]">{customer.full_name}</p>
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase">ID: {customer.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">KES {(customer.totalBorrowed || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-emerald-600 font-medium">KES {(customer.totalRepaid || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-rose-600 font-semibold">KES {balance.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    {customer.is_locked ? (
                      <span className="px-2 py-1 text-[10px] font-black rounded uppercase bg-red-100 text-red-700 dark:bg-red-900/30">
                        Locked/Archived
                      </span>
                    ) : (
                      <span className={`px-2 py-1 text-[10px] font-black rounded uppercase ${balance <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {balance <= 0 ? 'Cleared' : 'Active'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => {
                            setSelectedCustomer(customer);
                            setShowSMS(true);
                        }}
                        className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                        title="Send Individual SMS"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                            setSelectedCustomer(customer);
                            setShowHistory(true);
                        }}
                        className="text-primary-600 font-medium hover:underline text-sm"
                      >
                        View History
                      </button>
                      {!customer.is_locked && (
                        <button 
                          onClick={() => handleDelete(customer)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Lock/Delete Customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }}
          />
          <PaginationFooter
            hasMore={hasMore}
            canShowLess={canShowLess}
            onShowMore={showMore}
            onShowLess={showLess}
            isFetching={isFetching}
            totalCount={totalCount}
            currentCount={customers.length}
          />
        </Card>
      )}

      {selectedCustomer && (
          <CustomerHistoryModal 
            customer={selectedCustomer}
            isOpen={showHistory}
            onClose={() => {
                setShowHistory(false);
                setSelectedCustomer(null);
            }}
          />
      )}

      {selectedCustomer && (
          <DirectSMSModal 
            customer={selectedCustomer}
            isOpen={showSMS}
            onClose={() => {
                setShowSMS(false);
                setSelectedCustomer(null);
            }}
          />
      )}
    </div>
  );
};

export default AdminCustomers;
