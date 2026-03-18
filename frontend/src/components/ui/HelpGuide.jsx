import React, { useEffect } from 'react';
import { X, HelpCircle, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

const HelpGuide = ({ isOpen, onClose, title, sections, role }) => {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[60] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide Panel */}
      <div className={cn(
        "fixed top-0 right-0 h-full w-full sm:w-[28rem] md:w-[32rem] bg-white dark:bg-slate-900 shadow-2xl z-[70] flex flex-col transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 md:w-6 md:h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white leading-tight">{title}</h2>
              <p className="text-[11px] md:text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mt-0.5">{role} Guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5 md:w-6 md:h-6 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-8 md:space-y-10">
          {sections.map((section, i) => (
            <div key={i} className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                <section.icon className="w-5 h-5 text-primary-500 shrink-0" />
                <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-200">{section.title}</h3>
              </div>
              <div className="ml-1 space-y-4 md:space-y-5">
                {section.items.map((item, j) => (
                  <div key={j} className="flex items-start gap-4 group">
                    <div className="mt-1.5 shrink-0">
                      <ChevronRight className="w-4 h-4 text-primary-400 group-hover:text-primary-500 transition-colors" />
                    </div>
                    <p className="text-sm md:text-base text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center font-medium">
            Press <kbd className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-xs font-mono shadow-sm">Esc</kbd> or click outside to close
          </p>
        </div>
      </div>
    </>
  );
};

export default HelpGuide;
