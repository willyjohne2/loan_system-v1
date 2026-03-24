import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ShieldCheck, RefreshCw, Eye, EyeOff, Save, CheckCircle2, XCircle, Plus, Trash2, Settings2, Edit2, Wifi } from 'lucide-react';
import { Card, Button, Badge } from '../components/ui/Shared';
import { useAuth } from '../context/AuthContext';
import { useLoanProducts, useSecureSettings, useInvalidate } from '../hooks/useQueries';
import { loanService } from '../api/api';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

const LoanProductManager = () => {
  const { data: productsData, isLoading: loading } = useLoanProducts();
  const { invalidateLoanProducts } = useInvalidate();
  const products = useMemo(() => Array.isArray(productsData) ? productsData : (productsData?.results || []), [productsData]);
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', min_amount: '', max_amount: '', interest_rate: '', duration_weeks: '' });

  const handleSave = async () => {
    if (!productForm.name || !productForm.max_amount) { toast.error('Name and Max Amount required'); return; }
    try {
      if (editingId) {
        await loanService.updateLoanProduct(editingId, productForm);
        toast.success('Product updated');
      } else {
        await loanService.createLoanProduct(productForm);
        toast.success('Product created');
      }
      setIsAdding(false);
      setEditingId(null);
      setProductForm({ name: '', min_amount: '', max_amount: '', interest_rate: '', duration_weeks: '' });
      invalidateLoanProducts();
    } catch (err) { toast.error(editingId ? 'Update failed' : 'Creation failed'); }
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setProductForm({
      name: product.name,
      min_amount: product.min_amount,
      max_amount: product.max_amount,
      interest_rate: product.interest_rate,
      duration_weeks: product.duration_weeks
    });
    setIsAdding(true);
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setProductForm({ name: '', min_amount: '', max_amount: '', interest_rate: '', duration_weeks: '' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this loan product? Existing loans will remain but no new ones can use this.')) return;
    try {
      await loanService.deleteLoanProduct(id);
      toast.success('Deleted');
      invalidateLoanProducts();
    } catch (err) { toast.error('Delete failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Loan Products</h3>
          <p className="text-sm text-slate-500">Configure interest rates and limits for different loan tiers</p>
        </div>
        <Button onClick={isAdding ? cancelEdit : () => setIsAdding(true)} variant={isAdding ? 'secondary' : 'primary'}>
          {isAdding ? 'Cancel' : <><Plus className="w-4 h-4 mr-2" /> New Product</>}
        </Button>
      </div>

      {isAdding && (
        <Card className="p-6 border-2 border-indigo-500/20 bg-indigo-50/10 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Product Name</label>
              <input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg" placeholder="e.g. Business Loan" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Min Amount</label>
              <input type="number" value={productForm.min_amount} onChange={e => setProductForm({...productForm, min_amount: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg" placeholder="500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Max Amount</label>
              <input type="number" value={productForm.max_amount} onChange={e => setProductForm({...productForm, max_amount: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg" placeholder="50000" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Interest Rate (%)</label>
              <input type="number" step="0.01" value={productForm.interest_rate} onChange={e => setProductForm({...productForm, interest_rate: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg" placeholder="10.00" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Duration (Weeks)</label>
              <input type="number" value={productForm.duration_weeks} onChange={e => setProductForm({...productForm, duration_weeks: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg" placeholder="4" />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSave} className="w-full">{editingId ? 'Update Product' : 'Create Product'}</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-40 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />)
        ) : products.map(p => (
          <Card key={p.id} className="p-5 border-slate-200 hover:border-indigo-300 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-black text-slate-900 dark:text-slate-100">{p.name}</h4>
                <Badge variant="outline" className="mt-1">{p.interest_rate}% Interest</Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(p)} className="text-indigo-600 hover:bg-indigo-50"><Edit2 className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg">
                <span className="block text-xs text-slate-500 uppercase font-bold">Range</span>
                <span className="font-mono font-bold text-indigo-600">KES {parseInt(p.min_amount).toLocaleString()} - {parseInt(p.max_amount).toLocaleString()}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg">
                <span className="block text-xs text-slate-500 uppercase font-bold">Duration</span>
                <span className="font-bold">{p.duration_weeks} Weeks</span>
              </div>
            </div>
          </Card>
        ))}
        {!loading && products.length === 0 && (
          <div className="col-span-full py-12 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border-2 border-dashed border-slate-200">
            <Settings2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-bold">No loan products configured</p>
            <p className="text-xs text-slate-400">Add products to define interest rates for new loans</p>
          </div>
        )}
      </div>
    </div>
  );
};

const CredentialField = ({ label, sensitive, currentValue, onSave, onReveal }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revealedValue, setRevealedValue] = useState('');

  const isConfigured = useMemo(() => {
    if (!currentValue) return false;
    const v = String(currentValue);
    return v === '••••••••' || v === '••••••••••••' || v === '••••••••••••••••' || (v.length > 0 && !v.includes('•'));
  }, [currentValue]);

  const handleToggleReveal = async () => {
    if (showValue) { setShowValue(false); return; }
    setLoading(true);
    try {
      const resp = await onReveal();
      setRevealedValue(resp.value);
      setShowValue(true);
    } catch (err) { toast.error('Revealing failed'); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!value.trim()) { toast.error('Value required'); return; }
    setLoading(true);
    try {
      await onSave(value); setIsEditing(false); setValue('');
    } catch (err) { toast.error('Save failed'); } finally { setLoading(false); }
  };

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
          {label}
          {isConfigured ? (
            <Badge className="bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-none">OK</Badge>
          ) : (
            <Badge className="bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-none">Missing</Badge>
          )}
        </label>
        <div className="flex gap-1">
          {!isEditing ? (
            <React.Fragment>
              {sensitive && isConfigured && (
                <Button variant="ghost" size="sm" onClick={handleToggleReveal} disabled={loading}>
                  {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
            </React.Fragment>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
          )}
        </div>
      </div>
      {isEditing ? (
        <div className="flex gap-2">
          <input 
            type={sensitive ? 'password' : 'text'} 
            value={value} 
            onChange={e => setValue(e.target.value)} 
            className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 outline-none" 
          />
          <Button size="sm" onClick={handleSave} disabled={loading}>{loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}</Button>
        </div>
      ) : (
        <div className="px-3 py-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg truncate text-sm text-slate-700 dark:text-slate-300">
          {showValue ? revealedValue : (currentValue || 'Not configured')}
        </div>
      )}
    </div>
  );
};

const AdminSettings = ({ defaultTab = 'mpesa' }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const { data: secureSettingsData, isLoading: loading } = useSecureSettings();
  const { invalidateSecureSettings } = useInvalidate();

  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);

  const runMpesaTest = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const resp = await loanService.testMpesaConnection();
      setConnectionResult({ success: true, ...resp });
      toast.success('Configuration Validated');
    } catch (err) {
      setConnectionResult({ success: false, ...err.response?.data });
      toast.error('Connection Failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const secureSettings = useMemo(() => 
    Array.isArray(secureSettingsData) ? secureSettingsData : (secureSettingsData?.results || []),
    [secureSettingsData]
  );

  // overrides for immediate visual feedback
  const [envOverride, setEnvOverride] = useState(null);
  const [shortcodeOverride, setShortcodeOverride] = useState(null);

  const currentEnvironment = envOverride 
    ?? secureSettings.find(s => s.key === 'mpesa_environment')?.encrypted_value 
    ?? 'sandbox';

  const currentShortcodeType = shortcodeOverride 
    ?? secureSettings.find(s => s.key === 'mpesa_shortcode_type')?.encrypted_value 
    ?? 'paybill';

  const handleUpdate = async (key, value, group) => {
    try {
      await loanService.updateSecureSetting(key, value, group.toUpperCase());
      toast.success('Updated');
      invalidateSecureSettings();
    } catch (err) { toast.error('Update failed'); }
  };

  const filtered = secureSettings.filter(s => s.setting_group === activeTab.toUpperCase());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black flex items-center gap-3"><ShieldCheck className="w-8 h-8 text-indigo-600" /> Admin Settings</h2>
        <Button variant="secondary" onClick={() => invalidateSecureSettings()} disabled={loading}><RefreshCw className={clsx("w-4 h-4 mr-2", loading && "animate-spin")} /> Refresh</Button>
      </div>
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
        {['mpesa', 'sms', 'maintenance', (user?.is_owner || user?.role === 'SUPER_ADMIN') && 'loans'].filter(Boolean).map(id => (
          <button key={id} onClick={() => setActiveTab(id)} className={clsx("px-4 py-2 rounded-lg text-sm font-bold capitalize", activeTab === id ? "bg-white text-indigo-600 shadow" : "text-slate-500")}>{id}</button>
        ))}
      </div>
      <Card className="p-4">
        <div className="space-y-4">
          {activeTab === 'loans' ? (
            <LoanProductManager />
          ) : loading ? <p>Loading...</p> : filtered.length > 0 ? (
            <React.Fragment>
              {filtered.map(s => <CredentialField key={s.key} label={s.key.replace(/_/g, ' ')} sensitive={true} currentValue={s.encrypted_value} onSave={val => handleUpdate(s.key, val, s.setting_group)} onReveal={() => loanService.revealSecureSetting(s.key)} />)}
              
              {activeTab === 'mpesa' && (
                <div className="mt-8 pt-8 border-t space-y-6">
                  <div className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h4 className="text-sm font-black text-slate-500 uppercase mb-4">M-Pesa Environment</h4>
                    <div className="flex gap-4">
                      <Button 
                        variant={currentEnvironment === 'sandbox' ? 'primary' : 'secondary'}
                        className="flex-1"
                        onClick={async () => {
                          setEnvOverride('sandbox');
                          await handleUpdate('mpesa_environment', 'sandbox', 'mpesa');
                          toast.success('✅ Switched to Sandbox — test mode active');
                        }}
                      >
                        Sandbox (Testing)
                      </Button>
                      <Button 
                        variant={currentEnvironment === 'production' ? 'danger' : 'secondary'}
                        className="flex-1"
                        onClick={async () => {
                          if (!window.confirm('⚠️ Switch to PRODUCTION? Real money will move on every disbursement.')) return;
                          setEnvOverride('production');
                          await handleUpdate('mpesa_environment', 'production', 'mpesa');
                          toast.success('🔴 Switched to Production mode');
                        }}
                      >
                        Production (Live)
                      </Button>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h4 className="text-sm font-black text-slate-500 uppercase mb-4">Shortcode Type</h4>
                    <div className="flex gap-4">
                      <Button 
                        variant={currentShortcodeType === 'paybill' ? 'primary' : 'secondary'}
                        className="flex-1"
                        onClick={async () => {
                          setShortcodeOverride('paybill');
                          await handleUpdate('mpesa_shortcode_type', 'paybill', 'mpesa');
                          toast.success('Updated to Paybill');
                        }}
                      >
                        Paybill
                      </Button>
                      <Button 
                        variant={currentShortcodeType === 'till' ? 'primary' : 'secondary'}
                        className="flex-1"
                        onClick={async () => {
                          setShortcodeOverride('till');
                          await handleUpdate('mpesa_shortcode_type', 'till', 'mpesa');
                          toast.success('Updated to Buy Goods (Till)');
                        }}
                      >
                        Till Number
                      </Button>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h4 className="text-sm font-black text-slate-500 uppercase mb-4 flex items-center gap-2">
                       <Wifi className="w-4 h-4" /> Connection Diagnosis
                    </h4>
                    <p className="text-sm text-slate-500 mb-4">
                      Test your M-Pesa credentials before going live. This will attempt to authenticate with Safaricom to ensure your keys are correct.
                    </p>
                    
                    {!connectionResult && (
                      <Button onClick={runMpesaTest} disabled={testingConnection} className="w-full">
                        {testingConnection ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Testing...</> : 'Test Connectivity Now'}
                      </Button>
                    )}

                    {connectionResult && (
                      <div className={clsx("p-4 rounded-lg border text-sm space-y-2", connectionResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800")}>
                        <div className="flex items-center gap-2 font-bold">
                          {connectionResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-rose-600" />}
                          {connectionResult.success ? "Connection Successful" : "Connection Failed"}
                        </div>
                        <p>{connectionResult.message}</p>
                        {connectionResult.token_preview && (
                           <div className="text-xs font-mono bg-black/5 p-2 rounded mt-2">
                             Token: {connectionResult.token_preview}
                           </div>
                        )}
                         {connectionResult.configuration && (
                           <div className="mt-2 text-xs">
                             <p className="font-bold uppercase opacity-70 mb-1">Loaded Config:</p>
                             <pre className="bg-black/5 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                               {JSON.stringify(connectionResult.configuration, null, 2)}
                             </pre>
                           </div>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => setConnectionResult(null)} className="w-full mt-3">Reset Test</Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </React.Fragment>
          ) : <p>No settings for {activeTab}</p>}
        </div>
      </Card>
    </div>
  );
};
export default AdminSettings;
