import React, { useState, useEffect, useCallback } from 'react';
import { loanService } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge } from '../components/ui/Shared';
import { 
  Percent, 
  Save, 
  RefreshCw, 
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  MessageSquare,
  Settings,
  Eye,
  EyeOff,
  Lock,
  Search,
  CheckCircle,
  XCircle,
  Globe,
  Activity,
  UserCheck,
  Building2,
  Sliders,
  Calendar,
  Clock,
  LogOut,
  AlertTriangle,
  Edit2,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const CredentialField = ({ fieldKey, label, placeholder, sensitive, currentValue, onSave, onReveal }) => {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [revealed, setRevealed] = useState(null);
  const [showInput, setShowInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const isConfigured = !!currentValue && currentValue !== '••••••••';

  const handleSave = async () => {
    if (!inputValue.trim()) { toast.error('Value cannot be empty'); return; }
    setLoading(true);
    try {
      await onSave(inputValue.trim());
      setEditing(false);
      setInputValue('');
      setRevealed(null);
    } catch {
      toast.error('Failed to save — check encryption key');
    } finally {
      setLoading(false);
    }
  };

  const handleRevealClick = async () => {
    if (revealed) { setRevealed(null); return; }
    setLoading(true);
    try {
      const res = await onReveal();
      setRevealed(res?.value || res);
    } catch {
      toast.error('Cannot reveal — permission denied');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="group relative bg-slate-50 dark:bg-slate-900 shadow-sm hover:shadow-md hover:bg-white dark:hover:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800 transition-all duration-300">
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">
            {label}
          </label>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isConfigured ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300 dark:bg-slate-700'}`} />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {isConfigured ? 'Active' : 'Missing'}
            </span>
          </div>
        </div>
        
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {sensitive && isConfigured && (
            <button
              onClick={handleRevealClick}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-transparent hover:border-slate-100 dark:hover:border-slate-600 transition-all"
              title={revealed ? "Hide" : "Reveal"}
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : (revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />)}
            </button>
          )}
          <button
            onClick={() => { setEditing(!editing); setInputValue(''); }}
            className={`p-1.5 rounded-lg border border-transparent transition-all ${editing ? 'text-red-500 bg-white dark:bg-slate-700 border-red-100 dark:border-red-900/30' : 'text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-700 hover:border-slate-100 dark:hover:border-slate-600'}`}
          >
            {editing ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex gap-2 mt-1">
          <div className="relative flex-1">
            <input
              type={sensitive && !showInput ? "password" : "text"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white"
              autoFocus
            />
            {sensitive && (
              <button 
                onClick={() => setShowInput(!showInput)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500 transition-colors"
              >
                {showInput ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={loading || !inputValue}
            className="bg-slate-900 dark:bg-indigo-600 hover:scale-[1.02] active:scale-[0.98] text-white px-4 py-2 rounded-lg text-xs font-black shadow-lg shadow-slate-900/20 dark:shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-30 transition-all uppercase tracking-tight"
          >
            {loading ? <RefreshCw className="w-3 h-3 animate-spin text-white" /> : <Save className="w-3 h-3 text-white" />}
            Save
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-1">
          <div className={`flex-1 font-mono text-sm truncate py-1.5 ${revealed ? 'text-indigo-600 dark:text-indigo-400 font-bold' : (isConfigured && sensitive ? 'text-slate-300 dark:text-slate-700 tracking-[0.3em] text-[10px]' : 'text-slate-600 dark:text-slate-300')}`}>
            {revealed ? revealed : (isConfigured ? (sensitive ? '••••••••••••••••' : currentValue) : <span className="text-slate-300 dark:text-slate-700 italic font-sans text-xs">Unconfigured</span>)}
          </div>
          {isConfigured && (
             <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded-md uppercase">
               Secure
             </span>
          )}
        </div>
      )}
    </div>
  );
};

const SecureSettingRow = ({ item, onUpdate, onReveal }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(item.value);
  const [revealedValue, setRevealedValue] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onUpdate(item.key, value, item.group);
      setIsEditing(false);
      setRevealedValue(null);
      toast.success(`${item.key} updated`);
    } catch (err) {
      toast.error("Failed to update setting");
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = async () => {
    if (revealedValue) {
      setRevealedValue(null);
      return;
    }
    setLoading(true);
    try {
      const res = await onReveal(item.key);
      setRevealedValue(res.value);
    } catch (err) {
      toast.error("Permission denied or error revealing value");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 gap-3">
      <div className="flex-1">
        <h4 className="font-bold text-slate-800 dark:text-white text-sm">{item.key}</h4>
        <p className="text-xs text-slate-500">{item.description || 'Secure configuration parameter'}</p>
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <div className="flex gap-2 w-full sm:w-auto">
            <input 
              type="text"
              className="flex-1 sm:w-64 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/30 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter new value..."
            />
            <Button size="sm" onClick={handleSave} disabled={loading}>
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setIsEditing(false)}>
               Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg font-mono text-xs text-slate-600 dark:text-slate-400 min-w-[120px] text-center">
              {revealedValue || item.value}
            </div>
            <button 
              onClick={handleReveal}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
              title="Reveal Value"
            >
              {revealedValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => { setValue(revealedValue || ''); setIsEditing(true); }}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminSettings = ({ defaultTab = 'mpesa' }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [secureSettings, setSecureSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);

  // Derive current values from secureSettings for display
  const currentEnvironment = secureSettings.find(s => s.key === 'mpesa_environment')?.encrypted_value || 'sandbox';
  const currentShortcodeType = secureSettings.find(s => s.key === 'mpesa_shortcode_type')?.encrypted_value || 'paybill';
  
  // Maintenance State
  const [maintenanceDate, setMaintenanceDate] = useState('');
  const [maintenanceTime, setMaintenanceTime] = useState('');
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // Update tab when prop changes (e.g. navigating between /owner/settings/sms and /owner/settings/mpesa)
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const allTabs = [
    { id: 'mpesa', label: 'M-Pesa API', icon: Smartphone, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', roles: ['owner', 'super_admin'] },
    { id: 'sms', label: 'SMS Portal', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', roles: ['owner', 'super_admin'] },
    { id: 'system', label: 'System Settings', icon: Sliders, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-900/20', roles: ['owner', 'super_admin', 'admin'] },
    { id: 'security', label: 'Security & Auth', icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', roles: ['owner'] },
    { id: 'branches', label: 'Branches', icon: Building2, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', roles: ['owner', 'super_admin', 'admin'] },
    { id: 'maintenance', label: 'Maintenance', icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', roles: ['owner', 'super_admin', 'admin'] },
  ];

  const visibleTabs = allTabs.filter(tab => {
    if (user?.is_owner) return true;
    if (user?.is_super_admin) return tab.roles.includes('super_admin');
    return tab.roles.includes('admin');
  });

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  const fetchSecureSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loanService.getSecureSettings();
      setSecureSettings(data);
      
      // Initialize maintenance state if keys exist
      const mActive = data.find(s => s.key === 'maintenance_mode_active');
      const mTime = data.find(s => s.key === 'maintenance_schedule_time');
      
      if (mActive) setIsMaintenanceActive(mActive.encrypted_value === 'true');
      if (mTime && mTime.encrypted_value && mTime.encrypted_value !== '••••••••') {
          const dt = new Date(mTime.encrypted_value);
          setMaintenanceDate(dt.toISOString().split('T')[0]);
          setMaintenanceTime(dt.toTimeString().split(' ')[0].substring(0, 5));
      }
    } catch (err) {
      toast.error("Failed to load secure settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSecureSettings();
  }, [fetchSecureSettings]);

  const handleUpdate = async (key, value, group) => {
    try {
      await loanService.updateSecureSetting(key, value, group);
      toast.success(`${key.replace(/_/g, ' ')} saved successfully`);
      await fetchSecureSettings();
    } catch (err) {
      console.error('Update error:', err);
      toast.error(err.response?.data?.error || "Failed to update setting — Check encryption key is set on server");
      throw err; // Re-throw for CredentialField to handle
    }
  };

  const handleReveal = async (key) => {
    return await loanService.revealSecureSetting(key);
  };

  const testMpesa = async () => {
    setTestLoading(true);
    try {
      const res = await loanService.testMpesaConnection();
      if (res.status === 'success') {
        toast.success("M-Pesa Connection Successful!");
      } else {
        toast.error(`M-Pesa Error: ${res.message || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error("M-Pesa connection test failed");
    } finally {
      setTestLoading(false);
    }
  };

  const testSMS = async () => {
    const phone = window.prompt("Enter phone number to test (+254...)");
    if (!phone) return;
    setTestLoading(true);
    try {
      const res = await loanService.testSMSSend(phone, "Test message from Loan System Security Panel");
      if (res.status === 'success') {
        toast.success("SMS Sent Successfully (Check logs/device)");
      } else {
        toast.error(`SMS Error: ${res.message || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error("SMS test failed");
    } finally {
      setTestLoading(false);
    }
  };

  const handleMaintenanceSchedule = async (e) => {
    e.preventDefault();
    if (!maintenanceDate || !maintenanceTime) {
      toast.error("Please selected both date and time");
      return;
    }

    setScheduling(true);
    try {
      const scheduledDateTime = new Date(`${maintenanceDate}T${maintenanceTime}`).toISOString();
      await loanService.scheduleMaintenance({
        time: scheduledDateTime,
        active: isMaintenanceActive
      });
      toast.success("Maintenance policy updated successfully");
      await fetchSecureSettings();
    } catch (err) {
      toast.error("Failed to schedule maintenance");
    } finally {
      setScheduling(false);
    }
  };

  const filteredSettings = Array.isArray(secureSettings) 
    ? secureSettings.filter(s => s.setting_group === activeTab.toUpperCase())
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
            Admin Settings
          </h2>
          <p className="text-slate-500 font-medium">Configure encrypted API keys and system policies</p>
        </div>
        <div className="flex gap-2">
            <Button variant="secondary" onClick={fetchSecureSettings} disabled={loading}>
                <RefreshCw className={clsx("w-4 h-4 mr-2", loading && "animate-spin")} />
                Refresh
            </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all",
                isActive 
                  ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <Icon className={clsx("w-4 h-4", isActive ? tab.color : "text-slate-400")} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-500" />
                {visibleTabs.find(t => t.id === activeTab)?.label} Settings
              </h3>
              <Badge variant="outline" className="text-[10px] uppercase">Encrypted Storage</Badge>
            </div>
            
            <div className="p-4 space-y-3">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                  <p className="text-sm font-medium">Loading secure parameters...</p>
                </div>
              ) : filteredSettings.length > 0 ? (
                filteredSettings.map(item => (
                  <SecureSettingRow 
                    key={item.key} 
                    item={item} 
                    onUpdate={handleUpdate}
                    onReveal={handleReveal}
                  />
                ))
              ) : (
                <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-sm text-slate-500">No settings found for this group.</p>
                  <Button variant="secondary" size="sm" className="mt-4" onClick={() => handleUpdate(`NEW_${activeTab.toUpperCase()}_KEY`, 'CHANGE_ME', activeTab.toUpperCase())}>
                    Initialize First Key
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {activeTab === 'mpesa' && (
            <div className="space-y-5">

              {/* ── Environment Toggle ── */}
              <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">Environment</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Current: <span className={`font-bold ${currentEnvironment === 'production' ? 'text-red-600' : 'text-amber-600'}`}>
                        {currentEnvironment === 'production' ? 'PRODUCTION (Live Money)' : 'SANDBOX (Test Mode)'}
                      </span>
                    </p>
                  </div>
                  {/* Status dot */}
                  <div className={`w-3 h-3 rounded-full ${currentEnvironment === 'production' ? 'bg-red-500 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={async () => {
                      await handleUpdate('mpesa_environment', 'sandbox', 'mpesa');
                      toast.success('Switched to Sandbox mode');
                    }}
                    className={`flex-1 group relative overflow-hidden py-4 rounded-xl text-sm font-bold transition-all duration-300 border-2 ${
                      currentEnvironment === 'sandbox'
                        ? 'bg-amber-500 border-amber-500 text-white shadow-[0_8px_20px_-6px_rgba(245,158,11,0.5)] scale-[1.02]'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-500/5'
                    }`}
                  >
                    <div className="relative z-10 flex flex-col items-center">
                      <span className="flex items-center gap-2">
                        {currentEnvironment === 'sandbox' && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                        Sandbox
                      </span>
                      <p className={`text-[10px] font-medium mt-0.5 transition-colors ${currentEnvironment === 'sandbox' ? 'text-amber-100' : 'text-slate-400'}`}>
                        Safe Development Mode
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm('⚠️ You are switching to PRODUCTION mode. Real money will be used. Are you absolutely sure?')) return;
                      await handleUpdate('mpesa_environment', 'production', 'mpesa');
                      toast.success('Switched to Production mode');
                    }}
                    className={`flex-1 group relative overflow-hidden py-4 rounded-xl text-sm font-bold transition-all duration-300 border-2 ${
                      currentEnvironment === 'production'
                        ? 'bg-red-600 border-red-600 text-white shadow-[0_8px_25px_-6px_rgba(220,38,38,0.5)] scale-[1.02]'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-500/50 hover:bg-red-50/50 dark:hover:bg-red-500/5'
                    }`}
                  >
                    <div className="relative z-10 flex flex-col items-center">
                      <span className="flex items-center gap-2">
                        {currentEnvironment === 'production' && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                        Production
                      </span>
                      <p className={`text-[10px] font-medium mt-0.5 transition-colors ${currentEnvironment === 'production' ? 'text-red-100' : 'text-slate-400'}`}>
                        Live Financial Operations
                      </p>
                    </div>
                  </button>
                </div>
                {currentEnvironment === 'production' && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg">
                    <p className="text-xs font-bold text-red-700 dark:text-red-400">
                      ⚠️ PRODUCTION MODE ACTIVE — Every disbursement sends real money via M-Pesa. Double-check all credentials before disbursing any loan.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Shortcode Type ── */}
              <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700">
                <div className="mb-4">
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm">Shortcode Type</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Current: <span className="font-bold text-indigo-600 capitalize">{currentShortcodeType}</span>
                    {currentShortcodeType === 'paybill' && ' — Customers enter account reference (National ID). Recommended.'}
                    {currentShortcodeType === 'till' && ' — Customers send money directly. No account reference.'}
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={async () => {
                      await handleUpdate('mpesa_shortcode_type', 'paybill', 'mpesa');
                      toast.success('Shortcode type set to Paybill');
                    }}
                    className={`flex-1 group relative py-4 rounded-xl text-sm font-bold transition-all duration-300 border-2 ${
                      currentShortcodeType === 'paybill'
                        ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-slate-800 dark:border-white shadow-[0_8px_20px_-6px_rgba(30,41,59,0.4)] scale-[1.01]'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span>Paybill</span>
                      <p className={`text-[10px] font-medium mt-0.5 truncate w-full px-2 transition-colors ${currentShortcodeType === 'paybill' ? 'opacity-80' : 'text-slate-400'}`}>
                        With Account Ref
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={async () => {
                      await handleUpdate('mpesa_shortcode_type', 'till', 'mpesa');
                      toast.success('Shortcode type set to Till');
                    }}
                    className={`flex-1 group relative py-4 rounded-xl text-sm font-bold transition-all duration-300 border-2 ${
                      currentShortcodeType === 'till'
                        ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-slate-800 dark:border-white shadow-[0_8px_20px_-6px_rgba(30,41,59,0.4)] scale-[1.01]'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span>Buy Goods (Till)</span>
                      <p className={`text-[10px] font-medium mt-0.5 truncate w-full px-2 transition-colors ${currentShortcodeType === 'till' ? 'opacity-80' : 'text-slate-400'}`}>
                        Direct Payment
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* ── Credential Fields ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'mpesa_consumer_key',    label: 'Consumer Key',         placeholder: 'From Daraja portal → My Apps', sensitive: true  },
                  { key: 'mpesa_consumer_secret', label: 'Consumer Secret',      placeholder: 'From Daraja portal → My Apps', sensitive: true  },
                  { key: 'mpesa_shortcode',       label: 'Shortcode',            placeholder: 'Sandbox: 174379',              sensitive: false },
                  { key: 'mpesa_passkey',         label: 'Passkey',              placeholder: 'From Daraja portal',           sensitive: true  },
                  { key: 'mpesa_b2c_initiator',   label: 'B2C Initiator Name',   placeholder: 'Sandbox: testapi',             sensitive: false },
                  { key: 'mpesa_b2c_credential',  label: 'B2C Security Credential', placeholder: 'From Daraja portal',        sensitive: true  },
                ].map(field => (
                  <CredentialField
                    key={field.key}
                    fieldKey={field.key}
                    label={field.label}
                    placeholder={field.placeholder}
                    sensitive={field.sensitive}
                    currentValue={secureSettings.find(s => s.key === field.key)?.encrypted_value || ''}
                    onSave={(val) => handleUpdate(field.key, val, 'mpesa')}
                    onReveal={() => handleReveal(field.key)}
                  />
                ))}

                {/* Callback URL — full width */}
                <div className="md:col-span-2">
                  <CredentialField
                    fieldKey="mpesa_callback_url"
                    label="Callback URL"
                    placeholder="https://your-backend.onrender.com/api/payments/mpesa-callback/"
                    sensitive={false}
                    currentValue={secureSettings.find(s => s.key === 'mpesa_callback_url')?.encrypted_value || ''}
                    onSave={(val) => handleUpdate('mpesa_callback_url', val, 'mpesa')}
                    onReveal={() => handleReveal('mpesa_callback_url')}
                  />
                </div>
              </div>

              {/* ── Test Connection ── */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-xl flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h4 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">Test Connection</h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Calls Safaricom {currentEnvironment} API to verify your credentials work
                  </p>
                </div>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={testMpesa}
                  disabled={testLoading}
                >
                  {testLoading
                    ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Testing...</>
                    : <><Activity className="w-4 h-4 mr-2" />Test M-Pesa Connection</>
                  }
                </Button>
              </div>

            </div>
          )}

          {activeTab === 'sms' && (
            <div className="space-y-4">
              {[
                { key: 'sms_provider',  label: 'SMS Provider',  placeholder: "e.g. Africa's Talking or Brevo", sensitive: false },
                { key: 'sms_api_key',   label: 'API Key',        placeholder: 'Your SMS provider API key',      sensitive: true  },
                { key: 'sms_sender_id', label: 'Sender ID',      placeholder: 'e.g. AZARIAH',                  sensitive: false },
              ].map(field => (
                <CredentialField
                  key={field.key}
                  fieldKey={field.key}
                  label={field.label}
                  placeholder={field.placeholder}
                  sensitive={field.sensitive}
                  currentValue={secureSettings.find(s => s.key === field.key)?.encrypted_value || ''}
                  onSave={(val) => handleUpdate(field.key, val, 'sms')}
                  onReveal={() => handleReveal(field.key)}
                />
              ))}

              {/* Test SMS */}
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 rounded-xl">
                <h4 className="font-bold text-indigo-800 dark:text-indigo-300 text-sm mb-3">Send Test SMS</h4>
                <div className="flex gap-3">
                  <input
                    type="text"
                    id="test-sms-phone"
                    placeholder="Phone number e.g. 0712345678"
                    className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800"
                  />
                  <Button onClick={testSMS} disabled={testLoading}>
                    {testLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send Test'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <Card className="bg-orange-50/50 dark:bg-orange-900/5 border-orange-100 dark:border-orange-900/20">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white">Scheduled Maintenance</h4>
                        <p className="text-xs text-slate-500">Configure system-wide maintenance windows</p>
                      </div>
                    </div>
                    <Badge variant={isMaintenanceActive ? "solid" : "outline"} className={isMaintenanceActive ? "bg-orange-500 text-white" : "border-orange-200 text-orange-600"}>
                      {isMaintenanceActive ? "Policy: ACTIVE" : "Policy: INACTIVE"}
                    </Badge>
                  </div>

                  <form onSubmit={handleMaintenanceSchedule} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Scheduled Date
                        </label>
                        <input 
                          type="date"
                          className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
                          value={maintenanceDate}
                          onChange={(e) => setMaintenanceDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Scheduled Time
                        </label>
                        <input 
                          type="time"
                          className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
                          value={maintenanceTime}
                          onChange={(e) => setMaintenanceTime(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-orange-100 dark:border-orange-900/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          "w-10 h-5 rounded-full relative cursor-pointer transition-colors",
                          isMaintenanceActive ? "bg-orange-500" : "bg-slate-300"
                        )} onClick={() => setIsMaintenanceActive(!isMaintenanceActive)}>
                          <div className={clsx(
                            "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform",
                            isMaintenanceActive ? "translate-x-5.5" : "translate-x-0.5"
                          )} />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Enable Maintenance Window</span>
                      </div>
                      <Button type="submit" disabled={scheduling} className="bg-orange-600 hover:bg-orange-700">
                        {scheduling ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Apply Policy
                      </Button>
                    </div>
                  </form>
                </div>
              </Card>

              <Card className="border-indigo-100 dark:border-indigo-900/20 bg-indigo-50/20 dark:bg-indigo-900/5">
                <div className="p-5 flex gap-4">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl h-fit text-indigo-600">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 dark:text-white">Maintenance Best Practices</h4>
                    <ul className="space-y-2">
                       <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                         <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                         <b>Night/Weekends:</b> Maintenance should preferably be scheduled during low-traffic periods like weekends (Saturday night onwards) or late nights (11 PM - 4 AM).
                       </li>
                       <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                         <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                         <b>Auto Log-out:</b> When the scheduled time is reached, the system will automatically terminate all active sessions (excluding Owner accounts) and prevent new logins until maintenance is disabled.
                       </li>
                       <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                         <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                         <b>Notification:</b> SMS and Email alerts will be sent to all active users 15 minutes before the maintenance window begins.
                       </li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-orange-500" />
                Security Guide
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-3">
                <div className="w-1.5 h-auto bg-indigo-500 rounded-full" />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <b>Encryption:</b> Every value in these tabs is encrypted using AES-256 before being saved to the database.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-1.5 h-auto bg-emerald-500 rounded-full" />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <b>Masking:</b> Sensitive fields like Phone numbers and National IDs are masked for all users except Super Admins who explicitly reveal them.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-1.5 h-auto bg-orange-500 rounded-full" />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <b>IP Binding:</b> JWT tokens are now cryptographically bound to your login IP. Accessing from a different IP will invalidate the session.
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900 text-white border-none">
            <div className="p-6">
              <h4 className="font-bold flex items-center gap-2 mb-2">
                <UserCheck className="w-5 h-5 text-indigo-400" />
                Access Control
              </h4>
              <p className="text-xs text-slate-400 mb-6">Your current session is hardened with multi-factor audit logging.</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 bg-slate-800 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Device Verify</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[10px]">VERIFIED</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Rate Limiting</span>
                  <Badge className="bg-blue-500/20 text-blue-400 border-none text-[10px]">ENFORCED</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Audit Logs</span>
                  <Badge className="bg-indigo-500/20 text-indigo-400 border-none text-[10px]">RECORDING</Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
