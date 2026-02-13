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
    duration_type: 'MONTHS', // 'WEEKS' or 'MONTHS'
    duration_value: 12,
    loan_reason: '',
    loan_reason_other: '',
    agreedToTerms: false
  });

  const loanReasons = [
    'Business Expansion', 'Medical Expenses', 'Education', 'Personal Use', 'Rent/Housing', 'Agriculture/Farming', 'Emergencies', 'Other'
  ];

  useEffect(() => {
    const fetchLoanProducts = async () => {
      try {
        const data = await loanService.api.get('/loan-products/');
        let products = data.data.results || data.data || [];
        
        // Sort products so "Inuka" is first
        products.sort((a, b) => {
          if (a.name.toLowerCase().includes('inuka')) return -1;
          if (b.name.toLowerCase().includes('inuka')) return 1;
          return 0;
        });

        setLoanProducts(products);
        
        // Auto-select first product if available
        if (products.length > 0) {
          const firstProduct = products[0];
          setFormData(prev => ({ 
            ...prev, 
            loan_product_id: firstProduct.id,
            duration_type: 'WEEKS', // Default to weeks as per requirement
            duration_value: firstProduct.duration_weeks || 4 // Default to 4 weeks or product recommendation
          }));
        }
      } catch (err) {
        console.error('Failed to fetch loan products:', err);
      }
    };
    fetchLoanProducts();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // If product changes, auto-update duration to weeks and recommended value
    if (name === 'loan_product_id') {
      const selectedProduct = loanProducts.find(p => p.id === value);
      if (selectedProduct) {
        setFormData(prev => ({
          ...prev,
          loan_product_id: value,
          duration_type: 'WEEKS',
          duration_value: selectedProduct.duration_weeks || 4
        }));
        return;
      }
    }

    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.loan_product_id || !formData.principal_amount) {
      setError('Please select a product and enter amount');
      return;
    }

    if (!formData.agreedToTerms) {
      setError('You must agree to the Terms and Conditions to proceed');
      return;
    }
    try {
      const payload = {
        user: customer.id,
        loan_product: formData.loan_product_id,
        principal_amount: formData.principal_amount,
        loan_reason: formData.loan_reason,
        loan_reason_other: formData.loan_reason === 'Other' ? formData.loan_reason_other : '',
        status: 'UNVERIFIED' // Initial stage as per requirements
      };

      if (formData.duration_type === 'WEEKS') {
        payload.duration_weeks = formData.duration_value;
      } else {
        payload.duration_months = formData.duration_value;
      }

      await loanService.api.post('/loans/', payload);
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
        <h3 className="text-xl font-bold">Application Received!</h3>
        <p className="text-slate-500">
          Application for {customer.full_name} is now <span className="text-amber-600 font-black">UNVERIFIED</span>. 
          Please proceed to verify documents.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 max-w-xl mx-auto dark:bg-slate-900 border-none shadow-xl">
      <div className="flex items-center gap-4 mb-6 pb-6 border-b dark:border-slate-800">
        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">{customer?.full_name}</h3>
          <p className="text-sm text-slate-500">Loan Application Cycle Initiated</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Loan Product</label>
            <select 
              name="loan_product_id"
              value={formData.loan_product_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 outline-none font-bold text-slate-700 dark:text-slate-200"
              required
            >
              <option value="">Choose Plan...</option>
              {loanProducts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (KES {Number(p.min_amount).toLocaleString()} - {Number(p.max_amount).toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Amount (KES)</label>
            <input 
              name="principal_amount"
              type="number"
              value={formData.principal_amount}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 outline-none font-black text-lg text-indigo-600" 
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Duration Type</label>
            <select 
              name="duration_type"
              value={formData.duration_type}
              onChange={handleChange}
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none font-bold text-slate-500"
            >
              <option value="WEEKS">Weekly (Company Policy)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Period (Weeks)</label>
            <input 
              name="duration_value"
              type="number"
              value={formData.duration_value}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 outline-none font-bold" 
              placeholder="e.g. 4"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Purpose of Credit</label>
            <select 
              name="loan_reason"
              value={formData.loan_reason}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 outline-none font-semibold"
            >
              <option value="">Select Purpose...</option>
              {loanReasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {formData.loan_reason === 'Other' && (
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-black text-slate-400 uppercase">Specify Reason</label>
              <textarea 
                name="loan_reason_other"
                value={formData.loan_reason_other}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 outline-none" 
                placeholder="Details..."
                rows="2"
              />
            </div>
          )}
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl flex items-start gap-3 mt-6 border border-amber-100 dark:border-amber-900/50">
          <Info className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="text-[11px] text-amber-800 dark:text-amber-400 leading-relaxed">
            <p className="font-black mb-1 text-[10px] uppercase tracking-wider">Workflow Verification:</p>
            <p>This loan will start as <strong>UNVERIFIED</strong>. A Field Officer must verify the physical documents before an Admin can approve funds.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <input 
            type="checkbox" 
            id="agreedToTerms" 
            name="agreedToTerms"
            checked={formData.agreedToTerms}
            onChange={handleChange}
            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            required
          />
          <label htmlFor="agreedToTerms" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            I agree to the <span className="text-indigo-600 dark:text-indigo-400 font-bold underline">Loan Terms & Conditions</span> and confirm all details are accurate.
          </label>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 mt-6 border-t dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onCancel} className="w-full sm:w-auto px-8">
            Dismiss
          </Button>
          <Button 
            type="submit" 
            disabled={loading || !formData.agreedToTerms}
            className={`w-full sm:flex-1 font-bold h-11 shadow-lg transition-all ${
              formData.agreedToTerms 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            {loading ? 'Processing...' : 'Submit Application'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default LoanApplicationForm;
