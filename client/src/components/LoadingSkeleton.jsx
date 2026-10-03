import React from 'react';

export default function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
      <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl w-full"></div>
      <div className="space-y-2 pt-2">
        <div className="h-14 bg-slate-200 dark:bg-slate-800 rounded-xl w-full"></div>
        <div className="h-14 bg-slate-200 dark:bg-slate-800 rounded-xl w-full"></div>
        <div className="h-14 bg-slate-200 dark:bg-slate-800 rounded-xl w-full"></div>
      </div>
    </div>
  );
}
