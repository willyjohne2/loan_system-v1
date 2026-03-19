import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ShieldCheck, RefreshCw, Eye, EyeOff, Save, CheckCircle2, XCircle } from 'lucide-react';
import { Card, Button, Badge } from '../components/ui/Shared';
import { useAuth } from '../context/AuthContext';
import { loanService } from '../api/api';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

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
  const [secureSettings, setSecureSettings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSecureSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loanService.getSecureSettings();
      setSecureSettings(Array.isArray(data) ? data : (data?.results || []));
    } catch (err) { toast.error('Failed to load settings'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSecureSettings(); }, [fetchSecureSettings]);

  const handleUpdate = async (key, value, group) => {
    try {
      await loanService.updateSecureSetting(key, value, group.toUpperCase());
      toast.success('Updated');
      await fetchSecureSettings();
    } catch (err) { toast.error('Update failed'); }
  };

  const filtered = secureSettings.filter(s => s.setting_group === activeTab.toUpperCase());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black flex items-center gap-3"><ShieldCheck className="w-8 h-8 text-indigo-600" /> Admin Settings</h2>
        <Button variant="secondary" onClick={fetchSecureSettings} disabled={loading}><RefreshCw className={clsx("w-4 h-4 mr-2", loading && "animate-spin")} /> Refresh</Button>
      </div>
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
        {['mpesa', 'sms', 'maintenance'].map(id => (
          <button key={id} onClick={() => setActiveTab(id)} className={clsx("px-4 py-2 rounded-lg text-sm font-bold capitalize", activeTab === id ? "bg-white text-indigo-600 shadow" : "text-slate-500")}>{id}</button>
        ))}
      </div>
      <Card className="p-4">
        <div className="space-y-4">
          {loading ? <p>Loading...</p> : filtered.length > 0 ? (
            filtered.map(s => <CredentialField key={s.key} label={s.key.replace(/_/g, ' ')} sensitive={true} currentValue={s.encrypted_value} onSave={val => handleUpdate(s.key, val, s.setting_group)} onReveal={() => loanService.revealSecureSetting(s.key)} />)
          ) : <p>No settings for {activeTab}</p>}
        </div>
      </Card>
    </div>
  );
};
export default AdminSettings;
