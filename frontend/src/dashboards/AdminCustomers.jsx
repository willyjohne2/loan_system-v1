import React, { useEffect, useState } from 'react';
import { loanService } from '../api/api';
import { Table, StatCard, Button, Pagination } from '../components/ui/Shared';
import { Search, Filter, UserPlus, Trash2, Lock, Unlock, MessageSquare, Send, X } from 'lucide-react';
import CustomerRegistrationForm from '../components/forms/CustomerRegistrationForm';
import CustomerHistoryModal from '../components/ui/CustomerHistoryModal';
import { useDebounce } from '../hooks/useDebounce';

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
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSMS, setShowSMS] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchData(page, debouncedSearch);
  }, [page, debouncedSearch]);

  const fetchData = async (pageNum = 1, search = '') => {
    setLoading(true);
    const parseAmount = (val) => {
      const num = Number(val);
      return Number.isFinite(num) ? num : 0;
    };

    try {
      console.log(`[AdminCustomers] Fetching customers page ${pageNum}...`);
      const [usersData, loansData, repaymentsData] = await Promise.all([
        loanService.getCustomers({ page: pageNum, search }),
        loanService.getLoans({ limit: 1000 }), // Keep for stats calculation or adjust
        loanService.getRepayments({ limit: 1000 })
      ]);

      const users = usersData.results || usersData;
      if (usersData.total_pages) setTotalPages(usersData.total_pages);
      
      const loans = loansData.results || loansData;
      const repayments = repaymentsData.results || repaymentsData;
      const loans = loansData.results || loansData;
      const repayments = repaymentsData.results || repaymentsData;

      const repaidByLoanId = repayments.reduce((acc, r) => {
        const loanId = r.loan;
        acc[loanId] = (acc[loanId] || 0) + parseAmount(r.amount_paid);
        return acc;
      }, {});

      const loansByUser = loans.reduce((acc, loan) => {
        const userId = loan.user;
        if (!acc[userId]) acc[userId] = [];
        acc[userId].push(loan);
        return acc;
      }, {});

      const customersWithTotals = users.map((user) => {
        const userLoans = loansByUser[user.id] || [];
        const totalBorrowed = userLoans.reduce(
          (sum, loan) => sum + parseAmount(loan.principal_amount),
          0
        );
        const totalRepaid = userLoans.reduce(
          (sum, loan) => sum + (repaidByLoanId[loan.id] || 0),
          0
        );
        return {
          ...user,
          totalBorrowed,
          totalRepaid,
        };
      });

      setCustomers(customersWithTotals);
      setError('');
    } catch (err) {
      console.error('[AdminCustomers] Failed to load customers:', err);
      setError(`Failed to load customers: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (customer) => {
    if (window.confirm(`Are you sure you want to "delete" ${customer.full_name}? This will lock their account and keep their records for legal reference.`)) {
      try {
        await loanService.deleteCustomer(customer.id);
        fetchData();
      } catch (err) {
        alert("Failed to lock customer: " + (err.response?.data?.error || err.message));
      }
    }
  };

  if (isRegistering) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">New Customer Registration</h2>
          <Button variant="secondary" onClick={() => setIsRegistering(false)}>Back to List</Button>
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold">Customers & Loanees</h3>
          <p className="text-sm text-slate-500">Full list of customers with their loan statuses.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setIsRegistering(true)} className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Register Customer
          </Button>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search customer..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700" 
              />
            </div>
          </div>
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <p>{searchTerm ? 'No results matching your search' : 'No customers registered yet'}</p>
        </div>
      ) : (
        <Table
          headers={['Customer', 'Borrowed', 'Paid', 'Balance', 'Status', 'Actions']}
          data={filteredCustomers}
          renderRow={(customer) => {
            const balance = customer.totalBorrowed - customer.totalRepaid;
            return (
              <tr key={customer.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${customer.is_locked ? 'opacity-60 bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {customer.is_locked && <Lock className="w-3 h-3 text-red-500" />}
                    <p className="font-medium text-slate-900 dark:text-white truncate max-w-[150px]">{customer.full_name}</p>
                  </div>
                  <p className="text-[10px] text-slate-500 uppercase">ID: {customer.id.slice(0, 8)}</p>
                </td>
                <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">KES {customer.totalBorrowed.toLocaleString()}</td>
                <td className="px-6 py-4 text-emerald-600 font-medium">KES {customer.totalRepaid.toLocaleString()}</td>
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
