import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Crown, ArrowLeft } from 'lucide-react';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Layout = ({ children, title }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1280);
  const { user, activeRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Pages where the banner should NOT show
  const noBannerPaths = [
    '/admin/settings',
    '/admin/audit',
    '/admin/security',
    '/owner',
    '/profile',
  ];

  const showGodModeBanner = user?.is_owner && 
    !noBannerPaths.some(path => location.pathname.startsWith(path));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        isSidebarOpen ? "xl:pl-64" : "pl-0"
      )}>
        <Navbar 
          title={title} 
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} 
          isSidebarOpen={isSidebarOpen}
        />
        
        {/* God Mode Banner — only shows for Owner */}
        {showGodModeBanner && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 lg:px-6 py-2 flex items-center justify-between flex-shrink-0 sticky top-16 z-10">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-700">
                God Mode Active — Viewing as{' '}
                {activeRole?.replace(/_/g, ' ') || user?.role?.replace(/_/g, ' ')}
              </span>
            </div>
            <button
              onClick={() => navigate('/owner/dashboard')}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Owner Dashboard
            </button>
          </div>
        )}

        <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
