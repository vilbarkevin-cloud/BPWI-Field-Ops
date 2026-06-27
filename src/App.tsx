import React, { useState, useEffect, Suspense, lazy } from "react";
import { cleanUpOldLocalData } from "./utils/storageCleanup";
import { TopBar } from "./components/TopBar";
import { Sidebar, Tab } from "./components/Sidebar";
import { BottomNav } from "./components/BottomNav";

const DashboardView = lazy(() => import("./views/DashboardView").then(m => ({ default: m.DashboardView })));
const ActivityView = lazy(() => import("./views/ActivityView").then(m => ({ default: m.ActivityView })));
const TasksView = lazy(() => import("./views/TasksView").then(m => ({ default: m.TasksView })));
const IncidentsView = lazy(() => import("./views/IncidentsView").then(m => ({ default: m.IncidentsView })));
const PmsView = lazy(() => import("./views/PmsView").then(m => ({ default: m.PmsView })));
const StaffView = lazy(() => import("./views/StaffView").then(m => ({ default: m.StaffView })));
const KpiView = lazy(() => import("./views/KpiView").then(m => ({ default: m.KpiView })));
const AttendanceView = lazy(() => import("./views/AttendanceView").then(m => ({ default: m.AttendanceView })));
const InventoryView = lazy(() => import("./views/InventoryView").then(m => ({ default: m.InventoryView })));
const TripTicketView = lazy(() => import("./views/TripTicketView").then(m => ({ default: m.TripTicketView })));
const ChlorinationView = lazy(() => import("./views/ChlorinationView").then(m => ({ default: m.ChlorinationView })));
const FacilityView = lazy(() => import("./views/FacilityView").then(m => ({ default: m.FacilityView })));
const LoginView = lazy(() => import("./views/LoginView").then(m => ({ default: m.LoginView })));
const MapView = lazy(() => import("./views/MapView").then(m => ({ default: m.MapView })));
const SettingsView = lazy(() => import("./views/SettingsView").then(m => ({ default: m.SettingsView })));
import {
  WifiOff,
  Wifi,
  Zap,
  RefreshCw,
  X,
  FileClock,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "./lib/firebase";
import { useNetworkInfo } from "./utils/useNetworkInfo";
import { useSyncQueue } from "./utils/useSyncQueue";
import { usePushNotifications } from "./utils/usePushNotifications";
import { auth } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { hasBiometricEnrolled, verifyBiometric, isBiometricAvailable, registerBiometric } from "./utils/biometrics";

import { BiometricSetupBanner } from "./components/BiometricSetupBanner";
import { haptics } from "./utils/haptics";

import { useWakeLockManager } from "./utils/WakeLockManager";

function renderHumanReadableDiff(localData: any, remoteData: any) {
  const local = localData || {};
  const remote = remoteData || {};
  const keys = Array.from(new Set([...Object.keys(local), ...Object.keys(remote)]));
  
  const differences = keys.filter(
    (key) => JSON.stringify(local[key]) !== JSON.stringify(remote[key])
  );

  if (differences.length === 0) {
    return <span className="text-on-surface-variant italic">No readable changes detected.</span>;
  }

  return (
    <ul className="space-y-2 mt-2">
      {differences.map((key) => {
        // Skip some internal fields
        if (key === 'updatedAt' || key === 'createdAt' || key === 'isMerged' || key === 'history') return null;
        
        let localVal = local[key] === undefined ? 'N/A' : JSON.stringify(local[key]);
        let remoteVal = remote[key] === undefined ? 'N/A' : JSON.stringify(remote[key]);
        
        // Remove quotes for strings
        if (typeof local[key] === 'string') localVal = local[key];
        if (typeof remote[key] === 'string') remoteVal = remote[key];

        return (
          <li key={key} className="text-sm border-l-2 border-primary/30 pl-2 py-0.5">
            <span className="font-semibold text-on-surface capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>{" "}
            <span className="line-through text-error opacity-80">{remoteVal}</span>
            <ArrowRight className="inline w-3 h-3 mx-1 text-on-surface-variant" />
            <span className="font-medium text-success">{localVal}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab | "live-map">("dashboard");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncDrawerOpen, setIsSyncDrawerOpen] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<"field_ops" | "management">("field_ops");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) {
        return savedTheme === "dark";
      }
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  usePushNotifications(currentUid);

  const { isLowDataMode } = useNetworkInfo();
  const {
    queueCount,
    pendingItems,
    syncConflicts,
    toggleItemRetry,
    isSyncing,
    resolveConflict,
    clearCompleted,
    syncProgress,
  } = useSyncQueue();

  useWakeLockManager();

  useEffect(() => {
    // Run cleanup for old offline data
    cleanUpOldLocalData();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!currentUid) return;
    // Count open incidents
    const incQ = query(collection(db, `users/${currentUid}/incidents`));
    const invQ = query(collection(db, `users/${currentUid}/inventory`));
    let openIncidents = 0;
    let lowStock = 0;

    const unsubInc = onSnapshot(
      incQ,
      (snap) => {
        openIncidents = snap.docs.filter(
          (d) => d.data().status === "open",
        ).length;
        setNotificationCount(openIncidents + lowStock);
      },
      (error: any) => {
        if (error.code === "permission-denied") return;
        console.error("Incidents listener error:", error);
      },
    );
    const unsubInv = onSnapshot(
      invQ,
      (snap) => {
        lowStock = snap.docs.filter((d) => {
          const item = d.data();
          return item.minThreshold != null && item.minThreshold > 0 && item.currentStock <= item.minThreshold;
        }).length;
        setNotificationCount(openIncidents + lowStock);
      },
      (error: any) => {
        if (error.code === "permission-denied") return;
        console.error("Inventory listener error:", error);
      },
    );
    return () => {
      unsubInc();
      unsubInv();
    };
  }, [currentUid]);

  const [biometricStatus, setBiometricStatus] = useState<'checking' | 'verified' | 'failed' | 'not_enrolled' | 'idle'>('idle');
  const [userEmailForBiometric, setUserEmailForBiometric] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let name = user.displayName || user.email?.split("@")[0] || "User";
        const email = user.email || "";
        setUserEmailForBiometric(email);

        if (hasBiometricEnrolled(email)) {
          setBiometricStatus('checking');
          const verified = await verifyBiometric(email);
          if (verified) {
            setBiometricStatus('verified');
            setCurrentUser(name);
            setCurrentUid(user.uid);
          } else {
            setBiometricStatus('failed');
            signOut(auth);
          }
        } else {
          setBiometricStatus('not_enrolled');
          setCurrentUser(name);
          setCurrentUid(user.uid);
        }
      } else {
        setCurrentUser(null);
        setCurrentUid(null);
        setBiometricStatus('idle');
        setUserEmailForBiometric(null);
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

  if (biometricStatus === 'checking') {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
        <div className="w-[90%] max-w-[448px] bg-surface border border-outline-variant rounded-2xl shadow-lg p-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-primary-container text-primary rounded-full flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Verifying Identity</h2>
          <p className="text-on-surface-variant text-center text-sm">Please complete biometric authentication to continue.</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !currentUid) {
    return (
      <LoginView
        onLogin={(name, uid) => {
          setCurrentUser(name);
          setCurrentUid(uid);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-background text-on-surface font-body-md flex overflow-hidden">
      <div className="hide-on-print">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          currentUid={currentUid}
          onLogout={handleLogout}
          isMobileOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          dashboardMode={dashboardMode}
          setDashboardMode={setDashboardMode}
        />
      </div>

      <main className="flex-1 md:ml-64 flex flex-col h-full overflow-y-auto w-full pb-[68px] md:pb-0 relative printable-area">
        <div className="hide-on-print">
          <TopBar
            onMenuClick={() => setIsMobileMenuOpen(true)}
            notificationCount={notificationCount}
            onNotificationClick={() => setActiveTab("incidents")}
            isOnline={isOnline}
            isSyncing={isSyncing}
            queueCount={queueCount}
            currentUser={currentUser}
            toggleTheme={toggleTheme}
            isDarkMode={isDarkMode}
            searchQuery={globalSearchQuery}
            onSearchChange={setGlobalSearchQuery}
          />
        </div>

        {!isOnline && (
          <div className="bg-warning text-on-surface p-2 text-center text-sm font-semibold flex items-center justify-center gap-2 z-50 shadow-sm border-b border-warning hide-on-print">
            <WifiOff className="w-4 h-4 ml-2" />
            <span className="flex-1 text-center">Offline mode.</span>
            {queueCount > 0 && (
              <button
                onClick={() => {
                  haptics.medium();
                  setIsSyncDrawerOpen(true);
                }}
                className="bg-white/20 hover:bg-white/30 transition-colors px-2 py-0.5 rounded flex items-center gap-1.5 mr-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {queueCount} items in Sync Queue
              </button>
            )}
          </div>
        )}

        {isOnline && isLowDataMode && (
          <div className="bg-secondary/10 text-secondary p-2 text-center text-sm font-semibold flex items-center justify-center gap-2 z-50 shadow-sm border-b border-secondary/20">
            <Zap className="w-4 h-4" />
            Cellular connection detected. Low Data Mode active (Images
            auto-compressed).
          </div>
        )}

        <div className="flex-1 w-full mx-auto pb-6">
          <BiometricSetupBanner 
            isOpen={biometricStatus === 'not_enrolled'} 
            onClose={() => setBiometricStatus('idle')}
            onSuccess={() => setBiometricStatus('verified')}
            email={userEmailForBiometric}
          />
          {syncConflicts.length > 0 && (
            <div className="m-4 md:m-6 bg-error/10 border-2 border-error/50 rounded-xl p-4 shadow-sm relative animate-in fade-in zoom-in slide-in-from-top-4 duration-300">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-error shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-error">Sync Conflict Detected</h3>
                  <p className="text-body-sm text-error/80 mb-4 max-w-2xl">
                    Data collision detected while syncing. Another user has modified the same record while you were offline. Please choose how to resolve this conflict to maintain data integrity.
                  </p>
                  
                  <div className="flex flex-col gap-4">
                    {syncConflicts.map(conflict => (
                      <div key={conflict.id} className="bg-white rounded-lg border border-error/30 p-4 shadow-sm">
                        <h4 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
                           <FileClock className="w-4 h-4 text-error" /> {conflict.type}: {conflict.title}
                        </h4>
                        
                        <div className="bg-surface-container-lowest border border-outline-variant rounded p-4 mb-4">
                          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2 border-b border-outline-variant pb-2">Changes Detected</span>
                          {renderHumanReadableDiff(conflict.localData, conflict.remoteData)}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            onClick={() => {
                              haptics.success();
                              resolveConflict(conflict.id, 'mine');
                            }}
                            className="w-full py-2 bg-secondary text-white text-sm font-semibold rounded-lg hover:bg-secondary/90 transition-colors"
                          >
                            Keep My Edit
                          </button>
                          <button
                            onClick={() => {
                              haptics.success();
                              resolveConflict(conflict.id, 'theirs');
                            }}
                            className="w-full py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            Keep Cloud Version
                          </button>
                        </div>

                        <div className="flex justify-center border-t border-error/20 pt-4">
                          <button
                            onClick={() => {
                              haptics.success();
                              resolveConflict(conflict.id, 'merge', { ...conflict.remoteData, ...conflict.localData, isMerged: true });
                            }}
                            className="px-6 py-2 bg-surface text-on-surface border border-outline font-semibold rounded-lg hover:bg-surface-container transition-colors shadow-sm"
                          >
                            Merge (Keep Both / Overwrite)
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            </div>
          )}
          
          <Suspense fallback={<div className="p-6 space-y-4 animate-pulse"><div className="h-8 bg-surface-container-high rounded w-1/4"></div><div className="h-32 bg-surface-container-high rounded"></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="h-24 bg-surface-container-high rounded"></div><div className="h-24 bg-surface-container-high rounded"></div><div className="h-24 bg-surface-container-high rounded"></div></div></div>}>
            {activeTab === "dashboard" && (
              <DashboardView
                setActiveTab={setActiveTab}
                currentUid={currentUid}
                dashboardMode={dashboardMode}
              />
            )}
            {activeTab === "activity" && (
              <ActivityView
                setActiveTab={setActiveTab}
                isOnline={isOnline}
                currentUser={currentUser}
                currentUid={currentUid}
              />
            )}
            {activeTab === "tasks" && (
              <TasksView setActiveTab={setActiveTab} currentUser={currentUser} currentUid={currentUid} />
            )}
            {activeTab === "pms" && <PmsView setActiveTab={setActiveTab} currentUid={currentUid} />}
            {activeTab === "incidents" && (
              <IncidentsView setActiveTab={setActiveTab} currentUid={currentUid} currentUser={currentUser} />
            )}
            {activeTab === "attendance" && (
              <AttendanceView setActiveTab={setActiveTab} currentUser={currentUser} currentUid={currentUid} />
            )}
            {activeTab === "inventory" && (
              <InventoryView setActiveTab={setActiveTab} isOnline={isOnline} currentUid={currentUid} globalSearchQuery={globalSearchQuery} />
            )}
            {activeTab === "trip-tickets" && (
              <TripTicketView
                setActiveTab={setActiveTab}
                isOnline={isOnline}
                currentUid={currentUid}
                currentUser={currentUser}
              />
            )}
            {activeTab === "kpi" && <KpiView setActiveTab={setActiveTab} currentUid={currentUid} />}
            {activeTab === "staff" && (
              <StaffView setActiveTab={setActiveTab} currentUser={currentUser} currentUid={currentUid} globalSearchQuery={globalSearchQuery} />
            )}
            {activeTab === "live-map" && (
              <MapView setActiveTab={setActiveTab} currentUser={currentUser} currentUid={currentUid} />
            )}
            {activeTab === "chlorination" && <ChlorinationView setActiveTab={setActiveTab} currentUid={currentUid} currentUser={currentUser} />}
            {activeTab === "facilities" && <FacilityView currentUid={currentUid} setActiveTab={setActiveTab} globalSearchQuery={globalSearchQuery} />}
            {activeTab === "settings" && <SettingsView isDarkMode={isDarkMode} toggleTheme={toggleTheme} />}
          </Suspense>
        </div>
      </main>

      <div className="hide-on-print">
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Sync Status Drawer */}
      {isSyncDrawerOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex justify-end animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm h-full shadow-xl flex flex-col py-4 animate-in slide-in-from-right duration-300">
            <div className="px-5 pb-4 border-b border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileClock className="w-5 h-5 text-primary" />
                <h3 className="font-headline-sm text-on-surface">Sync Queue</h3>
              </div>
              <div className="flex items-center gap-2">
                {pendingItems.some(i => i.status === 'completed') && (
                  <button
                    onClick={() => {
                      haptics.tap();
                      clearCompleted();
                    }}
                    className="text-xs font-medium text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                  >
                    Clear Completed
                  </button>
                )}
                <button
                  onClick={() => setIsSyncDrawerOpen(false)}
                  className="p-2 -mr-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {isSyncing && syncProgress && (
              <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-primary truncate pr-2">{syncProgress.message}</span>
                  <span className="text-on-surface-variant shrink-0">{syncProgress.current} / {syncProgress.total}</span>
                </div>
                <div className="h-1.5 w-full bg-outline-variant/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-out rounded-full" 
                    style={{ width: `${Math.max(5, (syncProgress.current / syncProgress.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              {pendingItems.length === 0 ? (
                <div className="text-center py-10 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-surface-variant rounded-full flex items-center justify-center text-on-surface-variant">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                  <p className="text-on-surface-variant font-label-md mt-2">
                    All caught up!
                  </p>
                  <p className="text-body-sm text-on-surface-variant max-w-[250px]">
                    All your local changes have been successfully synced to the
                    cloud.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {!isOnline && pendingItems.some(i => i.status !== 'completed') && (
                    <div className="bg-warning/10 text-warning px-3 py-2 rounded-lg text-body-sm mb-2 font-medium flex items-start gap-2">
                      <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
                      Waiting for connection. These items will automatically sync
                      when online.
                    </div>
                  )}
                  {pendingItems.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className={`bg-surface-container border p-3 rounded-lg flex items-center justify-between gap-3 shadow-sm transition-colors ${item.status === 'completed' ? "border-success/30 opacity-70" : item.autoRetry ? "border-primary/30" : "border-outline-variant opacity-75"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`font-label-md truncate pr-2 ${item.status === 'completed' ? 'text-success' : 'text-on-surface'}`}>
                          {item.title}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-body-sm text-on-surface-variant font-medium">
                            {item.type}
                          </span>
                          {item.status !== 'completed' && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <span
                                className={`text-[10px] uppercase font-semibold transition-colors ${item.autoRetry ? "text-primary" : "text-on-surface-variant"}`}
                              >
                                Auto-Retry
                              </span>
                              <div
                                className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${item.autoRetry ? "bg-primary" : "bg-outline-variant"}`}
                              >
                                <div
                                  className={`bg-white w-3 h-3 rounded-full shadow-sm transform transition-transform ${item.autoRetry ? "translate-x-4" : "translate-x-0"}`}
                                />
                              </div>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={item.autoRetry}
                                onChange={() =>
                                  toggleItemRetry(item.id, item.type as any)
                                }
                              />
                            </label>
                          )}
                        </div>
                      </div>
                      <div
                        className={`px-2 py-1 flex items-center gap-1 text-[10px] uppercase font-bold rounded whitespace-nowrap ${item.status === 'completed' ? "bg-success/20 text-success" : item.autoRetry ? "bg-warning/20 text-warning" : "bg-surface-variant text-on-surface-variant"}`}
                      >
                        {item.status === 'completed' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            Synced
                          </>
                        ) : item.autoRetry ? "Pending" : "Deferred"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
