import React from 'react';
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
  ChevronDown,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Briefcase,
  Mail,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout, activeRole, switchActiveRole } = useAuth();
  const navigate = useNavigate();

  const handleRoleSwitch = (role) => {
    switchActiveRole(role);
    if (role === 'ADMIN') navigate('/admin/dashboard');
    else if (role === 'MANAGER') navigate('/manager/dashboard');
    else if (role === 'FINANCIAL_OFFICER') navigate('/finance/dashboard');
    else if (role === 'FIELD_OFFICER') navigate('/field/dashboard');
    
    if (window.innerWidth < 1024) onClose();
  };

  const adminLinks = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/managers', icon: Building2, label: 'Managers' },
    { to: '/admin/officers', icon: Users2, label: 'Finance Officers' },
    { to: '/admin/customers', icon: Users, label: 'Customers' },
    { to: '/admin/customer-communicator', icon: MessageSquare, label: 'Customer Communicator' },
    { to: '/admin/official-communicator', icon: Mail, label: 'Official Communicator' },
  ];

  const managerLinks = [
    { to: '/manager/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/manager/officers', icon: Users2, label: 'Field Officers' },
    { to: '/manager/customers', icon: Users, label: 'Regional Customers' },
    { to: '/manager/customer-communicator', icon: MessageSquare, label: 'Customer Communicator' },
    { to: '/manager/official-communicator', icon: Mail, label: 'Official Communicator' },
  ];

  const officerLinks = [
    { to: '/finance/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/finance/reports', icon: FileText, label: 'Loan Reports' },
    { to: '/finance/customer-communicator', icon: MessageSquare, label: 'Customer Communicator' },
  ];

  const fieldLinks = [
    { to: '/field/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ];

  const links = activeRole === 'ADMIN' ? adminLinks : 
                activeRole === 'MANAGER' ? managerLinks : 
                activeRole === 'FINANCIAL_OFFICER' ? officerLinks :
                fieldLinks;

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

          {/* Role Switcher - ONLY FOR ADMINS */}
          {user?.role === 'ADMIN' && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-1">Privileged Access</p>
              <div className="relative group">
                <select 
                  value={activeRole}
                  onChange={(e) => handleRoleSwitch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/50 shadow-lg shadow-primary-500/20"
                >
                  <option value="ADMIN">God Mode: Admin</option>
                  <option value="MANAGER">View: Branch Manager</option>
                  <option value="FINANCIAL_OFFICER">View: Finance Officer</option>
                  <option value="FIELD_OFFICER">View: Field Officer</option>
                </select>
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-200" />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-primary-200 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto pt-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => {
                if (window.innerWidth < 1024) onClose();
              }}
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                isActive 
                  ? "bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400" 
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              <link.icon className="w-5 h-5 mr-3" />
              {link.label}
            </NavLink>
          ))}
        </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-xs">
              {user?.role?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.full_name || 'Staff Member'}</p>
              <p className="text-[10px] text-slate-500 truncate uppercase mt-0.5">{activeRole?.replace('_', ' ')}</p>
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
  </>
  );
};

export default Sidebar;
