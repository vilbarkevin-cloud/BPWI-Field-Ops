import React from "react";
import {
  Menu,
  Bell,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  UserCircle,
  Search,
  Moon,
  Sun,
} from "lucide-react";
import { haptics } from "../utils/haptics";

interface TopBarProps {
  onMenuClick: () => void;
  notificationCount?: number;
  onNotificationClick?: () => void;
  isOnline?: boolean;
  isSyncing?: boolean;
  queueCount?: number;
  currentUser?: string | null;
  toggleTheme?: () => void;
  isDarkMode?: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export function TopBar({
  onMenuClick,
  notificationCount = 0,
  onNotificationClick,
  isOnline = true,
  isSyncing = false,
  queueCount = 0,
  currentUser,
  toggleTheme,
  isDarkMode = false,
  searchQuery = "",
  onSearchChange,
}: TopBarProps) {
  return (
    <header className="border-b border-outline-variant w-full top-0 sticky z-40 flex justify-between items-center px-4 md:px-6 h-14 shrink-0 bg-white/70 backdrop-blur-md dark:bg-surface/70">
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            haptics.tap();
            onMenuClick();
          }}
          className="md:hidden p-2 -ml-2 rounded-lg hover:bg-surface-container-low"
        >
          <Menu className="w-6 h-6 text-on-surface" />
        </button>
        <span className="text-headline-md font-headline-md text-on-surface md:hidden mr-4">
          BPWI
        </span>
        
        {/* Global Search */}
        <div className="hidden md:flex items-center bg-surface-container border border-outline-variant rounded-full px-3 py-1.5 w-64 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
          <Search className="w-4 h-4 text-on-surface-variant mr-2 shrink-0" />
          <input 
            type="text" 
            placeholder="Search records, tasks..." 
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-on-surface-variant/70 text-on-surface"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Connection Status Icon */}
        <div
          className="flex items-center justify-center mr-1 gap-1.5"
          title={
            !isOnline
              ? "Offline - Saved Locally"
              : isSyncing
                ? "Syncing..."
                : "Fully Synced"
          }
        >
          {!isOnline ? (
            <>
              <CloudOff className="w-5 h-5 text-error" />
              {queueCount > 0 && (
                <span className="bg-error text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {queueCount}
                </span>
              )}
            </>
          ) : isSyncing ? (
            <>
              <RefreshCw className="w-5 h-5 text-warning animate-pulse" />
              {queueCount > 0 && (
                <span className="text-warning font-mono font-bold text-xs">{queueCount}</span>
              )}
            </>
          ) : (
            <CheckCircle2 className="w-5 h-5 text-success" />
          )}
        </div>

        <button
          onClick={() => {
            haptics.tap();
            if (toggleTheme) toggleTheme();
          }}
          className="transition-colors duration-200 hover:bg-surface-container-low p-2 rounded-full"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun className="text-on-surface-variant w-5 h-5" /> : <Moon className="text-on-surface-variant w-5 h-5" />}
        </button>

        <button
          onClick={() => {
            haptics.tap();
            if (onNotificationClick) onNotificationClick();
          }}
          className="relative transition-colors duration-200 hover:bg-surface-container-low p-2 rounded-full"
          title="Notifications"
        >
          <Bell className="text-on-surface-variant w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        {/* User Profile */}
        <div
          className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm"
          title={currentUser ? currentUser.split(' - ')[0] : "User"}
        >
          {currentUser ? (
            currentUser.split(' - ')[0].charAt(0).toUpperCase()
          ) : (
            <UserCircle className="w-5 h-5" />
          )}
        </div>
      </div>
    </header>
  );
}
