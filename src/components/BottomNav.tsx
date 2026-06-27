import React, { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  FileSignature,
  ClipboardList,
  Calendar,
  AlertTriangle,
  Car,
  Activity,
  Plus
} from "lucide-react";
import { Tab } from "./Sidebar";
import { haptics } from "../utils/haptics";

interface BottomNavProps {
  activeTab: Tab | "live-map";
  setActiveTab: (tab: Tab | "live-map") => void;
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navItems: { id: Tab; label: string; icon: React.ReactElement }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-[22px] h-[22px]" />,
    },
    {
      id: "tasks",
      label: "Tasks",
      icon: <ClipboardList className="w-[22px] h-[22px]" />,
    },
    // center empty spot for FAB
    {
      id: "activity",
      label: "Activity",
      icon: <FileSignature className="w-[22px] h-[22px]" />,
    },
    {
      id: "incidents",
      label: "Incidents",
      icon: <AlertTriangle className="w-[22px] h-[22px]" />,
    },
  ];

  // handle quick actions
  const handleQuickAction = (action: string) => {
    haptics.tap();
    setIsMenuOpen(false);
    if (action === 'task') {
      setActiveTab("tasks");
      setTimeout(() => window.dispatchEvent(new Event('open-new-task')), 100);
    } else if (action === 'incident') {
      setActiveTab("incidents");
    } else if (action === 'activity') {
      setActiveTab("activity");
    } else if (action === 'pms') {
      setActiveTab("pms");
      setTimeout(() => window.dispatchEvent(new Event('open-new-pms')), 100);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Allow clicking the floating action button itself without instantly closing
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        // We only close if it's not the backdrop itself? Actually backdrop click can close.
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  return (
    <>
      {/* Quick Action Overlay & Menu */}
      {isMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[45]" 
          onClick={() => setIsMenuOpen(false)}
        />
      )}
      
      <div 
        className={`md:hidden fixed bottom-[80px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 transition-all duration-300 z-[50] ${isMenuOpen ? "opacity-100 translate-y-0 pointer-events-auto scale-100" : "opacity-0 translate-y-10 pointer-events-none scale-90"}`}
      >
        <button 
          onClick={() => handleQuickAction('incident')}
          className="bg-error text-white shadow-lg rounded-full pr-4 pl-1.5 py-1.5 flex items-center gap-2 text-sm font-semibold transition-transform active:scale-95"
        >
          <div className="bg-white/20 p-1.5 rounded-full">
            <AlertTriangle className="w-4 h-4" />
          </div>
          Incident
        </button>
        <button 
          onClick={() => handleQuickAction('activity')}
          className="bg-teal-600 text-white shadow-lg rounded-full pr-4 pl-1.5 py-1.5 flex items-center gap-2 text-sm font-semibold transition-transform active:scale-95"
        >
          <div className="bg-white/20 p-1.5 rounded-full">
            <FileSignature className="w-4 h-4" />
          </div>
          Activity
        </button>
        <button 
          onClick={() => handleQuickAction('task')}
          className="bg-primary text-white shadow-lg rounded-full pr-4 pl-1.5 py-1.5 flex items-center gap-2 text-sm font-semibold transition-transform active:scale-95"
        >
          <div className="bg-white/20 p-1.5 rounded-full">
            <ClipboardList className="w-4 h-4" />
          </div>
          Task
        </button>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 w-full border-t border-outline-variant flex justify-between items-end h-[68px] pb-2 px-2 z-40 bg-surface/90 backdrop-blur-lg">
        {navItems.slice(0, 2).map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                haptics.tap();
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center justify-end w-[20%] relative h-full ${
                isActive
                  ? "text-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <div
                className={`p-1 rounded-xl mb-1 transition-all ${isActive ? "bg-primary-container text-primary" : "hover:bg-surface-variant"}`}
              >
                {React.cloneElement(
                  item.icon as React.ReactElement<{ className?: string }>,
                  { className: "w-[22px] h-[22px]" },
                )}
              </div>
              <span
                className={`text-[10px] tracking-wide ${isActive ? "font-bold text-primary" : "font-medium"}`}
              >
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Center Quick Action FAB */}
        <div className="w-[20%] flex justify-center h-full relative z-[51]">
           <div className="absolute -top-6 bg-surface p-1.5 rounded-full z-0 pointer-events-none"></div>
          <button
            onClick={() => {
              haptics.medium();
              setIsMenuOpen(!isMenuOpen);
            }}
            className={`absolute -top-7 flex items-center justify-center w-[56px] h-[56px] rounded-full shadow-lg text-white transition-all duration-300 border-4 border-surface ${isMenuOpen ? "bg-primary rotate-45 scale-105 shadow-primary/40" : "bg-primary hover:scale-105 shadow-black/20"}`}
          >
             <Plus className="w-7 h-7" />
          </button>
        </div>

        {navItems.slice(2, 4).map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                haptics.tap();
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center justify-end w-[20%] relative h-full ${
                isActive
                  ? "text-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <div
                className={`p-1 rounded-xl mb-1 transition-all ${isActive ? "bg-primary-container text-primary" : "hover:bg-surface-variant"}`}
              >
                {React.cloneElement(
                  item.icon as React.ReactElement<{ className?: string }>,
                  { className: "w-[22px] h-[22px]" },
                )}
              </div>
              <span
                className={`text-[10px] tracking-wide ${isActive ? "font-bold text-primary" : "font-medium"}`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
