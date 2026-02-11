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
  TrendingUp
} from 'lucide-react';

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    DEFAULT_INTEREST_RATE: 15,
    OVERDUE_PENALTY_RATE: 5,
    INTEREST_CALCULATION_MODEL: 'MONTHLY_SIMPLE',
    MSG_TEMPLATE_DEFAULTER: "Hello {name}, your loan of KES {principal:,.2f} is OVERDUE. Interest accumulated: KES {interest:,.2f}. Remaining balance: KES {balance:,.2f}. Please pay via Paybill.",
    MSG_TEMPLATE_REPAID: "Hello {name}, thank you for your commitment to repaying your previous loan. You are now eligible to apply for a newer, larger loan. Visit our nearest office or apply online today!"
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await loanService.getSettings();
      // Ensure we have numbers where expected
      setSettings(prev => ({
        ...prev,
        ...data,
        DEFAULT_INTEREST_RATE: Number(data.DEFAULT_INTEREST_RATE || 15),
        OVERDUE_PENALTY_RATE: Number(data.OVERDUE_PENALTY_RATE || 5),
      }));
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Basic Interest Rate */}
        <Card className="p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
               <Percent className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Standard Interest Rate</h3>
              <p className="text-sm text-slate-500">Base monthly interest for new loan applications</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
              <span className="text-sm font-medium">Monthly Rate (%)</span>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSettings({...settings, DEFAULT_INTEREST_RATE: Math.max(0, settings.DEFAULT_INTEREST_RATE - 0.5)})}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"
                >
                  <ArrowDownRight className="w-4 h-4" />
                </button>
                <input 
                  type="number"
                  step="0.1"
                  className="w-20 text-center font-bold text-xl bg-transparent focus:outline-none dark:text-white"
                  value={settings.DEFAULT_INTEREST_RATE}
                  onChange={(e) => setSettings({...settings, DEFAULT_INTEREST_RATE: parseFloat(e.target.value)})}
                />
                <button 
                   onClick={() => setSettings({...settings, DEFAULT_INTEREST_RATE: settings.DEFAULT_INTEREST_RATE + 0.5})}
                   className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-primary-50/50 dark:bg-primary-900/10 rounded-lg">
              <Info className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
              <p className="text-xs text-primary-800/80 dark:text-primary-400">
                This rate applies to all loan products by default unless overridden at the individual product level. 
                Calculated per month using standard reducing balance or fixed models.
              </p>
            </div>
          </div>
        </Card>

        {/* Penalty Policy */}
        <Card className="p-8 border-t-4 border-t-amber-500">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
               <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Overdue Penalty Policy</h3>
              <p className="text-sm text-slate-500">Auto-calculated adjustments for late repayments</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Default Interest Adjustment</label>
              <div className="flex items-center justify-between p-4 bg-amber-50/50 dark:bg-amber-900/5 rounded-xl border border-amber-100 dark:border-amber-900/20">
                <span className="text-xs font-medium text-amber-900 dark:text-amber-400">Penalty Percentage</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    className="w-16 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/30 rounded p-1 text-center font-bold"
                    value={settings.OVERDUE_PENALTY_RATE}
                    onChange={(e) => setSettings({...settings, OVERDUE_PENALTY_RATE: parseFloat(e.target.value)})}
                  />
                  <span className="text-sm font-bold text-amber-900 dark:text-amber-400">%</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <Clock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                 <p className="text-xs text-slate-500">
                   When a loan becomes <span className="font-bold text-red-500">OVERDUE</span>, the monthly interest rate will 
                   <span className="mx-1 uppercase font-bold text-amber-600">increase</span> 
                   by this value.
                 </p>
                 <Badge variant="warning">Example: 15% + {settings.OVERDUE_PENALTY_RATE}% = {settings.DEFAULT_INTEREST_RATE + settings.OVERDUE_PENALTY_RATE}%</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Multi-tier Rules */}
        <Card className="lg:col-span-2 p-8">
           <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
             <TrendingUp className="w-5 h-5 text-indigo-500" />
             Calculation Logic (Automated)
           </h3>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { 
                  title: 'New Loans', 
                  desc: 'Interest applied on approval', 
                  rate: settings.DEFAULT_INTEREST_RATE, 
                  color: 'primary' 
                },
                { 
                  title: 'Ongoing', 
                  desc: 'Standard monthly accrual', 
                  rate: settings.DEFAULT_INTEREST_RATE, 
                  color: 'success' 
                },
                { 
                  title: 'Defaulted', 
                  desc: 'Compounded penalty rate', 
                  rate: settings.DEFAULT_INTEREST_RATE + settings.OVERDUE_PENALTY_RATE, 
                  color: 'danger' 
                },
              ].map((tier, idx) => (
                <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{tier.title}</p>
                   <div className="mt-2 flex items-baseline gap-1">
                      <span className={`text-2xl font-black text-${tier.color}-600`}>{tier.rate}%</span>
                      <span className="text-xs text-slate-500 font-medium">/ mo</span>
                   </div>
                   <p className="text-[10px] text-slate-400 mt-2 italic">{tier.desc}</p>
                </div>
              ))}
           </div>          <Card className="p-6 md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400">
                <Info className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Communication Templates</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Defaulter Reminder Template
                </label>
                <textarea
                  rows={3}
                  value={settings.MSG_TEMPLATE_DEFAULTER}
                  onChange={(e) => setSettings({ ...settings, MSG_TEMPLATE_DEFAULTER: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
                <p className="mt-2 text-[10px] text-slate-500 uppercase tracking-wider">
                  Placeholders: <span className="text-primary-600 font-mono">{"{name}"}, {"{principal}"}, {"{interest}"}, {"{balance}"}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Lead Nurturing Template (Repaid Customers)
                </label>
                <textarea
                  rows={3}
                  value={settings.MSG_TEMPLATE_REPAID}
                  onChange={(e) => setSettings({ ...settings, MSG_TEMPLATE_REPAID: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
                <p className="mt-2 text-[10px] text-slate-500 uppercase tracking-wider">
                  Placeholders: <span className="text-primary-600 font-mono">{"{name}"}</span>
                </p>
              </div>
            </div>
          </Card>        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;
