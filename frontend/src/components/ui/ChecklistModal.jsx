import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { Button } from './Shared';
import clsx from 'clsx';

const ChecklistModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  items, 
  confirmText, 
  note, 
  warning 
}) => {
  const [checkedItems, setCheckedItems] = useState({});

  useEffect(() => {
    // Reset checks when modal opens
    if (isOpen) {
      setCheckedItems({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleItem = (index) => {
    setCheckedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const allChecked = items.every((_, index) => checkedItems[index]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {title}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-3">
            {items.map((item, index) => (
              <label 
                key={index}
                className={clsx(
                  "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200",
                  checkedItems[index] 
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/50" 
                    : "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-800"
                )}
              >
                <div className="relative flex items-center pt-0.5">
                  <input
                    type="checkbox"
                    checked={!!checkedItems[index]}
                    onChange={() => toggleItem(index)}
                    className="sr-only"
                  />
                  <div className={clsx(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    checkedItems[index] 
                      ? "bg-emerald-500 border-emerald-500" 
                      : "bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600"
                  )}>
                    {checkedItems[index] && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                </div>
                <span className={clsx(
                  "text-sm font-medium transition-colors",
                  checkedItems[index] 
                    ? "text-emerald-900 dark:text-emerald-100" 
                    : "text-slate-700 dark:text-slate-300"
                )}>
                  {item}
                </span>
              </label>
            ))}
          </div>

          {note && (
            <div className="mt-6 flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50 text-blue-800 dark:text-blue-300">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-xs italic leading-relaxed">{note}</p>
            </div>
          )}

          {warning && (
            <div className="mt-4 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/50 text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-medium leading-relaxed">{warning}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-end gap-3">
          <Button 
            variant="secondary" 
            onClick={onClose}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={!allChecked}
            className={clsx(
              "w-full sm:w-auto order-1 sm:order-2 flex items-center justify-center gap-2 px-8",
              !allChecked && "opacity-50 grayscale cursor-not-allowed"
            )}
          >
            {!allChecked && <Lock className="w-4 h-4" />}
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Custom Icon for disabled state
const Lock = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

export default ChecklistModal;
