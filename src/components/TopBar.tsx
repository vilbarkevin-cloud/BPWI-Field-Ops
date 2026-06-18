import React from 'react';
import { Menu, Bell } from 'lucide-react';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  return (
    <header className="bg-surface border-b border-outline-variant w-full top-0 sticky z-40 flex justify-between items-center px-4 md:px-6 h-14 shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-surface-container-low">
          <Menu className="w-6 h-6 text-on-surface" />
        </button>
        <span className="text-headline-md font-headline-md text-on-surface md:hidden">BPWI</span>
      </div>
      <div className="flex items-center gap-2">
        <button className="transition-colors duration-200 hover:bg-surface-container-low p-2 rounded-full">
          <Bell className="text-on-surface-variant w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
