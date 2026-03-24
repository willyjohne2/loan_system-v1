import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Wallet, 
  MessageSquare, 
  Building2, 
  Sliders, 
  Lock, 
  FileText, 
  Bell, 
  Menu, 
  X,
  LayoutDashboard,
  Users2,
  Briefcase,
  History,
  Zap,
  HelpCircle,
  ChevronDown,
  LogOut,
  Settings,
  ShieldAlert,
  Search,
  Plus,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Target,
  ClipboardList,
  BarChart3
} from 'lucide-react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loanService } from '../../api/api';
import { cn } from '../../utils/cn';
import { toast } from 'react-hot-toast';
import BranchSelectorModal from '../../components/ui/BranchSelectorModal';
import Navbar from '../../components/layout/Navbar';

// Required for the sidebar links
const Crown = ({ className }) => <ShieldCheck className={className} />;

const officialsLinks = [
  { to: '/owner/super-admins',     icon: ShieldCheck, label: 'Super Admins' },
  { to: '/owner/accounts',         icon: Users,       label: 'Admins' },
  { to: '/owner/managers',         icon: Building2,   label: 'Managers' },
  { to: '/owner/finance-officers', icon: Users2,      label: 'Finance Officers' },
  { to: '/owner/field-officers',   icon: Users2,      label: 'Field Officers' },
];

const settingsLinks = [
  { to: '/owner/settings/mpesa',    icon: Wallet,        label: 'M-Pesa' },
  { to: '/owner/settings/sms',      icon: MessageSquare, label: 'SMS' },
  { to: '/owner/settings/system',   icon: Sliders,       label: 'System' },
  { to: '/owner/settings/security', icon: Lock,          label: 'Security' },
  { to: '/owner/settings/loans',    icon: Sliders,       label: 'Loan Products' },
];

