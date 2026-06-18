import React from 'react';
import { LayoutDashboard, FileSignature, ClipboardList, Calendar, AlertTriangle, Car } from 'lucide-react';
import { Tab } from './Sidebar';

interface BottomNavProps {
  activeTab: Tab | 'live-map';
  setActiveTab: (tab: Tab | 'live-map') => void;
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const navItems: { id: Tab; label: string; icon: React.ReactElement }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[22px] h-[22px]" /> },
    { id: 'trip-tickets', label: 'Trip Tickets', icon: <Car className="w-[22px] h-[22px]" /> },
    { id: 'tasks', label: 'Tasks', icon: <ClipboardList className="w-[22px] h-[22px]" /> },
    { id: 'pms', label: 'PMS', icon: <Calendar className="w-[22px] h-[22px]" /> },
    { id: 'activity', label: 'Activity', icon: <FileSignature className="w-[22px] h-[22px]" /> },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface border-t border-outline-variant flex justify-around items-end h-[60px] pb-1.5 px-1 z-40 bg-white">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        const isCenter = item.id === 'dashboard';
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-end w-full relative h-full ${
              isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {isCenter ? (
               <>
                 <div className={`absolute bottom-5 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform ${isActive ? 'bg-primary text-white scale-105 shadow-primary/30' : 'bg-surface text-on-surface-variant border border-outline-variant shadow-sm'}`}>
                   {React.cloneElement(item.icon as React.ReactElement<{className?: string}>, { className: 'w-6 h-6' })}
                 </div>
                 <span className={`text-[11px] font-semibold mt-auto tracking-wide ${isActive ? 'text-primary' : ''}`}>{item.label}</span>
               </>
            ) : (
               <>
                 <div className={`p-1.5 rounded-full mb-0.5 transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-variant'}`}>
                   {React.cloneElement(item.icon as React.ReactElement<{className?: string}>, { className: 'w-5 h-5' })}
                 </div>
                 <span className={`text-[11px] font-medium tracking-wide ${isActive ? 'text-primary font-bold' : ''}`}>{item.label}</span>
               </>
            )}
          </button>
        );
      })}
    </nav>
  );
}
