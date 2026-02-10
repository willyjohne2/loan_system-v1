import React from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const Layout = ({ children, title }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="pl-64">
        <Navbar title={title} />
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
