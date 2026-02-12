import React, { useState, useEffect } from 'react';
import { loanService } from '../../api/api';
import { Button, Card } from '../ui/Shared';
import { 
  User, 
  CreditCard, 
  Calendar, 
  DollarSign, 
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Info
} from 'lucide-react';

const LoanApplicationForm = ({ customer, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loanProducts, setLoanProducts] = useState([]);
  
  const [formData, setFormData] = useState({
    loan_product_id: '',
    principal_amount: '',
    duration_months: 12,
    loan_reason: '',
    loan_reason_other: ''
  });

  const loanReasons = [
    'Business Expansion', 'Medical Expenses', 'Education', 'Personal Use', 'Rent/Housing', 'Agriculture/Farming', 'Emergencies', 'Other'
  ];

  useEffect(() => {
    const fetchLoanProducts = async () => {
      try {
        const data = await loanService.api.get('/loan-products/');
        setLoanProducts(data.data.results || data.data || []);
      } catch (err) {
        console.error('Failed to fetch loan products:', err);
      }
    };
    fetchLoanProducts();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.loan_product_id || !formData.principal_amount) {
      setError('Please select a product and enter amount');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await loanService.api.post('/loans/', {
        user: customer.id,
        loan_product: formData.loan_product_id,
        principal_amount: formData.principal_amount,
        duration_months: formData.duration_months,
        loan_reason: formData.loan_reason,
        loan_reason_other: formData.loan_reason === 'Other' ? formData.loan_reason_other : '',
        status: 'PENDING'
      });
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 2000);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to apply for loan');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-bold">Loan Application Submitted!</h3>
        <p className="text-slate-500">
          The application for {customer.full_name || 'the customer'} has been queued for verification.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-4 mb-6 pb-6 border-b">
        <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">{customer?.full_name}</h3>
          <p className="text-sm text-slate-500">Applying for a new loan</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Loan Product</label>
            <select 
              name="loan_product_id"
              value={formData.loan_product_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              required
            >
              <option value="">Select a product...</option>
              {loanProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.interest_rate}%)</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Loan Amount (KES)</label>
            <input 
              name="principal_amount"
              type="number"
              value={formData.principal_amount}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" 
              placeholder="e.g. 10000"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Duration (Months)</label>
            <input 
              name="duration_months"
              type="number"
              value={formData.duration_months}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" 
              placeholder="12"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Reason for Loan</label>
            <select 
              name="loan_reason"
              value={formData.loan_reason}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">Select Reason...</option>
              {loanReasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {formData.loan_reason === 'Other' && (
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Please specify reason</label>
              <textarea 
                name="loan_reason_other"
                value={formData.loan_reason_other}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" 
                placeholder="Briefly describe why you need the loan..."
                rows="2"
              />
            </div>
          )}
        </div>

        <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3 mt-4">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-bold mb-1">Important Note:</p>
            <p>Make sure the customer has provided all required verification documents (Profile Photo & ID) before submitting this application.</p>
          </div>
        </div>

        <div className="flex justify-between items-center gap-4 pt-4 border-t mt-6">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={loading}
            className="bg-primary-600 hover:bg-primary-700 text-white flex-1 flex items-center justify-center gap-2"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
            {!loading && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default LoanApplicationForm;
