import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Crown, LayoutDashboard, ClipboardList, Shield,
  Users, Settings, Zap, LogOut, Menu, X,
  ChevronDown, ShieldCheck, Building2, Users2,
  FileText, Bell, Wallet, MessageSquare, Sliders, Lock, Mail
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CollapsableSection from '../../components/layout/CollapsableSection';
import HelpGuide from '../../components/ui/HelpGuide';
import { useHelpGuide } from '../../hooks/useHelpGuide';
import { ownerGuide } from '../../data/guideContent';
import { HelpCircle } from 'lucide-react';

function cn(...inputs) { return twMerge(clsx(inputs)); }

const OwnerLayout = ({ children }) => {
  const { user, logout, switchActiveRole } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isOpen: guideOpen, openGuide, closeGuide } = useHelpGuide('owner');

  const handleGodModeSwitch = (role) => {
    switchActiveRole(role);
    if (role === 'ADMIN') navigate('/admin/dashboard');
    else if (role === 'MANAGER') navigate('/manager/dashboard');
    else if (role === 'FINANCIAL_OFFICER') navigate('/finance/overview');
    else if (role === 'FIELD_OFFICER') navigate('/field/dashboard');
  };

  const commandLinks = [
    { to: '/owner/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/owner/ownership', icon: Crown, label: 'Ownership' },
    { to: '/owner/communications', icon: Mail, label: 'Communications' },
    { to: '/owner/audit', icon: ClipboardList, label: 'Owner Audit' },
    { to: '/owner/security-logs', icon: Shield, label: 'Security Logs' },
  ];

  const officialsLinks = [
    { to: '/admin/super-admins', icon: ShieldCheck, label: 'Super Admins' },
    { to: '/admin/managers', icon: Building2, label: 'Managers' },
    { to: '/admin/officers', icon: Users2, label: 'Finance Officers' },
    { to: '/admin/field-officers', icon: Users2, label: 'Field Officers' },
    { to: '/admin/accounts', icon: Users, label: 'Admins' },
  ];

  const settingsLinks = [
    { to: '/admin/settings/mpesa', icon: Wallet, label: 'M-Pesa' },
    { to: '/admin/settings/sms', icon: MessageSquare, label: 'SMS' },
    { to: '/admin/settings/system', icon: Sliders, label: 'System' },
    { to: '/admin/settings/security', icon: Lock, label: 'Security' },
    { to: '/admin/settings/branches', icon: Building2, label: 'Branches' },
  ];

  const godModeViews = [
    { role: 'ADMIN', label: 'Admin View', icon: ShieldCheck },
    { role: 'MANAGER', label: 'Manager View', icon: Building2 },
    { role: 'FINANCIAL_OFFICER', label: 'Finance Officer View', icon: Wallet },
    { role: 'FIELD_OFFICER', label: 'Field Officer View', icon: Users2 },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-amber-100 dark:border-amber-900/20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Azariah Credit Ltd</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Owner</span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-4 overflow-y-auto space-y-1">

        {/* Command Center */}
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2 mt-1">Command Center</p>
        {commandLinks.map(link => (
          <NavLink key={link.to} to={link.to} onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => cn(
              "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
              isActive ? "bg-amber-50 text-amber-700 border border-amber-200" : "text-slate-600 hover:bg-slate-50"
            )}>
            <link.icon className="w-4 h-4 mr-3" />{link.label}
          </NavLink>
        ))}

        {/* Officials - collapsable */}
        <div className="pt-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">Staff</p>
          <CollapsableSection icon={Users} label="Officials" links={officialsLinks} setSidebarOpen={setSidebarOpen} activeClass="text-amber-700 bg-amber-50" />
        </div>

        {/* Settings - collapsable */}
        <div className="pt-1">
          <CollapsableSection icon={Settings} label="Settings" links={settingsLinks} setSidebarOpen={setSidebarOpen} activeClass="text-amber-700 bg-amber-50" defaultOpen={false} />
        </div>

        {/* God Mode - collapsable */}
        <div className="pt-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">God Mode</p>
          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-amber-600">Switch Dashboard View</span>
            </div>
            <div className="space-y-1">
              {godModeViews.map(view => (
                <button
                  key={view.role}
                  onClick={() => handleGodModeSwitch(view.role)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-amber-100 rounded-lg transition-colors text-left"
                >
                  <view.icon className="w-3.5 h-3.5 text-amber-500" />
                  {view.label}
                </button>
              ))}
            </div>
          </div>
        </div>

      </nav>

      {/* Help Guide Button */}
      <div className="px-4 pb-2">
        <button
          onClick={openGuide}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-dashed border-slate-200 dark:border-slate-700"
        >
          <HelpCircle className="w-4 h-4" />
          Help & Guide
        </button>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-xl p-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.full_name || 'Owner'}</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">System Owner</p>
            </div>
          </div>
          <button
            onClick={() => { if (window.confirm('Sign out?')) logout(); }}
            className="flex items-center w-full px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "w-64 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <HelpGuide
        isOpen={guideOpen}
        onClose={closeGuide}
        title={ownerGuide.title}
        sections={ownerGuide.sections}
        role={ownerGuide.role}
      />
      <div className="flex-1 flex flex-col lg:ml-64 min-w-0">
        {/* Top navbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800">
              <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500 hidden sm:block" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 hidden sm:block">Owner Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Notification Bell - Owner audit notifications */}
            <OwnerNotificationBell />
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-800">
              <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 hidden sm:block">{user?.full_name}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

// Notification Bell Component
const OwnerNotificationBell = () => {
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { loanService } = await import('../../api/api');
        const res = await loanService.api.get('/owner-notifications/');
        setUnread(res.data.unread_count || 0);
        setNotifications(res.data.notifications || []);
      } catch (e) {
        // Silently fail
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">Recent Activity</span>
            <NavLink to="/owner/audit" onClick={() => setOpen(false)} className="text-xs text-amber-600 font-bold hover:underline">
              View All
            </NavLink>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400 italic">No recent activity</div>
            ) : (
              notifications.map((n, i) => (
                <div key={i} className="p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <p className="text-xs text-slate-700 leading-relaxed">{n.action}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerLayout;
