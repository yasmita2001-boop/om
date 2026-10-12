import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500/95 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-xs border border-amber-400/40 animate-in fade-in slide-in-from-bottom-2">
      <WifiOff className="h-4 w-4 shrink-0 animate-pulse" />
      <span>Offline Mode — All Om-LifeOS tools working locally</span>
    </div>
  );
};
