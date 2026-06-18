import React, { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar, Tab } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { DashboardView } from './views/DashboardView';
import { ActivityView } from './views/ActivityView';
import { TasksView } from './views/TasksView';
import { IncidentsView } from './views/IncidentsView';
import { PmsView } from './views/PmsView';
import { StaffView } from './views/StaffView';
import { KpiView } from './views/KpiView';
import { AttendanceView } from './views/AttendanceView';
import { InventoryView } from './views/InventoryView';
import { TripTicketView } from './views/TripTicketView';
import { LoginView } from './views/LoginView';
import { MapView } from './views/MapView';
import { WifiOff, Wifi, Zap, RefreshCw } from 'lucide-react';
import { useNetworkInfo } from './utils/useNetworkInfo';
import { useSyncQueue } from './utils/useSyncQueue';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab | 'live-map'>('dashboard');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const { isLowDataMode } = useNetworkInfo();
  const { queueCount } = useSyncQueue();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        let name = user.displayName || user.email?.split('@')[0] || 'User';
        if (name.toLowerCase() === 'kevin vilbar' || name.toLowerCase() === 'admin' || name.toLowerCase() === 'kevin.vilbar') {
          name = 'Kevin Vilbar - Tech Head';
        }
        setCurrentUser(name);
        setCurrentUid(user.uid);
      } else {
        setCurrentUser(null);
        setCurrentUid(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (!currentUser || !currentUid) {
    return <LoginView onLogin={(name, uid) => { setCurrentUser(name); setCurrentUid(uid); }} />;
  }

  return (
    <div className="bg-background text-on-surface min-h-[100dvh] font-body-md flex overflow-hidden">
      <div className="hide-on-print">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          currentUser={currentUser}
          onLogout={handleLogout}
          isMobileOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      </div>
      
      <main className="flex-1 md:ml-64 flex flex-col h-[100dvh] overflow-y-auto w-full pb-[68px] md:pb-0 relative printable-area">
        <div className="hide-on-print">
          <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
        </div>
        
        {!isOnline && (
          <div className="bg-warning text-on-surface p-2 text-center text-sm font-semibold flex items-center justify-center gap-2 z-50 shadow-sm border-b border-warning hide-on-print">
            <WifiOff className="w-4 h-4 ml-2" />
            <span className="flex-1 text-center">Offline mode.</span>
            {queueCount > 0 && (
              <span className="bg-white/20 px-2 py-0.5 rounded flex items-center gap-1.5 mr-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {queueCount} items in Sync Queue
              </span>
            )}
          </div>
        )}

        {isOnline && isLowDataMode && (
          <div className="bg-secondary/10 text-secondary p-2 text-center text-sm font-semibold flex items-center justify-center gap-2 z-50 shadow-sm border-b border-secondary/20">
            <Zap className="w-4 h-4" />
            Cellular connection detected. Low Data Mode active (Images auto-compressed).
          </div>
        )}
        
        <div className="flex-1 w-full mx-auto pb-6">
            {activeTab === 'dashboard' && <DashboardView setActiveTab={setActiveTab} currentUid={currentUid} />}
            {activeTab === 'activity' && <ActivityView isOnline={isOnline} currentUser={currentUser} currentUid={currentUid} />}
            {activeTab === 'tasks' && <TasksView currentUser={currentUser} currentUid={currentUid} />}
            {activeTab === 'pms' && <PmsView currentUid={currentUid} />}
            {activeTab === 'incidents' && <IncidentsView />}
            {activeTab === 'attendance' && <AttendanceView currentUser={currentUser} currentUid={currentUid} />}
            {activeTab === 'inventory' && <InventoryView isOnline={isOnline} currentUid={currentUid} />}
            {activeTab === 'trip-tickets' && <TripTicketView isOnline={isOnline} currentUid={currentUid} currentUser={currentUser} />}
            {activeTab === 'kpi' && <KpiView />}
            {activeTab === 'staff' && <StaffView currentUser={currentUser} currentUid={currentUid} />}
            {activeTab === 'live-map' && <MapView currentUser={currentUser} currentUid={currentUid} />}
        </div>
      </main>

      <div className="hide-on-print">
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}
