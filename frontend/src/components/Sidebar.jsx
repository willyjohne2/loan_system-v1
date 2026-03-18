import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Wallet, 
  Settings, 
  LogOut, 
  Briefcase,
  TrendingUp,
  History,
  ShieldCheck,
  Zap,
  Building2,
  FileText,
  Clock,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

const SidebarItem = ({ to, icon: Icon, label, badge }) => (
  <NavLink
    to={to}
    className={({ isActive }) => cn(
      "flex items-center gap-4 px-6 py-4 transition-all duration-300 group border-r-4",
      isActive 
        ? "bg-emerald-50/80 border-emerald-600 text-emerald-700 font-black" 
        : "text-slate-400 border-transparent hover:bg-slate-50 hover:text-slate-600 font-bold"
    )}
  >
    <div className={cn(
      "p-2 rounded-xl transition-all duration-300",
      "group-hover:bg-white group-hover:shadow-sm"
    )}>
      <Icon className="w-5 h-5" />
    </div>
    <span className="flex-1 uppercase tracking-widest text-[10px]">{label}</span>
    {badge && (
      <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
        {badge}
      </span>
    )}
    <ChevronRight className={cn(
      "w-4 h-4 transition-transform duration-300",
      "group-hover:translate-x-1"
    )} />
  </NavLink>
);

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = {
    SUPER_ADMIN: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
      { to: '/branches', icon: Building2, label: 'Branches' },
      { to: '/users', icon: Users, label: 'User Control' },
      { to: '/loans', icon: Wallet, label: 'Credit Portfolio' },
      { to: '/audit-logs', icon: ShieldCheck, label: 'Security Logs' },
      { to: '/settings', icon: Settings, label: 'System Prefs' },
    ],
    ADMIN: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Master View' },
      { to: '/branches', icon: Building2, label: 'Branch Access' },
      { to: '/loans', icon: Wallet, label: 'All Portfolio' },
      { to: '/reports', icon: FileText, label: 'Intelligence' },
      { to: '/settings', icon: Settings, label: 'Admin Settings' },
    ],
    MANAGER: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Branch Hub' },
      { to: '/loans', icon: Wallet, label: 'Pipeline' },
      { to: '/repayments', icon: History, label: 'Collectibles' },
      { to: '/customers', icon: Users, label: 'Client Base' },
    ],
    FINANCIAL_OFFICER: [
      { to: '/dashboard', icon: ShieldCheck, label: 'Fin. Control' },
      { to: '/disbursements', icon: Zap, label: 'Pay Queue' },
      { to: '/ledger', icon: History, label: 'Master Ledger' },
      { to: '/capital', icon: Building2, label: 'Capitalization' },
      { to: '/analytics', icon: TrendingUp, label: 'Performance' },
    ],
    OFFICER: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Work Bench' },
      { to: '/customers/new', icon: Users, label: 'Client Onboarding' },
      { to: '/loans/new', icon: Wallet, label: 'Issue Loan' },
      { to: '/repayments', icon: Clock, label: 'My Repayments' },
      { to: '/drafts', icon: FileText, label: 'Saved Drafts' },
    ],
  };

  const roleMenus = menuItems[user?.role] || [];

  return (
    <aside className="w-72 bg-white h-screen border-r border-slate-100 flex flex-col sticky top-0 overflow-y-auto">
      <div className="p-8 pb-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100 transform rotate-3">
             <Briefcase className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tighter">FIN-SYSTEM</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise Core</p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-slate-400 font-black">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="font-black text-slate-800 truncate text-xs uppercase">{user?.full_name || 'System User'}</p>
                <p className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1">
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
           </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {roleMenus.map((item, i) => (
          <SidebarItem key={i} {...item} />
        ))}
      </nav>

      <div className="p-6 border-t border-slate-50">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-6 py-4 text-rose-500 font-black uppercase tracking-widest text-[10px] hover:bg-rose-50 rounded-2xl transition-all group"
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>Terminate Session</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
