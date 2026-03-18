import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

const CollapsableSection = ({ icon: Icon, label, links, setSidebarOpen, activeClass, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4" />{label}
        </div>
        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-100 pl-3">
          {links.map(link => (
            <NavLink key={link.to} to={link.to} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                isActive ? activeClass : "text-slate-500 hover:bg-slate-50"
              )}>
              <link.icon className="w-4 h-4 mr-3" />{link.label}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
};

export default CollapsableSection;
