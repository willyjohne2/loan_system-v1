import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  Users, 
  UserPlus, 
  ShieldAlert, 
  ShieldCheck, 
  History,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Lock,
  Loader2
} from 'lucide-react';
import { loanService } from '../../api/api';
import { Card, Button, Badge } from '../../components/ui/Shared';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const OwnershipPage = () => {
  const { user } = useAuth();
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('grant'); // 'grant' or 'handover'
  const [subTab, setSubTab] = useState('existing'); // 'existing' or 'new'
  
  // Grant/Handover State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [newAccount, setNewAccount] = useState({ full_name: '', email: '', password: '', confirm_password: '' });
  
  // Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({ type: '', description: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await loanService.getOwnership();
      setOwners(data);
    } catch (e) {
      toast.error('Failed to load ownership data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const resp = await loanService.getAllAdmins();
      // Simple frontend filter for demo/initial implementation
      const filtered = resp.filter(s => 
        (s.full_name.toLowerCase().includes(query.toLowerCase()) || 
         s.email.toLowerCase().includes(query.toLowerCase())) &&
        !s.is_owner
      );
      setSearchResults(filtered.slice(0, 5));
    } catch (e) {
      console.error(e);
    }
  };

  const openConfirmModal = (type, description) => {
    setModalConfig({ type, description });
    setConfirmPassword('');
    setShowConfirmModal(true);
  };

  const handleAction = async () => {
    if (!confirmPassword) {
      toast.error('Please enter your password');
      return;
    }

    setSubmitting(true);
    try {
      let data = { confirm_password: confirmPassword };
      let response;

      if (modalConfig.type === 'relinquish') {
        response = await loanService.relinquishOwnership(data);
      } else if (modalConfig.type === 'grant') {
        data.type = subTab;
        if (subTab === 'existing') {
          data.target_admin_id = selectedStaff.id;
        } else {
          data.full_name = newAccount.full_name;
          data.email = newAccount.email;
          data.password = newAccount.password;
        }
        response = await loanService.grantOwnership(data);
      } else if (modalConfig.type === 'handover') {
        data.type = subTab;
        if (subTab === 'existing') {
          data.target_admin_id = selectedStaff.id;
        } else {
          data.full_name = newAccount.full_name;
          data.email = newAccount.email;
          data.password = newAccount.password;
        }
        response = await loanService.handoverOwnership(data);
      }

      toast.success(response.message || 'Action completed successfully');
      setShowConfirmModal(false);
      
      if (modalConfig.type === 'relinquish' || modalConfig.type === 'handover') {
        // Force logout or redirect since they are no longer owner
        window.location.href = '/dashboard';
      } else {
        fetchData();
        setSelectedStaff(null);
        setNewAccount({ full_name: '', email: '', password: '', confirm_password: '' });
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  const ownerCount = owners.length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center border border-amber-200 dark:border-amber-800/50">
            <Crown className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Ownership Management</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage system ownership and administrative hierarchy.</p>
          </div>
        </div>

        <div className={cn(
          "px-4 py-2 rounded-xl border flex items-center gap-2 font-bold text-sm",
          ownerCount >= 3 ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-400" 
                          : "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400"
        )}>
          <Users className="w-4 h-4" />
          {ownerCount}/3 Owners Allowed
        </div>
      </div>

      {/* Section 1: Current Owners Table */}
      <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
        <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Current System Owners</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b dark:border-slate-800">
                <th className="px-6 py-4 text-left">Owner</th>
                <th className="px-6 py-4 text-left">Hierarchy</th>
                <th className="px-6 py-4 text-left">Granted Since</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {owners.map(o => (
                <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs">
                        {o.full_name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {o.full_name}
                          {o.id === user.id && <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">You</span>}
                        </p>
                        <p className="text-xs text-slate-500">{o.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {o.is_primary_owner && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full text-[10px] font-black uppercase tracking-tight">
                          <Crown className="w-3 h-3" /> Primary
                        </span>
                      )}
                      {o.god_mode_enabled && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 rounded-full text-[10px] font-black uppercase tracking-tight">
                          <ShieldAlert className="w-3 h-3" /> God Mode
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-full text-[10px] font-black uppercase tracking-tight">
                        {o.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {o.ownership_granted_at ? new Date(o.ownership_granted_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Initial Setup'}
                    {o.ownership_granted_by_name && <p className="text-[10px] text-slate-400 italic">by {o.ownership_granted_by_name}</p>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {o.id === user.id ? (
                      <button 
                        onClick={() => openConfirmModal('relinquish', 'You are about to permanently remove yourself as an Owner of this system. This cannot be undone without another Owner granting you ownership again.')}
                        disabled={ownerCount <= 1}
                        className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:grayscale"
                        title={ownerCount <= 1 ? "You cannot relinquish while you are the only owner" : "Relinquish Ownership"}
                      >
                        Relinquish
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 uppercase italic">No Actions</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5" />
            Owners cannot be removed by other owners. Each owner can only relinquish their own ownership.
          </p>
        </div>
      </Card>

      {/* Section 2 & 3 Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* GRANT SECTION */}
        <Card className={cn(
          "border-2 transition-opacity",
          ownerCount >= 3 ? "opacity-50 border-slate-200 dark:border-slate-800" : "border-emerald-100 dark:border-emerald-900/30"
        )}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Grant Ownership</h2>
            </div>
            {ownerCount >= 3 && <Badge variant="warning">Limit Reached</Badge>}
          </div>

          <div className="p-6 space-y-6">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button 
                onClick={() => setSubTab('existing')}
                className={cn("flex-1 py-1.5 text-xs font-bold rounded-lg transition-all", subTab === 'existing' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Existing Staff
              </button>
              <button 
                onClick={() => setSubTab('new')}
                className={cn("flex-1 py-1.5 text-xs font-bold rounded-lg transition-all", subTab === 'new' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Create New
              </button>
            </div>

            {subTab === 'existing' ? (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search by name or email..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    disabled={ownerCount >= 3}
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                      {searchResults.map(s => (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedStaff(s); setSearchResults([]); setSearchQuery(''); }}
                          className="w-full p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{s.full_name}</p>
                            <p className="text-xs text-slate-500">{s.email}</p>
                          </div>
                          <Badge variant="info">{s.role}</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedStaff && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-xl animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Selected Manager</span>
                      </div>
                      <button onClick={() => setSelectedStaff(null)} className="text-emerald-700 hover:text-emerald-900"><XCircle className="w-4 h-4" /></button>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedStaff.full_name}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{selectedStaff.email} • {selectedStaff.role}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <input 
                  type="text" placeholder="Full Name" 
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={newAccount.full_name}
                  onChange={(e) => setNewAccount({...newAccount, full_name: e.target.value})}
                  disabled={ownerCount >= 3}
                />
                <input 
                  type="email" placeholder="Email Address" 
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={newAccount.email}
                  onChange={(e) => setNewAccount({...newAccount, email: e.target.value})}
                  disabled={ownerCount >= 3}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="password" placeholder="Password" 
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={newAccount.password}
                    onChange={(e) => setNewAccount({...newAccount, password: e.target.value})}
                    disabled={ownerCount >= 3}
                  />
                  <input 
                    type="password" placeholder="Confirm" 
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={newAccount.confirm_password}
                    onChange={(e) => setNewAccount({...newAccount, confirm_password: e.target.value})}
                    disabled={ownerCount >= 3}
                  />
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-xl">
              <p className="text-[10px] leading-relaxed text-amber-800 dark:text-amber-400 font-medium">
                <AlertTriangle className="w-3 h-3 inline mr-1 mb-0.5" />
                This person will gain full access to God Mode and can grant ownership to others. 
                {subTab === 'existing' ? " Their current role stays unchanged." : " Share credentials securely."}
              </p>
            </div>

            <Button 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              disabled={ownerCount >= 3 || (subTab === 'existing' ? !selectedStaff : !newAccount.full_name || !newAccount.email || !newAccount.password)}
              onClick={() => openConfirmModal('grant', `Grant full ownership status to ${subTab === 'existing' ? selectedStaff.full_name : newAccount.full_name}?`)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {subTab === 'existing' ? 'Grant Ownership' : 'Create Owner Account'}
            </Button>
          </div>
        </Card>

        {/* HANDOVER SECTION */}
        <Card className="border-2 border-red-100 dark:border-red-900/30 bg-red-50/10">
          <div className="p-4 border-b border-red-100 dark:border-red-900/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Full Handover</h2>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/20 rounded-xl">
              <p className="text-xs font-bold text-red-800 dark:text-red-400 mb-1">DANGER ZONE</p>
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                Transfer your ownership to someone else and permanently remove yourself as owner. Use this when selling the system or leaving the organization.
              </p>
            </div>

            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button 
                onClick={() => setSubTab('existing')}
                className={cn("flex-1 py-1.5 text-xs font-bold rounded-lg transition-all", subTab === 'existing' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Existing Staff
              </button>
              <button 
                onClick={() => setSubTab('new')}
                className={cn("flex-1 py-1.5 text-xs font-bold rounded-lg transition-all", subTab === 'new' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Create New
              </button>
            </div>

            {subTab === 'existing' ? (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search by name or email..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 outline-none"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                      {searchResults.map(s => (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedStaff(s); setSearchResults([]); setSearchQuery(''); }}
                          className="w-full p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{s.full_name}</p>
                            <p className="text-xs text-slate-500">{s.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedStaff && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 rounded-xl">
                    <p className="text-xs font-bold text-red-800 dark:text-red-400">Target for Handover</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedStaff.full_name}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <input 
                  type="text" placeholder="Full Name" 
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/20"
                  value={newAccount.full_name}
                  onChange={(e) => setNewAccount({...newAccount, full_name: e.target.value})}
                />
                <input 
                  type="email" placeholder="Email Address" 
                  className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none"
                  value={newAccount.email}
                  onChange={(e) => setNewAccount({...newAccount, email: e.target.value})}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input type="password" placeholder="Password" className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm" value={newAccount.password} onChange={(e) => setNewAccount({...newAccount, password: e.target.value})} />
                  <input type="password" placeholder="Confirm" className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm" value={newAccount.confirm_password} onChange={(e) => setNewAccount({...newAccount, confirm_password: e.target.value})} />
                </div>
              </div>
            )}

            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
              <p className="text-[10px] leading-relaxed text-red-900 dark:text-red-300 font-black uppercase">
                Warning: You will lose ALL access immediately after this action.
              </p>
            </div>

            <Button 
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold"
              disabled={subTab === 'existing' ? !selectedStaff : !newAccount.full_name || !newAccount.email}
              onClick={() => openConfirmModal('handover', `Permanently transfer ALL your ownership rights to ${subTab === 'existing' ? selectedStaff.full_name : newAccount.full_name}? You will be signed out immediately.`)}
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Initiate Handover
            </Button>
          </div>
        </Card>
      </div>

      {/* Audit History Hint */}
      <div className="flex items-center justify-center py-4 border-t border-slate-200 dark:border-slate-800">
        <button 
          onClick={() => window.location.href = '/owner/audit'}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-amber-600 transition-colors"
        >
          <History className="w-4 h-4" />
          View Detailed Ownership Audit History
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-600 mb-2">
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Confirm Security Action</h3>
              </div>
              
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/20 rounded-xl">
                <p className="text-xs font-bold text-red-800 dark:text-red-400 mb-1 leading-tight flex items-center gap-1.5 uppercase">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Your password is required
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed font-medium">
                  {modalConfig.description}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Confirm Identity</label>
                <input
                  type="password"
                  placeholder="Enter your current password"
                  autoFocus
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/30 transition-shadow"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !submitting && handleAction()}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  loading={submitting}
                  onClick={handleAction}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs"
                >
                  Authorize Action
                </Button>
                <button 
                  disabled={submitting}
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Internal CN helper since it was used in code
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default OwnershipPage;
