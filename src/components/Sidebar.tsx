import React from 'react';
import { LayoutDashboard, FileSignature, ClipboardList, Calendar, AlertTriangle, Users, BarChart3, LogOut, Droplet, X, CalendarDays, PackageSearch, Car, Map as MapIcon } from 'lucide-react';

export type Tab = 'dashboard' | 'activity' | 'tasks' | 'pms' | 'incidents' | 'staff' | 'kpi' | 'attendance' | 'inventory' | 'trip-tickets' | 'live-map';

interface SidebarProps {
  activeTab: Tab | 'live-map';
  setActiveTab: (tab: Tab | 'live-map') => void;
  currentUser: string;
  onLogout: () => void;
  isMobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ activeTab, setActiveTab, currentUser, onLogout, isMobileOpen, onClose }: SidebarProps) {
  const isAdmin = currentUser?.toLowerCase().includes('kevin vilbar') || currentUser?.toLowerCase().includes('tech head') || currentUser?.toLowerCase().includes('admin');
  
  const tabs: { id: Tab | 'live-map'; label: string; icon: React.ReactNode; hidden?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4"/> },
    { id: 'activity', label: 'Field Activity', icon: <FileSignature className="w-4 h-4"/> },
    { id: 'tasks', label: 'Tasks', icon: <ClipboardList className="w-4 h-4"/> },
    { id: 'pms', label: 'PMS', icon: <Calendar className="w-4 h-4"/> },
    { id: 'incidents', label: 'Incidents', icon: <AlertTriangle className="w-4 h-4"/> },
    { id: 'attendance', label: 'Attendance', icon: <CalendarDays className="w-4 h-4"/> },
    { id: 'inventory', label: 'Inventory (Beta)', icon: <PackageSearch className="w-4 h-4"/> },
    { id: 'trip-tickets', label: 'Trip Tickets', icon: <Car className="w-4 h-4" /> },
    { id: 'kpi', label: 'Team KPIs', icon: <BarChart3 className="w-4 h-4"/> },
    { id: 'staff', label: 'Team Management', icon: <Users className="w-4 h-4"/> },
    { id: 'live-map', label: 'Live Map', icon: <MapIcon className="w-4 h-4"/>, hidden: !isAdmin },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={onClose}
        />
      )}

      {/* Sidebar sidebar */}
      <aside className={`fixed top-0 left-0 h-screen w-64 bg-surface border-r border-outline-variant flex flex-col z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-container text-primary rounded-xl flex items-center justify-center shrink-0">
              <Droplet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-headline-sm text-on-surface font-bold">BPWI</h1>
              <p className="text-label-sm text-outline">v2.0.1 Field Ops</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden p-1 text-on-surface-variant hover:text-on-surface rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-4 py-2 flex flex-col gap-1 overflow-y-auto flex-1">
          <div className="text-label-sm font-semibold text-outline-variant px-2 mb-2 uppercase tracking-whider">Menu</div>
          {tabs.map((tab) => {
            if (tab.hidden) return null;
            const isActive = activeTab === tab.id;
            const isBottomNav = ['dashboard', 'activity', 'tasks', 'pms', 'incidents'].includes(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  onClose();
                }}
                className={`items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-left ${
                  isBottomNav ? 'hidden md:flex' : 'flex'
                } ${
                  isActive 
                    ? 'bg-primary-container text-primary font-medium' 
                    : 'text-on-surface hover:bg-surface-container-low font-normal'
                }`}
              >
              {tab.icon}
              <span className="text-sm">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-outline-variant mt-auto">
        <div className="flex items-center gap-3 p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/50 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
            {currentUser.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-label-sm text-on-surface truncate">{currentUser.split(' - ')[0]}</div>
            <div className="text-[10px] text-on-surface-variant truncate">
              {currentUser.includes('Tech Head') ? 'Technical Head' : 'Field Technician'}
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-colors text-left font-label-md"
        >
          <LogOut className="w-4 h-4"/>
          Logout
        </button>
      </div>
    </aside>
    </>
  );
}
