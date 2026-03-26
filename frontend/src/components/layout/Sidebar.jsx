import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  Wallet, 
  FileText, 
  Settings, 
  LogOut,
  Building2,
  Users2,
  MessageSquare,
  ChevronDown, Send, BarChart3,
  Search,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Briefcase,
  Mail,
  X,
  ChevronRight,
  ClipboardList,
  Lock,
  Crown,
  Sliders,
  AlertCircle,
  Upload
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { loanService } from '../../api/api';
import { useBackgroundPolling } from '../../hooks/useQueries';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CollapsableSection from './CollapsableSection';
import HelpGuide from '../ui/HelpGuide';
import { useHelpGuide } from '../../hooks/useHelpGuide';
import { 
  fieldOfficerGuide, managerGuide, 
  financeOfficerGuide, adminGuide 
} from '../../data/guideContent';
import { HelpCircle } from 'lucide-react';
import BranchSelectorModal from '../ui/BranchSelectorModal';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout, activeRole, switchActiveRole, activateActMode } = useAuth();
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetRole, setTargetRole] = useState('');

  useEffect(() => {
    if (user?.god_mode_enabled) {
      loanService.api.get('/branches/').then(res => setBranches(res.data.results || res.data));
    }
  }, [user]);

  const { threatCount, newRepaymentCount } = useBackgroundPolling(user, activeRole);
  const lastRepaymentCheck = useRef(localStorage.getItem('last_repayment_check') || new Date().toISOString());

  const getGuide = () => {
    if (activeRole === 'ADMIN' || activeRole === 'SUPER_ADMIN') return adminGuide;
    if (activeRole === 'MANAGER') return managerGuide;
    if (activeRole === 'FINANCIAL_OFFICER') return financeOfficerGuide;
    if (activeRole === 'FIELD_OFFICER') return fieldOfficerGuide;
    return adminGuide;
  };

  const currentGuide = getGuide();
  const { isOpen: guideOpen, openGuide, closeGuide } = useHelpGuide(activeRole || 'admin');

  const handleViewSwitch = (role) => {
    switchActiveRole(role);
    if (role === 'SUPER_ADMIN') navigate('/admin/dashboard');
    else if (role === 'ADMIN') navigate('/admin/dashboard');
    else if (role === 'MANAGER') navigate('/manager/dashboard');
    else if (role === 'FINANCIAL_OFFICER') navigate('/finance/overview');
    else if (role === 'FIELD_OFFICER') navigate('/field/dashboard');
    
    if (window.innerWidth < 1024) onClose();
  };

  const handleActSwitch = (role) => {
    if (!role) return;
    
    setTargetRole(role);
    setIsModalOpen(true);
  };

  const handleBranchSelect = (branch) => {
    switchActiveRole(targetRole, { branch_fk: branch.id, branch: branch.name });
    activateActMode(); // Automatically enable "Acting" mode when branch is selected
    navigateBasedOnRole(targetRole);
    setIsModalOpen(false);
    if (window.innerWidth < 1024) onClose();
  };

  const navigateBasedOnRole = (role) => {
    if (role === 'ADMIN') navigate('/admin/dashboard');
    else if (role === 'MANAGER') navigate('/manager/dashboard');
    else if (role === 'FINANCIAL_OFFICER') navigate('/finance/overview');
    else if (role === 'FIELD_OFFICER') navigate('/field/dashboard');
  };

  const isOwner = user?.is_owner || user?.role === 'OWNER';
  const isSuperAdmin = activeRole === 'SUPER_ADMIN' || user?.is_super_admin;

  const superAdminLinks = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { to: '/admin/customers', icon: Users, label: 'All Customers' },
    { to: '/admin/loans', icon: Wallet, label: 'All Loans' },
  ];

  const adminLinks = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { to: '/admin/customers', icon: Users, label: 'Customers' },
    { to: '/admin/loans', icon: Wallet, label: 'Loans' },
  ];

  const managerLinks = [
    { to: '/manager/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/manager/officers', icon: Users2, label: 'Field Officers' },
    { to: '/manager/customers', icon: Users, label: 'Regional Customers' },
    { to: '/manager/customer-communicator', icon: MessageSquare, label: 'Customer Comms' },
    { to: '/manager/official-communicator', icon: Mail, label: 'Official Comms' },
  ];

  const financeLinks = [
    { to: '/finance/overview', icon: LayoutDashboard, label: 'Overview' },
    { to: '/finance/loans', icon: Briefcase, label: 'Global Portfolio' },
    { to: '/finance/disbursement', icon: Send, label: 'Disbursement Queue' },
    { to: '/finance/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/finance/ledger', icon: FileText, label: 'Ledger' },
    { to: '/finance/unmatched', icon: AlertCircle, label: 'Unmatched Payments', badge: true },
    { to: '/finance/upload', icon: Upload, label: 'Upload Statement' },
    { to: '/finance/reports', icon: ClipboardList, label: 'Reports' },
    { to: '/finance/control', icon: Settings, label: 'Financial Control' },
    { to: '/finance/customer-communicator', icon: MessageSquare, label: 'Customer Comms' },
  ];

  const fieldLinks = [
    { to: '/field/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/field/verification', icon: ClipboardList, label: 'Verification Queue' },
    { to: '/field/inquiry', icon: Search, label: 'Customer Inquiry' },
    { to: '/field/portfolio', icon: Wallet, label: 'My Portfolio' },
  ];

  const getActiveLinks = () => {
    if (activeRole === 'SUPER_ADMIN' || user?.is_owner) return superAdminLinks;
    if (activeRole === 'ADMIN') return adminLinks;
    if (activeRole === 'MANAGER') return managerLinks;
    if (activeRole === 'FINANCIAL_OFFICER') return financeLinks;
    if (activeRole === 'FIELD_OFFICER') return fieldLinks;
    return [];
  };

  const baseLinks = getActiveLinks();

  return (
    <>
      {/* Mobile/Tablet Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 xl:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "w-64 h-screen bg-white border-r border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex flex-col fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out shadow-2xl xl:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black text-primary-600 dark:text-primary-400 tracking-tighter leading-tight">Azariah Credit Ltd</h1>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-95 group"
              title="Close Menu"
            >
              <X className="w-5 h-5 text-slate-500 group-hover:rotate-90 transition-transform" />
            </button>
          </div>

          {/* Role Switcher - ONLY FOR OWNERS with God Mode */}
          {user?.is_owner && user?.god_mode_enabled && (
            <div className="mt-2 space-y-1">
              <div className="mx-0 mb-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                <Zap className="w-3 h-3 text-amber-500" />
                <span className="text-xs font-bold text-amber-600">
                  {user?.is_primary_owner ? "👑 Primary Owner" : "👑 Owner"}
                </span>
              </div>
              
              <div className="flex items-center justify-between px-2 mb-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Privileged Access
                </p>
                <span className="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                  <Zap className="w-2.5 h-2.5 fill-current" />
                  GOD MODE
                </span>
              </div>
              
              <div className="space-y-4 pt-1">
                {/* View Mode */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 px-2">
                    <BarChart3 className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">View Mode</span>
                  </div>
                  <div className="relative group px-1">
                    <select
                      value={activeRole}
                      onChange={(e) => handleViewSwitch(e.target.value)}
                      className="w-full pl-3 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                    >
                      <option value="ADMIN">Admin Dashboard</option>
                      <option value="SUPER_ADMIN">Super Admin Dashboard</option>
                      <option value="MANAGER">Manager Dashboard</option>
                      <option value="FINANCIAL_OFFICER">Finance Officer Dashboard</option>
                      <option value="FIELD_OFFICER">Field Officer Dashboard</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Act As Mode */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 px-2">
                    <Users2 className="w-3 h-3 text-primary-500" />
                    <span className="text-[10px] font-bold text-primary-600 uppercase">Act As (Masked)</span>
                  </div>

                  <div className="relative group px-1">
                    <select
                      onChange={(e) => handleActSwitch(e.target.value)}
                      className="w-full pl-3 pr-4 py-2 bg-primary-600 dark:bg-primary-700 text-white rounded-lg text-[11px] font-bold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/20 shadow-sm border-none transition-all hover:bg-primary-700"
                    >
                      <option value="">Choose role...</option>
                      <option value="ADMIN">Admin Dashboard</option>
                      <option value="MANAGER">Manager Dashboard</option>
                      <option value="FINANCIAL_OFFICER">Finance Officer Dashboard</option>
                      <option value="FIELD_OFFICER">Field Officer Dashboard</option>
                    </select>
                    <ShieldCheck className="absolute right-8 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary-200" />
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-primary-100 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto pt-2 custom-scrollbar">
          {/* Main Navigation Links */}
          {baseLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => {
                if (window.innerWidth < 1024) onClose();
                if (link.badge) {
                  localStorage.setItem('last_repayment_check', new Date().toISOString());
                }
              }}
              className={({ isActive }) => cn(
                "flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors justify-between",
                isActive 
                  ? "bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-bold" 
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              <div className="flex items-center">
                <link.icon className="w-4 h-4 mr-3" />
                {link.label}
              </div>
              {link.badge && newRepaymentCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {newRepaymentCount > 99 ? '99+' : newRepaymentCount}
                </span>
              )}
              {link.threatBadge && threatCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {threatCount > 99 ? '99+' : threatCount}
                </span>
              )}
            </NavLink>
          ))}
          
          {(activeRole === 'ADMIN' || isSuperAdmin || isOwner) && (activeRole !== 'MANAGER' && activeRole !== 'FINANCIAL_OFFICER' && activeRole !== 'FIELD_OFFICER') && (
            <div className="pt-2 space-y-1">
              {/* Staff Management Section */}
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-1 mt-2">Staff Control</p>
              <CollapsableSection 
                icon={Users} 
                label="Officials" 
                setSidebarOpen={(val) => { if (!val && window.innerWidth < 1024) onClose(); }}
                activeClass="bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-bold"
                links={[
                  { to: '/admin/field-officers', label: 'Field Officers', icon: Users2 },
                  { to: '/admin/managers', label: 'Managers', icon: Building2 },
                  ...((isOwner || isSuperAdmin) ? [{ to: '/admin/finance-officers', label: 'Finance Officers', icon: Briefcase }] : []),
                  ...((isOwner || isSuperAdmin) ? [{ to: '/admin/accounts', label: 'Admins', icon: ShieldCheck }] : []),
                  ...(isOwner ? [{ to: '/admin/super-admins', label: 'Super Admins', icon: ShieldCheck }] : []),
                ]}
              />

              {/* Communication Section */}
              <div className="pt-1">
                <CollapsableSection 
                  icon={Mail} 
                  label="Comms" 
                  setSidebarOpen={(val) => { if (!val && window.innerWidth < 1024) onClose(); }}
                  activeClass="bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-bold"
                  links={[
                    { to: '/admin/customer-communicator', icon: MessageSquare, label: 'Customer' },
                    { to: '/admin/official-communicator', icon: Mail, label: 'Official' },
                  ]}
                />
              </div>

              {/* Security & System Section */}
              <div className="pt-1">
                <CollapsableSection 
                  icon={ShieldAlert} 
                  label="System Intel" 
                  setSidebarOpen={(val) => { if (!val && window.innerWidth < 1024) onClose(); }}
                  activeClass="bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-bold"
                  links={[
                    ...((isOwner || isSuperAdmin) ? [
                      { to: '/admin/security-logs', icon: ShieldAlert, label: 'Security Logs' }
                    ] : []),
                    ...((isOwner || isSuperAdmin) ? [{ to: '/admin/security-threats', icon: ShieldAlert, label: 'Security Threats', threatBadge: true }] : []),
                    ...((isOwner || isSuperAdmin) ? [{ to: '/admin/owner-audit', icon: Crown, label: 'Owner Audit' }] : []),
                    { to: '/admin/audit', icon: ClipboardList, label: 'Audit Logs' },
                    { to: '/admin/deactivations', icon: Lock, label: 'Security Requests' },
                  ]}
                />
              </div>

              {/* Settings Section */}
              <div className="pt-1">
                <CollapsableSection 
                    icon={Settings} 
                    label="Settings" 
                    setSidebarOpen={(val) => { if (!val && window.innerWidth < 1024) onClose(); }}
                    activeClass="bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-bold"
                    links={[
                        ...((isOwner || isSuperAdmin) ? [
                            { to: '/admin/settings/mpesa', icon: Wallet, label: 'M-Pesa Config' },
                            { to: '/admin/settings/sms', icon: MessageSquare, label: 'SMS Gateway' },
                        ] : []),
                        { to: '/admin/settings/system', icon: Sliders, label: 'System Logic' },
                        ...(isOwner ? [{ to: '/admin/settings/security', icon: Lock, label: 'Access Control' }] : []),
                        { to: '/admin/settings/branches', icon: Building2, label: 'Branch Network' },
                    ]}
                />
              </div>
            </div>
          )}
        </nav>

        {/* Support & Quick Stats Section */}
        <div className="px-4 pb-2 pt-2 space-y-2">
          <button
            onClick={openGuide}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-dashed border-slate-200 dark:border-slate-700"
          >
            <HelpCircle className="w-4 h-4" />
            Help & Guide
          </button>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
            <div className="flex items-center gap-3 mb-3 text-left">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-xs uppercase">
                {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.full_name || 'Staff'}</p>
                <p className="text-[10px] text-slate-500 truncate uppercase mt-0.5">{activeRole?.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to sign out?')) {
                  logout();
                }
              }}
              className="flex items-center w-full px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors border border-transparent hover:border-red-100"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out System
            </button>
          </div>
        </div>
      </aside>

      <HelpGuide
        isOpen={guideOpen}
        onClose={closeGuide}
        title={currentGuide.title}
        sections={currentGuide.sections}
        role={currentGuide.role}
      />

      <BranchSelectorModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        branches={branches}
        role={targetRole}
        onSelect={handleBranchSelect}
      />
    </>
  );
};

export default Sidebar;
