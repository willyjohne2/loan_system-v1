import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  Wallet, 
  FileText, 
  Settings, 
  LogOut,
  Building2,
  Users2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Sidebar = () => {
  const { user, logout } = useAuth();

  const adminLinks = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/managers', icon: Building2, label: 'Managers' },
    { to: '/admin/officers', icon: Users2, label: 'Finance Officers' },
    { to: '/admin/customers', icon: Users, label: 'Customers' },
  ];

  const managerLinks = [
    { to: '/manager/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/manager/officers', icon: Users2, label: 'Field Officers' },
    { to: '/manager/customers', icon: Users, label: 'Regional Customers' },
  ];

  const officerLinks = [
    { to: '/finance/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/finance/reports', icon: FileText, label: 'Loan Reports' },
  ];

  const fieldLinks = [
    { to: '/field/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ];

  const links = user?.role === 'ADMIN' ? adminLinks : 
                user?.role === 'MANAGER' ? managerLinks : 
                user?.role === 'FINANCIAL_OFFICER' ? officerLinks :
                fieldLinks;

  return (
    <aside className="w-64 h-screen bg-white border-r border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex flex-col fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">MicroLoan</h1>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
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
  );
};

export default Sidebar;