const coreLinks = [
    { to: '/owner/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { to: '/owner/analytics', icon: TrendingUp, label: 'Analytics' },
    { to: '/owner/repayments', icon: CreditCard, label: 'Branch Repayments' },
    { to: '/owner/overdue', icon: ShieldAlert, label: 'Global Overdue' },
    { to: '/owner/staff-performance', icon: ClipboardList, label: 'Staff Leaderboard' },
    { to: '/owner/audit', icon: History, label: 'Operations Audit' },
    { to: '/owner/security-threats', icon: ShieldAlert, label: 'Security Threats', threatBadge: true },
    { to: '/owner/security-logs', icon: ShieldAlert, label: 'Security Logs' },
    { to: '/owner/communications', icon: MessageSquare, label: 'Official Comms' },
    { to: '/owner/ownership', icon: Crown, label: 'Ownership' }
];

const OwnerLayout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1280);
  const [isBusinessOpen, setIsBusinessOpen] = useState(true);
  const [isOfficialsOpen, setIsOfficialsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { logout, user, switchActiveRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [branches, setBranches] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetRole, setTargetRole] = useState('');

  useEffect(() => {
    if (user?.god_mode_enabled) {
      loanService.api.get('/branches/').then(res => setBranches(res.data.results || res.data));
    }
  }, [user]);

  const handleViewSwitch = (role) => {
    switchActiveRole(role);
    if (role === 'SUPER_ADMIN') navigate('/admin/dashboard');
    else if (role === 'ADMIN') navigate('/admin/dashboard');
    else if (role === 'MANAGER') navigate('/manager/dashboard');
    else if (role === 'FINANCIAL_OFFICER') navigate('/finance/overview');
    else if (role === 'FIELD_OFFICER') navigate('/field/dashboard');
  };

  const handleActSwitch = (role) => {
    if (role === 'FIELD_OFF_OFFICER' || role === 'MANAGER' || role === 'FIELD_OFFICER') {
      setTargetRole(role);
      setIsModalOpen(true);
      return;
    } 
    
    switchActiveRole(role);
    navigateBasedOnRole(role);
  };

  const handleBranchSelect = (branch) => {
    switchActiveRole(targetRole, { branch_fk: branch.id, branch: branch.name });
    navigateBasedOnRole(targetRole);
    setIsModalOpen(false);
  };

  const navigateBasedOnRole = (role) => {
    if (role === 'ADMIN') navigate('/admin/dashboard');
    else if (role === 'MANAGER') navigate('/manager/dashboard');
    else if (role === 'FINANCIAL_OFFICER') navigate('/finance/overview');
    else if (role === 'FIELD_OFFICER') navigate('/field/dashboard');
  };

  const [threatCount, setThreatCount] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await loanService.api.get('/security-threats/');
        setThreatCount(res.data?.summary?.total_threats || 0);
      } catch (e) {}
    };
    fetch();
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      logout();
      navigate('/login');
    }
  };

  const businessLinks = [
    { to: '/owner/settings/branches', icon: Building2, label: 'Branches' },
    { to: '/owner/customers', icon: Users, label: 'Customers' },
    { to: '/owner/loans', icon: Briefcase, label: 'Loans' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Sidebar for Owner */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 lg:static lg:translate-x-0",
        !isSidebarOpen && "-translate-x-full lg:hidden"
      )}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">OWNER</h1>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest mt-0.5">Control Center</p>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
             {/* God Mode Role Switcher - ONLY FOR OWNERS with God Mode */}
             {(user?.is_owner || user?.role === 'OWNER') && user?.god_mode_enabled && (
               <div className="px-4 mb-6 space-y-4 pt-2 border-b border-slate-100 dark:border-slate-800 pb-6">
                 <div className="flex items-center justify-between">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                     Privileged Access
                   </p>
                   <span className="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                     <Zap className="w-2.5 h-2.5 fill-current" />
                     GOD MODE
                   </span>
                 </div>

                 {/* View Mode */}
                 <div className="space-y-1.5">
                    <div className="flex items-center gap-2 px-1">
                      <BarChart3 className="w-3 h-3 text-slate-400" />
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">View Mode</span>
                    </div>
                    <div className="relative group">
                      <select
                        onChange={(e) => handleViewSwitch(e.target.value)}
                        className="w-full pl-3 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-bold appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      >
                        <option value="">Choose view...</option>
                        <option value="ADMIN">Admin Dashboard</option>
                        <option value="SUPER_ADMIN">Super Admin Dashboard</option>
                        <option value="MANAGER">Manager Dashboard</option>
                        <option value="FINANCIAL_OFFICER">Finance Officer Dashboard</option>
                        <option value="FIELD_OFFICER">Field Officer Dashboard</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                 </div>

                 {/* Act Mode */}
                 <div className="space-y-1.5">
                    <div className="flex items-center gap-2 px-1">
                      <Users2 className="w-3 h-3 text-indigo-500" />
                      <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">Act As (Masked)</span>
                    </div>

                    <div className="relative group">
                      <select
                        onChange={(e) => handleActSwitch(e.target.value)}
                        className="w-full pl-3 pr-4 py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded-xl text-[11px] font-bold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all hover:bg-indigo-700"
                      >
                        <option value="">Choose role...</option>
                        <option value="ADMIN">Admin Dashboard</option>
                        <option value="MANAGER">Manager Dashboard</option>
                        <option value="FINANCIAL_OFFICER">Finance Officer Dashboard</option>
                        <option value="FIELD_OFFICER">Field Officer Dashboard</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-indigo-100 pointer-events-none" />
                    </div>
                 </div>

                 {user?.is_primary_owner && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg">
                      <Crown className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Primary Owner</span>
                    </div>
                 )}
               </div>
             )}

             {/* Core */}
             <div>
                <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Core Engine</p>
                <div className="space-y-1">
                    {coreLinks.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                                isActive 
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                        >
                            {({ isActive }) => (
                                <>
                                    <link.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />
                                    <span className="flex-1">{link.label}</span>
                                    {link.threatBadge && threatCount > 0 && (
                                        <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                            {threatCount > 99 ? '99+' : threatCount}
                                        </span>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
             </div>

             {/* Business Operations Collapsible */}
             <div className="space-y-1">
                <button 
                  onClick={() => setIsBusinessOpen(!isBusinessOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                >
                  <span>Business Operations</span>
                  <ChevronDown className={cn("w-3 h-3 transition-transform", isBusinessOpen ? "rotate-180" : "rotate-0")} />
                </button>
                
                {isBusinessOpen && (
                  <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                    {businessLinks.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                isActive 
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                        >
                            <link.icon className="w-5 h-5" />
                            {link.label}
                        </NavLink>
                    ))}
                  </div>
                )}
             </div>

             {/* Officials Collapsible */}
             <div className="space-y-1">
                <button 
                  onClick={() => setIsOfficialsOpen(!isOfficialsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                >
                  <span>Personnel Management</span>
                  <ChevronDown className={cn("w-3 h-3 transition-transform", isOfficialsOpen ? "rotate-180" : "rotate-0")} />
                </button>

                {isOfficialsOpen && (
                  <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                    {officialsLinks.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                isActive 
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                        >
                            <link.icon className="w-5 h-5" />
                            {link.label}
                        </NavLink>
                    ))}
                  </div>
                )}
             </div>

             {/* Settings Collapsible */}
             <div className="space-y-1">
                <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                >
                  <span>Infrastructure Control</span>
                  <ChevronDown className={cn("w-3 h-3 transition-transform", isSettingsOpen ? "rotate-180" : "rotate-0")} />
                </button>

                {isSettingsOpen && (
                  <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                    {settingsLinks.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                isActive 
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                        >
                            <link.icon className="w-5 h-5" />
                            {link.label}
                        </NavLink>
                    ))}
                  </div>
                )}
             </div>
          </div>

          {/* User Profile Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
             <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {user?.full_name?.charAt(0) || 'O'}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.full_name}</p>
                            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">Owner Account</p>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out Center
                </button>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <Navbar 
            title="Owner Dashboard" 
            onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
        />

        <main className="flex-1 overflow-y-auto no-scrollbar">
          <div className="max-w-[1600px] mx-auto p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
      <BranchSelectorModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        branches={branches}
        role={targetRole}
        onSelect={handleBranchSelect}
      />
    </div>
  );
};

export default OwnerLayout;
