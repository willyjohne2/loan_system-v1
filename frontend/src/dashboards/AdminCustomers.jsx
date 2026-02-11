import React, { useEffect, useState } from 'react';
import { loanService } from '../api/api';
import { Table, StatCard, Button } from '../components/ui/Shared';
import { Search, Filter, UserPlus } from 'lucide-react';
import CustomerRegistrationForm from '../components/forms/CustomerRegistrationForm';
import CustomerHistoryModal from '../components/ui/CustomerHistoryModal';

const AdminCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const parseAmount = (val) => {
      const num = Number(val);
      return Number.isFinite(num) ? num : 0;
    };

    try {
      console.log('[AdminCustomers] Fetching customer data...');
      const [usersData, loansData, repaymentsData] = await Promise.all([
        loanService.getCustomers(),
        loanService.getLoans(),
        loanService.getRepayments()
      ]);

      const users = usersData.results || usersData;
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

  useEffect(() => {
    fetchData();
  }, []);

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
              <input type="text" placeholder="Search customer..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700" />
            </div>
            <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              <Filter className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <p>No customers registered yet</p>
        </div>
      ) : (
        <Table
          headers={['Customer', 'Borrowed', 'Paid', 'Balance', 'Status', 'Actions']}
          data={customers}
          renderRow={(customer) => {
            const balance = customer.totalBorrowed - customer.totalRepaid;
            return (
              <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-medium text-slate-900 dark:text-white">{customer.full_name}</p>
                  <p className="text-xs text-slate-500">ID: {customer.id}</p>
                </td>
                <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">KES {customer.totalBorrowed.toLocaleString()}</td>
                <td className="px-6 py-4 text-emerald-600 font-medium">KES {customer.totalRepaid.toLocaleString()}</td>
                <td className="px-6 py-4 text-rose-600 font-semibold">KES {balance.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${balance <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {balance <= 0 ? 'Cleared' : 'Active'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => {
                        setSelectedCustomer(customer);
                        setShowHistory(true);
                    }}
                    className="text-primary-600 font-medium hover:underline"
                  >
                    View History
                  </button>
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
    </div>
  );
};

export default AdminCustomers;
