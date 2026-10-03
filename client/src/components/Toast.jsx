import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isError = toast.type === 'error';
  const isSuccess = toast.type === 'success';

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4 animate-bounce-short">
      <div
        className={`flex items-center space-x-3 p-3.5 rounded-xl shadow-xl border text-sm ${
          isError
            ? 'bg-red-900/90 text-white border-red-700'
            : isSuccess
            ? 'bg-emerald-900/90 text-white border-emerald-700'
            : 'bg-slate-800 text-white border-slate-700'
        }`}
      >
        {isError && <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
        {isSuccess && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
        {!isError && !isSuccess && <Info className="w-5 h-5 text-sky-400 shrink-0" />}
        
        <span className="flex-1 font-medium">{toast.message}</span>

        <button onClick={onClose} className="opacity-70 hover:opacity-100 p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
