import React, { useState, useEffect } from 'react';
import { loanService } from '../api/api';
import { Card, Button, Badge } from '../components/ui/Shared';
import { 
  Percent, 
  AlertTriangle, 
  Save, 
  RefreshCw, 
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  TrendingUp,
  Edit,
  Check,
  X
} from 'lucide-react';

const LoanProductCard = ({ product, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [rate, setRate] = useState(product.interest_rate);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(product.id, { interest_rate: rate });
      setIsEditing(false);
    } catch (err) {
      alert("Failed to update interest rate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
            <Percent className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h4 className="font-bold text-slate-800 dark:text-white capitalize">{product.name}</h4>
          <p className="text-[10px] text-slate-500 uppercase font-medium">Monthly Rate</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <div className="relative">
              <input 
                type="number"
                step="0.1"
                className="w-20 pl-3 pr-7 py-1.5 bg-slate-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/30 rounded-lg font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                autoFocus
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
            </div>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => { setIsEditing(false); setRate(product.interest_rate); }}
              className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-lg font-black text-slate-800 dark:text-white">
              {product.interest_rate}%
            </div>
            <button 
              onClick={() => setIsEditing(true)}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    DEFAULT_INTEREST_RATE: 15,
    OVERDUE_PENALTY_RATE: 5,
    INTEREST_CALCULATION_MODEL: 'MONTHLY_SIMPLE',
    MSG_TEMPLATE_DEFAULTER: "Hello {name}, your loan of KES {principal:,.2f} is OVERDUE. Interest accumulated: KES {interest:,.2f}. Remaining balance: KES {balance:,.2f}. Please pay via Paybill.",
    MSG_TEMPLATE_REPAID: "Hello {name}, thank you for your commitment to repaying your previous loan. You are now eligible to apply for a newer, larger loan. Visit our nearest office or apply online today!"
  });
  const [loanProducts, setLoanProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsData, productsData] = await Promise.all([
        loanService.getSettings(),
        loanService.getLoanProducts()
      ]);

      setSettings(prev => ({
        ...prev,
        ...settingsData,
        DEFAULT_INTEREST_RATE: Number(settingsData.DEFAULT_INTEREST_RATE || 15),
        OVERDUE_PENALTY_RATE: Number(settingsData.OVERDUE_PENALTY_RATE || 5),
      }));

      setLoanProducts(productsData.results || productsData);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProductUpdate = async (id, data) => {
    await loanService.updateLoanProduct(id, data);
    // Refresh local state
    setLoanProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await loanService.updateSettings(settings);
      setMessage({ type: 'success', text: 'Financial policies updated successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-20 text-slate-400">
      <RefreshCw className="w-8 h-8 animate-spin mr-3" />
      <span>Loading system configurations...</span>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Interest & Financial Policies</h2>
          <p className="text-sm text-slate-500 mt-1">Configure global interest rates and late payment penalties</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="flex items-center gap-2"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400' 
            : 'bg-red-50 border-red-100 text-red-800 dark:bg-red-900/20 dark:border-red-900/30'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        {/* Basic Interest Rate */}
        <Card className="p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
               <Percent className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Loan Product Interest Rates</h3>
              <p className="text-sm text-slate-500">Configure monthly interest rates for each specific product</p>
            </div>
          </div>

          <div className="space-y-4">
            {loanProducts.length === 0 ? (
                <div className="text-center py-6 text-slate-400">No products found</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loanProducts.map(product => (
                        <LoanProductCard 
                            key={product.id} 
                            product={product} 
                            onUpdate={handleProductUpdate} 
                        />
                    ))}
                </div>
            )}

            <div className="flex items-start gap-3 p-4 bg-primary-50/50 dark:bg-primary-900/10 rounded-lg mt-8">
              <Info className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm text-primary-900 dark:text-primary-400 font-semibold">Policy Update:</p>
                <p className="text-xs text-primary-800/80 dark:text-primary-400">
                    Interest rates are fixed at the time of application. Changing a rate here will only affect <strong>new</strong> loans. 
                    Verified and disbursed loans remain unchanged. Note: There is no interest increase for overdue loans; the selected product rate applies throughout the loan duration.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;
