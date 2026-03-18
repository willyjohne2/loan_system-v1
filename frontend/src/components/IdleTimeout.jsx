import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ShieldCheck, Clock, FileText } from 'lucide-react';
import axios from 'axios';

const IDLE_TIME = 20 * 60 * 1000; // 20 minutes
const WARNING_TIME = 2 * 60 * 1000; // 2 minute warning

export default function IdleTimeout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(WARNING_TIME / 1000);
  const timerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const countdownRef = useRef(null);

  // Function to save current form state (if any) as a draft
  const saveDraft = async () => {
    // This is a simplified check. In a real app, we'd check current URL or a global form state provider.
    const currentPath = window.location.pathname;
    if (currentPath.includes('/customers/new') || currentPath.includes('/loans/new')) {
      const formData = JSON.parse(localStorage.getItem('current_form_data')) || {};
      if (Object.keys(formData).length > 0) {
         try {
           await axios.post('/api/users/drafts/', {
             form_data: formData,
             incomplete_reason: 'AUTO_LOGOUT_IDLE',
             step_reached: 'middle' // Placeholder
           }, {
             headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
           });
           toast.success('Idle Session: Form saved to drafts');
         } catch (e) {
           console.error('Failed to save draft on idle', e);
         }
      }
    }
  };

  const resetTimer = () => {
    setShowWarning(false);
    setTimeLeft(WARNING_TIME / 1000);
    
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    timerRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, IDLE_TIME - WARNING_TIME);
  };

  const startCountdown = () => {
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLogout = async () => {
    await saveDraft();
    logout();
    navigate('/login');
    toast.error('Session expired due to inactivity');
    setShowWarning(false);
  };

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    
    resetTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [user]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-white max-w-sm w-full p-8 rounded-[32px] shadow-2xl border border-slate-100 text-center space-y-6">
        <div className="bg-amber-100/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-50">
          <Clock className="w-12 h-12 text-amber-600 animate-pulse" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Session Expiring</h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-relaxed">
            You've been idle for 20 minutes. Logging out in <span className="text-amber-600 font-black">{timeLeft}s</span>
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl flex items-start gap-4 text-left border border-slate-100">
           <FileText className="w-8 h-8 text-blue-500 shrink-0" />
           <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed">
             Security Policy: Any unsaved form data will be automatically saved to your <span className="text-blue-600">Drafts Folder</span> before disconnection.
           </p>
        </div>

        <div className="flex gap-4 pt-4">
           <button 
             onClick={handleLogout}
             className="flex-1 px-4 py-4 rounded-2xl border-2 border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
           >
             Exit Now
           </button>
           <button 
             onClick={resetTimer}
             className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all transform active:scale-95 flex items-center justify-center gap-2"
           >
             <ShieldCheck className="w-4 h-4" />
             I'm Still Here
           </button>
        </div>
      </div>
    </div>
  );
}
