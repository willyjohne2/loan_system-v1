import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Layout = ({ children, title }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1280);

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
        <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
