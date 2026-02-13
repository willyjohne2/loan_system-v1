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
  Briefcase
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
    { to: '/admin/sms-logs', icon: MessageSquare, label: 'Communicator' },
  ];

  const managerLinks = [
    { to: '/manager/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/manager/officers', icon: Users2, label: 'Field Officers' },
    { to: '/manager/customers', icon: Users, label: 'Regional Customers' },
    { to: '/manager/sms-logs', icon: MessageSquare, label: 'Communicator' },
  ];

  const officerLinks = [
    { to: '/finance/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/finance/reports', icon: FileText, label: 'Loan Reports' },
    { to: '/finance/sms-logs', icon: MessageSquare, label: 'Communication' },
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
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "w-64 h-screen bg-white border-r border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black text-primary-600 dark:text-primary-400 tracking-tighter leading-tight">Azariah Credit Ltd</h1>
            <button 
              onClick={onClose}
              className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <X className="w-5 h-5 text-slate-500" />
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
        <button
          onClick={logout}
          className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </button>
      </div>
    </aside>
  </>
  );
};

export default Sidebar;
