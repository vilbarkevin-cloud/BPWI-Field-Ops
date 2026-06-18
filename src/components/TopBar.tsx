import React from 'react';
import { Menu, Bell } from 'lucide-react';

interface TopBarProps {
  onMenuClick: () => void;
  notificationCount?: number;
  onNotificationClick?: () => void;
}

export function TopBar({ onMenuClick, notificationCount = 0, onNotificationClick }: TopBarProps) {
  return (
    <header className="bg-surface border-b border-outline-variant w-full top-0 sticky z-40 flex justify-between items-center px-4 md:px-6 h-14 shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-surface-container-low">
          <Menu className="w-6 h-6 text-on-surface" />
        </button>
        <span className="text-headline-md font-headline-md text-on-surface md:hidden">BPWI</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onNotificationClick}
          className="relative transition-colors duration-200 hover:bg-surface-container-low p-2 rounded-full"
          title="Notifications"
        >
          <Bell className="text-on-surface-variant w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
