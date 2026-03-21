import React from 'react';

export const SkeletonCard = ({ className = '' }) => (
  <div className={`bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse ${className}`} />
);

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <div className="space-y-3">
    <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, j) => (
          <div key={j} className="h-8 bg-slate-50 dark:bg-slate-900 rounded animate-pulse" />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonStatCards = ({ count = 4 }) => (
  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${count} gap-4`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
    ))}
  </div>
);
