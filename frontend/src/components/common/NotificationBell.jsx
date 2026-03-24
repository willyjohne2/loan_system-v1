import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { loanService } from '../../api/api';
import { Link } from 'react-router-dom';

const NotificationBell = () => {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const bellRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const fetchNotifications = async () => {
      try {
        const response = await loanService.api.get('/staff-notifications/');
        if (mounted) {
          if (response.data && response.data.notifications) {
            setNotifications(response.data.notifications);
            setUnreadCount(response.data.unread_count || 0);
          } else {
            const data = response.data.results || response.data;
            const notifs = Array.isArray(data) ? data : [];
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.is_read).length);
          }
        }
      } catch (err) {
        if (mounted) {
          console.error('Error fetching notifications:', err.message);
          // Optional: Don't clear notifications on error to prevent flashing
        }
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user?.id]);

  const markAsRead = async (id) => {
    try {
      const payload = id ? { notification_ids: [id] } : {};
      await loanService.api.post('/staff-notifications/mark-read/', payload);
      if (id) {
        setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        setNotifications(notifications.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  return (
    <div className="relative" ref={bellRef}>
      <button 
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="absolute right-0 mt-2 w-72 md:w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 transition-all">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <h4 className="font-bold text-sm">Notifications</h4>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => markAsRead()}
                className="text-[10px] text-primary-600 font-bold hover:underline"
              >
                Mark all read
              </button>
              <span className="text-[10px] bg-primary-100 text-primary-600 px-2 py-1 rounded-full font-bold">
                {unreadCount} NEW
              </span>
            </div>
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
                      {notif.log_type && <span className="ml-2 text-[8px] opacity-70 px-1 border border-current rounded uppercase">{notif.log_type}</span>}
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
            <Link 
              to="/notifications" 
              onClick={() => setShowNotifications(false)}
              className="text-xs text-primary-600 font-bold hover:underline"
            >
              View All Activity
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
