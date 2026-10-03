import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Prevent automatic mini-infobar
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between shadow-lg text-sm border-b border-slate-700 animate-fade-in">
      <div className="flex items-center space-x-2.5">
        <Download className="w-4 h-4 text-sky-400 shrink-0" />
        <span>Install TripSplit for offline access & faster loading</span>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={handleInstall}
          className="bg-sky-500 hover:bg-sky-600 text-white px-3 py-1 rounded-lg text-xs font-semibold transition"
        >
          Install App
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-white p-1"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
