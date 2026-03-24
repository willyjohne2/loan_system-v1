import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { loanService } from '../../api/api';
import { CheckCheck, Bell, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const AllNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Reusing logic but fetching potentially more or paginated
  // Ideally, backend supports pagination on /staff-notifications/
  // If not, we fetch all. Assuming existing endpoint returns limited list or all.
  // The Bell component suggests it might conform to standard DRF pagination or list.
  
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await loanService.api.get(`/staff-notifications/?page=${page}`);
      
      let newNotifs = [];
      if (response.data && response.data.results) {
          newNotifs = response.data.results;
          setHasMore(!!response.data.next);
      } else if (response.data && response.data.notifications) {
          // The structure used in Bell seems to be { notifications: [], ... } or direct array
          newNotifs = response.data.notifications;
      } else if (Array.isArray(response.data)) {
          newNotifs = response.data;
      }

      if (page === 1) {
        setNotifications(newNotifs);
      } else {
        setNotifications(prev => [...prev, ...newNotifs]);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      const payload = id ? { notification_ids: [id] } : {};
      await loanService.api.post('/staff-notifications/mark-read/', payload);
      
      if (id) {
        setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
        toast.success('Notification marked as read');
      } else {
        setNotifications(notifications.map(n => ({ ...n, is_read: true })));
        toast.success('All notifications marked as read');
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
      toast.error('Failed to update notification');
    }
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">View all your system alerts and messages</p>
          </div>
        </div>
        <button 
          onClick={() => markAsRead()}
          className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm"
        >
          <CheckCheck className="w-4 h-4" />
          Mark all as read
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading && page === 1 ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : notifications.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex gap-4 ${!notif.is_read ? 'bg-indigo-50/30' : ''}`}
              >
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!notif.is_read ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={`text-base ${!notif.is_read ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                        {notif.message}
                      </p>
                      {notif.log_type && (
                        <span className="inline-block mt-2 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500">
                          {notif.log_type}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                {!notif.is_read && (
                  <button 
                    onClick={() => markAsRead(notif.id)}
                    className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-600 transition-all self-start"
                    title="Mark as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Bell className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">No notifications</h3>
            <p className="text-slate-500 dark:text-slate-400">You're all caught up!</p>
          </div>
        )}
        
        {hasMore && (
           <div className="p-4 border-t border-slate-100 dark:border-slate-700 text-center">
             <button 
               onClick={loadMore}
               disabled={loading}
               className="text-indigo-600 hover:text-indigo-700 text-sm font-medium disabled:opacity-50"
             >
               {loading ? 'Loading...' : 'Load older notifications'}
             </button>
           </div>
        )}
      </div>
    </div>
  );
};

export default AllNotifications;
