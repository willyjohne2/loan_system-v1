import React, { useState, useEffect } from 'react';
import { Bell, Search, User, LogOut, Settings, ChevronDown, CheckCheck, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { loanService } from '../../api/api';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Navbar = ({ title, onMenuClick, isSidebarOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const response = await loanService.api.get('/notifications/');
      const data = response.data.results || response.data;
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setNotifications([]);
    }
  };

  const markAsRead = async (id) => {
    try {
      await loanService.api.patch(`/notifications/${id}/`, { is_read: true });
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

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
      'FIELD_OFFICER': '/field/profile'
    };
    return roleMap[user?.role] || '/login';
  };

  return (
    <header className="h-16 md:h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 transition-all">
      <div className="flex items-center gap-3 md:gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-95 group"
          title={isSidebarOpen ? "Hide Menu" : "Show Menu"}
        >
          <Menu className={cn(
            "w-6 h-6 transition-transform",
            isSidebarOpen && "rotate-180"
          )} />
        </button>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="text-sm md:text-xl font-black text-slate-900 dark:text-white truncate max-w-[140px] sm:max-w-[200px] md:max-w-none tracking-tight">
              {title}
            </h2>
          </div>
          <span className="text-[10px] text-slate-400 font-medium hidden sm:inline uppercase tracking-widest">
            Azariah Credit Ltd &bull; Dashboard
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-1 sm:space-x-3 md:space-x-6">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-800 dark:border-slate-700"
          />
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <Bell className="w-5 h-5" />
            {notifications.some(n => !n.is_read) && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 md:w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 transition-all">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h4 className="font-bold text-sm">Notifications</h4>
                <span className="text-[10px] bg-primary-100 text-primary-600 px-2 py-1 rounded-full font-bold">
                  {notifications.filter(n => !n.is_read).length} NEW
                </span>
              </div>
              <div className="max-h-[400px] overflow-y-auto pr-1">
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-4 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex gap-3 ${!notif.is_read ? 'bg-primary-50/30' : ''}`}
                    >
                      <div className="h-2 w-2 rounded-full bg-primary-500 mt-2 shrink-0 opacity-0 group-hover:opacity-100"></div>
                      <div className="flex-1">
                        <p className={`text-sm ${!notif.is_read ? 'font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(notif.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!notif.is_read && (
                        <button 
                          onClick={() => markAsRead(notif.id)}
                          className="p-1 hover:bg-white rounded text-slate-300 hover:text-primary-600"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <p className="text-sm">No notifications yet</p>
                  </div>
                )}
              </div>
              <div className="p-3 text-center border-t border-slate-100 dark:border-slate-700">
                <button className="text-xs text-primary-600 font-bold hover:underline">View All Activity</button>
              </div>
            </div>
          )}
        </div>

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
