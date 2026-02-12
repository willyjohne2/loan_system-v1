import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function for Tailwind class merging
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Button Component
 */
export const Button = ({ className, variant = 'primary', loading = false, children, ...props }) => {
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
  };

  return (
    <button
      disabled={loading || props.disabled}
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 flex items-center justify-center gap-2",
        variants[variant],
        className
      )}
      {...props}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
};

/**
 * Card Component
 */
export const Card = ({ className, children }) => (
  <div className={cn("bg-white rounded-xl border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 p-6", className)}>
    {children}
  </div>
);

/**
 * Table Component
 */
export const Table = ({ headers, data, renderRow, className }) => (
  <div className={cn("overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800", className)}>
    <table className="w-full text-sm text-left">
      <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 font-medium">
        <tr>
          {headers.map((h, i) => <th key={i} className="px-6 py-4">{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
        {data.map((item, i) => renderRow(item, i))}
      </tbody>
    </table>
  </div>
);

/**
 * Stat Card
 */
export const StatCard = ({ label, value, icon: Icon, trend, trendValue, variant = 'primary', onClick }) => {
  const iconVariants = {
    primary: "bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400",
    success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    warning: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    danger: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
    info: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
  };

  const isTrendUp = typeof trend === 'object' ? trend.isPositive : trend === 'up';
  const trendLabel = typeof trend === 'object' ? trend.value : `${trendValue}%`;

  return (
    <Card 
      className={cn(
        "flex items-start justify-between p-4 md:p-6 transition-transform hover:scale-[1.02] active:scale-[0.98]",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <h3 className="text-lg md:text-2xl font-bold mt-1 text-slate-800 dark:text-white truncate">{value}</h3>
        {trend && (
          <p className={cn("text-[10px] md:text-xs font-medium mt-2 flex items-center gap-1", isTrendUp ? 'text-emerald-600' : 'text-rose-600')}>
            {isTrendUp ? '↑' : '↓'} {trendLabel}
          </p>
        )}
      </div>
      <div className={cn("p-2 md:p-3 rounded-lg shrink-0", iconVariants[variant])}>
        <Icon className="w-5 h-5 md:w-6 h-6" />
      </div>
    </Card>
  );
};

/**
 * Badge Component
 */
export const Badge = ({ children, variant = 'secondary', className }) => {
  const variants = {
    primary: "bg-primary-50 text-primary-700 border-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-900/50",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/50",
    warning: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50",
    danger: "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/50",
    info: "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/50",
    secondary: "bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
  };

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-xs font-bold border",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
};
