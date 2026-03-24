import React, { useState } from 'react';
import { User, ChevronDown, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import NotificationBell from '../common/NotificationBell';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Navbar = ({ title, onMenuClick, isSidebarOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const userName = user?.admin?.full_name || user?.full_name || user?.name || 'User';
  const userEmail = user?.admin?.email || user?.email || '';
  const userRole = user?.role || 'Staff';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getProfilePath = () => {
    const roleMap = {
      'ADMIN': '/admin/profile',
      'MANAGER': '/manager/profile',
      'FINANCIAL_OFFICER': '/finance/profile',
      'FIELD_OFFICER': '/field/profile',
      'OWNER': '/owner/profile'
    };
    return roleMap[user?.role] || '/login';
  };

  return (
    <header className="h-16 md:h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 transition-all">
      <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
        <button 
          onClick={onMenuClick}
          className="p-1.5 md:p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg md:rounded-xl transition-all active:scale-95 group shrink-0"
          title={isSidebarOpen ? "Hide Menu" : "Show Menu"}
        >
          <Menu className={cn(
            "w-5 h-5 md:w-6 md:h-6 transition-transform",
            isSidebarOpen && "rotate-180"
          )} />
        </button>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-lg md:text-xl font-black text-slate-900 dark:text-white truncate tracking-tight">
              {title}
            </h2>
          </div>
          <span className="text-[9px] md:text-[10px] text-slate-400 font-medium hidden sm:inline uppercase tracking-widest truncate">
            Azariah Credit Ltd &bull; Dashboard
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-1 sm:space-x-3 md:space-x-4">
        
        <NotificationBell />

        <div className="relative">
          <button
            onClick={() => {
              setShowMenu(!showMenu);
              console.log('[Navbar] Current User State:', user);
            }}
            className="flex items-center space-x-3 border-l border-slate-200 dark:border-slate-800 pl-6 hover:opacity-80 transition-opacity"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-800 dark:text-white">{userName}</p>
              <p className="text-xs text-slate-500">{userRole.replace('_', ' ')}</p>
            </div>
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 dark:bg-primary-900/40 dark:text-primary-400">
              <User className="w-6 h-6" />
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{userName}</p>
                <p className="text-xs text-slate-500 mt-1">{userEmail}</p>
              </div>
              
              <div className="p-2">
                <button 
                  onClick={() => {
                    setShowMenu(false);
                    navigate(getProfilePath());
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                >
                  <User className="w-4 h-4 mr-3" />
                  My Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
