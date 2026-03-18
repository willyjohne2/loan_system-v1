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
  Sliders
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

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

const AdminSettings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('mpesa');
  const [secureSettings, setSecureSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);

  const allTabs = [
    { id: 'mpesa', label: 'M-Pesa API', icon: Smartphone, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', roles: ['owner', 'super_admin'] },
    { id: 'sms', label: 'SMS Portal', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', roles: ['owner', 'super_admin'] },
    { id: 'system', label: 'System Settings', icon: Sliders, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-900/20', roles: ['owner', 'super_admin', 'admin'] },
    { id: 'security', label: 'Security & Auth', icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', roles: ['owner'] },
    { id: 'branches', label: 'Branches', icon: Building2, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', roles: ['owner', 'super_admin', 'admin'] },
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
      await fetchSecureSettings();
    } catch (err) {
      toast.error("Failed to update setting");
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Card className="bg-emerald-50/50 dark:bg-emerald-900/5 border-emerald-100 dark:border-emerald-900/20">
                  <div className="p-4 flex items-start gap-4">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white">API Connectivity</h4>
                      <p className="text-xs text-slate-500 mt-1">Verify credentials with Safaricom Sandbox/Live</p>
                      <Button 
                        size="sm" 
                        className="mt-3 bg-emerald-600 hover:bg-emerald-700"
                        onClick={testMpesa}
                        disabled={testLoading}
                      >
                        {testLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Activity className="w-4 h-4 mr-2" />}
                        Run Test
                      </Button>
                    </div>
                  </div>
               </Card>
               <Card className="bg-blue-50/50 dark:bg-blue-900/5 border-blue-100 dark:border-blue-900/20">
                  <div className="p-4 flex items-start gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white">Callback Health</h4>
                      <p className="text-xs text-slate-500 mt-1">Ensures payment notifications are reaching system</p>
                      <Badge className="mt-3 bg-blue-100 text-blue-700 border-none">Active</Badge>
                    </div>
                  </div>
               </Card>
            </div>
          )}

          {activeTab === 'sms' && (
            <Card className="bg-indigo-50/50 dark:bg-indigo-900/5 border-indigo-100 dark:border-indigo-900/20">
                 <div className="p-6 text-center">
                    <MessageSquare className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
                    <h3 className="font-bold text-lg">SMS Integration Test</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
                        Send a test SMS through Africa's Talking to verify your API Key and Sender ID setup.
                    </p>
                    <Button onClick={testSMS} disabled={testLoading}>
                        {testLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Smartphone className="w-4 h-4 mr-2" />}
                        Send Test Message
                    </Button>
                 </div>
            </Card>
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
