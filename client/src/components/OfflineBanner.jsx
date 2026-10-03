import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOffline } from '../hooks/useOffline';

export default function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-center space-x-2 text-center shadow-md">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>You are currently offline. Showing cached shell data. Adding/editing expenses is disabled until reconnected.</span>
    </div>
  );
}
